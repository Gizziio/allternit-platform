/**
 * Interactive Capsule Types
 * 
 * Defines the core types for MCP Apps / Interactive Capsules.
 * An Interactive Capsule is a sandboxed UI surface that enables
 * bidirectional communication between tools and the host.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const CapsuleState = {
  PENDING: 'pending',
  ACTIVE: 'active',
  CLOSED: 'closed',
  ERROR: 'error',
} as const;

export type CapsuleState = typeof CapsuleState[keyof typeof CapsuleState];

export const CapsulePermissionType = {
  TOOL_INVOKE: 'tool:invoke',
  TOOL_SUBSCRIBE: 'tool:subscribe',
  STATE_READ: 'state:read',
  STATE_WRITE: 'state:write',
  EVENT_EMIT: 'event:emit',
  EVENT_SUBSCRIBE: 'event:subscribe',
} as const;

export type CapsulePermissionType = typeof CapsulePermissionType[keyof typeof CapsulePermissionType];

// ============================================================================
// Zod Schemas
// ============================================================================

export const CapsulePermissionSchema = z.object({
  permission_type: z.enum([
    CapsulePermissionType.TOOL_INVOKE,
    CapsulePermissionType.TOOL_SUBSCRIBE,
    CapsulePermissionType.STATE_READ,
    CapsulePermissionType.STATE_WRITE,
    CapsulePermissionType.EVENT_EMIT,
    CapsulePermissionType.EVENT_SUBSCRIBE,
  ]),
  resource: z.string(), // tool name, state path, or event type
  actions: z.array(z.string()).optional(),
  conditions: z.record(z.unknown()).optional(),
});

export const ToolUISurfaceSchema = z.object({
  html: z.string().min(1),
  css: z.string().optional(),
  js: z.string().optional(),
  props: z.record(z.unknown()).optional(),
  permissions: z.array(CapsulePermissionSchema),
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    version: z.string().default('1.0.0'),
    author: z.string().optional(),
  }).optional(),
});

export const InteractiveCapsuleSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  state: z.enum([CapsuleState.PENDING, CapsuleState.ACTIVE, CapsuleState.CLOSED, CapsuleState.ERROR]),
  surface: ToolUISurfaceSchema,
  toolId: z.string(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  error: z.string().optional(),
});

export const CreateCapsuleRequestSchema = z.object({
  type: z.string(),
  toolId: z.string(),
  surface: ToolUISurfaceSchema,
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  ttlSeconds: z.number().int().min(1).max(3600).optional().default(1800),
});

export const CapsuleEventSchema = z.object({
  id: z.string().uuid(),
  capsuleId: z.string().uuid(),
  direction: z.enum(['to_tool', 'to_ui']),
  type: z.string(),
  payload: z.unknown(),
  timestamp: z.string().datetime(),
  source: z.enum(['capsule', 'tool', 'user', 'system']),
});

// ============================================================================
// TypeScript Types
// ============================================================================

export type CapsulePermission = z.infer<typeof CapsulePermissionSchema>;
export type ToolUISurface = z.infer<typeof ToolUISurfaceSchema>;
export type InteractiveCapsule = z.infer<typeof InteractiveCapsuleSchema>;
export type CreateCapsuleRequest = z.infer<typeof CreateCapsuleRequestSchema>;
export type CapsuleEvent = z.infer<typeof CapsuleEventSchema>;

// ============================================================================
// Additional Types
// ============================================================================

export interface CapsuleLifecycle {
  onMount?: () => void;
  onUpdate?: (prevProps: unknown, nextProps: unknown) => void;
  onUnmount?: () => void;
  onError?: (error: Error) => void;
}

export interface CapsuleStats {
  eventCount: number;
  toolInvocationCount: number;
  errorCount: number;
  lastActivityAt: Date;
  averageResponseTimeMs: number;
}

export interface CapsuleFilter {
  state?: CapsuleState;
  type?: string;
  toolId?: string;
  agentId?: string;
  sessionId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateCreateCapsuleRequest(data: unknown): CreateCapsuleRequest {
  return CreateCapsuleRequestSchema.parse(data);
}

export function validateInteractiveCapsule(data: unknown): InteractiveCapsule {
  return InteractiveCapsuleSchema.parse(data);
}

export function validateCapsuleEvent(data: unknown): CapsuleEvent {
  return CapsuleEventSchema.parse(data);
}

export function validateToolUISurface(data: unknown): ToolUISurface {
  return ToolUISurfaceSchema.parse(data);
}

export function isValidCapsuleState(state: string): state is CapsuleState {
  return Object.values(CapsuleState).includes(state as CapsuleState);
}
