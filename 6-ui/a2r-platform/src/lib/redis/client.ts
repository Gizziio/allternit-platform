/**
 * Redis client for resumable streams and caching
 * Uses ioredis for Redis connectivity
 */

import Redis from 'ioredis';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('redis');

// Redis client singleton
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  
  if (!redisUrl) {
    log.warn('REDIS_URL not configured, resumable streams will not be available');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err) => {
      log.error({ error: err.message }, 'Redis error');
    });

    redisClient.on('connect', () => {
      log.info('Redis connected');
    });

    return redisClient;
  } catch (error) {
    log.error({ error }, 'Failed to connect to Redis');
    return null;
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return !!process.env.REDIS_URL || !!process.env.UPSTASH_REDIS_REST_URL;
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    log.info('Redis connection closed');
  }
}
