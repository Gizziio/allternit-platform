/**
 * Agent Color Manager
 */

export type AgentColorName = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'

export function getAgentColor(agentId: string): AgentColorName {
  const colors: AgentColorName[] = ['blue', 'green', 'yellow', 'red', 'purple', 'gray']
  const index = agentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % colors.length
  return colors[index]
}
