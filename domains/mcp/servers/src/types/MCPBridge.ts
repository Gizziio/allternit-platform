/**
 * MCP Bridge Protocol
 * 
 * Defines the message protocol for bidirectional communication
 * between the capsule (iframe) and the host (parent window).
 */

import { z } from 'zod';

// ============================================================================
// Message Types
// ============================================================================

export const MCPMessageType = {
  // Tool → UI (Host pushes data to capsule)
  TOOL_DATA: 'tool:data',
  TOOL_EVENT: 'tool:event',
  TOOL_ERROR: 'tool:error',
  
  // UI → Tool (Capsule invokes tool or emits events)
  UI_ACTION: 'ui:action',
  UI_EVENT: 'ui:event',
  UI_TOOL_INVOKE: 'ui:tool:invoke',
  UI_STATE_UPDATE: 'ui:state:update',
  
  // Lifecycle
  CAPSULE_READY: 'capsule:ready',
  CAPSULE_MOUNT: 'capsule:mount',
  CAPSULE_UNMOUNT: 'capsule:unmount',
  CAPSULE_ERROR: 'capsule:error',
  
  // Handshake
  HANDSHAKE_REQUEST: 'handshake:request',
  HANDSHAKE_RESPONSE: 'handshake:response',
  
  // Heartbeat
  PING: 'ping',
  PONG: 'pong',
} as const;

export type MCPMessageType = typeof MCPMessageType[keyof typeof MCPMessageType];

// ============================================================================
// Zod Schemas
// ============================================================================

export const MCPMessageSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    MCPMessageType.TOOL_DATA,
    MCPMessageType.TOOL_EVENT,
    MCPMessageType.TOOL_ERROR,
    MCPMessageType.UI_ACTION,
    MCPMessageType.UI_EVENT,
    MCPMessageType.UI_TOOL_INVOKE,
    MCPMessageType.UI_STATE_UPDATE,
    MCPMessageType.CAPSULE_READY,
    MCPMessageType.CAPSULE_MOUNT,
    MCPMessageType.CAPSULE_UNMOUNT,
    MCPMessageType.CAPSULE_ERROR,
    MCPMessageType.HANDSHAKE_REQUEST,
    MCPMessageType.HANDSHAKE_RESPONSE,
    MCPMessageType.PING,
    MCPMessageType.PONG,
  ]),
  payload: z.unknown(),
  timestamp: z.number(), // Unix timestamp in ms
  capsuleId: z.string().uuid(),
  correlationId: z.string().uuid().optional(), // For request/response pairing
  metadata: z.record(z.unknown()).optional(),
});

// Specific message payloads
export const ToolDataPayloadSchema = z.object({
  data: z.unknown(),
  dataType: z.string().optional(),
});

export const ToolEventPayloadSchema = z.object({
  eventType: z.string(),
  data: z.unknown(),
});

export const ToolInvokePayloadSchema = z.object({
  toolName: z.string(),
  params: z.record(z.unknown()),
  requestId: z.string().uuid(),
});

export const ToolInvokeResponsePayloadSchema = z.object({
  requestId: z.string().uuid(),
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export const UIActionPayloadSchema = z.object({
  actionType: z.string(),
  target: z.string().optional(),
  data: z.unknown(),
});

export const HandshakeRequestPayloadSchema = z.object({
  capsuleId: z.string().uuid(),
  version: z.string(),
  capabilities: z.array(z.string()),
});

export const HandshakeResponsePayloadSchema = z.object({
  accepted: z.boolean(),
  serverVersion: z.string(),
  permissions: z.array(z.string()),
  error: z.string().optional(),
});

// ============================================================================
// TypeScript Types
// ============================================================================

export type MCPMessage = z.infer<typeof MCPMessageSchema>;
export type ToolDataPayload = z.infer<typeof ToolDataPayloadSchema>;
export type ToolEventPayload = z.infer<typeof ToolEventPayloadSchema>;
export type ToolInvokePayload = z.infer<typeof ToolInvokePayloadSchema>;
export type ToolInvokeResponsePayload = z.infer<typeof ToolInvokeResponsePayloadSchema>;
export type UIActionPayload = z.infer<typeof UIActionPayloadSchema>;
export type HandshakeRequestPayload = z.infer<typeof HandshakeRequestPayloadSchema>;
export type HandshakeResponsePayload = z.infer<typeof HandshakeResponsePayloadSchema>;

// ============================================================================
// Message Builders
// ============================================================================

export function createMCPMessage(
  type: MCPMessageType,
  capsuleId: string,
  payload: unknown,
  options?: {
    correlationId?: string;
    metadata?: Record<string, unknown>;
  }
): MCPMessage {
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    capsuleId,
    correlationId: options?.correlationId,
    metadata: options?.metadata,
  };
}

export function createToolInvokeMessage(
  capsuleId: string,
  toolName: string,
  params: Record<string, unknown>
): MCPMessage {
  const requestId = crypto.randomUUID();
  return createMCPMessage(
    MCPMessageType.UI_TOOL_INVOKE,
    capsuleId,
    {
      toolName,
      params,
      requestId,
    } as ToolInvokePayload,
    { correlationId: requestId }
  );
}

export function createToolInvokeResponse(
  capsuleId: string,
  requestId: string,
  success: boolean,
  result?: unknown,
  error?: string
): MCPMessage {
  return createMCPMessage(
    MCPMessageType.TOOL_DATA,
    capsuleId,
    {
      requestId,
      success,
      result,
      error,
    } as ToolInvokeResponsePayload,
    { correlationId: requestId }
  );
}

export function createHandshakeRequest(
  capsuleId: string,
  capabilities: string[] = []
): MCPMessage {
  return createMCPMessage(
    MCPMessageType.HANDSHAKE_REQUEST,
    capsuleId,
    {
      capsuleId,
      version: '1.0.0',
      capabilities,
    } as HandshakeRequestPayload
  );
}

// ============================================================================
// Message Validators
// ============================================================================

export function validateMCPMessage(data: unknown): MCPMessage {
  return MCPMessageSchema.parse(data);
}

export function isValidMCPMessage(data: unknown): data is MCPMessage {
  try {
    MCPMessageSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function isToolInvokeMessage(message: MCPMessage): boolean {
  return message.type === MCPMessageType.UI_TOOL_INVOKE;
}

export function isToolResponseMessage(message: MCPMessage): boolean {
  const payload = message.payload as ToolInvokeResponsePayload | undefined;
  return message.type === MCPMessageType.TOOL_DATA && 
         payload?.requestId !== undefined;
}
