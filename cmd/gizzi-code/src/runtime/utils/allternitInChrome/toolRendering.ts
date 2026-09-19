// Auto-generated shim to satisfy TypeScript imports
import type { ReactNode } from 'react'
import type { MCPToolResult } from '../../../shared/utils/mcpValidation.js'

export type AllternitInChromeMCPToolOverrides = {
  userFacingName: (input?: Record<string, unknown>) => string
  renderToolUseMessage: (
    input: Record<string, unknown>,
    options: { verbose: boolean },
  ) => ReactNode
  renderToolUseTag: (
    input: Partial<Record<string, unknown>>,
  ) => ReactNode
  renderToolResultMessage: (
    output: string | MCPToolResult,
    progressMessagesForMessage: unknown[],
    options: { verbose: boolean },
  ) => ReactNode
}

export function getAllternitInChromeMCPToolOverrides(
  _toolName: string,
): AllternitInChromeMCPToolOverrides {
  // Stub implementation
  throw new Error('Allternit-in-Chrome MCP is not available in this build')
}
