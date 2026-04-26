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
        await upstash.set(key, value, exOrOpts as any);
      } else {
        await upstash.set(key, value);
      }
    },

    async del(...keys: string[]): Promise<number> {
      if (!keys.length) return 0;
      return (upstash.del as any)(...keys);
    },

    async exists(...keys: string[]): Promise<number> {
      if (!keys.length) return 0;
      return (upstash.exists as any)(...keys);
    },

    async expire(key: string, seconds: number): Promise<number> {
      return upstash.expire(key, seconds);
    },

    // ── Set ops ─────────────────────────────────────────────────────────────
    async sadd(key: string, ...members: string[]): Promise<number> {
      return (upstash as any).sadd(key, ...members);
    },

    async smembers(key: string): Promise<string[]> {
      return upstash.smembers(key);
    },

    async srem(key: string, ...members: string[]): Promise<number> {
      return upstash.srem(key, ...members);
    },

    // ── Sorted set ops ──────────────────────────────────────────────────────
    async zadd(key: string, score: number, member: string): Promise<number> {
      return upstash.zadd(key, { score, member }) as Promise<number>;
    },

    async zrange(key: string, start: number | string, stop: number | string): Promise<string[]> {
      return upstash.zrange(key, start as number, stop as number) as Promise<string[]>;
    },

    // ── Hash ops ────────────────────────────────────────────────────────────
    async hset(key: string, ...args: string[]): Promise<number> {
      const obj: Record<string, string> = {};
      for (let i = 0; i < args.length - 1; i += 2) obj[args[i]] = args[i + 1];
      return upstash.hset(key, obj);
    },

    async hgetall(key: string): Promise<Record<string, string> | null> {
      return upstash.hgetall(key) as Promise<Record<string, string> | null>;
    },

    // ── String with TTL ─────────────────────────────────────────────────────
    async setex(key: string, seconds: number, value: string): Promise<void> {
      await upstash.set(key, value, { ex: seconds });
    },

    // ── Key scan ────────────────────────────────────────────────────────────
    async keys(pattern: string): Promise<string[]> {
      const result = await upstash.keys(pattern);
      return result as string[];
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
