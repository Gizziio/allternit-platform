import { useMemo } from "react";

import { useAgentSurfaceModeStore, type AgentModeSurface } from "@/stores/agent-surface-mode.store";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { useCodeSessionStore } from "@/views/code/CodeSessionStore";
import { useCoworkSessionStore } from "@/views/cowork/CoworkSessionStore";

import { useAgentStore } from "./agent.store";
import type { Agent } from "./agent.types";
import { getAgentSessionDescriptor } from "./session-metadata";

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

/**
 * Derives whether agent mode is active for a surface from the mode-specific store.
 * Agent mode is on when there is an active session whose session_mode is 'agent'.
 */
export function useSurfaceAgentModeEnabled(surface: AgentModeSurface): boolean {
  const chatSessionId = useChatSessionStore((s) => s.activeSessionId);
  const codeSessionId = useCodeSessionStore((s) => s.activeSessionId);
  const coworkSessionId = useCoworkSessionStore((s) => s.activeSessionId);
  const chatSessions = useChatSessionStore((s) => s.sessions);
  const codeSessions = useCodeSessionStore((s) => s.sessions);
  const coworkSessions = useCoworkSessionStore((s) => s.sessions);

  const activeId = surface === "code" ? codeSessionId : surface === "cowork" ? coworkSessionId : chatSessionId;
  const sessions = surface === "code" ? codeSessions : surface === "cowork" ? coworkSessions : chatSessions;

  const session = activeId ? (sessions.find((s) => s.id === activeId) ?? null) : null;
  const descriptor = getAgentSessionDescriptor(session?.metadata);

  return Boolean(activeId && session) && descriptor.sessionMode === "agent";
}

export function useSurfaceAgentSelection(surface: AgentModeSurface) {
  const agentModeEnabled = useSurfaceAgentModeEnabled(surface);
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
