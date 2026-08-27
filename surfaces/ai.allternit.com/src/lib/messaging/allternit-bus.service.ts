/**
 * AllternitBus Messaging Service
 *
 * Client implementation for the internal AllternitBus cloud-orchestration
 * message bus. Uses Server-Sent Events (EventSource) for inbound envelopes and
 * fetch for outbound envelopes. This keeps the client simple, browser-friendly,
 * and compatible with the existing API gateway pattern.
 */

import type {
  AllternitBusClient,
  AllternitBusClientConfig,
  AllternitBusEnvelope,
  AllternitBusSendOptions,
} from './allternit-bus.types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('AllternitBus');

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class AllternitBusClientImpl implements AllternitBusClient {
  private config: AllternitBusClientConfig;
  private eventSource: EventSource | null = null;
  private subscriptions = new Map<string, Set<(envelope: AllternitBusEnvelope) => void>>();
  private _connected = false;

  constructor(config: AllternitBusClientConfig) {
    this.config = config;
  }

  get connected(): boolean {
    return this._connected;
  }

  connect(): void {
    if (this.eventSource) return;

    // Route paths remain /api/v1/photon for backward compatibility.
    const url = new URL('/api/v1/photon/stream', this.config.baseUrl);
    url.searchParams.set('identity', this.config.identity);
    if (this.config.defaultTopic) {
      url.searchParams.set('topic', this.config.defaultTopic);
    }
    if (this.config.token) {
      url.searchParams.set('token', this.config.token);
    }

    logger.debug({ identity: this.config.identity }, 'Connecting AllternitBus stream');

    this.eventSource = new EventSource(url.toString());

    this.eventSource.onopen = () => {
      this._connected = true;
      logger.debug({ identity: this.config.identity }, 'AllternitBus stream connected');
    };

    this.eventSource.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data) as AllternitBusEnvelope;
        this.dispatch(envelope);
      } catch (err) {
        logger.error({ err }, 'Failed to parse AllternitBus envelope');
      }
    };

    this.eventSource.onerror = (err) => {
      logger.error({ err }, 'AllternitBus stream error');
      this._connected = false;
    };
  }

  disconnect(): void {
    if (!this.eventSource) return;
    this.eventSource.close();
    this.eventSource = null;
    this._connected = false;
    this.subscriptions.clear();
    logger.debug({ identity: this.config.identity }, 'AllternitBus stream disconnected');
  }

  async send(
    to: string,
    topic: string,
    payload: Record<string, unknown>,
    options: AllternitBusSendOptions = {}
  ): Promise<void> {
    const envelope: AllternitBusEnvelope = {
      id: generateId(),
      kind: options.kind ?? 'agent_to_agent',
      from: this.config.identity,
      to,
      topic,
      payload,
      priority: options.priority ?? 'normal',
      timestamp: new Date().toISOString(),
      correlationId: options.correlationId,
      ttl: options.ttl,
    };

    // Route paths remain /api/v1/photon for backward compatibility.
    const url = new URL('/api/v1/photon/send', this.config.baseUrl);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new Error(`AllternitBus send failed: ${response.status} ${text}`);
    }
  }

  subscribe(
    topic: string,
    handler: (envelope: AllternitBusEnvelope) => void
  ): () => void {
    let handlers = this.subscriptions.get(topic);
    if (!handlers) {
      handlers = new Set();
      this.subscriptions.set(topic, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers?.delete(handler);
      if (handlers?.size === 0) {
        this.subscriptions.delete(topic);
      }
    };
  }

  async broadcast(
    topic: string,
    payload: Record<string, unknown>,
    options: AllternitBusSendOptions = {}
  ): Promise<void> {
    return this.send(topic, topic, payload, { ...options, kind: 'broadcast' });
  }

  private dispatch(envelope: AllternitBusEnvelope): void {
    // Dispatch to topic subscribers
    const topicHandlers = this.subscriptions.get(envelope.topic);
    if (topicHandlers) {
      topicHandlers.forEach((handler) => {
        try {
          handler(envelope);
        } catch (err) {
          logger.error({ err }, 'AllternitBus handler threw');
        }
      });
    }

    // Dispatch to direct-address subscribers
    const addressHandlers = this.subscriptions.get(envelope.to);
    if (addressHandlers) {
      addressHandlers.forEach((handler) => {
        try {
          handler(envelope);
        } catch (err) {
          logger.error({ err }, 'AllternitBus handler threw');
        }
      });
    }
  }
}

export function createAllternitBusClient(config: AllternitBusClientConfig): AllternitBusClient {
  return new AllternitBusClientImpl(config);
}
