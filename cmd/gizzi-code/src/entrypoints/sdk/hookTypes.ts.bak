/**
 * SDK Hook Types
 * Definitions for lifecycle hooks in the SDK
 */

// Import HookEvent for proper typing
import type { HookEvent } from './coreTypes.js'

// Base hook input
export interface HookInput {
  context: Record<string, unknown>
  sessionId: string
  timestamp: number
  tool_name?: string  // Legacy property
  toolName?: string
  type?: string
  event?: string
  data?: unknown
  // Additional properties used by specific hook events
  hook_event_name?: HookEvent
  tool_input?: Record<string, unknown>
  source?: string
  trigger?: string
  notification_type?: string
  reason?: string
  error?: Error | string
  agent_type?: string
  mcp_server_name?: string
  load_reason?: string
  file_path?: string
  [key: string]: unknown
}

// Base hook output
export interface HookJSONOutput {
  success: boolean
  output?: unknown
  error?: string
  metadata?: Record<string, unknown>
  hookSpecificOutput?: unknown
  continue?: boolean
  suppressOutput?: boolean
  stopReason?: string
  decision?: 'block' | 'approve'
  reason?: string
  systemMessage?: string
  async?: boolean
  asyncTimeout?: number
  message?: string
  data?: unknown
  subtype?: string
  type?: string
}

// Permission request decision type
export interface PermissionRequestDecision {
  behavior: 'allow' | 'deny'
  updatedInput?: Record<string, unknown>
  updatedPermissions?: unknown[]
  message?: string
  interrupt?: boolean
}

// Synchronous hook output
export interface SyncHookJSONOutput extends HookJSONOutput {
  sync: true
  // Hook event specific fields
  hookSpecificOutput?: {
    hookEventName?: string
    permissionDecision?: 'allow' | 'deny' | 'ask'
    permissionDecisionReason?: string
    updatedInput?: Record<string, unknown>
    additionalContext?: Record<string, unknown>
    initialUserMessage?: string
    updatedMCPToolOutput?: unknown
    retry?: boolean
    decision?: PermissionRequestDecision
    action?: string
    content?: string
    [key: string]: unknown
  }
  // Common fields used by hooks
  decision?: 'approve' | 'block'
  reason?: string
  continue?: boolean
  stopReason?: string
}

// Asynchronous hook output
export interface AsyncHookJSONOutput extends HookJSONOutput {
  sync?: false
  async: true
  promise?: Promise<unknown>
}

// Specific hook input types
export interface StopHookInput extends HookInput {
  reason: 'user' | 'system' | 'error' | 'timeout'
  duration: number
}

export interface StopFailureHookInput extends HookInput {
  error: Error
  duration: number
}

export interface SubagentStartHookInput extends HookInput {
  subagentId: string
  task: string
}

export interface SubagentStopHookInput extends HookInput {
  subagentId: string
  result?: unknown
  error?: Error
}

export interface TaskCreatedHookInput extends HookInput {
  taskId: string
  description: string
}

export interface TaskCompletedHookInput extends HookInput {
  taskId: string
  result?: unknown
  error?: Error
}

export interface TeammateIdleHookInput extends HookInput {
  teammateId: string
  idleDuration: number
}

export interface UserPromptSubmitHookInput extends HookInput {
  prompt: string
  attachments?: unknown[]
}

// Additional hook input types
export interface PostToolUseFailureHookInput extends HookInput {
  toolName: string
  toolInput?: Record<string, unknown>
  error: Error | string
  duration: number
}

export interface SetupHookInput extends HookInput {
  projectDir: string
  config: Record<string, unknown>
}

// Exit reasons for StopHookInput
export type ExitReason = 'user' | 'system' | 'error' | 'timeout' | 'completed' | 'other' | 'resume' | 'clear' | 'logout' | 'prompt_input_exit'

// Hook progress info
export interface HookProgressInfo {
  hookEventName?: string
  hookName?: string
  command?: string
  statusMessage?: string
  promptText?: string
  type?: string
}

// Hook result info
export interface HookResultInfo {
  outcome?: 'success' | 'blocking' | 'non_blocking_error' | 'cancelled'
  message?: string
  error?: string
  data?: unknown
}
