/**
 * Allowlist Validator
 * 
 * Validates webhook sources and event types against configured allowlists.
 */

import type { WebhookSource, WebhookEventType } from '../types/webhook.types.js';

/**
 * Allowlist configuration
 */
export interface AllowlistConfig {
  /** Allowed sources */
  sources?: WebhookSource[];
  /** Allowed event types per source */
  eventTypes?: Map<WebhookSource, Set<string>>;
  /** Blocked sources (takes precedence) */
  blockedSources?: WebhookSource[];
  /** Blocked event types */
  blockedEventTypes?: Map<WebhookSource, Set<string>>;
  /** Allow by default (if true, allowlist is a blocklist) */
  allowByDefault?: boolean;
}

/**
 * Validation result
 */
export interface AllowlistValidationResult {
  /** Whether allowed */
  allowed: boolean;
  /** Reason if blocked */
  reason?: string;
  /** Rule that matched */
  matchedRule?: 'source_allowed' | 'source_blocked' | 'event_allowed' | 'event_blocked';
}

/**
 * Allowlist validator class
 */
export class AllowlistValidator {
  private config: AllowlistConfig;
  
  constructor(config: AllowlistConfig = {}) {
    this.config = config;
  }
  
  /**
   * Validate a webhook
   */
  validate(source: WebhookSource, eventType: WebhookEventType): AllowlistValidationResult {
    // Check blocked sources first
    if (this.isSourceBlocked(source)) {
      return {
        allowed: false,
        reason: `Source '${source}' is blocked`,
        matchedRule: 'source_blocked',
      };
    }
    
    // Check if source is allowed
    if (!this.isSourceAllowed(source)) {
      return {
        allowed: false,
        reason: `Source '${source}' is not in the allowlist`,
        matchedRule: 'source_allowed',
      };
    }
    
    // Check blocked event types
    if (this.isEventTypeBlocked(source, eventType)) {
      return {
        allowed: false,
        reason: `Event type '${eventType}' is blocked for source '${source}'`,
        matchedRule: 'event_blocked',
      };
    }
    
    // Check if event type is allowed
    if (!this.isEventTypeAllowed(source, eventType)) {
      return {
        allowed: false,
        reason: `Event type '${eventType}' is not allowed for source '${source}'`,
        matchedRule: 'event_allowed',
      };
    }
    
    return {
      allowed: true,
      matchedRule: 'event_allowed',
    };
  }
  
  /**
   * Check if source is blocked
   */
  private isSourceBlocked(source: WebhookSource): boolean {
    return this.config.blockedSources?.includes(source) || false;
  }
  
  /**
   * Check if source is allowed
   */
  private isSourceAllowed(source: WebhookSource): boolean {
    // If allowByDefault, source is allowed unless blocked
    if (this.config.allowByDefault) {
      return true;
    }
    
    // Check explicit allowlist
    return this.config.sources?.includes(source) || false;
  }
  
  /**
   * Check if event type is blocked
   */
  private isEventTypeBlocked(source: WebhookSource, eventType: WebhookEventType): boolean {
    const blockedTypes = this.config.blockedEventTypes?.get(source);
    return blockedTypes?.has(eventType) || false;
  }
  
  /**
   * Check if event type is allowed
   */
  private isEventTypeAllowed(source: WebhookSource, eventType: WebhookEventType): boolean {
    // If allowByDefault, event type is allowed unless blocked
    if (this.config.allowByDefault) {
      return true;
    }
    
    // If no event type allowlist, allow all
    const allowedTypes = this.config.eventTypes?.get(source);
    if (!allowedTypes) {
      return true;
    }
    
    return allowedTypes.has(eventType);
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<AllowlistConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Add source to allowlist
   */
  allowSource(source: WebhookSource): void {
    if (!this.config.sources) {
      this.config.sources = [];
    }
    if (!this.config.sources.includes(source)) {
      this.config.sources.push(source);
    }
  }
  
  /**
   * Block source
   */
  blockSource(source: WebhookSource): void {
    if (!this.config.blockedSources) {
      this.config.blockedSources = [];
    }
    if (!this.config.blockedSources.includes(source)) {
      this.config.blockedSources.push(source);
    }
  }
  
  /**
   * Allow event type for source
   */
  allowEventType(source: WebhookSource, eventType: string): void {
    if (!this.config.eventTypes) {
      this.config.eventTypes = new Map();
    }
    
    let types = this.config.eventTypes.get(source);
    if (!types) {
      types = new Set();
      this.config.eventTypes.set(source, types);
    }
    
    types.add(eventType);
  }
  
  /**
   * Block event type for source
   */
  blockEventType(source: WebhookSource, eventType: string): void {
    if (!this.config.blockedEventTypes) {
      this.config.blockedEventTypes = new Map();
    }
    
    let types = this.config.blockedEventTypes.get(source);
    if (!types) {
      types = new Set();
      this.config.blockedEventTypes.set(source, types);
    }
    
    types.add(eventType);
  }
  
  /**
   * Get current configuration
   */
  getConfig(): AllowlistConfig {
    return { ...this.config };
  }
  
  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = {};
  }
}

/**
 * Create default allowlist validator with common settings
 */
export function createDefaultAllowlistValidator(): AllowlistValidator {
  const validator = new AllowlistValidator({
    allowByDefault: false,
    sources: ['github', 'discord', 'antfarm', 'moltbook'],
  });
  
  // Allow common event types for GitHub
  const githubEvents = [
    'pull_request.opened',
    'pull_request.closed',
    'pull_request.reopened',
    'pull_request.synchronize',
    'pull_request_review.submitted',
    'pull_request_comment.created',
    'issue_comment.created',
    'issues.opened',
    'issues.closed',
    'issues.labeled',
    'push',
  ];
  
  for (const event of githubEvents) {
    validator.allowEventType('github', event);
  }
  
  // Allow common event types for Discord
  const discordEvents = [
    'message.create',
    'message.update',
    'member.join',
    'reaction.add',
  ];
  
  for (const event of discordEvents) {
    validator.allowEventType('discord', event);
  }
  
  // Allow common event types for Ant Farm
  const antFarmEvents = [
    'room.message.created',
    'room.task.requested',
    'room.member.joined',
    'task.acknowledged',
    'task.completed',
  ];
  
  for (const event of antFarmEvents) {
    validator.allowEventType('antfarm', event);
  }
  
  // Allow common event types for Moltbook
  const moltbookEvents = [
    'post.created',
    'comment.created',
    'mention.received',
    'challenge.created',
  ];
  
  for (const event of moltbookEvents) {
    validator.allowEventType('moltbook', event);
  }
  
  return validator;
}
