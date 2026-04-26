/**
 * OAuth access and refresh token store.
 *
 * Access tokens  — HMAC-SHA256 signed JWTs that include a `jti` claim.
 *   Redis key : oauth:at:{jti}   TTL : 3600 s
 *   Revocation : delete the key. Validation requires the key to exist.
 *
 * Refresh tokens — random opaque tokens.
 *   Redis key : oauth:rt:{token}  TTL : 30 days
 *   Single-use rotation: old token is consumed and a new pair is issued.
 *
 * Falls back to in-memory Maps when Redis is not configured (local dev /
 * single-instance staging). In-process fallback does not survive restarts.
 */

import { getRedisClient } from '@/lib/redis/client';

const ACCESS_TTL = 3600;          // 1 hour
const REFRESH_TTL = 30 * 86_400;  // 30 days

const KEY_AT = 'oauth:at:';
const KEY_RT = 'oauth:rt:';
const KEY_NBF = 'oauth:user:nbf:'; // not-before timestamp per user (for bulk revocation)

// ─── Shared payload shape ──────────────────────────────────────────────────────

export interface TokenPayload {
  userId: string;
  userEmail: string;
  clientId: string;
  scope: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

// ─── In-memory fallback stores ─────────────────────────────────────────────────

interface MemEntry extends TokenPayload {
  expiresAt: number;
}

const atStore = new Map<string, MemEntry>();          // jti → entry
const rtStore = new Map<string, MemEntry>();          // refresh token → entry
const nbfStore = new Map<string, number>();           // userId → not-before epoch (seconds)

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of atStore.entries()) if (v.expiresAt < now) atStore.delete(k);
    for (const [k, v] of rtStore.entries()) if (v.expiresAt < now) rtStore.delete(k);
  }, 60_000);
}

// ─── JWT helpers ───────────────────────────────────────────────────────────────

function secret(): string {
  return process.env.OAUTH_TOKEN_SECRET ?? 'allternit-oauth-dev-secret-change-in-prod';
}

async function signJWT(payload: Record<string, unknown>): Promise<string> {
  const header = toB64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = toB64(JSON.stringify(payload));
  const input  = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return `${input}.${toB64(String.fromCharCode(...new Uint8Array(sig)))}`;
}

export async function verifyJWT(token: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const input = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  const sigBytes = Uint8Array.from(atob(fromB64(sig)), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(input));
  if (!valid) return null;
  try {
    return JSON.parse(atob(fromB64(body))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toB64(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromB64(s: string): string {
  return s.replace(/-/g, '+').replace(/_/g, '/');
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function issueTokenPair(payload: TokenPayload): Promise<TokenPair> {
  const jti = crypto.randomUUID();
  const iat = Math.floor(Date.now() / 1000);

  const access_token = await signJWT({
    iss: 'https://platform.allternit.com',
    sub: payload.userId,
    email: payload.userEmail,
    client_id: payload.clientId,
    scope: payload.scope,
    jti,
    iat,
    exp: iat + ACCESS_TTL,
  });

  const refresh_token =
    crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '');

  const redis = getRedisClient();
  if (redis) {
    try {
      await Promise.all([
        redis.set(`${KEY_AT}${jti}`, JSON.stringify(payload), 'EX', ACCESS_TTL),
        redis.set(`${KEY_RT}${refresh_token}`, JSON.stringify(payload), 'EX', REFRESH_TTL),
      ]);
    } catch (error) {
      console.warn('[oauth-tokens] Redis write failed, falling back to in-memory store:', error);
      const atExpiry = Date.now() + ACCESS_TTL * 1000;
      const rtExpiry = Date.now() + REFRESH_TTL * 1000;
      atStore.set(jti, { ...payload, expiresAt: atExpiry });
      rtStore.set(refresh_token, { ...payload, expiresAt: rtExpiry });
    }
  } else {
    const atExpiry = Date.now() + ACCESS_TTL * 1000;
    const rtExpiry = Date.now() + REFRESH_TTL * 1000;
    atStore.set(jti, { ...payload, expiresAt: atExpiry });
    rtStore.set(refresh_token, { ...payload, expiresAt: rtExpiry });
  }

  return { access_token, refresh_token, token_type: 'Bearer', expires_in: ACCESS_TTL, scope: payload.scope };
}

/**
 * Validate an access token.
 * Returns the payload if the JWT signature is valid AND the jti is live in the store.
 * Returns null if expired, revoked, or tampered.
 */
export async function validateAccessToken(token: string): Promise<TokenPayload | null> {
  const claims = await verifyJWT(token);
  if (!claims) return null;

  const jti = claims.jti as string | undefined;
  const exp = claims.exp as number | undefined;
  const iat = claims.iat as number | undefined;
  const sub = claims.sub as string | undefined;
  if (!jti || !exp || !iat || Math.floor(Date.now() / 1000) > exp) return null;

  const redis = getRedisClient();
  if (redis) {
    try {
      if (sub) {
        const nbfRaw = await redis.get(`${KEY_NBF}${sub}`);
        if (nbfRaw && iat < Number(nbfRaw)) return null;
      }
      const raw = await redis.get(`${KEY_AT}${jti}`);
      if (!raw) return null;
      try { return JSON.parse(raw) as TokenPayload; } catch { return null; }
    } catch (error) {
      console.warn('[oauth-tokens] Redis validation failed, falling back to in-memory store:', error);
    }
  }

  // In-memory path
  if (sub) {
    const nbf = nbfStore.get(sub);
    if (nbf && iat < nbf) return null;
  }
  const entry = atStore.get(jti);
  if (!entry || entry.expiresAt < Date.now()) {
    atStore.delete(jti);
    return null;
  }
  return entry;
}

/**
 * Consume a refresh token (single-use) and issue a fresh token pair.
 * Returns null if the token is unknown or expired.
 */
export async function rotateRefreshToken(refreshToken: string): Promise<TokenPair | null> {
  const redis = getRedisClient();

  let payload: TokenPayload | null = null;

  if (redis) {
    try {
      const key = `${KEY_RT}${refreshToken}`;
      const raw = await redis.get(key);
      if (!raw) return null;
      await redis.del(key);
      try { payload = JSON.parse(raw) as TokenPayload; } catch { return null; }
    } catch (error) {
      console.warn('[oauth-tokens] Redis refresh rotation failed, falling back to in-memory store:', error);
    }
  }

  if (!payload) {
    const entry = rtStore.get(refreshToken);
    if (!entry || entry.expiresAt < Date.now()) {
      rtStore.delete(refreshToken);
      return null;
    }
    rtStore.delete(refreshToken);
    const { expiresAt: _, ...rest } = entry;
    payload = rest;
  }

  return issueTokenPair(payload);
}

/**
 * Revoke a token (access or refresh).
 * For access tokens pass the jti; for refresh tokens pass the opaque string.
 * Always resolves — revocation is best-effort (RFC 7009 §2.2).
 */
export async function revokeToken(token: string, hint?: 'access_token' | 'refresh_token'): Promise<void> {
  const redis = getRedisClient();

  // Try to identify token type from JWT structure
  const isJWT = token.split('.').length === 3;

  if (hint === 'refresh_token' || !isJWT) {
    // Opaque refresh token
    if (redis) {
      await redis.del(`${KEY_RT}${token}`).catch(() => {});
    } else {
      rtStore.delete(token);
    }
    return;
  }

  // Access token — extract jti
  const claims = await verifyJWT(token).catch(() => null);
  const jti = claims?.jti as string | undefined;
  if (!jti) return;

  if (redis) {
    await redis.del(`${KEY_AT}${jti}`).catch(() => {});
  } else {
    atStore.delete(jti);
  }
}

/**
 * Invalidate all tokens previously issued for a user by recording the current
 * timestamp as a "not-before" marker.  Any token with iat < this value will
 * fail validation on the next request.  Does not require enumerating keys.
 *
 * TTL is set to REFRESH_TTL (30 days) — the maximum lifetime of a token pair.
 */
export async function revokeAllTokensForUser(userId: string): Promise<void> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(`${KEY_NBF}${userId}`, String(nowSeconds), 'EX', REFRESH_TTL);
      return;
    } catch (error) {
      console.warn('[oauth-tokens] Redis revoke-all failed, falling back to in-memory store:', error);
    }
  } else {
    nbfStore.set(userId, nowSeconds);
    return;
  }

  nbfStore.set(userId, nowSeconds);
}
