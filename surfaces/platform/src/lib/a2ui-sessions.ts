/**
 * A2UI session store.
 *
 * Uses Redis when REDIS_URL / UPSTASH_REDIS_REST_URL is configured.
 * Falls back to an in-process Map for local dev / single-instance staging.
 *
 * Redis keys:
 *   a2ui:session:{id}     → JSON of StoredSession   TTL: 7 days
 *   a2ui:user:{userId}    → Redis Set of session IDs TTL: refreshed on write
 */

import { getRedisClient } from '@/lib/redis/client';
import type { A2UIPayload } from '@/capsules/a2ui/a2ui.types';

const SESSION_TTL = 7 * 86_400; // 7 days
const KEY_SESSION = 'a2ui:session:';
const KEY_USER    = 'a2ui:user:';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StoredSession {
  id: string;
  chatId: string;
  userId: string;
  messageId?: string;
  agentId?: string;
  payload: A2UIPayload;
  dataModel: Record<string, unknown>;
  status: 'active' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
}

// ─── In-memory fallback ────────────────────────────────────────────────────────

const memStore = new Map<string, StoredSession>();

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function redisGet(id: string): Promise<StoredSession | null> {
  const redis = getRedisClient();
  if (!redis) return memStore.get(id) ?? null;
  const raw = await redis.get(`${KEY_SESSION}${id}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredSession; } catch { return null; }
}

async function redisSet(session: StoredSession): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    memStore.set(session.id, session);
    return;
  }
  await Promise.all([
    redis.set(`${KEY_SESSION}${session.id}`, JSON.stringify(session), 'EX', SESSION_TTL),
    redis.sadd(`${KEY_USER}${session.userId}`, session.id),
    redis.expire(`${KEY_USER}${session.userId}`, SESSION_TTL),
  ]);
}

async function redisDel(id: string, userId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    memStore.delete(id);
    return;
  }
  await Promise.all([
    redis.del(`${KEY_SESSION}${id}`),
    redis.srem(`${KEY_USER}${userId}`, id),
  ]);
}

async function redisListByUser(userId: string, chatId?: string): Promise<StoredSession[]> {
  const redis = getRedisClient();
  if (!redis) {
    return [...memStore.values()].filter(
      (s) => s.userId === userId && (!chatId || s.chatId === chatId),
    );
  }

  const ids = await redis.smembers(`${KEY_USER}${userId}`);
  if (!ids.length) return [];

  const raws = await Promise.all(ids.map((id) => redis.get(`${KEY_SESSION}${id}`)));
  const sessions: StoredSession[] = [];
  for (const raw of raws) {
    if (!raw) continue;
    try {
      const s = JSON.parse(raw) as StoredSession;
      if (!chatId || s.chatId === chatId) sessions.push(s);
    } catch { /* skip corrupt entries */ }
  }
  return sessions;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getSession(id: string): Promise<StoredSession | null> {
  return redisGet(id);
}

export async function saveSession(session: StoredSession): Promise<void> {
  await redisSet(session);
}

export async function deleteSession(id: string, userId: string): Promise<void> {
  await redisDel(id, userId);
}

export async function listSessions(userId: string, chatId?: string): Promise<StoredSession[]> {
  return redisListByUser(userId, chatId);
}
