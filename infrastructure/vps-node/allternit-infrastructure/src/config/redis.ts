import Redis from 'ioredis';
import config from './index';
import { logger } from '../utils/logger';

// Redis connection options
const redisOptions: Redis.RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  db: config.redis.db,
  keyPrefix: config.redis.keyPrefix,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  lazyConnect: true,
};

// Add password if configured
if (config.redis.password && config.redis.password.length > 0) {
  redisOptions.password = config.redis.password;
}

// Create Redis client
export const redis = new Redis(redisOptions);

// Event handlers
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (err: Error) => {
  logger.error('Redis client error', { error: err.message });
});

redis.on('close', () => {
  logger.warn('Redis client connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting');
});

redis.on('end', () => {
  logger.info('Redis client connection ended');
});

/**
 * Connect to Redis
 */
export async function connect(): Promise<void> {
  if (redis.status === 'ready') {
    return;
  }
  await redis.connect();
}

/**
 * Disconnect from Redis
 */
export async function disconnect(): Promise<void> {
  await redis.quit();
}

/**
 * Set a value with optional TTL
 */
export async function set(
  key: string,
  value: string | number | Buffer,
  ttlSeconds?: number
): Promise<void> {
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, value);
  } else {
    await redis.set(key, value);
  }
}

/**
 * Get a value
 */
export async function get(key: string): Promise<string | null> {
  return await redis.get(key);
}

/**
 * Delete a key
 */
export async function del(key: string): Promise<void> {
  await redis.del(key);
}

/**
 * Set JSON value
 */
export async function setJson<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const serialized = JSON.stringify(value);
  await set(key, serialized, ttlSeconds);
}

/**
 * Get JSON value
 */
export async function getJson<T>(key: string): Promise<T | null> {
  const value = await get(key);
  if (value === null) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('Failed to parse JSON from Redis', { key, error });
    return null;
  }
}

/**
 * Check if key exists
 */
export async function exists(key: string): Promise<boolean> {
  const result = await redis.exists(key);
  return result === 1;
}

/**
 * Set key expiration
 */
export async function expire(key: string, seconds: number): Promise<void> {
  await redis.expire(key, seconds);
}

/**
 * Get TTL of a key
 */
export async function ttl(key: string): Promise<number> {
  return await redis.ttl(key);
}

/**
 * Increment a counter
 */
export async function incr(key: string): Promise<number> {
  return await redis.incr(key);
}

/**
 * Increment by a specific amount
 */
export async function incrBy(key: string, increment: number): Promise<number> {
  return await redis.incrby(key, increment);
}

/**
 * Decrement a counter
 */
export async function decr(key: string): Promise<number> {
  return await redis.decr(key);
}

/**
 * Add to a set
 */
export async function sadd(key: string, ...members: (string | number | Buffer)[]): Promise<void> {
  await redis.sadd(key, ...members);
}

/**
 * Get all members of a set
 */
export async function smembers(key: string): Promise<string[]> {
  return await redis.smembers(key);
}

/**
 * Remove from a set
 */
export async function srem(key: string, ...members: (string | number | Buffer)[]): Promise<void> {
  await redis.srem(key, ...members);
}

/**
 * Push to a list
 */
export async function lpush(key: string, ...values: (string | number | Buffer)[]): Promise<void> {
  await redis.lpush(key, ...values);
}

/**
 * Push to end of a list
 */
export async function rpush(key: string, ...values: (string | number | Buffer)[]): Promise<void> {
  await redis.rpush(key, ...values);
}

/**
 * Get range from a list
 */
export async function lrange(key: string, start: number, stop: number): Promise<string[]> {
  return await redis.lrange(key, start, stop);
}

/**
 * Get list length
 */
export async function llen(key: string): Promise<number> {
  return await redis.llen(key);
}

/**
 * Trim list to specific range
 */
export async function ltrim(key: string, start: number, stop: number): Promise<void> {
  await redis.ltrim(key, start, stop);
}

/**
 * Publish message to channel
 */
export async function publish(channel: string, message: string): Promise<void> {
  await redis.publish(channel, message);
}

/**
 * Create a new Redis subscriber client
 */
export function createSubscriber(): Redis {
  return new Redis(redisOptions);
}

/**
 * Subscribe to channel
 */
export async function subscribe(
  subscriber: Redis,
  channel: string,
  callback: (message: string, channel: string) => void
): Promise<void> {
  subscriber.subscribe(channel);
  subscriber.on('message', (receivedChannel: string, message: string) => {
    if (receivedChannel === channel) {
      callback(message, receivedChannel);
    }
  });
}

/**
 * Unsubscribe from channel
 */
export async function unsubscribe(subscriber: Redis, channel: string): Promise<void> {
  await subscriber.unsubscribe(channel);
}

/**
 * Pattern subscribe
 */
export async function psubscribe(
  subscriber: Redis,
  pattern: string,
  callback: (message: string, channel: string) => void
): Promise<void> {
  subscriber.psubscribe(pattern);
  subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
    callback(message, channel);
  });
}

/**
 * Pattern unsubscribe
 */
export async function punsubscribe(subscriber: Redis, pattern: string): Promise<void> {
  await subscriber.punsubscribe(pattern);
}

/**
 * Flush all data (use with caution!)
 */
export async function flushAll(): Promise<void> {
  await redis.flushall();
}

/**
 * Get Redis info
 */
export async function info(): Promise<string> {
  return await redis.info();
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ healthy: boolean; latency: number; message?: string }> {
  const start = Date.now();
  try {
    await redis.ping();
    const latency = Date.now() - start;
    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    const latency = Date.now() - start;
    return {
      healthy: false,
      latency,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default redis;
