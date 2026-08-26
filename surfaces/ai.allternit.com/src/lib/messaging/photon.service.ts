/**
 * Photon Messaging Service
 *
 * Client implementation for the Photon cloud-orchestration message bus.
 * Uses Server-Sent Events (EventSource) for inbound envelopes and fetch for
 * outbound envelopes. This keeps the client simple, browser-friendly, and
 * compatible with the existing API gateway pattern.
 */

import type {
  PhotonClient,
  PhotonClientConfig,
  PhotonEnvelope,
  PhotonSendOptions,
} from './photon.types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('Photon');

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class PhotonClientImpl implements PhotonClient {
  private config: PhotonClientConfig;
  private eventSource: EventSource | null = null;
  private subscriptions = new Map<string, Set<(envelope: PhotonEnvelope) => void>>();
  private _connected = false;

  constructor(config: PhotonClientConfig) {
    this.config = config;
  }

  get connected(): boolean {
    return this._connected;
  }

  connect(): void {
    if (this.eventSource) return;

    const url = new URL('/api/v1/photon/stream', this.config.baseUrl);
    url.searchParams.set('identity', this.config.identity);
    if (this.config.defaultTopic) {
      url.searchParams.set('topic', this.config.defaultTopic);
    }
    if (this.config.token) {
      url.searchParams.set('token', this.config.token);
    }

    logger.debug({ identity: this.config.identity }, 'Connecting Photon stream');

    this.eventSource = new EventSource(url.toString());

    this.eventSource.onopen = () => {
      this._connected = true;
      logger.debug({ identity: this.config.identity }, 'Photon stream connected');
    };

    this.eventSource.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data) as PhotonEnvelope;
        this.dispatch(envelope);
      } catch (err) {
        logger.error({ err }, 'Failed to parse Photon envelope');
      }
    };

    this.eventSource.onerror = (err) => {
      logger.error({ err }, 'Photon stream error');
      this._connected = false;
    };
  }

  disconnect(): void {
    if (!this.eventSource) return;
    this.eventSource.close();
    this.eventSource = null;
    this._connected = false;
    this.subscriptions.clear();
    logger.debug({ identity: this.config.identity }, 'Photon stream disconnected');
  }

  async send(
    to: string,
    topic: string,
    payload: Record<string, unknown>,
    options: PhotonSendOptions = {}
  ): Promise<void> {
    const envelope: PhotonEnvelope = {
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

    const url = new URL('/api/v1/photon/send', this.config.baseUrl);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new Error(`Photon send failed: ${response.status} ${text}`);
    }
  }

  subscribe(
    topic: string,
    handler: (envelope: PhotonEnvelope) => void
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
    options: PhotonSendOptions = {}
  ): Promise<void> {
    return this.send(topic, topic, payload, { ...options, kind: 'broadcast' });
  }

  private dispatch(envelope: PhotonEnvelope): void {
    // Dispatch to topic subscribers
    const topicHandlers = this.subscriptions.get(envelope.topic);
    if (topicHandlers) {
      topicHandlers.forEach((handler) => {
        try {
          handler(envelope);
        } catch (err) {
          logger.error({ err }, 'Photon handler threw');
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
          logger.error({ err }, 'Photon handler threw');
        }
      });
    }
  }
}

export function createPhotonClient(config: PhotonClientConfig): PhotonClient {
  return new PhotonClientImpl(config);
}
