/**
 * Tool Schemas — converts plugin tool definitions to OpenAI function-calling format
 * and provides a host-aware loader so the right tool set is sent with each request.
 */

import { excelTools } from '../../plugins/excel/tools/tool-definitions'
import { powerpointTools } from '../../plugins/powerpoint/tools/tool-definitions'
import { wordTools } from '../../plugins/word/tools/tool-definitions'
import { getOfficeHost } from './host-detector'

// ── Types ────────────────────────────────────────────────────────────────────

/** OpenAI function-calling tool format (also accepted by Anthropic-compatible endpoints) */
export interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required: string[]
    }
  }
}

/** A fully-parsed tool call returned from the streaming SSE response */
export interface ParsedToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/** Partial accumulator used while streaming tool_call deltas */
export interface ToolCallAccumulator {
  id: string
  name: string
  argumentsJson: string
}

// ── Conversion ───────────────────────────────────────────────────────────────

/**
 * Converts an internal tool definition (with `inputSchema`) to the OpenAI
 * function-calling format (with `parameters`).
 */
export function toOpenAITool(def: {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}): OpenAITool {
  return {
    type: 'function',
    function: {
      name: def.name,
      description: def.description,
      parameters: {
        type: def.inputSchema.type,
        properties: def.inputSchema.properties,
        required: def.inputSchema.required,
      },
    },
  }
}

/**
 * Returns the tool set for the current Office host in OpenAI format.
 * Returns an empty array if the host is unrecognized.
 */
export function getToolsForHost(): OpenAITool[] {
  const host = getOfficeHost()
  switch (host) {
    case 'excel':
      return excelTools.map(toOpenAITool)
    case 'powerpoint':
      return powerpointTools.map(toOpenAITool)
    case 'word':
      return wordTools.map(toOpenAITool)
    default:
      return []
  }
}

// ── Streaming accumulation helpers ───────────────────────────────────────────

/** Merge an incoming SSE tool_call delta into an accumulator map */
export function mergeToolCallDelta(
  accumMap: Map<number, ToolCallAccumulator>,
  delta: {
    index?: number
    id?: string
    function?: { name?: string; arguments?: string }
  },
): void {
  const idx = delta.index ?? 0
  const existing = accumMap.get(idx) ?? { id: '', name: '', argumentsJson: '' }
  accumMap.set(idx, {
    id: existing.id || delta.id || '',
    name: existing.name || delta.function?.name || '',
    argumentsJson: existing.argumentsJson + (delta.function?.arguments ?? ''),
  })
}

/** Finalize accumulated tool calls into ParsedToolCall objects */
export function finalizeToolCalls(
  accumMap: Map<number, ToolCallAccumulator>,
): ParsedToolCall[] {
  return Array.from(accumMap.values())
    .filter((tc) => tc.name)
    .map((tc) => {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.argumentsJson || '{}') as Record<string, unknown>
      } catch {
        // malformed JSON — use empty args
      }
      return { id: tc.id, name: tc.name, arguments: args }
    })
}
