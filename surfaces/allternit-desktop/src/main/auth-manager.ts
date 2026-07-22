import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import log from 'electron-log';
import WebSocket from 'ws';
import { URLS } from './config.js';

const RUNTIME_CLIENT_ID = 'allternit-desktop-runtime';
const PAIRING_TIMEOUT_MS = 10 * 60 * 1000;
const ROTATION_SKEW_MS = 7 * 24 * 60 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const SAFE_STORAGE_HEADER = 'allternit-safe-storage-v1\n';
const LOCAL_STORAGE_HEADER = 'allternit-local-aes-gcm-v1\n';

export interface DesktopAuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope: string;
  expiresAt: number;
  userId: string;
  userEmail: string;
  clientId: string;
  runtimeId: string;
  organizationId?: string;
  capabilities: string[];
}

interface PersistedRuntimeIdentity extends DesktopAuthSession {
  privateKeyPem: string;
  publicKey: string;
  savedAt: string;
}

interface PairingStartResponse {
  pairingId: string;
  deviceCode: string;
  userCode: string;
  challenge: string;
  verificationUrl: string;
  expiresAt: string;
  pollIntervalSeconds: number;
}

interface PairingExchangeResponse {
  runtimeId: string;
  userId: string;
  userEmail: string;
  organizationId?: string;
  deviceToken: string;
  tokenType: string;
  expiresAt: string;
  capabilities: string[];
}

interface PendingPairing {
  pairing: PairingStartResponse;
  privateKeyPem: string;
  publicKey: string;
  resolve: (session: DesktopAuthSession) => void;
  reject: (error: Error) => void;
  promise: Promise<DesktopAuthSession>;
  timeout: NodeJS.Timeout;
  exchangeInFlight: boolean;
}

export interface DesktopBackendProfile {
  mode: 'bundled' | 'remote' | 'development';
  remoteUrl?: string;
}

export interface DesktopAccountRecord {
  userId: string;
  userEmail: string;
  clientId: string;
  lastSignedInAt: string;
  lastSeenAt: string;
  current: boolean;
  backend?: DesktopBackendProfile;
}

function cloudApiBaseUrl(): string {
  return (process.env.ALLTERNIT_CLOUD_API_URL || URLS.CLOUD_API).replace(/\/$/, '');
}

function pairingSignatureMessage(pairingId: string, challenge: string): string {
  return `allternit-runtime-pairing:${pairingId}:${challenge}`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class DesktopAuthManager {
  private session: DesktopAuthSession | null = null;
  private runtimeIdentity: PersistedRuntimeIdentity | null = null;
  private pendingPairing: PendingPairing | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private relaySocket: any = null;
  private relayReconnectTimer: NodeJS.Timeout | null = null;
  private relayReconnectDelayMs = 1_000;
  private relayLocalSockets = new Map<string, WebSocket>();
  private refreshInFlight: Promise<void> | null = null;
  private readonly identityPath = path.join(app.getPath('userData'), 'auth', 'runtime-identity.json');
  private readonly platformKeyPath = path.join(app.getPath('userData'), 'auth', 'platform-encryption-key.bin');
  private readonly legacySessionPath = path.join(app.getPath('userData'), 'auth', 'desktop-session.json');
  private readonly accountsPath = path.join(app.getPath('userData'), 'auth', 'desktop-accounts.json');
  private signInResolver: ((session: DesktopAuthSession) => void) | null = null;
  private signInRejecter: ((error: Error) => void) | null = null;
  private startupGateResolver: ((session: DesktopAuthSession) => void) | null = null;
  private splashWindow: BrowserWindow | null = null;

  constructor() {
    ipcMain.on('auth:start-login', () => {
      void this.handleLoginRequest();
    });
    // Kept for older startup-window bundles. Human login method selection now
    // belongs entirely to Clerk on the Allternit pairing page.
    ipcMain.on('auth:start-google-login', () => {
      void this.handleLoginRequest();
    });
    ipcMain.on('app:quit', () => app.quit());
  }

  async initialize(): Promise<void> {
    log.info('[Auth] Initializing paired runtime identity');
    this.quarantineLegacyOAuthSession();
    this.runtimeIdentity = this.readIdentityFromDisk();
    this.session = this.runtimeIdentity ? this.toSession(this.runtimeIdentity) : null;
    if (!this.session) {
      log.info('[Auth] This desktop has not been paired yet');
      return;
    }

    await this.upsertAccountRecord(this.session);
    this.scheduleHeartbeat();
    this.connectRuntimeRelay();
    void this.refreshSessionIfNeeded()
      .then(() => this.sendHeartbeat())
      .catch((error) => {
        // Network loss must not destroy an otherwise valid local runtime
        // identity. A definitive 401/403 is handled by refresh/heartbeat.
        log.warn('[Auth] Cloud runtime validation deferred:', error);
      });
  }

  /**
   * Compatibility shim for older startup code. Pairing always uses the fixed
   * Allternit Cloud API and platform URL; it never follows the local/static UI.
   */
  setOAuthBaseUrl(_baseUrl: string): void {
    this.notifySplash('auth:ready', 'Allternit account pairing is ready');
  }

  isOAuthReady(): boolean {
    return true;
  }

  /**
   * Connector encryption is owned by Electron main, not the frequently rebuilt
   * Rust API. Packaged builds protect this key with the signed application's
   * `safeStorage`; development uses the existing authenticated local envelope
   * so rebuilds cannot trigger recurring Keychain ACL prompts.
   */
  getPlatformEncryptionEnvironment(): Record<string, string> {
    let key: string | null = null;
    if (fs.existsSync(this.platformKeyPath)) {
      try {
        key = this.decodeSecret(fs.readFileSync(this.platformKeyPath));
        if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('Connector key has an invalid format');
      } catch (error) {
        log.warn('[Auth] Connector encryption key is unreadable; replacing it:', error);
        this.quarantineCorruptFile(this.platformKeyPath);
        key = null;
      }
    }
    if (!key) {
      key = randomBytes(32).toString('hex');
      fs.mkdirSync(path.dirname(this.platformKeyPath), { recursive: true });
      fs.writeFileSync(this.platformKeyPath, this.encodeSecret(key), { mode: 0o600 });
    }
    return { ALLTERNIT_ENCRYPTION_KEY: key };
  }

  /** Main-process-only snapshot for narrow request brokering. */
  getSessionSnapshot(): DesktopAuthSession | null {
    return this.session ? { ...this.session, capabilities: [...this.session.capabilities] } : null;
  }

  hasSession(): boolean {
    return this.session !== null;
  }

  async getSession(): Promise<DesktopAuthSession | null> {
    if (!this.session) return null;
    await this.refreshSessionIfNeeded();
    return this.session;
  }

  async waitForStartupSignIn(window?: BrowserWindow): Promise<DesktopAuthSession> {
    const existing = await this.getSession();
    if (existing) return existing;

    if (process.env.ALLTERNIT_SKIP_PAIRING === '1') {
      // Local-testing escape hatch: passes the startup gate and gives the
      // renderer's desktop auth broker an in-memory stub session. Nothing is
      // persisted, so the next launch without the env var returns to the
      // normal pairing flow. The far-future expiry keeps refreshSessionIfNeeded
      // from ever calling the cloud rotate endpoint for this fake identity.
      log.warn('[Auth] ALLTERNIT_SKIP_PAIRING=1 — skipping runtime pairing for local testing');
      this.session = {
        accessToken: '',
        refreshToken: '',
        tokenType: 'Bearer',
        scope: '',
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        userId: 'local-test',
        userEmail: 'local-test@localhost',
        clientId: RUNTIME_CLIENT_ID,
        runtimeId: 'local-test',
        capabilities: [],
      };
      return this.session;
    }

    this.splashWindow = window || BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed()) || null;
    this.notifySplash('auth:ready', 'Allternit account pairing is ready');
    log.info('[Auth] Startup gate is waiting for runtime pairing');
    return new Promise((resolve) => {
      this.startupGateResolver = resolve;
    });
  }

  async ensureAuthenticated(window?: BrowserWindow): Promise<DesktopAuthSession> {
    const existing = await this.getSession();
    if (existing) return existing;
    this.splashWindow = window || BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed()) || null;
    this.notifySplash('auth:ready', 'Allternit account pairing is ready');
    this.notifySplash('auth-required', 'Pair this runtime with your Allternit account');
    return new Promise((resolve, reject) => {
      this.signInResolver = resolve;
      this.signInRejecter = reject;
    });
  }

  async signOut(): Promise<void> {
    const current = this.session;
    const token = current?.accessToken;
    const runtimeId = current?.runtimeId;
    this.clearPendingPairing(new Error('Pairing interrupted by sign-out'));

    if (token && runtimeId) {
      try {
        await fetch(`${cloudApiBaseUrl()}/api/v1/runtime-devices/${encodeURIComponent(runtimeId)}/revoke-self`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        log.warn('[Auth] Could not notify cloud of runtime sign-out:', error);
      }
    }

    this.clearSession();
    await this.clearCurrentAccountFlag();
  }

  /** Handles the optional deep link used to return browser focus to desktop. */
  async handleCallbackUrl(callbackUrl: string): Promise<boolean> {
    const url = new URL(callbackUrl);
    if (url.protocol !== 'allternit:' || url.hostname !== 'pairing' || url.pathname !== '/complete') {
      return false;
    }
    const pairingId = url.searchParams.get('pairing_id');
    if (pairingId && this.pendingPairing?.pairing.pairingId === pairingId) {
      this.notifySplash('auth:login-started', 'Approved — securely pairing this runtime…');
      void this.exchangePendingPairing(this.pendingPairing);
    }
    return true;
  }

  async listAccounts(): Promise<DesktopAccountRecord[]> {
    const accounts = this.readAccountsFromDisk();
    return accounts.sort((left, right) => {
      if (left.current !== right.current) return left.current ? -1 : 1;
      return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
    });
  }

  async forgetAccount(userId: string): Promise<void> {
    if (this.session?.userId === userId) return;
    this.writeAccountsToDisk(this.readAccountsFromDisk().filter((account) => account.userId !== userId));
  }

  async updateBackendProfile(profile: DesktopBackendProfile): Promise<void> {
    if (!this.session) return;
    const accounts = this.readAccountsFromDisk();
    const next = accounts.map((account) => account.userId === this.session?.userId
      ? {
          ...account,
          backend: profile.mode === 'remote'
            ? { mode: profile.mode, remoteUrl: profile.remoteUrl }
            : { mode: profile.mode },
          lastSeenAt: new Date().toISOString(),
        }
      : account);
    this.writeAccountsToDisk(next);
  }

  private async handleLoginRequest(): Promise<void> {
    const visibleWindow = this.splashWindow
      || BrowserWindow.getAllWindows().find((candidate) => candidate.isVisible() && !candidate.isDestroyed());
    visibleWindow?.setAlwaysOnTop(false);
    this.notifySplash('auth:login-started', 'Opening Allternit in your browser…');

    try {
      const session = await this.startPairing();
      this.notifySplash('auth:login-success', 'Runtime paired — starting Allternit…');
      this.signInResolver?.(session);
      this.signInResolver = null;
      this.signInRejecter = null;
      this.startupGateResolver?.(session);
      this.startupGateResolver = null;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error('Runtime pairing failed');
      this.notifySplash('auth:login-failed', failure.message);
      this.signInRejecter?.(failure);
      this.signInResolver = null;
      this.signInRejecter = null;
    }
  }

  private async startPairing(): Promise<DesktopAuthSession> {
    if (this.pendingPairing) return this.pendingPairing.promise;

    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });
    const publicKeyRaw = publicKeyDer.subarray(publicKeyDer.length - 32).toString('base64url');
    const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const response = await fetch(`${cloudApiBaseUrl()}/api/v1/runtime-pairings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${os.hostname()} Desktop`,
        runtimeType: 'desktop',
        hostname: os.hostname(),
        platform: `${process.platform}-${process.arch}`,
        version: app.getVersion(),
        publicKey: publicKeyRaw,
      }),
    });
    if (!response.ok) {
      throw new Error(`Allternit pairing is unavailable (${response.status})`);
    }
    const pairing = await response.json() as PairingStartResponse;

    let resolvePairing!: (session: DesktopAuthSession) => void;
    let rejectPairing!: (error: Error) => void;
    const promise = new Promise<DesktopAuthSession>((resolve, reject) => {
      resolvePairing = resolve;
      rejectPairing = reject;
    });
    const timeout = setTimeout(() => {
      this.clearPendingPairing(new Error('Pairing expired. Choose Continue with Allternit to try again.'));
    }, PAIRING_TIMEOUT_MS);
    const pending: PendingPairing = {
      pairing,
      privateKeyPem,
      publicKey: publicKeyRaw,
      resolve: resolvePairing,
      reject: rejectPairing,
      promise,
      timeout,
      exchangeInFlight: false,
    };
    this.pendingPairing = pending;

    this.notifySplash(
      'auth:login-started',
      `Approve ${pairing.userCode} in your browser. This window will continue automatically.`,
    );
    await shell.openExternal(pairing.verificationUrl);
    void this.pollPairing(pending);
    return promise;
  }

  private async pollPairing(pending: PendingPairing): Promise<void> {
    const interval = Math.max(pending.pairing.pollIntervalSeconds || 2, 2) * 1000;
    while (this.pendingPairing === pending) {
      const completed = await this.exchangePendingPairing(pending);
      if (completed || this.pendingPairing !== pending) return;
      await sleep(interval);
    }
  }

  private async exchangePendingPairing(pending: PendingPairing): Promise<boolean> {
    if (pending.exchangeInFlight || this.pendingPairing !== pending) return false;
    pending.exchangeInFlight = true;
    try {
      const message = pairingSignatureMessage(pending.pairing.pairingId, pending.pairing.challenge);
      const signature = sign(null, Buffer.from(message, 'utf8'), pending.privateKeyPem).toString('base64url');
      const response = await fetch(`${cloudApiBaseUrl()}/api/v1/runtime-pairings/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingId: pending.pairing.pairingId,
          deviceCode: pending.pairing.deviceCode,
          signature,
        }),
      });
      if (response.status === 428) return false;
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
        if (response.status >= 500) return false;
        throw new Error(payload?.message || payload?.error || `Pairing failed (${response.status})`);
      }

      const exchange = await response.json() as PairingExchangeResponse;
      const identity: PersistedRuntimeIdentity = {
        accessToken: exchange.deviceToken,
        refreshToken: '',
        tokenType: exchange.tokenType || 'Bearer',
        scope: exchange.capabilities.join(' '),
        expiresAt: new Date(exchange.expiresAt).getTime(),
        userId: exchange.userId,
        userEmail: exchange.userEmail,
        clientId: RUNTIME_CLIENT_ID,
        runtimeId: exchange.runtimeId,
        organizationId: exchange.organizationId,
        capabilities: exchange.capabilities,
        privateKeyPem: pending.privateKeyPem,
        publicKey: pending.publicKey,
        savedAt: new Date().toISOString(),
      };
      this.persistIdentity(identity);
      await this.upsertAccountRecord(identity);
      clearTimeout(pending.timeout);
      this.pendingPairing = null;
      pending.resolve(this.toSession(identity));
      this.scheduleHeartbeat();
      this.connectRuntimeRelay();
      return true;
    } catch (error) {
      if (error instanceof TypeError) {
        log.warn('[Auth] Pairing poll could not reach Allternit Cloud; retrying');
        return false;
      }
      this.clearPendingPairing(error instanceof Error ? error : new Error('Pairing failed'));
      return true;
    } finally {
      pending.exchangeInFlight = false;
    }
  }

  private async refreshSessionIfNeeded(): Promise<void> {
    if (!this.session || this.session.expiresAt - Date.now() > ROTATION_SKEW_MS) return;
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.rotateCredential();
    try {
      await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  private async rotateCredential(): Promise<void> {
    if (!this.session || !this.runtimeIdentity) return;
    const response = await fetch(
      `${cloudApiBaseUrl()}/api/v1/runtime-devices/${encodeURIComponent(this.session.runtimeId)}/rotate`,
      { method: 'POST', headers: { Authorization: `Bearer ${this.session.accessToken}` } },
    );
    if (response.status === 401 || response.status === 403) {
      this.clearSession();
      await this.clearCurrentAccountFlag();
      throw new Error('This runtime was revoked. Pair it with Allternit again.');
    }
    if (!response.ok) throw new Error(`Runtime credential rotation failed (${response.status})`);
    const rotated = await response.json() as { deviceToken: string; expiresAt: string };
    this.persistIdentity({
      ...this.runtimeIdentity,
      accessToken: rotated.deviceToken,
      expiresAt: new Date(rotated.expiresAt).getTime(),
      savedAt: new Date().toISOString(),
    });
    this.reconnectRuntimeRelay();
  }

  private scheduleHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (!this.session) return;
    this.heartbeatTimer = setInterval(() => {
      void this.sendHeartbeat().catch((error) => log.warn('[Auth] Runtime heartbeat deferred:', error));
    }, HEARTBEAT_INTERVAL_MS);
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.session) return;
    const response = await fetch(
      `${cloudApiBaseUrl()}/api/v1/runtime-devices/${encodeURIComponent(this.session.runtimeId)}/heartbeat`,
      { method: 'POST', headers: { Authorization: `Bearer ${this.session.accessToken}` } },
    );
    if (response.status === 401 || response.status === 403) {
      this.clearSession();
      await this.clearCurrentAccountFlag();
      this.notifySplash('auth:login-failed', 'This runtime was revoked. Pair it again to continue.');
      return;
    }
    if (!response.ok) throw new Error(`Runtime heartbeat failed (${response.status})`);
  }

  private persistIdentity(identity: PersistedRuntimeIdentity): void {
    this.runtimeIdentity = identity;
    this.session = this.toSession(identity);
    fs.mkdirSync(path.dirname(this.identityPath), { recursive: true });
    fs.writeFileSync(this.identityPath, this.encodeSecret(JSON.stringify(identity)));
  }

  private readIdentityFromDisk(): PersistedRuntimeIdentity | null {
    if (!fs.existsSync(this.identityPath)) return null;
    try {
      const parsed = JSON.parse(this.decodeSecret(fs.readFileSync(this.identityPath))) as PersistedRuntimeIdentity;
      if (!parsed.runtimeId || !parsed.accessToken || !parsed.privateKeyPem || !parsed.userId) {
        throw new Error('Runtime identity is incomplete');
      }
      return parsed;
    } catch (error) {
      log.warn('[Auth] Runtime identity is unreadable:', error);
      this.quarantineCorruptFile(this.identityPath);
      return null;
    }
  }

  private toSession(identity: PersistedRuntimeIdentity): DesktopAuthSession {
    const { privateKeyPem: _privateKeyPem, publicKey: _publicKey, savedAt: _savedAt, ...session } = identity;
    return session;
  }

  private clearSession(): void {
    this.session = null;
    this.runtimeIdentity = null;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.relayReconnectTimer) {
      clearTimeout(this.relayReconnectTimer);
      this.relayReconnectTimer = null;
    }
    if (this.relaySocket) {
      this.relaySocket.close();
      this.relaySocket = null;
    }
    fs.rmSync(this.identityPath, { force: true });
  }

  private connectRuntimeRelay(): void {
    if (!this.session || this.relaySocket) return;
    const runtimeId = this.session.runtimeId;
    const relayUrl = new URL(`${cloudApiBaseUrl()}/api/v1/runtime-relay/connect/${encodeURIComponent(runtimeId)}`);
    relayUrl.protocol = relayUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(relayUrl.toString());
    this.relaySocket = socket;

    socket.addEventListener('open', () => {
      if (!this.session || this.session.runtimeId !== runtimeId) return socket.close();
      socket.send(JSON.stringify({
        type: 'authenticate',
        runtime_id: runtimeId,
        device_token: this.session.accessToken,
      }));
    });
    socket.addEventListener('message', (event: { data: unknown }) => {
      const text = typeof event.data === 'string' ? event.data : Buffer.from(event.data as ArrayBuffer).toString('utf8');
      let message: any;
      try { message = JSON.parse(text); } catch { return; }
      if (message.type === 'authenticated') {
        this.relayReconnectDelayMs = 1_000;
        log.info('[Auth] Paired runtime relay connected');
      } else if (message.type === 'request') {
        void this.handleRelayRequest(socket, message);
      } else if (message.type === 'socket_open') {
        this.handleRelaySocketOpen(socket, message);
      } else if (message.type === 'socket_data') {
        this.handleRelaySocketData(message);
      } else if (message.type === 'socket_close') {
        this.handleRelaySocketClose(message);
      } else if (message.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
      }
    });
    socket.addEventListener('close', () => {
      if (this.relaySocket === socket) this.relaySocket = null;
      for (const local of this.relayLocalSockets.values()) local.close(1012, 'Relay disconnected');
      this.relayLocalSockets.clear();
      if (this.session) this.scheduleRelayReconnect();
    });
    socket.addEventListener('error', (error: unknown) => {
      log.warn('[Auth] Runtime relay connection error:', error);
    });
  }

  private async handleRelayRequest(socket: any, message: any): Promise<void> {
    const requestId = typeof message.request_id === 'string' ? message.request_id : '';
    const method = typeof message.method === 'string' ? message.method.toUpperCase() : 'GET';
    const requestPath = typeof message.path === 'string' ? message.path : '';
    if (!requestId || !requestPath.startsWith('/') || requestPath.includes('..') || requestPath.includes('://')) return;
    const allowedPrefixes = [
      '/api/', '/viz', '/sandbox', '/vm-session', '/rails', '/stream',
      '/terminal', '/mcp', '/platform', '/metrics', '/alabs', '/cowork',
      '/webhooks', '/status', '/health',
      '/ws', '/panes',
    ];
    if (!allowedPrefixes.some((prefix) => requestPath.startsWith(prefix))) return;

    try {
      const headers = new Headers(message.headers || {});
      const session = this.session;
      if (!session) throw new Error('Runtime is no longer paired');
      headers.set('Authorization', `Bearer ${session.accessToken}`);
      headers.set('X-Allternit-Desktop-Access-Token', session.accessToken);
      headers.set('X-Allternit-User-Id', session.userId);
      headers.set('X-Allternit-User-Email', session.userEmail);
      if (session.organizationId) headers.set('X-Allternit-Tenant-Id', session.organizationId);
      const body = method === 'GET' || method === 'HEAD' || !message.body
        ? undefined
        : message.body_encoding === 'base64'
          ? Buffer.from(message.body, 'base64')
          : Buffer.from(message.body, 'utf8');
      const response = await fetch(`${URLS.API}${requestPath}`, { method, headers, body });
      const responseHeaders: Record<string, string> = {};
      for (const name of ['content-type', 'cache-control', 'content-disposition', 'etag', 'last-modified', 'x-request-id']) {
        const value = response.headers.get(name);
        if (value) responseHeaders[name] = value;
      }
      socket.send(JSON.stringify({
        type: 'response_start',
        request_id: requestId,
        status: response.status,
        headers: responseHeaders,
      }));
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value?.byteLength) {
            socket.send(JSON.stringify({
              type: 'response_chunk',
              request_id: requestId,
              body: Buffer.from(value).toString('base64'),
              body_encoding: 'base64',
            }));
          }
        }
      }
      socket.send(JSON.stringify({ type: 'response_end', request_id: requestId }));
    } catch (error) {
      socket.send(JSON.stringify({
        type: 'response_start',
        request_id: requestId,
        status: 502,
        headers: { 'content-type': 'application/json' },
      }));
      socket.send(JSON.stringify({
        type: 'response_chunk',
        request_id: requestId,
        body: Buffer.from(JSON.stringify({ error: 'runtime_proxy_error', message: String(error) })).toString('base64'),
        body_encoding: 'base64',
      }));
      socket.send(JSON.stringify({ type: 'response_end', request_id: requestId }));
    }
  }

  private handleRelaySocketOpen(relay: WebSocket, message: any): void {
    const socketId = typeof message.socket_id === 'string' ? message.socket_id : '';
    const requestPath = typeof message.path === 'string' ? message.path : '';
    const allowedPrefixes = [
      '/api/', '/viz', '/sandbox', '/vm-session', '/rails', '/stream',
      '/terminal', '/mcp', '/platform', '/metrics', '/alabs', '/cowork',
      '/webhooks', '/ws', '/panes', '/status', '/health',
    ];
    if (!socketId || !requestPath.startsWith('/') || requestPath.includes('..')
      || requestPath.includes('://') || !allowedPrefixes.some((prefix) => requestPath.startsWith(prefix))) return;
    this.relayLocalSockets.get(socketId)?.close();
    const session = this.session;
    if (!session) return;
    const local = new WebSocket(`${URLS.API.replace(/^http/, 'ws')}${requestPath}`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'X-Allternit-Desktop-Access-Token': session.accessToken,
        'X-Allternit-User-Id': session.userId,
        'X-Allternit-User-Email': session.userEmail,
        ...(session.organizationId ? { 'X-Allternit-Tenant-Id': session.organizationId } : {}),
      },
    });
    this.relayLocalSockets.set(socketId, local);
    local.on('open', () => {
      if (relay.readyState === WebSocket.OPEN) relay.send(JSON.stringify({ type: 'socket_ready', socket_id: socketId }));
    });
    local.on('message', (data: any, isBinary: boolean) => {
      if (relay.readyState !== WebSocket.OPEN) return;
      relay.send(JSON.stringify({
        type: 'socket_data',
        socket_id: socketId,
        body: isBinary ? Buffer.from(data).toString('base64') : data.toString(),
        body_encoding: isBinary ? 'base64' : 'utf8',
      }));
    });
    local.on('close', (code: number, reason: Buffer) => {
      this.relayLocalSockets.delete(socketId);
      if (relay.readyState === WebSocket.OPEN) {
        relay.send(JSON.stringify({ type: 'socket_close', socket_id: socketId, code, reason: reason.toString() }));
      }
    });
    local.on('error', (error: Error) => {
      log.warn('[Auth] Local runtime socket error:', error.message);
      local.close(1011, 'Local runtime socket failed');
    });
  }

  private handleRelaySocketData(message: any): void {
    const local = this.relayLocalSockets.get(message.socket_id);
    if (!local || local.readyState !== WebSocket.OPEN) return;
    local.send(message.body_encoding === 'base64'
      ? Buffer.from(String(message.body || ''), 'base64')
      : String(message.body || ''));
  }

  private handleRelaySocketClose(message: any): void {
    const local = this.relayLocalSockets.get(message.socket_id);
    if (!local) return;
    this.relayLocalSockets.delete(message.socket_id);
    const code = Number(message.code) >= 1000 && Number(message.code) <= 4999 ? Number(message.code) : 1000;
    local.close(code, String(message.reason || ''));
  }

  private scheduleRelayReconnect(): void {
    if (this.relayReconnectTimer || !this.session) return;
    const delay = this.relayReconnectDelayMs;
    this.relayReconnectDelayMs = Math.min(this.relayReconnectDelayMs * 2, 30_000);
    this.relayReconnectTimer = setTimeout(() => {
      this.relayReconnectTimer = null;
      this.connectRuntimeRelay();
    }, delay);
  }

  private reconnectRuntimeRelay(): void {
    if (this.relaySocket) {
      this.relaySocket.close();
      this.relaySocket = null;
    }
    for (const socket of this.relayLocalSockets.values()) socket.close(1012, 'Relay reconnecting');
    this.relayLocalSockets.clear();
    this.scheduleRelayReconnect();
  }

  private clearPendingPairing(error?: Error): void {
    const pending = this.pendingPairing;
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingPairing = null;
    if (error) pending.reject(error);
  }

  private async upsertAccountRecord(session: DesktopAuthSession): Promise<void> {
    const accounts = this.readAccountsFromDisk();
    const now = new Date().toISOString();
    let found = false;
    const next = accounts.map((account) => {
      if (account.userId !== session.userId) return { ...account, current: false };
      found = true;
      return {
        ...account,
        userEmail: session.userEmail,
        clientId: session.runtimeId,
        current: true,
        lastSeenAt: now,
        lastSignedInAt: account.lastSignedInAt || now,
      };
    });
    if (!found) {
      next.push({
        userId: session.userId,
        userEmail: session.userEmail,
        clientId: session.runtimeId,
        lastSignedInAt: now,
        lastSeenAt: now,
        current: true,
      });
    }
    this.writeAccountsToDisk(next);
  }

  private async clearCurrentAccountFlag(): Promise<void> {
    this.writeAccountsToDisk(this.readAccountsFromDisk().map((account) => (
      account.current ? { ...account, current: false } : account
    )));
  }

  private readAccountsFromDisk(): DesktopAccountRecord[] {
    if (!fs.existsSync(this.accountsPath)) return [];
    try {
      const raw = fs.readFileSync(this.accountsPath);
      let json: string;
      try {
        json = raw.toString('utf8');
        JSON.parse(json);
      } catch {
        json = this.decodeLegacyLocalEncryption(raw);
      }
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed.filter((account) => (
        account && typeof account.userId === 'string' && typeof account.userEmail === 'string'
      )) : [];
    } catch (error) {
      log.warn('[Auth] Account registry is unreadable:', error);
      this.quarantineCorruptFile(this.accountsPath);
      return [];
    }
  }

  private writeAccountsToDisk(accounts: DesktopAccountRecord[]): void {
    fs.mkdirSync(path.dirname(this.accountsPath), { recursive: true });
    fs.writeFileSync(this.accountsPath, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  }

  private encodeSecret(value: string): Buffer {
    // In production Electron's signed main process is the sole Keychain owner.
    // Dev builds use authenticated local encryption so rebuilding the API or
    // Electron does not cause repeated macOS Keychain prompts.
    if (app.isPackaged && safeStorage.isEncryptionAvailable()) {
      return Buffer.from(`${SAFE_STORAGE_HEADER}${safeStorage.encryptString(value).toString('base64')}`, 'utf8');
    }
    const key = this.localHardwareKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
    return Buffer.from(`${LOCAL_STORAGE_HEADER}${payload}`, 'utf8');
  }

  private decodeSecret(raw: Buffer): string {
    const value = raw.toString('utf8');
    if (value.startsWith(SAFE_STORAGE_HEADER)) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('macOS credential storage is unavailable');
      return safeStorage.decryptString(Buffer.from(value.slice(SAFE_STORAGE_HEADER.length), 'base64'));
    }
    if (value.startsWith(LOCAL_STORAGE_HEADER)) {
      const payload = Buffer.from(value.slice(LOCAL_STORAGE_HEADER.length), 'base64');
      const iv = payload.subarray(0, 12);
      const tag = payload.subarray(12, 28);
      const ciphertext = payload.subarray(28);
      const decipher = createDecipheriv('aes-256-gcm', this.localHardwareKey(), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    }
    throw new Error('Unknown runtime identity format');
  }

  private localHardwareKey(): Buffer {
    return createHash('sha256')
      .update(os.hostname())
      .update(os.userInfo().username)
      .update(os.platform())
      .update(os.arch())
      .update('allternit-desktop-runtime-v2')
      .digest();
  }

  private decodeLegacyLocalEncryption(raw: Buffer): string {
    const key = createHash('sha256')
      .update(os.hostname())
      .update(os.userInfo().username)
      .update(os.platform())
      .update(os.arch())
      .update('allternit-desktop-salt-v1')
      .digest();
    const decipher = createDecipheriv('aes-256-cbc', key, raw.subarray(0, 16));
    return Buffer.concat([decipher.update(raw.subarray(16)), decipher.final()]).toString('utf8');
  }

  private quarantineLegacyOAuthSession(): void {
    if (!fs.existsSync(this.legacySessionPath)) return;
    try {
      fs.renameSync(this.legacySessionPath, `${this.legacySessionPath}.legacy-oauth-${Date.now()}`);
      log.info('[Auth] Retired legacy desktop OAuth session; runtime pairing is required once');
    } catch (error) {
      log.warn('[Auth] Could not retire legacy OAuth session:', error);
    }
  }

  private quarantineCorruptFile(filePath: string): void {
    if (!fs.existsSync(filePath)) return;
    try {
      fs.renameSync(filePath, `${filePath}.corrupt-${Date.now()}`);
    } catch {
      fs.rmSync(filePath, { force: true });
    }
  }

  private notifySplash(channel: string, message: string): void {
    const window = this.splashWindow
      || BrowserWindow.getAllWindows().find((candidate) => candidate.isVisible() && !candidate.isDestroyed());
    if (window && !window.isDestroyed()) window.webContents.send(channel, message);
  }
}

export const authManager = new DesktopAuthManager();
