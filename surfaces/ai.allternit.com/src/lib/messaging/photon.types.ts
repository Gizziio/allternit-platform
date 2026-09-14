/**
 * Photon Messaging Types
 *
 * Photon is the cloud-orchestration message bus for agents and cross-surface
 * sessions. It carries routed envelopes between bots, surfaces, and the runtime.
 */

export type PhotonMessageKind =
  | 'agent_to_agent'
  | 'agent_to_surface'
  | 'surface_to_agent'
  | 'broadcast'
  | 'command'
  | 'event';

export type PhotonPriority = 'low' | 'normal' | 'high' | 'critical';

export interface PhotonEnvelope {
  /** Unique message id */
  id: string;
  /** Message kind */
  kind: PhotonMessageKind;
  /** Sender address (agent id, surface id, or system) */
  from: string;
  /** Recipient address or topic */
  to: string;
  /** Topic used for routing */
  topic: string;
  /** Payload */
  payload: Record<string, unknown>;
  /** Priority */
  priority: PhotonPriority;
  /** ISO timestamp */
  timestamp: string;
  /** Correlation id for request/response patterns */
  correlationId?: string;
  /** TTL in milliseconds */
  ttl?: number;
}

export interface PhotonSubscription {
  topic: string;
  handler: (envelope: PhotonEnvelope) => void;
}

export interface PhotonClientConfig {
  /** Base URL of the Photon gateway */
  baseUrl: string;
  /** Agent or surface identity this client speaks for */
  identity: string;
  /** Auth token for the connection */
  token?: string;
  /** Default topic to subscribe to */
  defaultTopic?: string;
}

export interface PhotonSendOptions {
  kind?: PhotonMessageKind;
  priority?: PhotonPriority;
  correlationId?: string;
  ttl?: number;
}

export interface PhotonClient {
  /** True when the underlying transport is connected. */
  readonly connected: boolean;
  /** Connect and subscribe to topics. */
  connect: () => void;
  /** Disconnect and clean up. */
  disconnect: () => void;
  /** Send an envelope to an address or topic. */
  send: (to: string, topic: string, payload: Record<string, unknown>, options?: PhotonSendOptions) => Promise<void>;
  /** Subscribe to a topic. Returns unsubscribe function. */
  subscribe: (topic: string, handler: (envelope: PhotonEnvelope) => void) => () => void;
  /** Broadcast to all subscribers of a topic. */
  broadcast: (topic: string, payload: Record<string, unknown>, options?: PhotonSendOptions) => Promise<void>;
}
