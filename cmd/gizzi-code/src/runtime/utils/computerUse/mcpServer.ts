// Dormant shim — runtime-dead: importers gate on feature('CHICAGO_MCP') DCE
// flags. Mirrors the contract of
// src/cli/ui/ink-app/utils/computerUse/mcpServer.ts; the runtime tree has no
// Computer Use MCP server.
export async function createComputerUseMcpServerForCli(): Promise<never> {
  throw new Error(
    'createComputerUseMcpServerForCli: dormant shim has no runtime implementation',
  )
}
