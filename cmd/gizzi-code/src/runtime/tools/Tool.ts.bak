/**
 * Tool Type Definitions
 * 
 * Central type definitions for the tool system.
 */

import type { z } from 'zod/v4'
import type { Tool } from './builtins/tool.js'

// Re-export tool types
export type { Tool }

// Tool context for execution
export interface ToolUseContext {
  abortSignal?: AbortSignal
  sessionId?: string
  messageId?: string
}

// Tool permission context
export interface ToolPermissionContext {
  mode: string
  allowedTools?: string[]
  blockedTools?: string[]
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

// Tool matching utility
export function toolMatchesName(tool: { name: string } | string, name: string): boolean {
  const toolName = typeof tool === 'string' ? tool : tool.name
  return toolName === name
}

// Tools collection type
export type Tools = Tool[] | Map<string, Tool>

// Find tool by name
export function findToolByName(tools: Tools, name: string): Tool | undefined {
  if (Array.isArray(tools)) {
    return tools.find(t => toolMatchesName(t, name))
  }
  return tools.get(name)
}
