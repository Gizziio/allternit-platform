/**
 * Rails Event Emitter
 * 
 * Emits events to the a2rchitech Rails ledger.
 * This is the bridge between webhook ingestion and Rails control plane.
 */

import type {
  RailsEvent,
  RailsEventEnvelope,
  ExternalEventReceived,
  WorkRequestCreated,
  AgentMentioned,
  GitHubEventReceived,
  DiscordEventReceived,
  AntFarmEventReceived,
  MoltbookEventReceived,
} from '../types/rails-event.types.js';
import type { NormalizedWebhookEvent } from '../types/webhook.types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Rails client configuration
 */
export interface RailsClientConfig {
  /** Rails API base URL */
  baseUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** Request timeout in ms */
  timeout: number;
  /** Retry attempts */
  maxRetries: number;
  /** Retry delay in ms */
  retryDelay: number;
}

/**
 * Rails event emitter
 */
export class RailsEventEmitter {
  private config: RailsClientConfig;
  private eventQueue: RailsEvent[];
  
  constructor(config: RailsClientConfig) {
    this.config = config;
    this.eventQueue = [];
  }
  
  /**
   * Emit an event to Rails ledger
   * 
   * In production, this would make HTTP calls to the Rails API.
   * For now, we queue events and provide methods to process them.
   */
  async emit(event: RailsEvent): Promise<void> {
    // Validate event
    this.validateEvent(event);
    
    // Queue event (in production, would POST to Rails API)
    this.eventQueue.push(event);
    
    // Log for debugging
    console.log(`[RailsEventEmitter] Queued event: ${event.type} (${event.eventId})`);
  }
  
  /**
   * Emit ExternalEventReceived
   */
  async emitExternalEvent(
    normalizedEvent: NormalizedWebhookEvent,
    signatureVerified: boolean,
    rawPayloadRef?: string
  ): Promise<ExternalEventReceived> {
    const event: ExternalEventReceived = {
      eventId: `evt_ext_${uuidv4()}`,
      timestamp: new Date().toISOString(),
      actor: 'system:webhook',
      scope: {},
      type: 'ExternalEventReceived',
      payload: {
        source: normalizedEvent.source,
        sourceEventType: normalizedEvent.type,
        normalizedData: {
          actor: normalizedEvent.actor,
          target: normalizedEvent.target,
          action: normalizedEvent.action,
          content: normalizedEvent.content,
          context: normalizedEvent.context,
        },
        idempotencyKey: normalizedEvent.idempotencyKey,
        rawPayloadRef,
        signatureVerified,
      },
      provenance: {
        correlationId: normalizedEvent.eventId,
      },
    };
    
    await this.emit(event);
    return event;
  }
  
  /**
   * Emit WorkRequestCreated when webhook requires agent action
   */
  async emitWorkRequest(
    normalizedEvent: NormalizedWebhookEvent,
    role: 'builder' | 'validator' | 'reviewer' | 'security',
    executionMode: 'PLAN_ONLY' | 'REQUIRE_APPROVAL' | 'ACCEPT_EDITS' | 'BYPASS_PERMISSIONS' = 'PLAN_ONLY',
    priority: number = 0
  ): Promise<WorkRequestCreated> {
    const event: WorkRequestCreated = {
      eventId: `evt_wr_${uuidv4()}`,
      timestamp: new Date().toISOString(),
      actor: 'system:webhook',
      scope: {},
      type: 'WorkRequestCreated',
      payload: {
        requestId: `wr_${uuidv4()}`,
        role,
        executionMode,
        priority,
        depsSatisfied: true,
        requiredGates: ['policy_check'],
        requiredEvidence: [],
        leaseRequired: role === 'builder',
        leaseScope: role === 'builder' ? {
          allowedPaths: ['**/*'],
          allowedTools: ['bash', 'read_file', 'write_file'],
        } : undefined,
        externalEventRef: normalizedEvent.eventId,
        correlationId: normalizedEvent.eventId,
      },
      provenance: {
        correlationId: normalizedEvent.eventId,
      },
    };
    
    await this.emit(event);
    return event;
  }
  
  /**
   * Emit AgentMentioned when an agent is @mentioned
   */
  async emitAgentMentioned(
    normalizedEvent: NormalizedWebhookEvent,
    mentionedRole: string,
    mentionedAgentId?: string,
    threadId?: string
  ): Promise<AgentMentioned> {
    const event: AgentMentioned = {
      eventId: `evt_mention_${uuidv4()}`,
      timestamp: new Date().toISOString(),
      actor: normalizedEvent.actor ? `${normalizedEvent.actor.type}:${normalizedEvent.actor.name}` : 'unknown',
      scope: {
        threadId,
      },
      type: 'AgentMentioned',
      payload: {
        mentionedRole,
        mentionedAgentId,
        message: normalizedEvent.content?.text || '',
        source: normalizedEvent.source,
        threadId,
        correlationId: normalizedEvent.eventId,
      },
      provenance: {
        correlationId: normalizedEvent.eventId,
      },
    };
    
    await this.emit(event);
    return event;
  }
  
  /**
   * Emit source-specific event
   */
  async emitSourceEvent(
    normalizedEvent: NormalizedWebhookEvent,
    sourceEventType: string,
    additionalPayload: Record<string, unknown> = {}
  ): Promise<RailsEvent> {
    const baseEvent = {
      eventId: `evt_${normalizedEvent.source}_${uuidv4()}`,
      timestamp: new Date().toISOString(),
      actor: normalizedEvent.actor ? `${normalizedEvent.actor.type}:${normalizedEvent.actor.name}` : 'system',
      scope: {},
      provenance: {
        correlationId: normalizedEvent.eventId,
      },
    };
    
    let event: RailsEvent;
    
    switch (normalizedEvent.source) {
      case 'github':
        event = {
          ...baseEvent,
          type: 'GitHubEventReceived',
          payload: {
            githubEvent: sourceEventType,
            repository: normalizedEvent.context?.repository || '',
            sender: normalizedEvent.actor?.name,
            pullRequestNumber: normalizedEvent.context?.pullRequestNumber 
              ? parseInt(normalizedEvent.context.pullRequestNumber) 
              : undefined,
            issueNumber: normalizedEvent.context?.issueNumber 
              ? parseInt(normalizedEvent.context.issueNumber) 
              : undefined,
            action: normalizedEvent.action?.type || '',
            idempotencyKey: normalizedEvent.idempotencyKey,
            ...additionalPayload,
          },
        } as GitHubEventReceived;
        break;
      
      case 'discord':
        event = {
          ...baseEvent,
          type: 'DiscordEventReceived',
          payload: {
            discordEvent: sourceEventType,
            guildId: normalizedEvent.context?.guildId,
            channelId: normalizedEvent.context?.channelId,
            messageId: normalizedEvent.target?.id,
            authorId: normalizedEvent.actor?.id,
            content: normalizedEvent.content?.text,
            idempotencyKey: normalizedEvent.idempotencyKey,
            ...additionalPayload,
          },
        } as DiscordEventReceived;
        break;
      
      case 'antfarm':
        event = {
          ...baseEvent,
          type: 'AntFarmEventReceived',
          payload: {
            antFarmEvent: sourceEventType,
            roomId: normalizedEvent.context?.roomId,
            messageId: normalizedEvent.target?.id,
            taskId: normalizedEvent.context?.taskId,
            taskStatus: normalizedEvent.context?.taskStatus,
            idempotencyKey: normalizedEvent.idempotencyKey,
            ...additionalPayload,
          },
        } as AntFarmEventReceived;
        break;
      
      case 'moltbook':
        event = {
          ...baseEvent,
          type: 'MoltbookEventReceived',
          payload: {
            moltbookEvent: sourceEventType,
            postId: normalizedEvent.context?.postId,
            commentId: normalizedEvent.context?.commentId,
            realmId: normalizedEvent.context?.realmId,
            idempotencyKey: normalizedEvent.idempotencyKey,
            ...additionalPayload,
          },
        } as MoltbookEventReceived;
        break;
      
      default:
        throw new Error(`Unknown source: ${normalizedEvent.source}`);
    }
    
    await this.emit(event);
    return event;
  }
  
  /**
   * Get queued events (for testing/processing)
   */
  getQueuedEvents(): RailsEvent[] {
    return [...this.eventQueue];
  }
  
  /**
   * Clear queued events
   */
  clearQueue(): void {
    this.eventQueue = [];
  }
  
  /**
   * Validate event structure
   */
  private validateEvent(event: RailsEvent): void {
    const required = ['eventId', 'timestamp', 'actor', 'type', 'payload'];
    
    for (const field of required) {
      if (!(event as Record<string, unknown>)[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!event.eventId.startsWith('evt_')) {
      console.warn('[RailsEventEmitter] Event ID should start with "evt_"');
    }
  }
  
  /**
   * Process queue (send to Rails API)
   * 
   * In production, this would make actual HTTP requests.
   */
  async processQueue(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }
    
    console.log(`[RailsEventEmitter] Processing ${this.eventQueue.length} events...`);
    
    // In production, would POST each event to Rails API
    // For now, just log
    for (const event of this.eventQueue) {
      console.log(`  → ${event.type}: ${event.eventId}`);
    }
    
    this.clearQueue();
  }
}

/**
 * Create default Rails event emitter
 */
export function createRailsEventEmitter(config?: Partial<RailsClientConfig>): RailsEventEmitter {
  return new RailsEventEmitter({
    baseUrl: config?.baseUrl || 'http://127.0.0.1:3011',
    apiKey: config?.apiKey || process.env.A2R_RAILS_API_KEY,
    timeout: config?.timeout || 30000,
    maxRetries: config?.maxRetries || 3,
    retryDelay: config?.retryDelay || 1000,
  });
}
