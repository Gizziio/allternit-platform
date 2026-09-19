// Dormant shim — runtime-dead: importers gate on feature('CHICAGO_MCP') DCE
// flags. Mirrors the contract of
// src/cli/ui/ink-app/utils/computerUse/wrapper.tsx; the runtime tree has no
// Computer Use MCP server.
export function getComputerUseMCPToolOverrides(
  _toolName: string,
): Record<string, never> {
  return {}
}
