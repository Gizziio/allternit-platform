/**
 * Cross-Service Event Bus
 * 
 * Uses memory as event store for platform events
 * Enables event-driven architecture across services
 */

import { EventEmitter } from 'events';
import type { MemoryOrchestrator } from '../orchestrator.js';

export interface PlatformEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  data: Record<string, unknown>;
  tenantId?: string;
  sessionId?: string;
  correlationId?: string;
}

export interface EventSubscription {
  id: string;
  eventTypes: string[];
  callback: (event: PlatformEvent) => void | Promise<void>;
  tenantId?: string;
}

/**
 * Event Bus for cross-service communication
 */
export class EventBus extends EventEmitter {
  private memory: MemoryOrchestrator;
  private subscriptions: Map<string, EventSubscription> = new Map();

  constructor(memory: MemoryOrchestrator) {
    super();
    this.memory = memory;
  }

  /**
   * Publish event to bus and store in memory
   */
  async publish(event: PlatformEvent): Promise<void> {
    // Add metadata
    const enrichedEvent: PlatformEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      id: event.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Store in memory for persistence and querying
    await this.memory.ingest(
      JSON.stringify(enrichedEvent),
      `event:${enrichedEvent.type}:${enrichedEvent.id}`
    );

    // Emit to subscribers
    this.emit('event', enrichedEvent);
    
    // Emit to type-specific subscribers
    this.emit(`event:${enrichedEvent.type}`, enrichedEvent);

    // Call subscription callbacks
    for (const subscription of this.subscriptions.values()) {
      if (
        subscription.eventTypes.includes('*') ||
        subscription.eventTypes.includes(enrichedEvent.type)
      ) {
        if (subscription.tenantId && subscription.tenantId !== enrichedEvent.tenantId) {
          continue; // Skip if tenant doesn't match
        }
        
        try {
          await subscription.callback(enrichedEvent);
        } catch (error) {
          console.error(`Error in event subscription ${subscription.id}:`, error);
        }
      }
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(subscription: Omit<EventSubscription, 'id'>): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.subscriptions.set(id, {
      ...subscription,
      id,
    });

    return id;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Query past events
   */
  async queryEvents(query: {
    type?: string;
    source?: string;
    tenantId?: string;
    sessionId?: string;
    correlationId?: string;
    limit?: number;
  }): Promise<PlatformEvent[]> {
    const searchTerms: string[] = [];
    
    if (query.type) searchTerms.push(`type:${query.type}`);
    if (query.source) searchTerms.push(`source:${query.source}`);
    if (query.tenantId) searchTerms.push(`tenant:${query.tenantId}`);
    if (query.sessionId) searchTerms.push(`session:${query.sessionId}`);
    if (query.correlationId) searchTerms.push(`correlation:${query.correlationId}`);

    const searchQuery = searchTerms.join(' ');
    const memories = this.memory.search(searchQuery);

    // Parse events from memories
    const events: PlatformEvent[] = [];
    
    for (const memory of memories.slice(0, query.limit || 20)) {
      try {
        const event = JSON.parse(memory.content) as PlatformEvent;
        events.push(event);
      } catch {
        // Skip invalid JSON
      }
    }

    return events;
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string): Promise<PlatformEvent | null> {
    const memories = this.memory.search(`event:${eventId}`);
    
    if (memories.length === 0) {
      return null;
    }

    try {
      return JSON.parse(memories[0].content) as PlatformEvent;
    } catch {
      return null;
    }
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
  }
}

/**
 * Common event types for the platform
 */
export const EventTypes = {
  // Agent events
  AGENT_STARTED: 'agent.started',
  AGENT_COMPLETED: 'agent.completed',
  AGENT_FAILED: 'agent.failed',
  AGENT_CHECKPOINT: 'agent.checkpoint',
  
  // Tool events
  TOOL_CALLED: 'tool.called',
  TOOL_COMPLETED: 'tool.completed',
  TOOL_FAILED: 'tool.failed',
  
  // Task events
  TASK_CREATED: 'task.created',
  TASK_STARTED: 'task.started',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  
  // Memory events
  MEMORY_INGESTED: 'memory.ingested',
  MEMORY_CONSOLIDATED: 'memory.consolidated',
  MEMORY_QUERIED: 'memory.queried',
  
  // Session events
  SESSION_STARTED: 'session.started',
  SESSION_PAUSED: 'session.paused',
  SESSION_RESUMED: 'session.resumed',
  SESSION_ENDED: 'session.ended',
  
  // Governance events
  POLICY_CHECK: 'policy.check',
  POLICY_VIOLATION: 'policy.violation',
  RECEIPT_CREATED: 'receipt.created',
  
  // Wildcard for all events
  ALL: '*',
} as const;

/**
 * Create event factory
 */
export function createEvent(
  type: string,
  source: string,
  data: Record<string, unknown>,
  options?: {
    tenantId?: string;
    sessionId?: string;
    correlationId?: string;
  }
): PlatformEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    source,
    timestamp: new Date().toISOString(),
    data,
    ...options,
  };
}
