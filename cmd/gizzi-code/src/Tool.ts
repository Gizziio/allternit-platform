/**
 * Tool - re-export from runtime tools
 * Top-level entry point for all tool types and utilities
 */

// Re-export from runtime/tools/Tool.ts
export {
  ToolUseContext,
  ToolPermissionContext,
  ToolDef,
  buildTool,
  toolMatchesName,
  findToolByName,
  type Tools,
} from './runtime/tools/Tool.js'

// Re-export the Tool interface/type
export type { Tool } from './runtime/tools/Tool.js'

// Re-export from runtime tools builtins
export {
  type ToolUse,
  type ToolResult,
  type ToolCall,
  type ToolInvocation,
} from './runtime/tools/builtins/Tool.js'
