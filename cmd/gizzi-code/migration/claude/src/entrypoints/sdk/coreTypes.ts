// SDK Core Types - Common serializable types used by both SDK consumers and SDK builders.
//
// Types are generated from Zod schemas in coreSchemas.ts.
// To modify types:
// 1. Edit Zod schemas in coreSchemas.ts
// 2. Run: bun scripts/generate-sdk-types.ts
//
// Schemas are available in coreSchemas.ts for runtime validation but are not
// part of the public API.

// Re-export sandbox types for SDK consumers
export type {
  SandboxFilesystemConfig,
  SandboxIgnoreViolations,
  SandboxNetworkConfig,
  SandboxSettings,
} from '../sandboxTypes.js'
// Re-export all generated types
export * from './coreTypes.generated.js'

// Re-export utility types that can't be expressed as Zod schemas
export type { NonNullableUsage } from './sdkUtilityTypes.js'

// Const arrays for runtime usage
export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'StopFailure',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'PermissionRequest',
  'PermissionDenied',
  'Setup',
  'TeammateIdle',
  'TaskCreated',
  'TaskCompleted',
  'Elicitation',
  'ElicitationResult',
  'ConfigChange',
  'WorktreeCreate',
  'WorktreeRemove',
  'InstructionsLoaded',
  'CwdChanged',
  'FileChanged',
] as const

export const EXIT_REASONS = [
  'clear',
  'resume',
  'logout',
  'prompt_input_exit',
  'other',
  'bypass_permissions_disabled',
] as const

// ============================================================================
// SDK Status Types
// ============================================================================

export type SDKStatus = 
  | { state: 'idle' }
  | { state: 'loading'; message?: string; progress?: number }
  | { state: 'error'; message: string; error?: string }
  | { state: 'success'; message?: string }
  | string
  | null

// ============================================================================
// Model Info Types
// ============================================================================

export interface ModelInfo {
  id: string
  name: string
  provider: 'anthropic' | 'openai' | 'google' | 'amazon'
  contextWindow: number
  maxTokens: number
  supportsThinking?: boolean
  supportsTools?: boolean
  supportsVision?: boolean
  pricing?: {
    inputPer1k: number
    outputPer1k: number
  }
}

// ============================================================================
// SDK Message Types
// ============================================================================

export interface SDKCompactBoundaryMessage {
  type: 'compact_boundary' | 'system'
  subtype?: 'compact_boundary'
  direction?: 'up' | 'down' | 'both'
  messageCount?: number
  compact_metadata?: {
    trigger?: string
    pre_tokens?: number
    preserved_segment?: {
      head_uuid?: string
      anchor_uuid?: string
      tail_uuid?: string
    }
  }
  session_id?: string
  uuid?: string
  timestamp?: number
}

export interface SDKUserMessageReplay {
  type: 'user_message_replay' | 'user'
  message: string | { 
    content: string 
    id?: string 
    role?: string 
    stop_reason?: string | null 
    usage?: { input_tokens: number; output_tokens: number }
    type?: string
  }
  timestamp: number
  session_id?: string
  parent_tool_use_id?: string | null
  uuid?: string
  isReplay?: boolean
  isSynthetic?: boolean
  attachments?: unknown[]
  toolResults?: unknown[]
  tool_use_result?: unknown
  priority?: 'next' | 'later' | number
  request?: unknown
  response?: unknown
  [key: string]: unknown
}

export interface SDKAssistantMessage {
  type: 'assistant'
  role?: 'assistant'
  content?: string | unknown[]
  message?: string
  uuid?: string
  error?: SDKAssistantMessageError
  tool_calls?: unknown[]
  model?: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  stop_reason?: string | null
  id?: string
  text?: string
  name?: string
  input?: unknown
  parent_tool_use_id?: string | null
  session_id?: string
  [key: string]: unknown
}

export interface SDKAssistantMessageError {
  type?: 'assistant_error'
  error?: string
  code?: string
  timestamp?: number
  message?: string
  [key: string]: any
}

// ============================================================================
// Permission Types
// ============================================================================

export type PermissionMode = 'ask' | 'auto' | 'reject'

// Re-export the full PermissionResult from types/permissions
export type {
  PermissionResult,
  PermissionAllowDecision,
  PermissionAskDecision,
  PermissionDenyDecision,
  PermissionDecision,
} from '../../types/permissions.js'

// Simple permission result for basic use cases
export type SimplePermissionResult = 'granted' | 'denied' | 'pending' | 'timeout'

export interface PermissionUpdate {
  id: string
  requestId: string
  result: SimplePermissionResult
  timestamp: number
  metadata?: Record<string, unknown>
  toolUseID?: string  // Tool use ID for permission tracking
  tool_use_id?: string  // Snake case alias
}

// ============================================================================
// Legacy/Misc Types
// ============================================================================

// TEMPORARY: Missing type exports
export type HookEvent = typeof HOOK_EVENTS[number]

// Server tool use metrics
export interface ServerToolUseMetrics {
  web_search_requests: number
  web_fetch_requests: number
}

// Cache creation breakdown
export interface CacheCreationMetrics {
  ephemeral_1h_input_tokens: number
  ephemeral_5m_input_tokens: number
}

export type ModelUsage = {
  input_tokens: number
  output_tokens: number
  inputTokens?: number  // Camel case alias
  outputTokens?: number  // Camel case alias
  maxOutputTokens?: number
  contextWindow?: number
  webSearchRequests?: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
  costUSD?: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  server_tool_use: ServerToolUseMetrics
  service_tier: string
  cache_creation: CacheCreationMetrics
  inference_geo: string
  iterations: unknown[]
  speed: string
}

export type SDKResultSuccess<T = unknown> = {
  type: 'success'
  result: T
  message?: string
  duration_ms?: number
  duration_api_ms?: number
  data?: unknown
}
