/**
 * Load Agents Directory
 */

export interface AgentDefinition {
  id: string
  name: string
  description?: string
  systemPrompt?: string
}

export interface BuiltInAgentDefinition extends AgentDefinition {
  builtIn: true
  category?: string
  mcpServers?: string[]
}

export interface ResolvedAgent extends AgentDefinition {
  source: 'builtin' | 'directory' | 'mcp'
}

export function isBuiltInAgent(agent: AgentDefinition): agent is BuiltInAgentDefinition {
  return 'builtIn' in agent && agent.builtIn === true
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
