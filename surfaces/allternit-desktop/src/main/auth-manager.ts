import { app, dialog, safeStorage, shell, BrowserWindow, ipcMain } from 'electron';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import log from 'electron-log';

const DESKTOP_CLIENT_ID = 'allternit-desktop';
const DESKTOP_CALLBACK_URI = 'allternit://auth/callback';
const OAUTH_DEV_BASE_URL = 'http://localhost:3013';
const OAUTH_PROD_BASE_URL = 'https://platform.allternit.com';
const SESSION_REFRESH_SKEW_MS = 5 * 60 * 1000;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

export interface DesktopAuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope: string;
  expiresAt: number;
  userId: string;
  userEmail: string;
  clientId: string;
}

interface PendingAuthState {
  state: string;
  verifier: string;
  resolve: (session: DesktopAuthSession) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface PersistedDesktopAuthSession extends DesktopAuthSession {
  savedAt: string;
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

type PersistedFileMode = 'encrypted' | 'local-hardware' | 'plaintext';

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function resolveOAuthBaseUrl(): string {
  if (process.env.ALLTERNIT_OAUTH_BASE_URL) {
    return process.env.ALLTERNIT_OAUTH_BASE_URL;
  }

  if (process.env.NODE_ENV === 'development') {
    return OAUTH_DEV_BASE_URL;
  }

  return OAUTH_PROD_BASE_URL;
}

export class DesktopAuthManager {
  private session: DesktopAuthSession | null = null;
  private pendingAuth: PendingAuthState | null = null;
  private deferredCallbackUrl: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly sessionPath = path.join(app.getPath('userData'), 'auth', 'desktop-session.json');
  private readonly accountsPath = path.join(app.getPath('userData'), 'auth', 'desktop-accounts.json');
  private signInResolver: ((session: DesktopAuthSession) => void) | null = null;
  private signInRejecter: ((error: Error) => void) | null = null;
  private splashWindow: BrowserWindow | null = null;

  constructor() {
    // Listen for login trigger from splash screen
    ipcMain.on('auth:start-login', async () => {
      // Lower splash window so browser can come to front
      const splash = BrowserWindow.getAllWindows().find(w => w.isVisible() && !w.isDestroyed());
      if (splash) {
        splash.setAlwaysOnTop(false);
      }
      this.notifySplash('auth:login-started', 'Browser opened — complete sign in to continue');
      try {
        const session = await this.startInteractiveSignIn();
        this.notifySplash('auth:login-success', 'Sign in complete — starting up...');
        if (this.signInResolver) {
          this.signInResolver(session);
          this.signInResolver = null;
          this.signInRejecter = null;
        }
      } catch (err) {
        this.notifySplash('auth:login-failed', (err as Error).message);
        if (this.signInRejecter) {
          this.signInRejecter(err as Error);
          this.signInResolver = null;
          this.signInRejecter = null;
        }
      }
    });

    ipcMain.on('app:quit', () => {
      app.quit();
    });
  }

  private notifySplash(channel: string, message: string): void {
    const win = this.splashWindow || BrowserWindow.getAllWindows().find(w => w.isVisible() && !w.isDestroyed());
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, message);
    }
  }

  async initialize(): Promise<void> {
    log.info('[Auth] Initializing DesktopAuthManager...');
    log.info('[Auth] Session path:', this.sessionPath);
    log.info('[Auth] Accounts path:', this.accountsPath);

    this.session = await this.readSessionFromDisk();
    if (this.session) {
      await this.upsertAccountRecord(this.session);
    } else {
      log.info('[Auth] No persisted desktop session; skipping account registry read during startup');
    }
  }

  getAccessToken(): string | null {
    return this.session?.accessToken ?? null;
  }

  async getSession(): Promise<DesktopAuthSession | null> {
    if (!this.session) {
      return null;
    }

    await this.refreshSessionIfNeeded();
    return this.session;
  }

  async ensureAuthenticated(window?: BrowserWindow): Promise<DesktopAuthSession> {
    log.info('[Auth] Checking for existing session...');
    const existing = await this.getSession();
    if (existing) {
      log.info('[Auth] Existing session found:', existing.userId);
      return existing;
    }

    log.info('[Auth] No session found, requesting splash screen to show login prompt...');
    
    // Use the provided window or find it
    this.splashWindow = window || BrowserWindow.getAllWindows().find(w => !w.isDestroyed()) || null;
    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      this.splashWindow.setAlwaysOnTop(false);
      this.splashWindow.webContents.send('auth-required');
    }

    return new Promise((resolve, reject) => {
      this.signInResolver = resolve;
      this.signInRejecter = reject;
    });
  }

  async signOut(): Promise<void> {
    const current = this.session;
    this.clearPendingAuth(new Error('Authentication interrupted by sign-out'));
    await this.clearSession();
    await this.clearCurrentAccountFlag();

    if (!current) {
      return;
    }

    try {
      await fetch(`${resolveOAuthBaseUrl()}/api/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: current.refreshToken,
          token_type_hint: 'refresh_token',
          client_id: DESKTOP_CLIENT_ID,
        }),
      });
    } catch (error) {
      log.warn('[Auth] Refresh token revoke failed during sign-out:', error);
    }
  }

  async handleCallbackUrl(callbackUrl: string): Promise<boolean> {
    log.info('[Auth] handleCallbackUrl entered with URL:', callbackUrl);
    const url = new URL(callbackUrl);
    log.info('[Auth] Parsed URL components:', {
      protocol: url.protocol,
      hostname: url.hostname,
      pathname: url.pathname,
      params: Array.from(url.searchParams.keys())
    });

    if (url.protocol !== 'allternit:' || url.hostname !== 'auth' || url.pathname !== '/callback') {
      log.warn('[Auth] Callback URL does not match expected pattern (allternit://auth/callback)');
      return false;
    }

    const error = url.searchParams.get('error');
    if (error) {
      log.error('[Auth] Callback returned error:', error);
      this.clearPendingAuth(new Error(error));
      return true;
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    log.info('[Auth] Callback params - code:', code ? 'present' : 'missing', 'state:', state);

    if (!code || !state) {
      log.warn('[Auth] Missing code or state in callback');
      return true;
    }

    if (!this.pendingAuth) {
      this.deferredCallbackUrl = callbackUrl;
      log.warn('[Auth] No pending auth state found yet — deferring callback until interactive sign-in is ready');
      return true;
    }

    if (this.pendingAuth.state !== state) {
      log.warn('[Auth] State mismatch in callback. Expected:', this.pendingAuth.state, 'Got:', state);
      return true;
    }

    const pending = this.pendingAuth;
    try {
      log.info('[Auth] Exchanging code for session...');
      const session = await this.exchangeCodeForSession(code, pending.verifier);
      log.info('[Auth] Session established for user:', session.userId);
      await this.persistSession(session);
      this.clearPendingAuth();
      pending.resolve(session);
    } catch (exchangeError) {
      log.error('[Auth] Token exchange failed:', exchangeError);
      this.clearPendingAuth(exchangeError instanceof Error ? exchangeError : new Error('Desktop sign-in failed'));
    }

    return true;
  }

  private async startInteractiveSignIn(): Promise<DesktopAuthSession> {
    log.info('[Auth] startInteractiveSignIn called');
    if (this.pendingAuth) {
      log.info('[Auth] Already has pending auth, waiting for it to complete...');
      return new Promise<DesktopAuthSession>((resolve, reject) => {
        const current = this.pendingAuth;
        const timeout = setInterval(async () => {
          if (!this.pendingAuth || this.pendingAuth !== current) {
            clearInterval(timeout);
            const session = await this.getSession();
            if (session) {
              resolve(session);
            } else {
              reject(new Error('Desktop sign-in did not complete'));
            }
          }
        }, 250);
      });
    }

    const verifier = toBase64Url(randomBytes(32));
    const state = toBase64Url(randomBytes(24));
    const challenge = buildCodeChallenge(verifier);

    const oauthBaseUrl = resolveOAuthBaseUrl();
    log.info('[Auth] OAuth Base URL resolved to:', oauthBaseUrl);
    
    const authorizeUrl = new URL('/oauth/authorize', oauthBaseUrl);
    authorizeUrl.searchParams.set('client_id', DESKTOP_CLIENT_ID);
    authorizeUrl.searchParams.set('redirect_uri', DESKTOP_CALLBACK_URI);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('state', state);

    const signInUrl = new URL('/sign-in', oauthBaseUrl);
    signInUrl.searchParams.set(
      'redirect_url',
      `${authorizeUrl.pathname}${authorizeUrl.search}`,
    );

    log.info('[Auth] Generated Sign-In URL:', signInUrl.toString());

    const sessionPromise = new Promise<DesktopAuthSession>((resolve, reject) => {
      const timeout = setTimeout(() => {
        log.error('[Auth] Interactive sign-in timed out');
        this.clearPendingAuth(new Error('Desktop sign-in timed out'));
      }, AUTH_TIMEOUT_MS);

      this.pendingAuth = { state, verifier, resolve, reject, timeout };
    });

    if (this.deferredCallbackUrl) {
      const deferredCallbackUrl = this.deferredCallbackUrl;
      this.deferredCallbackUrl = null;
      log.info('[Auth] Replaying deferred callback URL after pending auth state was created:', deferredCallbackUrl);
      void this.handleCallbackUrl(deferredCallbackUrl);
    }

    log.info('[Auth] Opening external browser for sign-in...');
    await shell.openExternal(signInUrl.toString());
    return sessionPromise;
  }

  private async exchangeCodeForSession(code: string, verifier: string): Promise<DesktopAuthSession> {
    const tokenResponse = await fetch(`${resolveOAuthBaseUrl()}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: DESKTOP_CLIENT_ID,
        code,
        redirect_uri: DESKTOP_CALLBACK_URI,
        code_verifier: verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const details = await tokenResponse.text().catch(() => '');
      throw new Error(`OAuth token exchange failed (${tokenResponse.status}): ${details || 'unknown error'}`);
    }

    const tokenPayload = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    return this.buildSessionFromTokenPayload(tokenPayload);
  }

  private async refreshSessionIfNeeded(): Promise<void> {
    if (!this.session) {
      return;
    }

    if (Date.now() < this.session.expiresAt - SESSION_REFRESH_SKEW_MS) {
      this.scheduleRefresh();
      return;
    }

    let refreshed: DesktopAuthSession;
    try {
      refreshed = await this.refreshSession(this.session.refreshToken);
    } catch (err) {
      const message = (err as Error).message ?? '';
      if (message.includes('invalid_grant') || message.includes('400')) {
        log.warn('[Auth] Refresh token expired or revoked — clearing session for re-authentication');
        await this.clearSession();
        await this.clearCurrentAccountFlag();
        return;
      }
      throw err;
    }
    await this.persistSession(refreshed);
  }

  private async refreshSession(refreshToken: string): Promise<DesktopAuthSession> {
    const response = await fetch(`${resolveOAuthBaseUrl()}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: DESKTOP_CLIENT_ID,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`OAuth refresh failed (${response.status}): ${details || 'unknown error'}`);
    }

    const tokenPayload = await response.json() as {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    return this.buildSessionFromTokenPayload(tokenPayload);
  }

  private async buildSessionFromTokenPayload(tokenPayload: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  }): Promise<DesktopAuthSession> {
    const userInfoResponse = await fetch(`${resolveOAuthBaseUrl()}/api/oauth/userinfo`, {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error(`User info request failed (${userInfoResponse.status})`);
    }

    const userInfo = await userInfoResponse.json() as {
      sub: string;
      email: string;
      client_id: string;
    };

    return {
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token,
      tokenType: tokenPayload.token_type,
      scope: tokenPayload.scope,
      expiresAt: Date.now() + tokenPayload.expires_in * 1000,
      userId: userInfo.sub,
      userEmail: userInfo.email,
      clientId: userInfo.client_id,
    };
  }

  private getLocalHardwareKey(): Buffer {
    // Generate a stable key based on machine-specific identifiers.
    // We avoid app.getPath('userData') as it might change between dev/prod or versions.
    const machineId = createHash('sha256')
      .update(os.hostname())
      .update(os.userInfo().username)
      .update(os.platform())
      .update(os.arch())
      .update('allternit-desktop-salt-v1')
      .digest();
    return machineId;
  }

  private encryptLocal(data: string): Buffer {
    const key = this.getLocalHardwareKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    // Prepend IV for decryption
    return Buffer.concat([iv, encrypted]);
  }

  private decryptLocal(encrypted: Buffer): string {
    const key = this.getLocalHardwareKey();
    const iv = encrypted.subarray(0, 16);
    const authData = encrypted.subarray(16);
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(authData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  private async persistSession(session: DesktopAuthSession): Promise<void> {
    this.session = session;
    this.scheduleRefresh();
    await this.upsertAccountRecord(session);

    const persisted: PersistedDesktopAuthSession = {
      ...session,
      savedAt: new Date().toISOString(),
    };
    const payload = Buffer.from(JSON.stringify(persisted), 'utf8');

    fs.mkdirSync(path.dirname(this.sessionPath), { recursive: true });
    
    // Use local hardware-bound encryption exclusively to avoid OS Keychain prompts
    log.info('[Auth] Writing session using local hardware-bound encryption');
    fs.writeFileSync(this.sessionPath, this.encryptLocal(payload.toString('utf8')));
  }

  private async readSessionFromDisk(): Promise<DesktopAuthSession | null> {
    if (!fs.existsSync(this.sessionPath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.sessionPath);
      const json = this.decodePersistedPayload(raw, this.sessionPath);
      const persisted = JSON.parse(json) as PersistedDesktopAuthSession;
      return {
        accessToken: persisted.accessToken,
        refreshToken: persisted.refreshToken,
        tokenType: persisted.tokenType,
        scope: persisted.scope,
        expiresAt: persisted.expiresAt,
        userId: persisted.userId,
        userEmail: persisted.userEmail,
        clientId: persisted.clientId,
      };
    } catch (error) {
      log.warn('[Auth] Failed to read persisted desktop session:', error);
      this.quarantineCorruptFile(this.sessionPath);
      return null;
    }
  }

  private async clearSession(): Promise<void> {
    this.session = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    fs.rmSync(this.sessionPath, { force: true });
  }

  async listAccounts(): Promise<DesktopAccountRecord[]> {
    const accounts = await this.readAccountsFromDisk();
    return accounts.sort((a, b) => {
      if (a.current !== b.current) {
        return a.current ? -1 : 1;
      }
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    });
  }

  async forgetAccount(userId: string): Promise<void> {
    if (this.session?.userId === userId) {
      return;
    }
    const accounts = await this.readAccountsFromDisk();
    const nextAccounts = accounts.filter((account) => account.userId !== userId);
    await this.writeAccountsToDisk(nextAccounts);
  }

  async updateBackendProfile(profile: DesktopBackendProfile): Promise<void> {
    if (!this.session) {
      return;
    }

    const accounts = await this.readAccountsFromDisk();
    if (!accounts.some((account) => account.userId === this.session?.userId)) {
      await this.upsertAccountRecord(this.session);
      return this.updateBackendProfile(profile);
    }
    const nextAccounts = accounts.map((account) => (
      account.userId === this.session?.userId
        ? {
            ...account,
            backend: profile.mode === 'remote'
              ? { mode: profile.mode, remoteUrl: profile.remoteUrl }
              : { mode: profile.mode },
            lastSeenAt: new Date().toISOString(),
          }
        : account
    ));
    await this.writeAccountsToDisk(nextAccounts);
  }

  private scheduleRefresh(): void {
    if (!this.session) {
      return;
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const delay = Math.max(this.session.expiresAt - Date.now() - SESSION_REFRESH_SKEW_MS, 5_000);
    this.refreshTimer = setTimeout(() => {
      this.refreshSessionIfNeeded().catch((error) => {
        log.warn('[Auth] Scheduled refresh failed:', error);
      });
    }, delay);
  }

  private clearPendingAuth(error?: Error): void {
    if (!this.pendingAuth) {
      return;
    }

    clearTimeout(this.pendingAuth.timeout);
    const pending = this.pendingAuth;
    this.pendingAuth = null;

    if (error) {
      pending.reject(error);
    }
  }

  private async upsertAccountRecord(session: DesktopAuthSession): Promise<void> {
    const accounts = await this.readAccountsFromDisk();
    const now = new Date().toISOString();
    let found = false;
    const nextAccounts = accounts.map((account) => {
      if (account.userId !== session.userId) {
        return { ...account, current: false };
      }

      found = true;
      return {
        ...account,
        userEmail: session.userEmail,
        clientId: session.clientId,
        current: true,
        lastSeenAt: now,
        lastSignedInAt: account.lastSignedInAt || now,
      };
    });

    if (!found) {
      nextAccounts.push({
        userId: session.userId,
        userEmail: session.userEmail,
        clientId: session.clientId,
        lastSignedInAt: now,
        lastSeenAt: now,
        current: true,
      });
    }

    await this.writeAccountsToDisk(nextAccounts);
  }

  private async clearCurrentAccountFlag(): Promise<void> {
    const accounts = await this.readAccountsFromDisk();
    const nextAccounts = accounts.map((account) => (
      account.current ? { ...account, current: false } : account
    ));
    await this.writeAccountsToDisk(nextAccounts);
  }

  private async readAccountsFromDisk(): Promise<DesktopAccountRecord[]> {
    if (!fs.existsSync(this.accountsPath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.accountsPath);
      const json = this.decodePersistedPayload(raw, this.accountsPath);
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((account): account is DesktopAccountRecord => (
        Boolean(account)
        && typeof account.userId === 'string'
        && typeof account.userEmail === 'string'
        && typeof account.clientId === 'string'
        && typeof account.lastSignedInAt === 'string'
        && typeof account.lastSeenAt === 'string'
        && typeof account.current === 'boolean'
      ));
    } catch (error) {
      log.warn('[Auth] Failed to read desktop account registry:', error);
      this.quarantineCorruptFile(this.accountsPath);
      return [];
    }
  }

  private async writeAccountsToDisk(accounts: DesktopAccountRecord[]): Promise<void> {
    fs.mkdirSync(path.dirname(this.accountsPath), { recursive: true });
    const payload = Buffer.from(JSON.stringify(accounts, null, 2), 'utf8');
    
    log.info('[Auth] Writing account registry using local hardware-bound encryption');
    fs.writeFileSync(this.accountsPath, this.encryptLocal(payload.toString('utf8')));
  }

  private decodePersistedPayload(raw: Buffer, filePath: string): string {
    // Only attempt local-hardware and plaintext.
    // We EXPLICITLY do not call safeStorage.decryptString to avoid OS popups.
    const attempts: PersistedFileMode[] = ['local-hardware', 'plaintext'];

    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        if (attempt === 'local-hardware') {
          return this.decryptLocal(raw);
        } else {
          return raw.toString('utf8');
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Unable to decode ${filePath}`);
  }

  private quarantineCorruptFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      return;
    }

    try {
      const corruptPath = `${filePath}.corrupt-${Date.now()}`;
      fs.renameSync(filePath, corruptPath);
      log.warn('[Auth] Quarantined corrupt auth file:', corruptPath);
    } catch (error) {
      log.warn('[Auth] Failed to quarantine corrupt auth file, removing instead:', error);
      fs.rmSync(filePath, { force: true });
    }
  }
}

export const authManager = new DesktopAuthManager();
