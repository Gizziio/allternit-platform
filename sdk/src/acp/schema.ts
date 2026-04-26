/**
 * ACP (Agent Capability Protocol) Schema
 * Zod schemas for ACP message validation
 */

import { z } from 'zod';

/**
 * ACP Message Schema
 * Core message format for agent communication
 */
export const ACPMessageSchema = z.object({
  id: z.string().uuid(),
  version: z.literal('1.0'),
  timestamp: z.string().datetime(),
  source: z.object({
    agentId: z.string(),
    sessionId: z.string().optional(),
    capability: z.string(),
  }),
  target: z.object({
    agentId: z.string(),
    capability: z.string().optional(),
  }),
  type: z.enum([
    'request',
    'response',
    'event',
    'error',
    'handshake',
    'heartbeat',
  ]),
  payload: z.object({
    action: z.string(),
    parameters: z.record(z.unknown()).optional(),
    data: z.unknown().optional(),
    context: z.record(z.unknown()).optional(),
  }),
  metadata: z.object({
    priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
    ttl: z.number().int().positive().optional(),
    correlationId: z.string().uuid().optional(),
    parentId: z.string().uuid().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  signature: z.object({
    algorithm: z.enum(['ed25519', 'secp256k1']),
    publicKey: z.string(),
    value: z.string(),
  }).optional(),
});

/**
 * ACP Tool Schema
 * Tool definition for capability exposure
 */
export const ACPToolSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(4096),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(z.object({
      type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),
      description: z.string(),
      enum: z.array(z.string()).optional(),
      items: z.unknown().optional(),
      required: z.boolean().optional(),
    })),
    required: z.array(z.string()).optional(),
  }),
  returns: z.object({
    type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),
    description: z.string(),
  }),
  examples: z.array(z.object({
    input: z.unknown(),
    output: z.unknown(),
    description: z.string().optional(),
  })).optional(),
});

/**
 * ACP Session Schema
 * Session management for agent connections
 */
export const ACPSessionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  status: z.enum(['initializing', 'active', 'paused', 'terminating', 'terminated']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  capabilities: z.array(z.string()),
  permissions: z.array(z.enum([
    'read',
    'write',
    'execute',
    'admin',
  ])),
  context: z.record(z.unknown()).optional(),
  metrics: z.object({
    messagesSent: z.number().int().nonnegative(),
    messagesReceived: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
    lastActivity: z.string().datetime(),
  }),
});

/**
 * ACP Registry Entry Schema
 * Registry entry for capability discovery
 */
export const ACPRegistryEntrySchema = z.object({
  agentId: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  capabilities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    version: z.string(),
    tools: z.array(ACPToolSchema),
  })),
  endpoints: z.object({
    rest: z.string().url().optional(),
    websocket: z.string().url().optional(),
    grpc: z.string().optional(),
  }),
  authentication: z.object({
    type: z.enum(['none', 'token', 'oauth2', 'mtls']),
    scopes: z.array(z.string()).optional(),
  }),
  metadata: z.object({
    tags: z.array(z.string()),
    category: z.string(),
    author: z.string(),
    license: z.string(),
    homepage: z.string().url().optional(),
    repository: z.string().url().optional(),
  }),
  status: z.enum(['active', 'deprecated', 'experimental', 'unavailable']),
  registeredAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

/**
 * Type definitions inferred from schemas
 */
export type ACPMessage = z.infer<typeof ACPMessageSchema>;
export type ACPTool = z.infer<typeof ACPToolSchema>;
export type ACPSession = z.infer<typeof ACPSessionSchema>;
export type ACPRegistryEntry = z.infer<typeof ACPRegistryEntrySchema>;

/**
 * ACP Error Types
 */
export type ACPErrorCode =
  | 'INVALID_MESSAGE'
  | 'INVALID_SIGNATURE'
  | 'AGENT_NOT_FOUND'
  | 'CAPABILITY_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ACPError {
  code: ACPErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * ACP Event Types
 */
export type ACPEventType =
  | 'message.received'
  | 'message.sent'
  | 'session.created'
  | 'session.terminated'
  | 'capability.registered'
  | 'capability.invoked'
  | 'error.occurred';

export interface ACPEvent {
  type: ACPEventType;
  timestamp: string;
  data: unknown;
}
