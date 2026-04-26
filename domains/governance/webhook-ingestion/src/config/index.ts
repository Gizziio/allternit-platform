/**
 * Webhook Service Configuration
 */

import { z } from 'zod';

/**
 * Environment variables schema
 */
export const envSchema = z.object({
  // Server
  WEBHOOK_PORT: z.string().default('8787'),
  WEBHOOK_HOST: z.string().default('0.0.0.0'),
  WEBHOOK_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // CORS
  WEBHOOK_CORS_ORIGINS: z.string().default('*'),
  
  // Secrets
  WEBHOOK_GITHUB_SECRET: z.string().optional(),
  WEBHOOK_DISCORD_SECRET: z.string().optional(),
  WEBHOOK_ANTFARM_SECRET: z.string().optional(),
  WEBHOOK_MOLTBOOK_SECRET: z.string().optional(),
  
  // Rails
  Allternit_RAILS_URL: z.string().default('http://127.0.0.1:3011'),
  Allternit_RAILS_API_KEY: z.string().optional(),
  
  // Rate limiting
  RATE_LIMIT_MAX_REQUESTS: z.string().default('60'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  
  // Idempotency
  DEDUP_TTL_SECONDS: z.string().default('3600'),
  DEDUP_CLEANUP_INTERVAL_SECONDS: z.string().default('300'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Webhook source configuration
 */
export interface WebhookSourceConfig {
  enabled: boolean;
  secret?: string;
  allowlist?: string[];
  blocklist?: string[];
}

/**
 * Complete service configuration
 */
export interface ServiceConfig {
  server: {
    port: number;
    host: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  cors: {
    origins: string[];
  };
  secrets: Map<string, string>;
  sources: Map<string, WebhookSourceConfig>;
  rails: {
    url: string;
    apiKey?: string;
  };
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  dedup: {
    ttlSeconds: number;
    cleanupIntervalSeconds: number;
  };
}

/**
 * Parse environment variables into config
 */
export function parseConfig(env: Record<string, string | undefined>): ServiceConfig {
  const parsed = envSchema.parse(env);
  
  const corsOrigins = parsed.WEBHOOK_CORS_ORIGINS === '*' 
    ? ['*'] 
    : parsed.WEBHOOK_CORS_ORIGINS.split(',').map(s => s.trim());
  
  const sources = new Map<string, WebhookSourceConfig>();
  
  // GitHub
  sources.set('github', {
    enabled: true,
    secret: parsed.WEBHOOK_GITHUB_SECRET,
  });
  
  // Discord
  sources.set('discord', {
    enabled: true,
    secret: parsed.WEBHOOK_DISCORD_SECRET,
  });
  
  // Ant Farm
  sources.set('antfarm', {
    enabled: true,
    secret: parsed.WEBHOOK_ANTFARM_SECRET,
  });
  
  // Moltbook
  sources.set('moltbook', {
    enabled: true,
    secret: parsed.WEBHOOK_MOLTBOOK_SECRET,
  });
  
  return {
    server: {
      port: parseInt(parsed.WEBHOOK_PORT),
      host: parsed.WEBHOOK_HOST,
      logLevel: parsed.WEBHOOK_LOG_LEVEL,
    },
    cors: {
      origins: corsOrigins,
    },
    secrets: new Map(
      Array.from(sources.entries())
        .filter(([_, config]) => config.secret)
        .map(([source, config]) => [source, config.secret!])
    ),
    sources,
    rails: {
      url: parsed.Allternit_RAILS_URL,
      apiKey: parsed.Allternit_RAILS_API_KEY,
    },
    rateLimit: {
      maxRequests: parseInt(parsed.RATE_LIMIT_MAX_REQUESTS),
      windowMs: parseInt(parsed.RATE_LIMIT_WINDOW_MS),
    },
    dedup: {
      ttlSeconds: parseInt(parsed.DEDUP_TTL_SECONDS),
      cleanupIntervalSeconds: parseInt(parsed.DEDUP_CLEANUP_INTERVAL_SECONDS),
    },
  };
}

/**
 * Load configuration from environment
 */
export function loadConfig(): ServiceConfig {
  return parseConfig(process.env as Record<string, string | undefined>);
}

/**
 * Validate configuration
 */
export function validateConfig(config: ServiceConfig): void {
  const errors: string[] = [];
  
  // Validate port
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push(`Invalid port: ${config.server.port}`);
  }
  
  // Validate rate limit
  if (config.rateLimit.maxRequests < 1) {
    errors.push('Rate limit max requests must be positive');
  }
  
  // Validate dedup TTL
  if (config.dedup.ttlSeconds < 60) {
    errors.push('Dedup TTL must be at least 60 seconds');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
