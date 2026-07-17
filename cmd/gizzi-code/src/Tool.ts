/**
 * Tool - central re-export entry point for tool types and utilities.
 */
export {
  buildTool,
  toolMatchesName,
  findToolByName,
} from './runtime/tools/Tool.js'

export type {
  ToolUseContext,
  ToolPermissionContext,
  ToolDef,
  Tools,
} from './runtime/tools/Tool.js'

export type { Tool } from './runtime/tools/Tool.js'

// Legacy Anthropic-style tool shapes
export type { ToolUse, ToolResult } from './types/tools.js'

// V2 message-based tool call/result shapes
import { Message } from './runtime/session/message.js'
export type ToolCall = Message.ToolCall
export type ToolInvocation = Message.ToolInvocation

// Types referenced by consumers but not yet extracted to a dedicated module.
export type AnyObject = Record<string, any>
export type ValidationResult = { ok: true } | { ok: false; error: string }
export type SetToolJSXFn = (
  toolUseId: string,
  jsx: any,
  options?: { height?: number; shouldAutoClose?: boolean },
) => void
export type Progress<T = any> = {
  status: 'pending' | 'running' | 'completed' | 'error'
  data?: T
  message?: string
}
