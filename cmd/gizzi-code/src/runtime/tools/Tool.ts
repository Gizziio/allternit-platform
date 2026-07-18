// @ts-nocheck
/**
 * Tool Type Definitions
 * 
 * Central type definitions for the tool system.
 */

import type { z } from 'zod/v4'
import type { Tool } from './builtins/tool.js'

// Re-export tool types
export type { Tool }

// Tool context for execution.
// Kept permissive so command/UI code can attach runtime fields without
// type errors while the project migrates to a stricter context shape.
export interface ToolUseContext {
  abortSignal?: AbortSignal
  sessionId?: string
  messageId?: string
  options?: Record<string, any>
  abortController?: AbortController
  readFileState?: any
  getAppState?: () => any
  setAppState?: (f: (prev: any) => any) => void
  setAppStateForTasks?: (f: (prev: any) => any) => void
  setToolJSX?: any
  addNotification?: any
  appendSystemMessage?: any
  sendOSNotification?: any
  setInProgressToolUseIDs?: any
  setHasInterruptibleToolInProgress?: (v: boolean) => void
  onCompactProgress?: any
  setSDKStatus?: any
  setStreamMode?: any
  setResponseLength?: any
  messages?: any
  messageId?: string
  [key: string]: any
}

// Tool permission context
export interface ToolPermissionContext {
  mode: string
  allowedTools?: string[]
  blockedTools?: string[]
  isAutoModeAvailable?: boolean
  [key: string]: any
}

// Tool definition helper
export interface ToolDef<TParams = unknown, TResult = unknown> {
  name: string
  description: string
  parameters: z.ZodType<TParams>
  execute: (params: TParams, context: ToolUseContext) => Promise<TResult>
}

// Build tool helper
export function buildTool<TParams, TResult>(
  name: string,
  description: string,
  parameters: z.ZodType<TParams>,
  execute: (params: TParams, context: ToolUseContext) => Promise<TResult>
): ToolDef<TParams, TResult> {
  return {
    name,
    description,
    parameters,
    execute,
  }
}

// Tools collection type
export type Tools = Tool[] | Map<string, Tool>







// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { filterToolProgressMessages, findToolByName, getEmptyToolPermissionContext, toolMatchesName } from "../../cli/ui/ink-app/Tool.js";
export type { AgentToolProgress, AnyObject, BashProgress, CompactProgressEvent, MCPProgress, Progress, QueryChainTracking, REPLToolProgress, SetToolJSXFn, SkillToolProgress, TaskOutputProgress, ToolCallProgress, ToolInputJSONSchema, ToolPermissionRulesBySource, ToolProgress, ToolProgressData, ToolResult, ValidationResult, WebSearchProgress } from "../../cli/ui/ink-app/Tool.js";
