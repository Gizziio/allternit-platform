// @ts-nocheck
// Stub for the optional `@allternit/extension` package (browser-extension MCP
// tools for the Allternit-in-Chrome integration). The extension package is
// not vendored in this repo, so the tool list is empty — the chrome
// integration setup still works and simply exposes no browser MCP tools.
// When the real extension package is present it takes precedence via the
// normal package resolution.

/** Browser tools exposed by the browser extension (none when unbundled). */
export const BROWSER_TOOLS: Array<{ name: string; description: string; inputSchema: unknown }> = []

export type ClaudeForChromeContext = Record<string, unknown>
export type Logger = (...args: unknown[]) => void
export type PermissionMode = string

/**
 * Creates the Claude-for-Chrome MCP server. Throws loudly: this path only
 * runs when the user explicitly enables the Chrome integration, which
 * requires the real @allternit/extension package.
 */
export function createClaudeForChromeMcpServer(
  _context: ClaudeForChromeContext,
): never {
  throw new Error(
    '[@allternit/extension] createClaudeForChromeMcpServer called, but the ' +
      'optional @allternit/extension package is not vendored in this build. ' +
      'Install it to enable the Allternit-in-Chrome MCP server.',
  )
}

export default { BROWSER_TOOLS, createClaudeForChromeMcpServer }
