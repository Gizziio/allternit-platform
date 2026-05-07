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

import { allowEphemeralPersistence, requireSharedPersistence } from '@/lib/shared-persistence';
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
  const redis = requireSharedPersistence('A2UI sessions');
  if (!redis) return memStore.get(id) ?? null;
  let raw: string | null = null;
  try {
    raw = await redis.get(`${KEY_SESSION}${id}`);
  } catch (error) {
    if (!allowEphemeralPersistence()) {
      throw new Error(
        `[a2ui-sessions] Shared persistence read failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    raw = memStore.get(id) ? JSON.stringify(memStore.get(id)) : null;
  }
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredSession; } catch { return null; }
}

async function redisSet(session: StoredSession): Promise<void> {
  const redis = requireSharedPersistence('A2UI sessions');
  if (!redis) {
    memStore.set(session.id, session);
    return;
  }
  try {
    await Promise.all([
      redis.set(`${KEY_SESSION}${session.id}`, JSON.stringify(session), 'EX', SESSION_TTL),
      redis.sadd(`${KEY_USER}${session.userId}`, session.id),
      redis.expire(`${KEY_USER}${session.userId}`, SESSION_TTL),
    ]);
  } catch (error) {
    if (!allowEphemeralPersistence()) {
      throw new Error(
        `[a2ui-sessions] Shared persistence write failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    memStore.set(session.id, session);
  }
}

async function redisDel(id: string, userId: string): Promise<void> {
  const redis = requireSharedPersistence('A2UI sessions');
  if (!redis) {
    memStore.delete(id);
    return;
  }
  try {
    await Promise.all([
      redis.del(`${KEY_SESSION}${id}`),
      redis.srem(`${KEY_USER}${userId}`, id),
    ]);
  } catch (error) {
    if (!allowEphemeralPersistence()) {
      throw new Error(
        `[a2ui-sessions] Shared persistence delete failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    memStore.delete(id);
  }
}

async function redisListByUser(userId: string, chatId?: string): Promise<StoredSession[]> {
  const redis = requireSharedPersistence('A2UI sessions');
  if (!redis) {
    return [...memStore.values()].filter(
      (s) => s.userId === userId && (!chatId || s.chatId === chatId),
    );
  }

  let ids: string[] = [];
  try {
    ids = await redis.smembers(`${KEY_USER}${userId}`);
  } catch (error) {
    if (!allowEphemeralPersistence()) {
      throw new Error(
        `[a2ui-sessions] Shared persistence list failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return [...memStore.values()].filter(
      (s) => s.userId === userId && (!chatId || s.chatId === chatId),
    );
  }
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
