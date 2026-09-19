// Auto-generated shim to satisfy TypeScript imports.
// The real MCP-skills discovery is only wired when the MCP_SKILLS feature
// flag is enabled; the MCP client DCE-gates this require behind feature().
const cache = new Map<string, unknown>()

export const fetchMcpSkillsForClient: {
  (client: unknown): Promise<unknown[]>
  cache: Map<string, unknown>
} = Object.assign(async (_client: unknown): Promise<unknown[]> => [], { cache })
