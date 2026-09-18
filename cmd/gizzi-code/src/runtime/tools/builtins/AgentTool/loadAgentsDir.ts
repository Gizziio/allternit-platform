/**
 * Load Agents Directory
 */

export interface AgentDefinition {
  id: string
  name: string
  description?: string
  systemPrompt?: string
}

// Built-in agent records (built-in/*.ts) carry the rich ink-app-style
// definition shape (agentType/whenToUse/tools/source/baseDir/getSystemPrompt)
// and are keyed by agentType at runtime, so id/name/builtIn are optional here.
export type BuiltInAgentDefinition = Omit<AgentDefinition, 'id' | 'name'> & {
  id?: string
  name?: string
  builtIn?: true
  category?: string
  mcpServers?: string[]
  agentType?: string
  whenToUse?: string
  tools?: string[]
  source?: string
  baseDir?: string
  getSystemPrompt?: () => string
}

export interface ResolvedAgent extends AgentDefinition {
  source: 'builtin' | 'directory' | 'mcp'
}

export function isBuiltInAgent(
  agent: AgentDefinition,
): agent is AgentDefinition & BuiltInAgentDefinition {
  return 'builtIn' in agent && (agent as BuiltInAgentDefinition).builtIn === true
}

export function filterAgentsByMcpRequirements(
  agents: AgentDefinition[],
  requiredServers: string[]
): AgentDefinition[] {
  return agents.filter(agent => {
    if (!isBuiltInAgent(agent)) return true
    const agentServers = agent.mcpServers || []
    return requiredServers.every(server => agentServers.includes(server))
  })
}

export function hasRequiredMcpServers(
  agent: AgentDefinition,
  availableServers: string[]
): boolean {
  if (!isBuiltInAgent(agent)) return true
  const required = agent.mcpServers || []
  return required.every(server => availableServers.includes(server))
}

export function getBuiltInAgents(): BuiltInAgentDefinition[] {
  return []
}

export async function loadAgentsDir(path?: string): Promise<AgentDefinition[]> {
  return []
}
