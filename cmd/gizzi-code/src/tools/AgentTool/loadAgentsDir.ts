/**
 * Agent Tool - re-export from runtime builtins
 * Entry point for agent tool definitions and directory loading
 */

export {
  type AgentDefinition,
  type BuiltInAgentDefinition,
  type ResolvedAgent,
  loadAgentsDir,
  isBuiltInAgent,
  filterAgentsByMcpRequirements,
  hasRequiredMcpServers,
  getBuiltInAgents,
} from '../../runtime/tools/builtins/agenttool/loadAgentsDir.js'
