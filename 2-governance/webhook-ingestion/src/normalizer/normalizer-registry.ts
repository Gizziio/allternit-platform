/**
 * Normalizer Registry
 * 
 * Dispatches webhook payloads to the appropriate normalizer based on source.
 */

import type {
  WebhookPayload,
  WebhookSource,
  NormalizedWebhookEvent,
  GitHubWebhookPayload,
  DiscordWebhookPayload,
  AntFarmWebhookPayload,
  MoltbookWebhookPayload,
  CustomWebhookPayload,
} from '../types/webhook.types.js';
import { normalizeGitHubWebhook } from './github-normalizer.js';
import { normalizeDiscordWebhook } from './discord-normalizer.js';
import { normalizeAntFarmWebhook } from './antfarm-normalizer.js';
import { normalizeMoltbookWebhook } from './moltbook-normalizer.js';

/**
 * Normalizer function type
 */
type NormalizerFn = (payload: WebhookPayload) => NormalizedWebhookEvent;

/**
 * Normalizer registry
 * Maps webhook sources to their normalizer functions
 */
class NormalizerRegistry {
  private normalizers: Map<WebhookSource, NormalizerFn> = new Map();
  
  constructor() {
    this.registerBuiltInNormalizers();
  }
  
  /**
   * Register built-in normalizers
   */
  private registerBuiltInNormalizers(): void {
    this.normalizers.set('github', normalizeGitHubWebhook as NormalizerFn);
    this.normalizers.set('discord', normalizeDiscordWebhook as NormalizerFn);
    this.normalizers.set('antfarm', normalizeAntFarmWebhook as NormalizerFn);
    this.normalizers.set('moltbook', normalizeMoltbookWebhook as NormalizerFn);
  }
  
  /**
   * Register a custom normalizer
   */
  register(source: WebhookSource, normalizer: NormalizerFn): void {
    this.normalizers.set(source, normalizer);
  }
  
  /**
   * Unregister a normalizer
   */
  unregister(source: WebhookSource): void {
    this.normalizers.delete(source);
  }
  
  /**
   * Get normalizer for a source
   */
  getNormalizer(source: WebhookSource): NormalizerFn | undefined {
    return this.normalizers.get(source);
  }
  
  /**
   * Check if a normalizer is registered
   */
  hasNormalizer(source: WebhookSource): boolean {
    return this.normalizers.has(source);
  }
  
  /**
   * Normalize a webhook payload
   * @throws Error if no normalizer is found for the source
   */
  normalize(payload: WebhookPayload): NormalizedWebhookEvent {
    const normalizer = this.getNormalizer(payload.source);
    
    if (!normalizer) {
      throw new Error(`No normalizer registered for source: ${payload.source}`);
    }
    
    return normalizer(payload);
  }
  
  /**
   * Get all registered sources
   */
  getRegisteredSources(): WebhookSource[] {
    return Array.from(this.normalizers.keys());
  }
  
  /**
   * Clear all normalizers (for testing)
   */
  clear(): void {
    this.normalizers.clear();
  }
}

/**
 * Default normalizer for custom webhooks
 * Passes through the custom data with minimal transformation
 */
export function normalizeCustomWebhook(payload: CustomWebhookPayload): NormalizedWebhookEvent {
  const { source, eventType, timestamp, rawPayload: originalRaw, customData } = payload;
  
  // Extract actor if present
  const actor = customData.actor as { id?: string; name?: string; type?: 'human' | 'bot' | 'system' } | undefined;
  
  // Extract target if present
  const targetData = customData.target as { type?: string; id?: string; name?: string; url?: string } | undefined;
  
  // Extract content if present
  const contentData = customData.content as { text?: string; html?: string } | undefined;
  
  return {
    eventId: `evt_custom_${Date.now()}`,
    source,
    type: `custom.${eventType}`,
    timestamp: timestamp,
    actor: actor ? {
      id: actor.id || 'unknown',
      name: actor.name || 'Unknown',
      type: actor.type || 'human',
    } : undefined,
    target: targetData ? {
      type: (targetData.type as 'repository' | 'issue' | 'pull_request' | 'message' | 'post' | 'room') || 'message',
      id: targetData.id || 'unknown',
      name: targetData.name,
      url: targetData.url,
    } : undefined,
    action: customData.action as NormalizedWebhookEvent['action'] | undefined,
    content: contentData ? {
      text: contentData.text,
      html: contentData.html,
    } : undefined,
    context: customData.context as Record<string, string> || {},
    idempotencyKey: `custom_${Date.now()}_${JSON.stringify(customData)}`,
    rawPayload: originalRaw as Record<string, unknown>,
    metadata: {
      receivedAt: new Date().toISOString(),
      normalizerVersion: '1.0.0',
    },
  };
}

// Export singleton instance
export const normalizerRegistry = new NormalizerRegistry();

// Register custom normalizer
normalizerRegistry.register('custom', normalizeCustomWebhook);

/**
 * Normalize any webhook payload
 */
export function normalizeWebhook(payload: WebhookPayload): NormalizedWebhookEvent {
  return normalizerRegistry.normalize(payload);
}

/**
 * Check if source is supported
 */
export function isSourceSupported(source: WebhookSource): boolean {
  return normalizerRegistry.hasNormalizer(source);
}

/**
 * Get list of supported sources
 */
export function getSupportedSources(): WebhookSource[] {
  return normalizerRegistry.getRegisteredSources();
}
