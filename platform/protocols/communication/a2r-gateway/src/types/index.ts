/**
 * A2R Gateway Types
 * Shared types for gateway commands and tool invocations
 */

export interface NodeInvokeRequest {
  nodeId: string;
  command: string;
  params?: unknown;
  idempotencyKey?: string;
}

export interface NodeInvokeResponse {
  payload?: unknown;
  error?: string;
}

export interface GatewayToolContext {
  gatewayUrl?: string;
  gatewayToken?: string;
  timeoutMs?: number;
}
