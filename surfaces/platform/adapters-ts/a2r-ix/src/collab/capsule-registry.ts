// OWNER: T2-A5

/**
 * Capsule Registry - GAP-69, 70, 71
 * 
 * Track subscribers and broadcast capsule events
 */

import { EventEmitter } from 'events';

export interface CapsuleEvent {
  /** Event type */
  type: string;
  /** Capsule ID */
  capsuleId: string;
  /** Event payload */
  payload: any;
  /** Timestamp */
  timestamp: Date;
  /** Sender ID */
  senderId?: string;
}

export interface CapsuleSubscriber {
  /** Subscriber ID */
  id: string;
  /** WebSocket connection */
  ws: WebSocket;
  /** Subscribed capsule IDs */
  capsuleIds: Set<string>;
  /** Connection time */
  connectedAt: Date;
  /** Last activity */
  lastActivity: Date;
}

/**
 * Capsule Registry - GAP-69, 70, 71
 * 
 * Track subscribers and broadcast events
 */
export class CapsuleRegistry extends EventEmitter {
  private subscribers: Map<string, Set<CapsuleSubscriber>>;
  private subscriberById: Map<string, CapsuleSubscriber>;
  private capsuleSubscribers: Map<string, Set<string>>;

  constructor() {
    super();
    this.subscribers = new Map();
    this.subscriberById = new Map();
    this.capsuleSubscribers = new Map();
  }

  /**
   * Subscribe to a capsule
   */
  subscribe(capsuleId: string, ws: WebSocket, subscriberId?: string): string {
    const id = subscriberId || this.generateSubscriberId();
    
    const subscriber: CapsuleSubscriber = {
      id,
      ws,
      capsuleIds: new Set([capsuleId]),
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    // Add to subscriber map
    this.subscriberById.set(id, subscriber);

    // Add to capsule subscribers
    if (!this.subscribers.has(capsuleId)) {
      this.subscribers.set(capsuleId, new Set());
    }
    this.subscribers.get(capsuleId)!.add(subscriber);

    // Track capsule subscription
    if (!this.capsuleSubscribers.has(capsuleId)) {
      this.capsuleSubscribers.set(capsuleId, new Set());
    }
    this.capsuleSubscribers.get(capsuleId)!.add(id);

    // Setup WebSocket message handler
    ws.addEventListener('message', (event) => {
      this.handleSubscriberMessage(id, event);
    });

    // Setup close handler
    ws.addEventListener('close', () => {
      this.unsubscribe(id);
    });

    this.emit('subscribe', { subscriberId: id, capsuleId });
    
    return id;
  }

  /**
   * Unsubscribe from a capsule
   */
  unsubscribe(subscriberId: string, capsuleId?: string): void {
    const subscriber = this.subscriberById.get(subscriberId);
    if (!subscriber) return;

    const capsules = capsuleId ? [capsuleId] : Array.from(subscriber.capsuleIds);

    for (const capsule of capsules) {
      const capsuleSubs = this.subscribers.get(capsule);
      if (capsuleSubs) {
        capsuleSubs.delete(subscriber);
        if (capsuleSubs.size === 0) {
          this.subscribers.delete(capsule);
        }
      }

      const capSubs = this.capsuleSubscribers.get(capsule);
      if (capSubs) {
        capSubs.delete(subscriberId);
        if (capSubs.size === 0) {
          this.capsuleSubscribers.delete(capsule);
        }
      }
    }

    if (!capsuleId) {
      this.subscriberById.delete(subscriberId);
    } else {
      subscriber.capsuleIds.delete(capsuleId);
      if (subscriber.capsuleIds.size === 0) {
        this.subscriberById.delete(subscriberId);
      }
    }

    this.emit('unsubscribe', { subscriberId, capsuleId });
  }

  /**
   * Broadcast event to all capsule subscribers
   */
  broadcast(capsuleId: string, event: CapsuleEvent): void {
    const capsuleSubs = this.subscribers.get(capsuleId);
    if (!capsuleSubs || capsuleSubs.size === 0) return;

    const message = JSON.stringify({
      type: 'capsule-event',
      event,
    });

    const failed: string[] = [];

    capsuleSubs.forEach(subscriber => {
      try {
        if (subscriber.ws.readyState === WebSocket.OPEN) {
          subscriber.ws.send(message);
          subscriber.lastActivity = new Date();
        } else {
          failed.push(subscriber.id);
        }
      } catch (error) {
        console.error('Failed to send to subscriber:', error);
        failed.push(subscriber.id);
      }
    });

    // Remove failed subscribers
    failed.forEach(id => this.unsubscribe(id, capsuleId));

    this.emit('broadcast', { capsuleId, event, subscriberCount: capsuleSubs.size - failed.length });
  }

  /**
   * Broadcast to all capsules
   */
  broadcastAll(event: Omit<CapsuleEvent, 'capsuleId'>): void {
    const capsuleIds = Array.from(this.subscribers.keys());
    
    for (const capsuleId of capsuleIds) {
      this.broadcast(capsuleId, {
        ...event,
        capsuleId,
      });
    }
  }

  /**
   * Send event to specific subscriber
   */
  sendToSubscriber(subscriberId: string, event: CapsuleEvent): boolean {
    const subscriber = this.subscriberById.get(subscriberId);
    if (!subscriber) return false;

    try {
      if (subscriber.ws.readyState === WebSocket.OPEN) {
        subscriber.ws.send(JSON.stringify({
          type: 'capsule-event',
          event,
        }));
        subscriber.lastActivity = new Date();
        return true;
      }
    } catch (error) {
      console.error('Failed to send to subscriber:', error);
    }

    return false;
  }

  /**
   * Get subscribers for a capsule
   */
  getCapsuleSubscribers(capsuleId: string): CapsuleSubscriber[] {
    const subs = this.subscribers.get(capsuleId);
    return subs ? Array.from(subs) : [];
  }

  /**
   * Get subscriber count for a capsule
   */
  getSubscriberCount(capsuleId: string): number {
    return this.subscribers.get(capsuleId)?.size || 0;
  }

  /**
   * Get all capsules
   */
  getAllCapsules(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Get subscriber by ID
   */
  getSubscriber(subscriberId: string): CapsuleSubscriber | undefined {
    return this.subscriberById.get(subscriberId);
  }

  /**
   * Get all subscribers
   */
  getAllSubscribers(): CapsuleSubscriber[] {
    return Array.from(this.subscriberById.values());
  }

  /**
   * Get capsules for a subscriber
   */
  getSubscriberCapsules(subscriberId: string): string[] {
    const subscriber = this.subscriberById.get(subscriberId);
    return subscriber ? Array.from(subscriber.capsuleIds) : [];
  }

  /**
   * Handle message from subscriber
   */
  private handleSubscriberMessage(subscriberId: string, event: MessageEvent): void {
    const subscriber = this.subscriberById.get(subscriberId);
    if (!subscriber) return;

    subscriber.lastActivity = new Date();

    try {
      const data = JSON.parse(event.data);
      this.emit('message', {
        subscriberId,
        data,
      });
    } catch (error) {
      console.error('Failed to parse subscriber message:', error);
    }
  }

  /**
   * Generate unique subscriber ID
   */
  private generateSubscriberId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalSubscribers: number;
    totalCapsules: number;
    capsules: Map<string, number>;
  } {
    const capsules = new Map<string, number>();
    this.subscribers.forEach((subs, id) => {
      capsules.set(id, subs.size);
    });

    return {
      totalSubscribers: this.subscriberById.size,
      totalCapsules: this.subscribers.size,
      capsules,
    };
  }

  /**
   * Clean up inactive subscribers
   */
  cleanupInactive(timeoutMs: number = 60000): number {
    const now = Date.now();
    let cleaned = 0;

    this.subscriberById.forEach((subscriber, id) => {
      const inactiveTime = now - subscriber.lastActivity.getTime();
      if (inactiveTime > timeoutMs) {
        this.unsubscribe(id);
        cleaned++;
      }
    });

    return cleaned;
  }

  /**
   * Destroy registry
   */
  destroy(): void {
    this.subscribers.forEach((subs) => {
      subs.forEach(sub => {
        sub.ws.close();
      });
    });
    
    this.subscribers.clear();
    this.subscriberById.clear();
    this.capsuleSubscribers.clear();
    this.removeAllListeners();
  }
}

/**
 * Create capsule registry
 */
export function createCapsuleRegistry(): CapsuleRegistry {
  return new CapsuleRegistry();
}
