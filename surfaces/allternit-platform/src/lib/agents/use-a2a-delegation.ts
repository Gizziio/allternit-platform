"use client";

import { useCallback } from "react";
import { useAgentStore } from "./agent.store";
import { useAdvancedAgentStore } from "./agent-advanced.store";
import { isSwarmAgentId, getSwarmIdFromAgent } from "./swarm-as-agent";
import { useAgentCommunicationStore } from "./tools/agent-communication.tool";
import type { Agent } from "./agent.types";

/**
 * A2A Delegation Hook
 *
 * Handles agent-to-agent task delegation when an agent with `canDelegate: true`
 * is @mentioned. Supports:
 * - Sub-agent spawning (agent delegates to its sub-agents)
 * - Swarm execution (agent triggers a swarm run)
 * - Cross-agent messaging (A2A message to another agent)
 */
export function useA2ADelegation() {
  const agents = useAgentStore((state: { agents: Agent[] }) => state.agents);
  const startSwarmRun = useAdvancedAgentStore((state: { startSwarmRun: (swarmId: string, input: string) => Promise<string> }) => state.startSwarmRun);
  const sendMessage = useAgentCommunicationStore((state: { sendMessage: (msg: any) => void }) => state.sendMessage);

  const delegate = useCallback(
    async (fromAgentId: string, toAgentId: string, task: string): Promise<{ success: boolean; delegatedTo?: string; message?: string }> => {
      const toAgent = agents.find((a) => a.id === toAgentId);
      if (!toAgent) {
        return { success: false, message: `Agent ${toAgentId} not found` };
      }

      // Case 1: Swarm agent — start a swarm run
      if (isSwarmAgentId(toAgentId)) {
        const swarmId = getSwarmIdFromAgent(toAgentId);
        if (!swarmId) {
          return { success: false, message: "Invalid swarm agent ID" };
        }
        try {
          const runId = await startSwarmRun(swarmId, task);
          return { success: true, delegatedTo: `swarm:${swarmId}`, message: `Delegated to swarm run ${runId}` };
        } catch (err) {
          return { success: false, message: `Swarm execution failed: ${err}` };
        }
      }

      // Case 2: Agent with canDelegate — send A2A message for sub-agent routing
      if (toAgent.agentCard?.canDelegate) {
        sendMessage({
          from: { agentId: fromAgentId, agentName: "User", agentRole: "orchestrator" },
          to: { agentId: toAgentId },
          content: task,
          type: "direct",
          correlationId: `a2a_${Date.now()}`,
        });
        return { success: true, delegatedTo: toAgentId, message: `A2A message sent to ${toAgent.name}` };
      }

      // Case 3: Regular agent — no delegation needed
      return { success: true, delegatedTo: toAgentId };
    },
    [agents, startSwarmRun, sendMessage]
  );

  return { delegate };
}
