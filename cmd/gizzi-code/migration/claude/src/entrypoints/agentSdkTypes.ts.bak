/**
 * Agent SDK Types Entry Point
 * Exports all SDK-related types for external consumption
 */

// ============================================================================
// Core SDK Types
// ============================================================================

export type {
  SDKControlRequest,
  SDKControlResponse,
  SDKControlInitializeRequest,
  SDKControlInitializeResponse,
  SDKControlSendMessageRequest,
  SDKControlSendMessageResponse,
  SDKControlToolUseRequest,
  SDKControlToolUseResponse,
  SDKControlMcpGetServersRequest,
  SDKControlMcpGetServersResponse,
  SDKControlMcpSetServersRequest,
  SDKControlMcpSetServersResponse,
  SDKControlReloadPluginsRequest,
  SDKControlReloadPluginsResponse,
  SDKControlRewindRequest,
  SDKControlRewindResponse,
  SDKControlBridgeStatusRequest,
  SDKControlBridgeStatusResponse,
  McpServerInfo,
  PluginInfo,
  AgentDefinition,
  HookDefinition,
  PromptSuggestion,
  RewindFilesResult,
  SDKMessage,
  SDKPartialAssistantMessageWithEvent,
} from './sdk/controlTypes.js'

// ============================================================================
// Core Types (Message, etc.)
// ============================================================================

export * from './sdk/coreTypes.js'

// ============================================================================
// Hook Types
// ============================================================================

export type {
  HookInput,
  HookJSONOutput,
  SyncHookJSONOutput,
  AsyncHookJSONOutput,
  StopHookInput,
  StopFailureHookInput,
  SubagentStartHookInput,
  SubagentStopHookInput,
  TaskCreatedHookInput,
  TaskCompletedHookInput,
  TeammateIdleHookInput,
  UserPromptSubmitHookInput,
  PostToolUseFailureHookInput,
  SetupHookInput,
  ExitReason,
} from './sdk/hookTypes.js'

// ============================================================================
// MCP Types
// ============================================================================

export type {
  McpServerConfig,
  McpServerConfigForProcessTransport,
  McpServerConfigForSSETransport,
  McpServerConfigForStdioTransport,
  McpServerStatus,
  McpToolInfo,
  McpToolResult,
} from './sdk/mcpTypes.js'

// ============================================================================
// SDK Message Types
// ============================================================================

export type {
  SDKPermissionDenial,
  SDKResultMessage,
  SDKStatusMessage,
  SDKSystemMessage,
  SDKToolProgressMessage,
  NotificationHookInput,
  PostToolUseHookInput,
  PreToolUseHookInput,
  SDKServerMessage,
  SDKUserMessage,
  SDKAssistantMessage,
} from './sdk/messageTypes.js'

// ============================================================================
// Runtime Types
// ============================================================================

export * from './sdk/runtimeTypes.js'

// ============================================================================
// Settings Types
// ============================================================================

export type { Settings } from './sdk/settingsTypes.generated.js'

// ============================================================================
// Tool Types
// ============================================================================

export * from './sdk/toolTypes.js'

// ============================================================================
// Legacy Exports (for backward compatibility)
// ============================================================================

export type { 
  SDKPartialAssistantMessageWithEvent as SDKPartialAssistantMessage 
} from './sdk/controlTypes.js'

// Re-export for convenience
export type { Message } from '../types/message.js'
