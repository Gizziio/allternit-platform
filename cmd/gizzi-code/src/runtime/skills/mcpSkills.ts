// Dormant shim — runtime-dead: importers gate on feature('MCP_SKILLS') DCE
// flags, and no real implementation exists for this contract. Exports the
// surface src/runtime/services/mcp/client.ts requires: an LRU-memoized fetch
// of slash commands discovered from skill:// resources.
import type { Command } from '../../commands.js'
import type { MCPServerConnection } from '../services/mcp/types.js'

type FetchMcpSkillsForClient = ((
  client: MCPServerConnection,
) => Promise<Command[]>) & {
  cache: { delete: (key: string) => boolean }
}

export const fetchMcpSkillsForClient: FetchMcpSkillsForClient = Object.assign(
  async (_client: MCPServerConnection): Promise<Command[]> => [],
  { cache: { delete: () => false } },
)
