/**
 * Idempotency Key Generator
 * 
 * Generates deterministic idempotency keys for webhook deduplication.
 */

import { createHash } from 'crypto';
import type {
  WebhookPayload,
  NormalizedWebhookEvent,
} from '../types/webhook.types.js';
import type {
  IdempotencyKeyOptions,
  IdempotencyKeyResult,
} from '../types/idempotency.types.js';

/**
 * Default options for idempotency key generation
 */
const DEFAULT_OPTIONS: IdempotencyKeyOptions = {
  includeSource: true,
  includeEventType: true,
  includeActor: true,
  includeTarget: true,
  includeTimestamp: {
    enabled: true,
    intervalSeconds: 60, // Round to minute
  },
};

/**
 * Generate idempotency key from webhook payload
 */
export function generateIdempotencyKey(
  payload: WebhookPayload,
  options: Partial<IdempotencyKeyOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const components: string[] = [];
  
  // Include source
  if (opts.includeSource) {
    components.push(`source:${payload.source}`);
  }
  
  // Include event type
  if (opts.includeEventType) {
    components.push(`type:${payload.eventType}`);
  }
  
  // Include actor
  if (opts.includeActor) {
    const actor = extractActor(payload);
    if (actor) {
      components.push(`actor:${actor}`);
    }
  }
  
  // Include target
  if (opts.includeTarget) {
    const target = extractTarget(payload);
    if (target) {
      components.push(`target:${target}`);
    }
  }
  
  // Include timestamp (rounded)
  if (opts.includeTimestamp?.enabled) {
    const interval = opts.includeTimestamp.intervalSeconds * 1000;
    const rounded = Math.floor(new Date(payload.timestamp).getTime() / interval);
    components.push(`ts:${rounded}`);
  }
  
  // Include custom fields
  if (opts.customFields) {
    for (const field of opts.customFields) {
      const value = extractField(payload, field);
      if (value !== undefined) {
        components.push(`${field}:${value}`);
      }
    }
  }
  
  // Generate hash
  const keyString = components.join('|');
  const hash = createHash('sha256').update(keyString).digest('hex');
  
  // Prefix with source abbreviation
  const prefix = getSourcePrefix(payload.source);
  
  return `${prefix}_${hash.slice(0, 16)}`;
}

/**
 * Generate idempotency key from normalized event
 */
export function generateIdempotencyKeyFromNormalized(
  event: NormalizedWebhookEvent
): string {
  return event.idempotencyKey;
}

/**
 * Extract actor identifier from payload
 */
function extractActor(payload: WebhookPayload): string | null {
  switch (payload.source) {
    case 'github':
      return payload.sender?.login || null;
    case 'discord':
      return payload.author?.username || payload.member?.username || null;
    case 'antfarm':
      return payload.message?.author?.name || payload.task?.requestedBy || null;
    case 'moltbook':
      return payload.post?.author?.name || payload.comment?.author?.name || null;
    case 'custom':
      return (payload.customData?.actor as { name?: string })?.name || null;
    default:
      return null;
  }
}

/**
 * Extract target identifier from payload
 */
function extractTarget(payload: WebhookPayload): string | null {
  switch (payload.source) {
    case 'github':
      if (payload.pullRequest?.number) {
        return `pr:${payload.pullRequest.number}`;
      }
      if (payload.issue?.number) {
        return `issue:${payload.issue.number}`;
      }
      if (payload.comment?.id) {
        return `comment:${payload.comment.id}`;
      }
      return `repo:${payload.repository.fullName}`;
    
    case 'discord':
      if (payload.message?.id) {
        return `msg:${payload.message.id}`;
      }
      if (payload.channel?.id) {
        return `channel:${payload.channel.id}`;
      }
      return null;
    
    case 'antfarm':
      if (payload.task?.id) {
        return `task:${payload.task.id}`;
      }
      if (payload.message?.id) {
        return `msg:${payload.message.id}`;
      }
      return null;
    
    case 'moltbook':
      if (payload.post?.id) {
        return `post:${payload.post.id}`;
      }
      if (payload.comment?.id) {
        return `comment:${payload.comment.id}`;
      }
      return null;
    
    case 'custom':
      return (payload.customData?.target as { id?: string })?.id || null;
    
    default:
      return null;
  }
}

/**
 * Extract field value from payload
 */
function extractField(payload: WebhookPayload, field: string): string | undefined {
  const raw = payload.rawPayload as Record<string, unknown>;
  
  // Handle nested fields (e.g., "repository.name")
  const parts = field.split('.');
  let value: unknown = raw;
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  
  if (value === undefined || value === null) {
    return undefined;
  }
  
  return String(value);
}

/**
 * Get source prefix for key
 */
function getSourcePrefix(source: string): string {
  const prefixes: Record<string, string> = {
    github: 'gh',
    discord: 'dc',
    antfarm: 'af',
    moltbook: 'mb',
    slack: 'sl',
    custom: 'cx',
  };
  
  return prefixes[source] || source.slice(0, 2);
}

/**
 * Validate idempotency key format
 */
export function validateIdempotencyKey(key: string): boolean {
  // Format: prefix_hexstring (e.g., "gh_abc123...")
  const regex = /^[a-z]{2,8}_[a-f0-9]{8,64}$/i;
  return regex.test(key);
}

/**
 * Parse idempotency key into components
 */
export function parseIdempotencyKey(key: string): { prefix: string; hash: string } | null {
  const parts = key.split('_');
  if (parts.length !== 2) {
    return null;
  }
  
  return {
    prefix: parts[0],
    hash: parts[1],
  };
}

/**
 * Generate idempotency key result with metadata
 */
export function generateIdempotencyKeyResult(
  payload: WebhookPayload,
  options?: Partial<IdempotencyKeyOptions>
): IdempotencyKeyResult {
  const key = generateIdempotencyKey(payload, options);
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Build components list
  const components: string[] = [];
  
  if (opts.includeSource) components.push('source');
  if (opts.includeEventType) components.push('eventType');
  if (opts.includeActor) components.push('actor');
  if (opts.includeTarget) components.push('target');
  if (opts.includeTimestamp?.enabled) {
    components.push(`timestamp(${opts.includeTimestamp.intervalSeconds}s)`);
  }
  if (opts.customFields) {
    components.push(...opts.customFields.map(f => `custom:${f}`));
  }
  
  return {
    key,
    components,
    algorithm: 'sha256',
    generatedAt: new Date().toISOString(),
  };
}
