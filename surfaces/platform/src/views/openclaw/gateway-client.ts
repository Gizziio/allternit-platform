export interface GatewayReqFrame {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
}

export interface GatewayResFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
}

export interface GatewayEventFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: number;
}

type PendingEntry = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutHandle: number;
};

type DeviceIdentityRecord = {
  version: 1;
  deviceId: string;
  publicKey: string;
  privateKeyPkcs8: string;
  createdAtMs: number;
};

type DeviceTokenStore = {
  version: 1;
  deviceId: string;
  tokens: Record<string, {
    token: string;
    role: string;
    scopes: string[];
    updatedAtMs: number;
  }>;
};

export interface GatewayClientOptions {
  url: string;
  token?: string;
  password?: string;
  clientName?: string;
  clientVersion?: string;
  mode?: string;
  instanceId?: string;
  onHello?: (payload: unknown) => void;
  onEvent?: (event: GatewayEventFrame) => void;
  onClose?: (close: { code: number; reason: string }) => void;
  onError?: (error: Error) => void;
  onGap?: (gap: { expected: number; received: number }) => void;
}

const DEVICE_IDENTITY_KEY = 'openclaw-device-identity-webcrypto-v1';
const DEVICE_TOKEN_KEY = 'openclaw.device.auth.v1';
const CONNECT_FAILURE_CLOSE_CODE = 4008;

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let text = '';
  for (const value of bytes) {
    text += String.fromCharCode(value);
  }
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const decoded = atob(padded);
  const result = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    result[index] = decoded.charCodeAt(index);
  }
  return result;
}

function normalizeRole(role: string): string {
  return role.trim();
}

function normalizeScopes(scopes: unknown): string[] {
  if (!Array.isArray(scopes)) return [];
  const set = new Set<string>();
  for (const scope of scopes) {
    if (typeof scope !== 'string') continue;
    const trimmed = scope.trim();
    if (!trimmed) continue;
    set.add(trimmed);
  }
  return Array.from(set).sort();
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256Hex(payload: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(payload));
  const view = new Uint8Array(digest);
  return Array.from(view)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function getDeviceTokenStore(): DeviceTokenStore | null {
  try {
    const raw = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeviceTokenStore>;
    if (
      parsed?.version !== 1
      || typeof parsed.deviceId !== 'string'
      || typeof parsed.tokens !== 'object'
      || parsed.tokens == null
    ) {
      return null;
    }
    return {
      version: 1,
      deviceId: parsed.deviceId,
      tokens: parsed.tokens as DeviceTokenStore['tokens'],
    };
  } catch {
    return null;
  }
}

function setDeviceTokenStore(store: DeviceTokenStore): void {
  try {
    window.localStorage.setItem(DEVICE_TOKEN_KEY, JSON.stringify(store));
  } catch {
    // No-op for privacy mode/localStorage errors.
  }
}

function getStoredDeviceToken(deviceId: string, role: string): string | null {
  const store = getDeviceTokenStore();
  if (!store || store.deviceId !== deviceId) return null;
  const normalizedRole = normalizeRole(role);
  const entry = store.tokens[normalizedRole];
  if (!entry || typeof entry.token !== 'string' || !entry.token.trim()) return null;
  return entry.token;
}

function storeDeviceToken(deviceId: string, role: string, token: string, scopes: unknown): void {
  const normalizedRole = normalizeRole(role);
  const next: DeviceTokenStore = {
    version: 1,
    deviceId,
    tokens: {},
  };

  const current = getDeviceTokenStore();
  if (current && current.deviceId === deviceId) {
    next.tokens = { ...current.tokens };
  }

  next.tokens[normalizedRole] = {
    token,
    role: normalizedRole,
    scopes: normalizeScopes(scopes),
    updatedAtMs: Date.now(),
  };

  setDeviceTokenStore(next);
}

function clearStoredDeviceToken(deviceId: string, role: string): void {
  const current = getDeviceTokenStore();
  if (!current || current.deviceId !== deviceId) return;

  const normalizedRole = normalizeRole(role);
  if (!current.tokens[normalizedRole]) return;

  const updated: DeviceTokenStore = {
    ...current,
    tokens: { ...current.tokens },
  };

  delete updated.tokens[normalizedRole];
  setDeviceTokenStore(updated);
}

function canUseSubtleCrypto(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

async function importPrivateKeyFromPkcs8(base64UrlPkcs8: string): Promise<CryptoKey> {
  const bytes = base64UrlToBytes(base64UrlPkcs8);
  return crypto.subtle.importKey(
    'pkcs8',
    toArrayBuffer(bytes),
    { name: 'Ed25519' } as AlgorithmIdentifier,
    false,
    ['sign'],
  );
}

async function generateDeviceIdentity(): Promise<{
  record: DeviceIdentityRecord;
  privateKey: CryptoKey;
}> {
  const pair = await crypto.subtle.generateKey(
    { name: 'Ed25519' } as AlgorithmIdentifier,
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair;

  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const privatePkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const deviceId = await sha256Hex(publicRaw);

  const record: DeviceIdentityRecord = {
    version: 1,
    deviceId,
    publicKey: bytesToBase64Url(publicRaw),
    privateKeyPkcs8: bytesToBase64Url(privatePkcs8),
    createdAtMs: Date.now(),
  };

  try {
    window.localStorage.setItem(DEVICE_IDENTITY_KEY, JSON.stringify(record));
  } catch {
    // Best effort cache.
  }

  return { record, privateKey: pair.privateKey };
}

async function loadOrCreateDeviceIdentity(): Promise<{
  record: DeviceIdentityRecord;
  privateKey: CryptoKey;
} | null> {
  if (!canUseSubtleCrypto()) return null;

  try {
    const raw = window.localStorage.getItem(DEVICE_IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceIdentityRecord>;
      if (
        parsed?.version === 1
        && typeof parsed.deviceId === 'string'
        && typeof parsed.publicKey === 'string'
        && typeof parsed.privateKeyPkcs8 === 'string'
      ) {
        const publicKeyBytes = base64UrlToBytes(parsed.publicKey);
        const calculated = await sha256Hex(publicKeyBytes);
        if (calculated === parsed.deviceId) {
          const privateKey = await importPrivateKeyFromPkcs8(parsed.privateKeyPkcs8);
          return {
            record: {
              version: 1,
              deviceId: parsed.deviceId,
              publicKey: parsed.publicKey,
              privateKeyPkcs8: parsed.privateKeyPkcs8,
              createdAtMs: typeof parsed.createdAtMs === 'number' ? parsed.createdAtMs : Date.now(),
            },
            privateKey,
          };
        }
      }
    }
  } catch {
    // Fall through to regeneration.
  }

  try {
    return await generateDeviceIdentity();
  } catch {
    return null;
  }
}

function buildConnectSignaturePayload(input: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string;
  nonce?: string | null;
}): string {
  const version = input.nonce ? 'v2' : 'v1';
  const scopesCsv = input.scopes.join(',');
  const token = input.token ?? '';
  const chunks = [
    version,
    input.deviceId,
    input.clientId,
    input.clientMode,
    input.role,
    scopesCsv,
    String(input.signedAtMs),
    token,
  ];
  if (version === 'v2') {
    chunks.push(input.nonce ?? '');
  }
  return chunks.join('|');
}

async function signWithDevice(privateKey: CryptoKey, payload: string): Promise<string> {
  const encoded = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' } as AlgorithmIdentifier,
    privateKey,
    encoded,
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGatewayEventFrame(frame: unknown): frame is GatewayEventFrame {
  return isRecord(frame)
    && frame.type === 'event'
    && typeof frame.event === 'string';
}

function isGatewayResFrame(frame: unknown): frame is GatewayResFrame {
  return isRecord(frame)
    && frame.type === 'res'
    && typeof frame.id === 'string'
    && typeof frame.ok === 'boolean';
}

export class GatewayClient {
  private options: GatewayClientOptions;
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingEntry>();
  private closed = false;
  private backoffMs = 800;
  private reconnectHandle: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: number | null = null;
  private lastSeq: number | null = null;

  private connectRole = 'operator';
  private connectScopes = ['operator.admin', 'operator.approvals', 'operator.pairing'];

  constructor(options: GatewayClientOptions) {
    this.options = options;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  start(): void {
    this.closed = false;
    this.connect();
  }

  stop(): void {
    this.closed = true;
    if (this.reconnectHandle != null) {
      window.clearTimeout(this.reconnectHandle);
      this.reconnectHandle = null;
    }
    if (this.connectTimer != null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error('gateway client stopped'));
  }

  request<T = unknown>(method: string, params: unknown = {}, timeoutMs = 20_000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('gateway not connected'));
    }

    const id = randomId();
    const frame: GatewayReqFrame = {
      type: 'req',
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`gateway request timed out: ${method}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value: unknown) => resolve(value as T),
        reject,
        timeoutHandle,
      });

      try {
        this.ws?.send(JSON.stringify(frame));
      } catch (error) {
        window.clearTimeout(timeoutHandle);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private connect(): void {
    if (this.closed) return;

    try {
      this.ws = new WebSocket(this.options.url);
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.queueConnect();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(String(event.data ?? ''));
    };

    this.ws.onclose = (event) => {
      const reason = String(event.reason ?? '');
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${event.code}): ${reason}`));
      this.options.onClose?.({ code: event.code, reason });
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // Browser WS errors are opaque; onclose path surfaces status.
    };
  }

  private queueConnect(): void {
    this.connectNonce = null;
    this.connectSent = false;

    if (this.connectTimer != null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    this.connectTimer = window.setTimeout(() => {
      void this.sendConnect();
    }, 750);
  }

  private async sendConnect(): Promise<void> {
    if (this.connectSent || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.connectSent = true;
    if (this.connectTimer != null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const clientId = this.options.clientName ?? 'openclaw-control-ui';
    const clientMode = this.options.mode ?? 'webchat';

    const role = this.connectRole;
    const scopes = this.connectScopes;

    let requestedToken = this.options.token;
    let clearCachedTokenOnFailure = false;
    let deviceRecord: DeviceIdentityRecord | null = null;
    let signature: string | undefined;
    let signedAt: number | undefined;

    try {
      const identity = await loadOrCreateDeviceIdentity();
      if (identity) {
        deviceRecord = identity.record;

        const cachedToken = getStoredDeviceToken(identity.record.deviceId, role);
        if (cachedToken) {
          requestedToken = cachedToken;
          clearCachedTokenOnFailure = Boolean(this.options.token);
        }

        signedAt = Date.now();
        const payload = buildConnectSignaturePayload({
          deviceId: identity.record.deviceId,
          clientId,
          clientMode,
          role,
          scopes,
          signedAtMs: signedAt,
          token: requestedToken,
          nonce: this.connectNonce,
        });
        signature = await signWithDevice(identity.privateKey, payload);
      }
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }

    const auth = requestedToken || this.options.password
      ? {
          token: requestedToken,
          password: this.options.password,
        }
      : undefined;

    const connectParams: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: clientId,
        version: this.options.clientVersion ?? 'allternit-native-dev',
        platform: navigator.platform ?? 'web',
        mode: clientMode,
        instanceId: this.options.instanceId,
      },
      role,
      scopes,
      caps: [],
      auth,
      userAgent: navigator.userAgent,
      locale: navigator.language,
    };

    if (deviceRecord && signature && typeof signedAt === 'number') {
      connectParams.device = {
        id: deviceRecord.deviceId,
        publicKey: deviceRecord.publicKey,
        signature,
        signedAt,
        nonce: this.connectNonce ?? undefined,
      };
    }

    try {
      const payload = await this.request('connect', connectParams, 15_000);
      const maybeAuth = (payload as { auth?: { deviceToken?: string; role?: string; scopes?: unknown } })?.auth;

      if (
        maybeAuth
        && typeof maybeAuth.deviceToken === 'string'
        && maybeAuth.deviceToken.trim()
        && deviceRecord
      ) {
        storeDeviceToken(
          deviceRecord.deviceId,
          typeof maybeAuth.role === 'string' && maybeAuth.role.trim() ? maybeAuth.role : role,
          maybeAuth.deviceToken,
          maybeAuth.scopes ?? scopes,
        );
      }

      this.backoffMs = 800;
      this.options.onHello?.(payload);
    } catch (error) {
      if (clearCachedTokenOnFailure && deviceRecord) {
        clearStoredDeviceToken(deviceRecord.deviceId, role);
      }

      this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
      this.ws?.close(CONNECT_FAILURE_CLOSE_CODE, 'connect failed');
    }
  }

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed;
    if (isGatewayEventFrame(frame)) {
      const eventFrame = frame;

      if (eventFrame.event === 'connect.challenge') {
        const nonce = (eventFrame.payload as { nonce?: unknown } | undefined)?.nonce;
        if (typeof nonce === 'string' && nonce.trim()) {
          this.connectNonce = nonce;
          void this.sendConnect();
        }
        return;
      }

      if (typeof eventFrame.seq === 'number') {
        if (this.lastSeq != null && eventFrame.seq > this.lastSeq + 1) {
          this.options.onGap?.({
            expected: this.lastSeq + 1,
            received: eventFrame.seq,
          });
        }
        this.lastSeq = eventFrame.seq;
      }

      try {
        this.options.onEvent?.(eventFrame);
      } catch (error) {
        this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }

    if (isGatewayResFrame(frame)) {
      const responseFrame = frame;
      const pending = this.pending.get(responseFrame.id);
      if (!pending) return;

      this.pending.delete(responseFrame.id);
      window.clearTimeout(pending.timeoutHandle);

      if (responseFrame.ok) {
        pending.resolve(responseFrame.payload);
      } else {
        pending.reject(new Error(responseFrame.error?.message ?? 'gateway request failed'));
      }
    }
  }

  private flushPending(error: Error): void {
    for (const [, entry] of this.pending) {
      window.clearTimeout(entry.timeoutHandle);
      entry.reject(error);
    }
    this.pending.clear();
  }

  private scheduleReconnect(): void {
    if (this.closed) return;

    const timeoutMs = this.backoffMs;
    this.backoffMs = Math.min(Math.round(this.backoffMs * 1.7), 15_000);

    if (this.reconnectHandle != null) {
      window.clearTimeout(this.reconnectHandle);
    }

    this.reconnectHandle = window.setTimeout(() => {
      this.reconnectHandle = null;
      this.connect();
    }, timeoutMs);
  }
}
