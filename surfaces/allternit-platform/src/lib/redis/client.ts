/**
 * Redis client — Upstash REST backend.
 *
 * Uses @upstash/redis which speaks HTTP instead of TCP.
 * No persistent connections, no pool exhaustion, works in every
 * Vercel serverless function invocation.
 *
 * Auto-reads KV_REST_API_URL + KV_REST_API_TOKEN (provisioned by the
 * Vercel / Upstash marketplace integration).
 *
 * Returns a thin wrapper whose API matches the ioredis subset used
 * throughout this codebase so existing callers need no changes:
 *   set(key, value, 'EX', ttl)
 *   get(key)
 *   del(...keys)
 *   exists(...keys)
 *   sadd(key, ...members)
 *   smembers(key)
 *   srem(key, ...members)
 *   expire(key, ttl)
 */

import { Redis } from '@upstash/redis';

// ─── Client singleton ──────────────────────────────────────────────────────────

export type RedisClient = ReturnType<typeof buildClient>;

let _client: RedisClient | null = null;

function buildClient() {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  const upstash = new Redis({ url, token });

  return {
    // ── String ops ──────────────────────────────────────────────────────────
    async get(key: string): Promise<string | null> {
      const v = await upstash.get<string>(key);
      return v ?? null;
    },

    /** Accepts both ioredis positional style (key, value, 'EX', ttl)
     *  and options style (key, value, { ex: ttl }).                   */
    async set(
      key: string,
      value: string,
      exOrOpts?: 'EX' | 'PX' | { ex?: number; px?: number },
      ttl?: number,
    ): Promise<void> {
      if (typeof exOrOpts === 'string' && typeof ttl === 'number') {
        const opts = exOrOpts === 'EX' ? { ex: ttl } : { px: ttl };
        await upstash.set(key, value, opts);
      } else if (exOrOpts && typeof exOrOpts === 'object') {
        await upstash.set(key, value, exOrOpts);
      } else {
        await upstash.set(key, value);
      }
    },

    async del(...keys: string[]): Promise<number> {
      if (!keys.length) return 0;
      return upstash.del(...keys as [string, ...string[]]);
    },

    async exists(...keys: string[]): Promise<number> {
      if (!keys.length) return 0;
      return upstash.exists(...keys as [string, ...string[]]);
    },

    async expire(key: string, seconds: number): Promise<number> {
      return upstash.expire(key, seconds);
    },

    // ── Set ops ─────────────────────────────────────────────────────────────
    async sadd(key: string, ...members: string[]): Promise<number> {
      return upstash.sadd(key, ...members);
    },

    async smembers(key: string): Promise<string[]> {
      return upstash.smembers(key);
    },

    async srem(key: string, ...members: string[]): Promise<number> {
      return upstash.srem(key, ...members);
    },
  };
}

export function getRedisClient(): RedisClient | null {
  if (_client) return _client;
  _client = buildClient();
  if (!_client) {
    console.warn('[redis] KV_REST_API_URL / KV_REST_API_TOKEN not set — falling back to in-memory stores');
  }
  return _client;
}

export function isRedisAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}
