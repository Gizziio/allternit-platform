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
  description: string | (() => string | Promise<string>)
  parameters?: z.ZodType<TParams>
  execute?: (params: TParams, context: ToolUseContext) => Promise<TResult>
  inputSchema?: z.ZodType<TParams>
  outputSchema?: z.ZodType<TResult>
  prompt?: (options?: any) => string | Promise<string>
  userFacingName?: () => string
  shouldDefer?: boolean
  isEnabled?: () => boolean
  isConcurrencySafe?: () => boolean
  isReadOnly?: () => boolean
  isDestructive?: () => boolean
  toAutoClassifierInput?: (input: TParams) => string
  renderToolUseMessage?: () => any
  validateInput?: (input: TParams, context: ToolUseContext) => Promise<any>
  checkPermissions?: (input: TParams, context: ToolUseContext) => Promise<any>
  call?: (input: TParams, context: ToolUseContext) => Promise<any>
  mapToolResultToToolResultBlockParam?: (content: any, toolUseID: string) => any
  aliases?: string[]
  searchHint?: string
  maxResultSizeChars?: number
  strict?: boolean
  [key: string]: any
}

const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isDestructive: () => false,
  toAutoClassifierInput: () => '',
  userFacingName: function (this: ToolDef) {
    return this.name
  },
  checkPermissions: async (_input: any, _ctx?: any) => ({ behavior: 'allow', updatedInput: _input }),
}

// Build tool helper
export function buildTool<TParams = unknown, TResult = unknown>(
  def: ToolDef<TParams, TResult>
): ToolDef<TParams, TResult>
export function buildTool<TParams = unknown, TResult = unknown>(
  name: string,
  description: string,
  parameters: z.ZodType<TParams>,
  execute: (params: TParams, context: ToolUseContext) => Promise<TResult>
): ToolDef<TParams, TResult>
export function buildTool<TParams = unknown, TResult = unknown>(
  nameOrDef: string | ToolDef<TParams, TResult>,
  description?: string,
  parameters?: z.ZodType<TParams>,
  execute?: (params: TParams, context: ToolUseContext) => Promise<TResult>
): ToolDef<TParams, TResult> {
  if (typeof nameOrDef === 'object' && nameOrDef !== null) {
    const def = nameOrDef
    return {
      ...TOOL_DEFAULTS,
      userFacingName: () => def.name,
      ...def,
    } as ToolDef<TParams, TResult>
  }

  return {
    ...TOOL_DEFAULTS,
    name: nameOrDef,
    description: description!,
    parameters: parameters!,
    execute: execute!,
  } as ToolDef<TParams, TResult>
}

// Tools collection type
export type Tools = Tool[] | Map<string, Tool>







// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { filterToolProgressMessages, findToolByName, getEmptyToolPermissionContext, toolMatchesName } from "../../cli/ui/ink-app/Tool.js";
export type { AgentToolProgress, AnyObject, BashProgress, CompactProgressEvent, MCPProgress, Progress, QueryChainTracking, REPLToolProgress, SetToolJSXFn, SkillToolProgress, TaskOutputProgress, ToolCallProgress, ToolInputJSONSchema, ToolPermissionRulesBySource, ToolProgress, ToolProgressData, ToolResult, ValidationResult, WebSearchProgress } from "../../cli/ui/ink-app/Tool.js";
