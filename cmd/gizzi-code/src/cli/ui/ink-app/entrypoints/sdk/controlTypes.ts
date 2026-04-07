/**
 * SDK Control Protocol Types
 * Complete implementation for Gizzi SDK
 */

import type { Message, SDKPartialAssistantMessage } from '@/types/message.js'
export type { SDKPartialAssistantMessage }

// ============================================================================
// Base Control Types
// ============================================================================

export interface SDKControlRequest {
  type: 'control_request' | string
  requestId: string
  request_id?: string  // Legacy alias
  uuid?: string
  message?: string
  payload?: unknown
  request?: SDKRequestDetails
  // Allow both camelCase and snake_case for compatibility
  response?: unknown
  result?: unknown
  error?: string
  ok?: boolean
  [key: string]: unknown
}

// Extracted request details interface for better type inference
export interface SDKRequestDetails {
  type?: string
  subtype?: string
  reason?: string
  sdkMcpServers?: string[]
  promptSuggestions?: unknown[]
  agentProgressSummaries?: unknown[]
  model?: string
  max_thinking_tokens?: number
  [key: string]: unknown
}

/**
 * Union type for control request messages that may be either SDKControlRequest
 * or the more flexible SDKServerMessage (used for incoming stream parsing)
 */
export type SDKControlRequestMessage = SDKControlRequest | SDKServerMessage

export interface SDKControlResponse {
  type: 'control_response' | 'response' | 'success' | 'error' | 'result'
  ok: boolean
  requestId: string
  uuid?: string
  response?: unknown
  result?: unknown
  error?: string
  is_error?: boolean
  data?: unknown
  subtype?: string
}

export type SDKMessage = 
  | SDKControlRequest 
  | SDKControlResponse
  | import('./coreTypes.js').SDKCompactBoundaryMessage
  | import('./coreTypes.js').SDKUserMessageReplay
  | import('./coreTypes.js').SDKAssistantMessage
  | import('./coreTypes.js').SDKAssistantMessageError
  | SDKServerMessage
  | SDKStreamEventMessage
  | SDKStopHookMessage
  | SDKApiRetryMessage

// Flexible base for runtime messages
// NOTE: This interface has common properties instead of [key: string]: unknown
// to preserve type discrimination in the SDKMessage union.
export interface SDKServerMessage {
  type: string | 'stream_event'
  subtype?: string
  request?: SDKRequestDetails
  response?: unknown
  result?: unknown
  error?: string
  message?: string
  uuid?: string
  session_id?: string
  [key: string]: unknown
}

// Stream event message type
export interface SDKStreamEventMessage {
  type: 'stream_event'
  event: unknown
  session_id: string
  parent_tool_use_id: string | null
  uuid: string
}

// Stop hook message type
export interface SDKStopHookMessage {
  type: 'system'
  subtype: 'stop_hook' | 'stop_hook_summary'
  is_error?: boolean
  duration_ms?: number
  duration_api_ms?: number
  num_turns?: number
  result?: string
  stop_reason?: string | null
  session_id: string
  total_cost_usd?: number
  uuid?: string
  errors?: string[]
  [key: string]: unknown
}

// API retry message type
export interface SDKApiRetryMessage {
  type: 'system'
  subtype: 'api_retry'
  attempt: number
  max_retries: number
  retry_delay_ms: number
  error_status: number
  error: unknown
  session_id: string
  uuid: string
}

// ============================================================================
// Initialization Types
// ============================================================================

export interface AgentDefinition {
  name: string
  description?: string
  systemPrompt?: string
  model?: string
  tools?: string[]
}

export interface HookDefinition {
  name: string
  type: 'pre' | 'post' | 'onStop'
  handler?: string
}

export interface PromptSuggestion {
  title: string
  prompt: string
}

export interface HookCallbackMatcher {
  type: string
  name?: string
  hookCallbackIds?: string[]
  timeout?: number
  matcher?: Record<string, unknown>
}

export interface SDKControlInitializeRequest extends SDKControlRequest {
  type: 'initialize'
  systemPrompt?: string
  appendSystemPrompt?: string
  promptSuggestions?: PromptSuggestion[]
  agents?: AgentDefinition[]
  hooks?: Record<string, HookCallbackMatcher[]>
  mcpServers?: unknown[]
  capabilities?: string[]
  cwd?: string
  env?: Record<string, string>
  jsonSchema?: unknown
}

export interface SDKControlInitializeResponse extends SDKControlResponse {
  sessionId: string
  version: string
  capabilities: string[]
  commands?: unknown[]  // Available commands after initialization
  fast_mode_state?: string  // Fast mode state setting
  agents?: AgentDefinition[]  // Registered agents
}

// ============================================================================
// Message Types
// ============================================================================

export interface SDKControlSendMessageRequest extends SDKControlRequest {
  type: 'send_message'
  message: string
  role?: 'user'
  attachments?: unknown[]
  toolUseResults?: unknown[]
}

export interface SDKControlSendMessageResponse extends SDKControlResponse {
  message?: Message
  assistantMessage?: SDKPartialAssistantMessage
}

// ============================================================================
// Tool Types
// ============================================================================

export interface SDKControlToolUseRequest extends SDKControlRequest {
  type: 'tool_use'
  toolName: string
  toolUseId: string
  input: unknown
}

export interface SDKControlToolUseResponse extends SDKControlResponse {
  result?: unknown
  content?: string | unknown[]
  isError?: boolean
}

// ============================================================================
// MCP Server Types
// ============================================================================

export interface McpServerInfo {
  name: string
  type: 'stdio' | 'sse' | 'sse-ide'
  status: 'connected' | 'disconnected' | 'connecting'
  tools?: unknown[]
}

export interface SDKControlMcpGetServersRequest extends SDKControlRequest {
  type: 'mcp_get_servers'
}

export interface SDKControlMcpGetServersResponse extends SDKControlResponse {
  servers: McpServerInfo[]
}

export interface SDKControlMcpSetServersRequest extends SDKControlRequest {
  type: 'mcp_set_servers'
  servers: unknown[]
  added?: unknown[]
  removed?: unknown[]
  updated?: unknown[]
}

export interface SDKControlMcpSetServersResponse extends SDKControlResponse {
  servers: McpServerInfo[]
  added?: McpServerInfo[]
  removed?: string[]
  updated?: McpServerInfo[]
  errors?: Record<string, string>
}

// ============================================================================
// Plugin Types
// ============================================================================

export interface PluginInfo {
  name: string
  version: string
  enabled: boolean
}

export interface SDKControlReloadPluginsRequest extends SDKControlRequest {
  type: 'reload_plugins'
}

export interface SDKControlReloadPluginsResponse extends SDKControlResponse {
  plugins: PluginInfo[]
  commands?: unknown[]
  loaded: number
  errors?: string[]
}

// ============================================================================
// File/Rewind Types
// ============================================================================

export interface RewindFilesResult {
  canRewind: boolean
  error?: string
  files?: string[]
  timestamp?: number
  filesChanged?: string[]  // Changed files for rewind operation
}

export interface SDKControlRewindRequest extends SDKControlRequest {
  type: 'rewind_files'
  files?: string[]
  toTimestamp?: number
}

export interface SDKControlRewindResponse extends SDKControlResponse {
  result: RewindFilesResult
}

// ============================================================================
// Bridge Types
// ============================================================================

export interface SDKControlBridgeStatusRequest extends SDKControlRequest {
  type: 'bridge_status'
}

export interface SDKControlBridgeStatusResponse extends SDKControlResponse {
  connected: boolean
  sessionId?: string
  version?: string
}

// ============================================================================
// Utility Types
// ============================================================================

export type SDKPartialAssistantMessageWithEvent = SDKPartialAssistantMessage & { 
  event?: 'content_block_delta' | 'content_block_start' | 'content_block_stop' | 'message_delta' | 'message_start' | 'message_stop'
}

// Legacy StdoutMessage/StdinMessage type aliases
export type StdoutMessage = SDKMessage
export type StdinMessage = SDKMessage

// Missing exports - stubs
export interface SDKControlCancelRequest extends SDKControlRequest {
  type: 'cancel'
}

export interface SDKControlPermissionRequest extends SDKControlRequest {
  type: 'permission'
  toolName: string
  toolInput: Record<string, unknown>
}

export interface SDKControlRequestInner {
  type: string
  requestId: string
  [key: string]: unknown
}

// Type guards
export function isSDKControlRequest(msg: SDKMessage): msg is SDKControlRequest {
  return msg.type === 'control_request' || ('requestId' in msg && !('ok' in msg))
}

export function isSDKControlResponse(msg: SDKMessage): msg is SDKControlResponse {
  return msg.type === 'control_response' || 'ok' in msg
}
