// @ts-nocheck
// Stub for the optional `@allternit/extension` package (browser-extension MCP
// tools for the Allternit-in-Chrome integration). The extension package is
// not vendored in this repo, so the tool list is empty — the chrome
// integration setup still works and simply exposes no browser MCP tools.
// When the real extension package is present it takes precedence via the
// normal package resolution.

/** Browser tools exposed by the browser extension (none when unbundled). */
export const BROWSER_TOOLS: Array<{ name: string; description: string; inputSchema: unknown }> = []

export default { BROWSER_TOOLS }
