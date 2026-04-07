/**
 * SDK Message Types
 * Additional message types for SDK communication
 */

import type { Message } from '../../types/message.js'

// ============================================================================
// SDK Permission Types
// ============================================================================

export interface SDKPermissionDenial {
  type: 'permission_denial'
  requestId: string
  reason: string
  toolName?: string
  tool_name?: string  // Legacy alias
  toolUseId?: string  // Camel case alias
  tool_use_id?: string  // Legacy property
  tool_input?: unknown  // Tool input that was denied
  timestamp: number
}

// ============================================================================
// SDK Result/Status Types
// ============================================================================

export interface SDKResultMessage {
  type: 'result'
  requestId: string
  uuid?: string
  result: unknown
  success: boolean
  error?: string
  errors?: string[]
  message?: string
  data?: unknown
  subtype?: 'success' | 'error' | string
}

export interface SDKStatusMessage {
  type: 'status'
  state: 'idle' | 'loading' | 'streaming' | 'error'
  status?: string
  message?: string
  progress?: number
  timestamp: number
  uuid?: string
}

export interface SDKSystemMessage {
  type: 'system'
  content: string
  level: 'info' | 'warning' | 'error'
  timestamp: number
  message?: string
  data?: unknown
  model?: string
  uuid?: string
}

export interface SDKToolProgressMessage {
  type: 'tool_progress'
  toolUseId: string
  toolName: string
  tool_name?: string  // Snake case alias
  tool_use_id?: string  // Legacy alias
  status: 'pending' | 'running' | 'completed' | 'error'
  progress?: number
  message?: string
  timestamp: number
  data?: unknown
  elapsed_time_seconds?: number
  uuid?: string
}

// ============================================================================
// Hook Input Types
// ============================================================================

export interface NotificationHookInput {
  type: 'notification'
  title: string
  message: string
  level: 'info' | 'warning' | 'error' | 'success'
}

export interface PostToolUseHookInput {
  type: 'post_tool_use'
  toolName: string
  toolUseId: string
  input: unknown
  output: unknown
  duration: number
}

export interface PreToolUseHookInput {
  type: 'pre_tool_use'
  toolName: string
  toolUseId: string
  input: unknown
}

// ============================================================================
// SDK User/Assistant Message Types
// ============================================================================

export interface SDKUserMessage {
  type: 'user'
  content: string | unknown[]
  timestamp?: number
  session_id?: string
  message?: { role: string; content: string }
  parent_tool_use_id?: string | null
}

export interface SDKAssistantMessage {
  type: 'assistant'
  content: string | unknown[]
  timestamp?: number
}

// ============================================================================
// SDK Message Union
// ============================================================================

export type SDKServerMessage = 
  | SDKResultMessage
  | SDKStatusMessage
  | SDKSystemMessage
  | SDKToolProgressMessage
  | SDKPermissionDenial
