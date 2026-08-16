/**
 * AllternitBus Messaging Types
 *
 * AllternitBus is the internal cloud-orchestration message bus for agents and
 * cross-surface sessions. It carries routed envelopes between bots, surfaces,
 * and the runtime.
 */

export type AllternitBusMessageKind =
  | 'agent_to_agent'
  | 'agent_to_surface'
  | 'surface_to_agent'
  | 'broadcast'
  | 'command'
  | 'event';

export type AllternitBusPriority = 'low' | 'normal' | 'high' | 'critical';

export interface AllternitBusEnvelope {
  /** Unique message id */
  id: string;
  /** Message kind */
  kind: AllternitBusMessageKind;
  /** Sender address (agent id, surface id, or system) */
  from: string;
  /** Recipient address or topic */
  to: string;
  /** Topic used for routing */
  topic: string;
  /** Payload */
  payload: Record<string, unknown>;
  /** Priority */
  priority: AllternitBusPriority;
  /** ISO timestamp */
  timestamp: string;
  /** Correlation id for request/response patterns */
  correlationId?: string;
  /** TTL in milliseconds */
  ttl?: number;
}

export interface AllternitBusSubscription {
  topic: string;
  handler: (envelope: AllternitBusEnvelope) => void;
}

export interface AllternitBusClientConfig {
  /** Base URL of the AllternitBus gateway */
  baseUrl: string;
  /** Agent or surface identity this client speaks for */
  identity: string;
  /** Auth token for the connection */
  token?: string;
  /** Default topic to subscribe to */
  defaultTopic?: string;
}

export interface AllternitBusSendOptions {
  kind?: AllternitBusMessageKind;
  priority?: AllternitBusPriority;
  correlationId?: string;
  ttl?: number;
}

export interface AllternitBusClient {
  /** True when the underlying transport is connected. */
  readonly connected: boolean;
  /** Connect and subscribe to topics. */
  connect: () => void;
  /** Disconnect and clean up. */
  disconnect: () => void;
  /** Send an envelope to an address or topic. */
  send: (to: string, topic: string, payload: Record<string, unknown>, options?: AllternitBusSendOptions) => Promise<void>;
  /** Subscribe to a topic. Returns unsubscribe function. */
  subscribe: (topic: string, handler: (envelope: AllternitBusEnvelope) => void) => () => void;
  /** Broadcast to all subscribers of a topic. */
  broadcast: (topic: string, payload: Record<string, unknown>, options?: AllternitBusSendOptions) => Promise<void>;
}
