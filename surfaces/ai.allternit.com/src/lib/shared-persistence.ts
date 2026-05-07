import { getRedisClient, type RedisClient } from "@/lib/redis/client";

const ALLOW_EPHEMERAL_PERSISTENCE =
  process.env.ALLTERNIT_PLATFORM_ALLOW_EPHEMERAL_PERSISTENCE === "1";

export function allowEphemeralPersistence(): boolean {
  return ALLOW_EPHEMERAL_PERSISTENCE;
}

export function requireSharedPersistence(feature: string): RedisClient | null {
  const redis = getRedisClient();
  if (redis) return redis;

  if (ALLOW_EPHEMERAL_PERSISTENCE) {
    console.warn(
      `[shared-persistence] ${feature} is using ephemeral in-memory storage because ALLTERNIT_PLATFORM_ALLOW_EPHEMERAL_PERSISTENCE=1`,
    );
    return null;
  }

  throw new Error(
    `${feature} requires shared Redis-backed persistence. Configure KV_REST_API_URL and KV_REST_API_TOKEN, or explicitly opt into ephemeral storage with ALLTERNIT_PLATFORM_ALLOW_EPHEMERAL_PERSISTENCE=1.`,
  );
}
