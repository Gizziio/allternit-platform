// Dormant shim — runtime-dead: importers gate on feature('CHICAGO_MCP') DCE
// flags. Mirrors the contract of
// src/cli/ui/ink-app/utils/computerUse/common.ts; the runtime tree has no
// Computer Use MCP server.
export function isComputerUseMCPServer(_name: string): boolean {
  return false
}
