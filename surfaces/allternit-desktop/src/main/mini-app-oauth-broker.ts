/**
 * OAuth broker for mini-app connectors — desktop main process only.
 *
 * Design invariants:
 * - Authorization Code with PKCE (S256) and a strong random, single-use
 *   state parameter with a 5-minute expiry.
 * - The authorization page opens in the SYSTEM BROWSER. Tokens never enter
 *   the renderer, embedded webviews, or logs: IPC returns account metadata
 *   (scopes, expiry, reauth state) only.
 * - The callback is a per-flow loopback HTTP server on 127.0.0.1 with an
 *   ephemeral port and an exact path check; the state is compared in
 *   constant time and consumed on first use.
 * - Access and refresh tokens are stored encrypted at rest through the
 *   injected host (Electron safeStorage in production).
 * - Access tokens auto-refresh 60s before expiry when a refresh token
 *   exists; invalid_grant marks the account as needing reauthorization.
 * - Account keys isolate tokens per miniapp, provider, and account scope
 *   (personal vs workspace).
 *
 * The module is electron-free: the host injects encryption, browser
 * launching, the storage path, and logging, so the full flow is testable
 * under plain Node with a loopback fake provider.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MiniAppOAuthProvider {
  authorizationUrl: string;
  tokenUrl: string;
  revocationUrl?: string;
  clientId: string;
  scopes: string[];
  /** Extra query parameters for the authorization URL (e.g. access_type). */
  additionalAuthParams?: Record<string, string>;
}

export interface MiniAppOAuthAccountMetadata {
  appId: string;
  providerId: string;
  accountId: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
  lastRefreshedAt?: string;
  needsReauth: boolean;
}

export interface MiniAppOAuthFlowResult {
  flowId: string;
  success: boolean;
  error?: string;
  /** Scopes actually granted by the provider (for scope review UI). */
  scopes?: string[];
  expiresAt?: string;
}

export interface MiniAppOAuthBrokerHost {
  encrypt(value: string): string;
  decrypt(value: string): string;
  openExternal(url: string): void | Promise<void>;
  storagePath(): string;
  logger?: (message: string) => void;
}

interface TokenRecord {
  appId: string;
  providerId: string;
  accountId: string;
  provider: MiniAppOAuthProvider;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
  lastRefreshedAt?: string;
  needsReauth: boolean;
}

// ─── Pure helpers (test targets) ──────────────────────────────────────────────

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(64).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(32).toString('base64url');
}

export function constantTimeEqual(left: string, right: string): boolean {
  // An empty string is never considered equal, not even to itself: an absent
  // credential must never satisfy a comparison.
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ACCOUNT_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,127}$/i;

export function accountKey(appId: string, providerId: string, accountId: string): string {
  return `${appId}${providerId}${accountId}`;
}

export function validateOAuthProvider(provider: MiniAppOAuthProvider): string | null {
  const secureish = (value: string): boolean => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  };
  if (!provider || typeof provider !== 'object') return 'Provider configuration is missing';
  if (!secureish(provider.authorizationUrl || '')) return 'authorizationUrl must be https (http only for localhost)';
  if (!secureish(provider.tokenUrl || '')) return 'tokenUrl must be https (http only for localhost)';
  if (provider.revocationUrl && !secureish(provider.revocationUrl)) return 'revocationUrl must be https (http only for localhost)';
  if (typeof provider.clientId !== 'string' || !/^[^\s]{1,512}$/.test(provider.clientId)) return 'clientId is invalid';
  if (!Array.isArray(provider.scopes) || provider.scopes.length > 64 || provider.scopes.some((s) => typeof s !== 'string' || !/^\S{1,256}$/.test(s))) {
    return 'scopes must be an array of up to 64 non-empty strings';
  }
  if (provider.additionalAuthParams) {
    const entries = Object.entries(provider.additionalAuthParams);
    if (entries.length > 20 || entries.some(([k, v]) => typeof k !== 'string' || typeof v !== 'string' || k.length > 128 || v.length > 1024)) {
      return 'additionalAuthParams is invalid';
    }
    if (entries.some(([k]) => ['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'code_challenge', 'code_challenge_method'].includes(k))) {
      return 'additionalAuthParams must not override standard OAuth parameters';
    }
  }
  return null;
}

export function buildAuthorizationUrl(
  provider: MiniAppOAuthProvider,
  redirectUri: string,
  state: string,
  challenge: string,
): string {
  const url = new URL(provider.authorizationUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (provider.scopes.length) url.searchParams.set('scope', provider.scopes.join(' '));
  for (const [key, value] of Object.entries(provider.additionalAuthParams || {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

// ─── Broker ───────────────────────────────────────────────────────────────────

const CALLBACK_PATH = '/callback';
const FLOW_TIMEOUT_MS = 5 * 60_000;
const REFRESH_MARGIN_MS = 60_000;
const CALLBACK_PAGE = (title: string, detail: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
  '<style>body{font-family:system-ui;margin:4em auto;max-width:32em;text-align:center;color:#222}</style>' +
  `</head><body><h2>${title}</h2><p>${detail}</p><p>You can close this tab.</p></body></html>`;

interface PendingFlow {
  flowId: string;
  appId: string;
  providerId: string;
  accountId: string;
  provider: MiniAppOAuthProvider;
  verifier: string;
  state: string;
  redirectUri: string;
  server: http.Server;
  timeout: NodeJS.Timeout;
}

export interface MiniAppOAuthBroker {
  startFlow(appId: string, providerId: string, provider: MiniAppOAuthProvider, accountId: string): Promise<{ flowId?: string; error?: string }>;
  cancelFlow(flowId: string): { success: boolean };
  listAccounts(appId: string): MiniAppOAuthAccountMetadata[];
  disconnect(appId: string, providerId: string, accountId: string): Promise<{ success: boolean; error?: string }>;
  /** Main-process only: returns a fresh access token, refreshing if needed. */
  getValidAccessToken(appId: string, providerId: string, accountId: string): Promise<{ token?: string; error?: string }>;
  onFlowComplete(handler: (result: MiniAppOAuthFlowResult & { appId: string; providerId: string; accountId: string }) => void): void;
}

export function createMiniAppOAuthBroker(host: MiniAppOAuthBrokerHost): MiniAppOAuthBroker {
  const pending = new Map<string, PendingFlow>();
  const completeHandlers: Array<(result: MiniAppOAuthFlowResult & { appId: string; providerId: string; accountId: string }) => void> = [];
  const log = (message: string): void => host.logger?.(`[oauth-broker] ${message}`);

  // ── Encrypted token store ────────────────────────────────────────────────
  const readStore = (): Record<string, string> => {
    try {
      return JSON.parse(fs.readFileSync(host.storagePath(), 'utf8')) as Record<string, string>;
    } catch {
      return {};
    }
  };
  const writeStore = (data: Record<string, string>): void => {
    fs.mkdirSync(path.dirname(host.storagePath()), { recursive: true });
    const temporary = `${host.storagePath()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, host.storagePath());
  };
  const getRecord = (appId: string, providerId: string, accountId: string): TokenRecord | null => {
    const encrypted = readStore()[accountKey(appId, providerId, accountId)];
    if (!encrypted) return null;
    try {
      return JSON.parse(host.decrypt(encrypted)) as TokenRecord;
    } catch {
      return null;
    }
  };
  const putRecord = (record: TokenRecord): void => {
    const data = readStore();
    data[accountKey(record.appId, record.providerId, record.accountId)] = host.encrypt(JSON.stringify(record));
    writeStore(data);
  };
  const deleteRecord = (appId: string, providerId: string, accountId: string): void => {
    const data = readStore();
    if (delete data[accountKey(appId, providerId, accountId)]) writeStore(data);
  };

  const metadata = (record: TokenRecord): MiniAppOAuthAccountMetadata => ({
    appId: record.appId,
    providerId: record.providerId,
    accountId: record.accountId,
    scopes: record.scopes,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    lastRefreshedAt: record.lastRefreshedAt,
    needsReauth: record.needsReauth,
  });

  // ── Token endpoint calls ─────────────────────────────────────────────────
  const tokenRequest = async (provider: MiniAppOAuthProvider, params: Record<string, string>): Promise<{ ok: boolean; json?: Record<string, unknown>; error?: string }> => {
    let response: Response;
    try {
      response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams(params).toString(),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      return { ok: false, error: `Token endpoint unreachable: ${error instanceof Error ? error.message : String(error)}` };
    }
    let json: Record<string, unknown>;
    try {
      json = (await response.json()) as Record<string, unknown>;
    } catch {
      return { ok: false, error: `Token endpoint returned HTTP ${response.status} with a non-JSON body` };
    }
    if (!response.ok) {
      return { ok: false, error: `Token endpoint returned ${String(json.error ?? `HTTP ${response.status}`)}`, json };
    }
    return { ok: true, json };
  };

  const storeTokenResponse = (
    base: Pick<TokenRecord, 'appId' | 'providerId' | 'accountId' | 'provider'>,
    json: Record<string, unknown>,
    previous?: TokenRecord,
  ): TokenRecord | { error: string } => {
    const accessToken = json.access_token;
    if (typeof accessToken !== 'string' || !accessToken) return { error: 'Token response did not include an access_token' };
    const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : undefined;
    const now = new Date();
    const record: TokenRecord = {
      ...base,
      accessToken,
      refreshToken: typeof json.refresh_token === 'string' && json.refresh_token ? json.refresh_token : previous?.refreshToken,
      scopes: typeof json.scope === 'string' && json.scope ? json.scope.split(' ').filter(Boolean) : base.provider.scopes,
      expiresAt: expiresIn ? new Date(now.getTime() + expiresIn * 1000).toISOString() : undefined,
      createdAt: previous?.createdAt ?? now.toISOString(),
      lastRefreshedAt: previous ? now.toISOString() : undefined,
      needsReauth: false,
    };
    putRecord(record);
    return record;
  };

  // ── Flow lifecycle ───────────────────────────────────────────────────────
  const settleFlow = (flow: PendingFlow, result: Omit<MiniAppOAuthFlowResult, 'flowId'>): void => {
    clearTimeout(flow.timeout);
    flow.server.close();
    pending.delete(flow.flowId);
    const full = { ...result, flowId: flow.flowId };
    log(`${result.success ? 'completed' : 'failed'} flow for ${flow.appId}/${flow.providerId} (${result.error ?? 'ok'})`);
    for (const handler of completeHandlers) {
      handler({ ...full, appId: flow.appId, providerId: flow.providerId, accountId: flow.accountId });
    }
  };

  const handleCallback = (flow: PendingFlow, req: http.IncomingMessage, res: http.ServerResponse): void => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname !== CALLBACK_PATH) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const state = url.searchParams.get('state') || '';
    const providerError = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    if (!constantTimeEqual(state, flow.state)) {
      res.writeHead(400, { 'content-type': 'text/html' });
      res.end(CALLBACK_PAGE('Authorization failed', 'The sign-in state did not match. Please try again.'));
      settleFlow(flow, { success: false, error: 'State mismatch' });
      return;
    }
    if (providerError) {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(CALLBACK_PAGE('Authorization cancelled', 'The provider did not grant access.'));
      settleFlow(flow, { success: false, error: `Provider returned: ${providerError}` });
      return;
    }
    if (!code) {
      res.writeHead(400, { 'content-type': 'text/html' });
      res.end(CALLBACK_PAGE('Authorization failed', 'The provider did not return an authorization code.'));
      settleFlow(flow, { success: false, error: 'Missing authorization code' });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(CALLBACK_PAGE('Connected', 'Authorization complete.'));
    void (async () => {
      const exchanged = await tokenRequest(flow.provider, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: flow.redirectUri,
        client_id: flow.provider.clientId,
        code_verifier: flow.verifier,
      });
      if (!exchanged.ok || !exchanged.json) {
        settleFlow(flow, { success: false, error: exchanged.error || 'Token exchange failed' });
        return;
      }
      const record = storeTokenResponse(
        { appId: flow.appId, providerId: flow.providerId, accountId: flow.accountId, provider: flow.provider },
        exchanged.json,
      );
      if ('error' in record) {
        settleFlow(flow, { success: false, error: record.error });
        return;
      }
      settleFlow(flow, { success: true, scopes: record.scopes, expiresAt: record.expiresAt });
    })();
  };

  return {
    async startFlow(appId, providerId, provider, accountId) {
      if (!ACCOUNT_ID_PATTERN.test(accountId)) return { error: 'Invalid account identifier' };
      if (!/^[a-z0-9][a-z0-9:._/-]{1,199}$/i.test(appId) || !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(providerId)) {
        return { error: 'Invalid app or provider identifier' };
      }
      const invalid = validateOAuthProvider(provider);
      if (invalid) return { error: invalid };

      const flowId = generateState();
      const { verifier, challenge } = generatePkce();
      const state = generateState();
      const server = http.createServer();
      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(0, '127.0.0.1', () => resolve());
        });
      } catch {
        return { error: 'Could not start the OAuth callback server' };
      }
      const port = (server.address() as AddressInfo).port;
      const redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`;

      const flow: PendingFlow = {
        flowId,
        appId,
        providerId,
        accountId,
        provider,
        verifier,
        state,
        redirectUri,
        server,
        timeout: setTimeout(() => {
          const pendingFlow = pending.get(flowId);
          if (pendingFlow) settleFlow(pendingFlow, { success: false, error: 'The authorization timed out' });
        }, FLOW_TIMEOUT_MS),
      };
      pending.set(flowId, flow);
      server.on('request', (req, res) => handleCallback(flow, req, res));
      server.on('clientError', (_error, socket) => socket.destroy());

      const authorizationUrl = buildAuthorizationUrl(provider, redirectUri, state, challenge);
      try {
        await host.openExternal(authorizationUrl);
      } catch (error) {
        settleFlow(flow, { success: false, error: `Could not open the browser: ${error instanceof Error ? error.message : String(error)}` });
        return { error: 'Could not open the system browser' };
      }
      log(`started flow for ${appId}/${providerId}/${accountId} on 127.0.0.1:${port}`);
      return { flowId };
    },

    cancelFlow(flowId) {
      const flow = pending.get(flowId);
      if (!flow) return { success: false };
      settleFlow(flow, { success: false, error: 'Cancelled by the user' });
      return { success: true };
    },

    listAccounts(appId) {
      const accounts: MiniAppOAuthAccountMetadata[] = [];
      for (const [key, encrypted] of Object.entries(readStore())) {
        if (!key.startsWith(`${appId}`)) continue;
        try {
          accounts.push(metadata(JSON.parse(host.decrypt(encrypted)) as TokenRecord));
        } catch { /* skip damaged records */ }
      }
      return accounts;
    },

    async disconnect(appId, providerId, accountId) {
      const record = getRecord(appId, providerId, accountId);
      if (!record) return { success: true };
      deleteRecord(appId, providerId, accountId);
      // Best-effort RFC 7009 revocation; local disconnect already happened.
      if (record.provider.revocationUrl) {
        for (const [token, hint] of [[record.accessToken, 'access_token'], [record.refreshToken, 'refresh_token']] as const) {
          if (!token) continue;
          try {
            await fetch(record.provider.revocationUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ token, token_type_hint: hint, client_id: record.provider.clientId }).toString(),
              signal: AbortSignal.timeout(10_000),
            });
          } catch { /* revocation is best-effort */ }
        }
      }
      log(`disconnected ${appId}/${providerId}/${accountId}`);
      return { success: true };
    },

    async getValidAccessToken(appId, providerId, accountId) {
      const record = getRecord(appId, providerId, accountId);
      if (!record) return { error: 'No connected account' };
      if (record.needsReauth) return { error: 'Account needs to be reconnected' };
      const fresh = !record.expiresAt || Date.parse(record.expiresAt) - REFRESH_MARGIN_MS > Date.now();
      if (fresh) return { token: record.accessToken };
      if (!record.refreshToken) return { error: 'Access token expired and no refresh token is available' };
      const refreshed = await tokenRequest(record.provider, {
        grant_type: 'refresh_token',
        refresh_token: record.refreshToken,
        client_id: record.provider.clientId,
      });
      if (!refreshed.ok || !refreshed.json) {
        if (refreshed.json?.error === 'invalid_grant') {
          putRecord({ ...record, needsReauth: true });
          return { error: 'Refresh was rejected; the account needs to be reconnected' };
        }
        return { error: refreshed.error || 'Token refresh failed' };
      }
      const updated = storeTokenResponse(
        { appId, providerId, accountId, provider: record.provider },
        refreshed.json,
        record,
      );
      if ('error' in updated) return { error: updated.error };
      log(`refreshed token for ${appId}/${providerId}/${accountId}`);
      return { token: updated.accessToken };
    },

    onFlowComplete(handler) {
      completeHandlers.push(handler);
    },
  };
}
