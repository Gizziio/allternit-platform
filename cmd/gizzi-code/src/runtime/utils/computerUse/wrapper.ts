// Auto-generated shim to satisfy TypeScript imports
import type { ReactNode } from 'react'
import type { Tool } from '../../../cli/ui/ink-app/Tool.js'
import type { MCPToolResult } from '../../../shared/utils/mcpValidation.js'

type CallOverride = Pick<Tool, 'call'>['call']

export type ComputerUseMCPToolOverrides = {
  userFacingName: () => string
  renderToolUseMessage: (
    input: Record<string, unknown>,
    options: { verbose: boolean },
  ) => ReactNode
  renderToolResultMessage: (
    output: MCPToolResult,
    progressMessages: unknown[],
    options: { verbose: boolean },
  ) => ReactNode
  call: CallOverride
}

export function getComputerUseMCPToolOverrides(
  _toolName: string,
): ComputerUseMCPToolOverrides {
  // Stub implementation
  throw new Error('Computer Use MCP is not available in this build')
}
