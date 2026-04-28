"use client";

import { useMemo } from "react";
import { useAgentStore } from "./agent.store";
import { useAdvancedAgentStore } from "./agent-advanced.store";
import { swarmToAgent } from "./swarm-as-agent";
import type { Agent } from "./agent.types";
import type { AgentSwarm } from "./agent-advanced.types";

/**
 * Returns all agents including swarm representations.
 * Swarms are converted to Agent objects so they can be:
 * - @mentioned in chat
 * - Shown in agent cards
 * - Delegated to via A2A
 */
export function useAgentsWithSwarms(): Agent[] {
  const agents = useAgentStore((state: { agents: Agent[] }) => state.agents);
  const swarms = useAdvancedAgentStore((state: { swarms: AgentSwarm[] }) => state.swarms);

  return useMemo(() => {
    const swarmAgents = swarms.map((swarm: AgentSwarm) => swarmToAgent(swarm));
    return [...agents, ...swarmAgents];
  }, [agents, swarms]);
}

/**
 * Returns only swarm agents.
 */
export function useSwarmAgents(): Agent[] {
  const swarms = useAdvancedAgentStore((state: { swarms: AgentSwarm[] }) => state.swarms);

  return useMemo(() => {
    return swarms.map((swarm: AgentSwarm) => swarmToAgent(swarm));
  }, [swarms]);
}
