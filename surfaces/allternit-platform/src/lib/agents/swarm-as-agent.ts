/**
 * Swarm-as-Agent Bridge
 *
 * Converts AgentSwarm configurations into Agent objects so they can be:
 * - @mentioned in chat
 * - Displayed in agent cards
 * - Delegated to via A2A
 * - Rated and benchmarked
 */

import type { Agent } from "./agent.types";
import type { AgentSwarm } from "./agent-advanced.types";

/**
 * Convert an AgentSwarm to an Agent representation.
 * The agent ID is prefixed with `swarm_` to avoid collisions.
 */
export function swarmToAgent(swarm: AgentSwarm): Agent {
  const swarmAgent: Agent = {
    id: `swarm_${swarm.id}`,
    name: swarm.name,
    description: swarm.description,
    type: "orchestrator",
    model: "swarm",
    provider: "custom",
    capabilities: swarm.agents.map((a) => a.role),
    tools: [],
    maxIterations: swarm.maxRounds,
    temperature: 0.7,
    config: {
      avatar: generateSwarmAvatar(swarm),
      swarmConfig: swarm,
    },
    status: "idle",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "organization",
    swarmId: swarm.id,
    agentCard: {
      tagline: `${swarm.agents.length}-agent ${swarm.strategy} swarm`,
      capabilityDescription: `Collaborative swarm using ${swarm.strategy} strategy. Agents: ${swarm.agents.map((a) => a.role).join(", ")}`,
      trustTier: "medium",
      canDelegate: true,
      a2aVersion: "1.0",
      examples: [
        `@${swarm.name} research this topic`,
        `@${swarm.name} draft a proposal`,
      ],
    },
    category: "operations",
    isPublic: true,
    tags: ["swarm", "multi-agent", swarm.strategy],
  };

  return swarmAgent;
}

/**
 * Generate a simple avatar config for a swarm based on its strategy.
 */
function generateSwarmAvatar(swarm: AgentSwarm): Record<string, unknown> {
  const colors: Record<string, string> = {
    "round-robin": "#06b6d4",
    hierarchical: "#ec4899",
    democratic: "#8b5cf6",
    competitive: "#f97316",
    collaborative: "#10b981",
    specialist: "#f59e0b",
    adaptive: "#6366f1",
  };

  const color = colors[swarm.strategy] || "#6366f1";

  return {
    preset: "geometric",
    colors: {
      primary: color,
      secondary: "#1e1c1a",
      accent: color,
    },
    shape: "hexagon",
  };
}

/**
 * Check if an agent ID represents a swarm.
 */
export function isSwarmAgentId(agentId: string): boolean {
  return agentId.startsWith("swarm_");
}

/**
 * Extract the original swarm ID from a swarm agent ID.
 */
export function getSwarmIdFromAgent(agentId: string): string | null {
  if (!isSwarmAgentId(agentId)) return null;
  return agentId.slice(6); // Remove "swarm_" prefix
}
