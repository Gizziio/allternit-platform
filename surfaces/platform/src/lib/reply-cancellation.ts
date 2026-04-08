/**
 * Reply cancellation store.
 *
 * Cross-process cancellation for streaming replies.
 * The cancel endpoint writes a flag; the streaming handler polls it.
 *
 * Redis keys:
 *   reply:active:{replyId}  → "1"   TTL: 10 min (auto-cleans if handler dies)
 *   reply:cancel:{replyId}  → "1"   TTL: 2 min  (consumed by the streaming loop)
 *
 * In-memory fallback (single-process / local dev):
 *   Cancellation works within the same process only.
 */

import { getRedisClient } from '@/lib/redis/client';

const ACTIVE_TTL = 600;  // 10 min
const CANCEL_TTL = 120;  // 2 min

// ─── In-memory fallback ────────────────────────────────────────────────────────

const activeMem = new Set<string>();
const cancelMem = new Set<string>();

// ─── Public API ────────────────────────────────────────────────────────────────

/** Called when a streaming reply starts. */
export async function markReplyActive(replyId: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.set(`reply:active:${replyId}`, '1', 'EX', ACTIVE_TTL);
  } else {
    activeMem.add(replyId);
  }
}

/** Called when a streaming reply finishes (success or error). */
export async function markReplyDone(replyId: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await Promise.all([
      redis.del(`reply:active:${replyId}`),
      redis.del(`reply:cancel:${replyId}`),
    ]).catch(() => {});
  } else {
    activeMem.delete(replyId);
    cancelMem.delete(replyId);
  }
}

/**
 * Request cancellation of a reply.
 * Returns true if the reply is currently active, false if unknown.
 */
export async function requestCancel(replyId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    const active = await redis.exists(`reply:active:${replyId}`);
    await redis.set(`reply:cancel:${replyId}`, '1', 'EX', CANCEL_TTL);
    return active > 0;
  }
  const active = activeMem.has(replyId);
  cancelMem.add(replyId);
  return active;
}

/**
 * Returns true if cancellation has been requested for this reply.
 * Non-blocking — intended to be called in the streaming loop.
 */
export async function isCancelled(replyId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    const val = await redis.exists(`reply:cancel:${replyId}`);
    return val > 0;
  }
  return cancelMem.has(replyId);
}
