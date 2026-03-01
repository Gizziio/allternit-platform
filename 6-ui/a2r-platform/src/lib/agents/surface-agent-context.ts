import { useMemo } from "react";

import { useAgentSurfaceModeStore, type AgentModeSurface } from "@/stores/agent-surface-mode.store";

import { useAgentStore } from "./agent.store";
import type { Agent } from "./agent.types";

type AgentLike = Pick<Agent, "id" | "name" | "provider" | "model" | "config"> | null;

export interface AgentConversationContext {
  conversationMode: "llm" | "agent";
  agentId?: string;
  agentName?: string;
  agentProvider?: string;
  agentModel?: string;
  agentFallbackModels?: string[];
  agentSessionKey?: string;
}

export function useSurfaceAgentSelection(surface: AgentModeSurface) {
  const agentModeEnabled = useAgentSurfaceModeStore(
    (state) => state.enabledBySurface[surface],
  );
  const selectedAgentId = useAgentSurfaceModeStore(
    (state) => state.selectedAgentIdBySurface[surface],
  );
  const agents = useAgentStore((state) => state.agents);

  const selectedAgent = useMemo(
    () =>
      selectedAgentId
        ? agents.find((agent) => agent.id === selectedAgentId) ?? null
        : null,
    [agents, selectedAgentId],
  );

  return {
    agentModeEnabled,
    selectedAgentId,
    selectedAgent,
  };
}

export function buildAgentConversationContext({
  agentModeEnabled,
  agentId,
  agent,
  chatId,
}: {
  agentModeEnabled: boolean;
  agentId?: string | null;
  agent?: AgentLike;
  chatId?: string | null;
}): AgentConversationContext {
  if (!agentModeEnabled || !agentId) {
    return { conversationMode: "llm" };
  }

  const fallbackModels = Array.isArray(agent?.config?.fallbackModels)
    ? agent.config.fallbackModels.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  return {
    conversationMode: "agent",
    agentId,
    agentName: agent?.name,
    agentProvider: agent?.provider,
    agentModel: agent?.model,
    agentFallbackModels: fallbackModels.length > 0 ? fallbackModels : undefined,
    agentSessionKey: chatId ? `agent:${agentId}:${chatId}` : undefined,
  };
}
