/**
 * OAuth authorization code store.
 *
 * Uses Redis (via the project's existing ioredis client) when REDIS_URL or
 * UPSTASH_REDIS_REST_URL is configured. Falls back to an in-process Map for
 * single-instance / local dev environments.
 *
 * Codes are single-use, expire after 5 minutes, and are tied to a specific
 * clientId + redirectUri + userId + PKCE challenge.
 */

import { getRedisClient } from '@/lib/redis/client';

const CODE_TTL_SECONDS = 300; // 5 minutes
const KEY_PREFIX = 'oauth:code:';

export interface StoredCode {
  code: string;
  clientId: string;
  redirectUri: string;
  userId: string;
  userEmail: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  scope: string;
}

// ─── In-memory fallback ────────────────────────────────────────────────────────

interface MemEntry extends StoredCode {
  expiresAt: number;
}

const memStore = new Map<string, MemEntry>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memStore.entries()) {
      if (v.expiresAt < now) memStore.delete(k);
    }
  }, 60_000);
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function createAuthCode(params: {
  clientId: string;
  redirectUri: string;
  userId: string;
  userEmail: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  scope?: string;
}): Promise<string> {
  const code =
    crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '');

  const entry: StoredCode = {
    code,
    ...params,
    scope: params.scope ?? 'openid profile email',
  };

  const redis = getRedisClient();
  if (redis) {
    await redis.set(
      `${KEY_PREFIX}${code}`,
      JSON.stringify(entry),
      'EX',
      CODE_TTL_SECONDS,
    );
  } else {
    memStore.set(code, {
      ...entry,
      expiresAt: Date.now() + CODE_TTL_SECONDS * 1000,
    });
  }

  return code;
}

export async function consumeAuthCode(code: string): Promise<StoredCode | null> {
  const redis = getRedisClient();

  if (redis) {
    const key = `${KEY_PREFIX}${code}`;
    const raw = await redis.get(key);
    if (!raw) return null;
    await redis.del(key); // single-use: delete immediately on consume
    try {
      return JSON.parse(raw) as StoredCode;
    } catch {
      return null;
    }
  }

  // In-memory fallback
  const entry = memStore.get(code);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memStore.delete(code);
    return null;
  }
  memStore.delete(code);
  return entry;
}
