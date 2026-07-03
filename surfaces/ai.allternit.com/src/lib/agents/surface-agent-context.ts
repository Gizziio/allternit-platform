import { useMemo } from "react";

import { useAgentSurfaceModeStore, type AgentModeSurface } from "@/stores/agent-surface-mode.store";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { useCodeSessionStore } from "@/views/code/CodeSessionStore";
import { useCoworkSessionStore } from "@/views/cowork/CoworkSessionStore";
import { useDesignSessionStore } from "@/views/design/DesignSessionStore";

import { useAgentStore } from "./agent.store";
import type { Agent } from "./agent.types";
import { getAgentSessionDescriptor } from "./session-metadata";

type AgentLike = Pick<Agent, "id" | "name" | "provider" | "model" | "config" | "allowedSurfaces"> | null;

export interface AgentConversationContext {
  conversationMode: "llm" | "agent";
  agentId?: string;
  agentName?: string;
  agentProvider?: string;
  agentModel?: string;
  agentFallbackModels?: string[];
  agentSessionKey?: string;
}

/**
 * Derives whether agent mode is active for a surface from the mode-specific store.
 * Agent mode is on when there is an active session whose session_mode is 'agent'.
 */
export function useSurfaceAgentModeEnabled(surface: AgentModeSurface): boolean {
  const chatSessionId = useChatSessionStore((s) => s.activeSessionId);
  const codeSessionId = useCodeSessionStore((s) => s.activeSessionId);
  const coworkSessionId = useCoworkSessionStore((s) => s.activeSessionId);
  const designSessionId = useDesignSessionStore((s) => s.activeSessionId);
  const chatSessions = useChatSessionStore((s) => s.sessions);
  const codeSessions = useCodeSessionStore((s) => s.sessions);
  const coworkSessions = useCoworkSessionStore((s) => s.sessions);
  const designSessions = useDesignSessionStore((s) => s.sessions);

  const activeId =
    surface === "code" ? codeSessionId :
    surface === "cowork" ? coworkSessionId :
    surface === "design" ? designSessionId :
    chatSessionId;
  const sessions =
    surface === "code" ? codeSessions :
    surface === "cowork" ? coworkSessions :
    surface === "design" ? designSessions :
    chatSessions;

  const session = activeId ? (sessions.find((s) => s.id === activeId) ?? null) : null;
  const descriptor = getAgentSessionDescriptor(session?.metadata);

  return Boolean(activeId && session) && descriptor.sessionMode === "agent";
}

/**
 * Returns true when an agent explicitly allows running on the given surface.
 * An agent with no allowedSurfaces is treated as certified for every surface
 * (backwards compatibility), matching the registry enabled_modes default.
 */
export function isAgentAllowedOnSurface(
  agent: Pick<Agent, "allowedSurfaces"> | null | undefined,
  surface: AgentModeSurface,
): boolean {
  if (!agent) return false;
  if (!agent.allowedSurfaces || agent.allowedSurfaces.length === 0) return true;
  return agent.allowedSurfaces.includes(surface);
}

export function useSurfaceAgentSelection(surface: AgentModeSurface) {
  const agentModeEnabled = useSurfaceAgentModeEnabled(surface);
  const selectedAgentId = useAgentSurfaceModeStore(
    (state) => state.selectedAgentIdBySurface[surface],
  );
  const agents = useAgentStore((state) => state.agents);

  const allowedAgents = useMemo(
    () => agents.filter((agent) => isAgentAllowedOnSurface(agent, surface)),
    [agents, surface],
  );

  const selectedAgent = useMemo(() => {
    if (!selectedAgentId) return null;
    const agent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
    return isAgentAllowedOnSurface(agent, surface) ? agent : null;
  }, [agents, selectedAgentId, surface]);

  return {
    agentModeEnabled,
    selectedAgentId: selectedAgent ? selectedAgentId : null,
    selectedAgent,
    allowedAgents,
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
