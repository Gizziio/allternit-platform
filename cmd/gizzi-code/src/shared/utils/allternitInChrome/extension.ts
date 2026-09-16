/**
 * Chrome-extension MCP surface for Allternit-in-Chrome.
 * The optional @allternit/extension package is not vendored in this repo.
 * Callers get an empty tool list; starting the in-process MCP server throws.
 */

export const BROWSER_TOOLS: Array<{
  name: string
  description: string
  inputSchema: unknown
}> = []

export type ClaudeForChromeContext = Record<string, unknown>
export type Logger = (...args: unknown[]) => void
export type PermissionMode = string

export function createClaudeForChromeMcpServer(
  _context: ClaudeForChromeContext,
): never {
  throw new Error(
    'Allternit-in-Chrome MCP server requires the @allternit/extension package, which is not in this build.',
  )
}
