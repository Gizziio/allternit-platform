/**
 * Resumable Streams - Store and resume AI generation streams
 * Uses Redis to persist stream state across page refreshes
 */

import { getRedisClient, isRedisAvailable } from '@/lib/redis/client';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('stream:resumable');

// Stream chunk TTL in seconds (24 hours)
const STREAM_CHUNK_TTL = 60 * 60 * 24;

// Helper function for safe integer parsing
const safeParseInt = (value: unknown): number => {
  const parsed = parseInt(String(value) || '0', 10);
  return isNaN(parsed) ? 0 : parsed;
};

export interface StreamChunk {
  id: string;
  streamId: string;
  index: number;
  content: string;
  timestamp: number;
}

export interface StreamState {
  streamId: string;
  chatId: string;
  messageId: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  lastChunkIndex: number;
  createdAt: number;
  updatedAt: number;
  metadata?: {
    model?: string;
    prompt?: string;
    error?: string;
  };
}

/**
 * Generate a unique stream ID
 */
export function generateStreamId(): string {
  return `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Store a stream chunk in Redis
 */
export async function storeStreamChunk(
  streamId: string,
  chunk: string,
  index: number
): Promise<void> {
  if (!isRedisAvailable()) return;

  const redis = getRedisClient();
  if (!redis) return;

  try {
    const chunkKey = `stream:${streamId}:chunks`;
    const chunkData: StreamChunk = {
      id: `${streamId}:${index}`,
      streamId,
      index,
      content: chunk,
      timestamp: Date.now(),
    };

    // Store chunk in sorted set by index
    await redis.zadd(chunkKey, index, JSON.stringify(chunkData));
    await redis.expire(chunkKey, STREAM_CHUNK_TTL);

    // Update last chunk index
    await redis.hset(`stream:${streamId}:state`, 'lastChunkIndex', index.toString());
    await redis.hset(`stream:${streamId}:state`, 'updatedAt', Date.now().toString());

    log.debug({ streamId, index }, 'Stream chunk stored');
  } catch (error) {
    log.error({ error, streamId }, 'Failed to store stream chunk');
  }
}

/**
 * Store stream state
 */
export async function storeStreamState(state: StreamState): Promise<void> {
  if (!isRedisAvailable()) return;

  const redis = getRedisClient() as any;
  if (!redis) return;

  try {
    const key = `stream:${state.streamId}:state`;
    await redis.hset(key, {
      ...state,
      metadata: JSON.stringify(state.metadata || {}),
    });
    await redis.expire(key, STREAM_CHUNK_TTL);

    // Index by chat and message for lookup
    if (state.chatId) {
      await redis.setex(
        `stream:chat:${state.chatId}:active`,
        STREAM_CHUNK_TTL,
        state.streamId
      );
    }
    if (state.messageId) {
      await redis.setex(
        `stream:message:${state.messageId}`,
        STREAM_CHUNK_TTL,
        state.streamId
      );
    }

    log.debug({ streamId: state.streamId, status: state.status }, 'Stream state stored');
  } catch (error) {
    log.error({ error, streamId: state.streamId }, 'Failed to store stream state');
  }
}

/**
 * Get stream state by ID
 */
export async function getStreamState(streamId: string): Promise<StreamState | null> {
  if (!isRedisAvailable()) return null;

  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const key = `stream:${streamId}:state`;
    const data = await redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) return null;

    return {
      streamId: data.streamId,
      chatId: data.chatId,
      messageId: data.messageId,
      status: data.status as StreamState['status'],
      lastChunkIndex: safeParseInt(data.lastChunkIndex),
      createdAt: safeParseInt(data.createdAt),
      updatedAt: safeParseInt(data.updatedAt),
      metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
    };
  } catch (error) {
    log.error({ error, streamId }, 'Failed to get stream state');
    return null;
  }
}

/**
 * Get all chunks for a stream
 */
export async function getStreamChunks(streamId: string): Promise<StreamChunk[]> {
  if (!isRedisAvailable()) return [];

  const redis = getRedisClient() as any;
  if (!redis) return [];

  try {
    const key = `stream:${streamId}:chunks`;
    const chunks = await redis.zrange(key, 0, -1, 'WITHSCORES');

    const result: StreamChunk[] = [];
    for (let i = 0; i < chunks.length; i += 2) {
      const data = chunks[i];
      try {
        result.push(JSON.parse(data));
      } catch {
        // Skip invalid chunks
      }
    }

    return result.sort((a, b) => a.index - b.index);
  } catch (error) {
    log.error({ error, streamId }, 'Failed to get stream chunks');
    return [];
  }
}

/**
 * Get active stream for a chat
 */
export async function getActiveStreamForChat(chatId: string): Promise<string | null> {
  if (!isRedisAvailable()) return null;

  const redis = getRedisClient();
  if (!redis) return null;

  try {
    return await redis.get(`stream:chat:${chatId}:active`);
  } catch (error) {
    log.error({ error, chatId }, 'Failed to get active stream');
    return null;
  }
}

/**
 * Mark stream as completed
 */
export async function completeStream(streamId: string): Promise<void> {
  await storeStreamState({
    ...(await getStreamState(streamId))!,
    status: 'completed',
    updatedAt: Date.now(),
  });

  log.debug({ streamId }, 'Stream marked as completed');
}

/**
 * Mark stream as error
 */
export async function errorStream(streamId: string, errorMessage: string): Promise<void> {
  const state = await getStreamState(streamId);
  if (state) {
    await storeStreamState({
      ...state,
      status: 'error',
      updatedAt: Date.now(),
      metadata: {
        ...state.metadata,
        error: errorMessage,
      },
    });
  }

  log.debug({ streamId, error: errorMessage }, 'Stream marked as error');
}

/**
 * Delete a stream and all its chunks
 */
export async function deleteStream(streamId: string): Promise<void> {
  if (!isRedisAvailable()) return;

  const redis = getRedisClient();
  if (!redis) return;

  try {
    const state = await getStreamState(streamId);
    
    // Remove chunk data
    await redis.del(`stream:${streamId}:chunks`);
    
    // Remove state
    await redis.del(`stream:${streamId}:state`);

    // Remove indices
    if (state?.chatId) {
      await redis.del(`stream:chat:${state.chatId}:active`);
    }
    if (state?.messageId) {
      await redis.del(`stream:message:${state.messageId}`);
    }

    log.debug({ streamId }, 'Stream deleted');
  } catch (error) {
    log.error({ error, streamId }, 'Failed to delete stream');
  }
}

/**
 * Resume a stream - get all chunks and state for reconstruction
 */
export async function resumeStream(streamId: string): Promise<{
  state: StreamState;
  chunks: StreamChunk[];
} | null> {
  const state = await getStreamState(streamId);
  if (!state) return null;

  const chunks = await getStreamChunks(streamId);

  log.info({ 
    streamId, 
    chunkCount: chunks.length,
    status: state.status 
  }, 'Stream resumed');

  return { state, chunks };
}

/**
 * Get stream statistics (for debugging/monitoring)
 */
export async function getStreamStats(): Promise<{
  activeStreams: number;
  totalChunks: number;
}> {
  if (!isRedisAvailable()) return { activeStreams: 0, totalChunks: 0 };

  const redis = getRedisClient() as any;
  if (!redis) return { activeStreams: 0, totalChunks: 0 };

  try {
    const keys = await redis.keys('stream:*:state');
    let totalChunks = 0;

    for (const key of keys) {
      const streamId = key.split(':')[1];
      const chunkCount = await redis.zcard(`stream:${streamId}:chunks`);
      totalChunks += chunkCount;
    }

    return {
      activeStreams: keys.length,
      totalChunks,
    };
  } catch (error) {
    log.error({ error }, 'Failed to get stream stats');
    return { activeStreams: 0, totalChunks: 0 };
  }
}
