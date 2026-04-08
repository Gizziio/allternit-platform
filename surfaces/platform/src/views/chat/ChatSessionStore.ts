/**
 * Chat Session Store (Production Implementation)
 * 
 * Owns all chat-mode sessions completely independently from Cowork and Code.
 * Like Claude Desktop's "Chat" tab - sessions here don't appear elsewhere.
 * 
 * PRODUCTION FEATURES:
 * - Automatic agent workspace loading
 * - SOUL.md trust tier enforcement
 * - HEARTBEAT.md task execution
 * - Context sent with every message
 * 
 * @module ChatSessionStore
 */

import { 
  createModeSessionStore, 
  type ModeSession, 
  type CreateModeSessionOptions,
  type SendMessageOptions,
} from '@/lib/agents/mode-session-store';

export type { 
  ModeSession as ChatSession, 
  CreateModeSessionOptions as CreateChatSessionOptions,
  SendMessageOptions as ChatSendMessageOptions,
};

export const useChatSessionStore = createModeSessionStore({
  name: 'ChatSessionStore',
  storageKey: 'allternit-chat-sessions',
  originSurface: 'chat',
});

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

export function useChatSessions() {
  return useChatSessionStore((state) => state.sessions);
}

export function useActiveChatSession() {
  return useChatSessionStore((state) => {
    if (!state.activeSessionId) return null;
    return state.sessions.find((s) => s.id === state.activeSessionId) || null;
  });
}

export function useActiveChatSessionId() {
  return useChatSessionStore((state) => state.activeSessionId);
}

export function useIsChatSessionLoading() {
  return useChatSessionStore((state) => state.isLoading);
}

export function useChatSessionError() {
  return useChatSessionStore((state) => state.error);
}

// ---------------------------------------------------------------------------
// Helper: Get agent sessions only
// ---------------------------------------------------------------------------

export function useAgentChatSessions() {
  return useChatSessionStore((state) => 
    state.sessions.filter((s) => s.metadata.sessionMode === 'agent')
  );
}

// ---------------------------------------------------------------------------
// Helper: Get sessions by project
// ---------------------------------------------------------------------------

export function useChatSessionsByProject(projectId: string | null) {
  return useChatSessionStore((state) => {
    if (!projectId) return state.sessions;
    return state.sessions.filter((s) => s.metadata.projectId === projectId);
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function useChatSessionActions() {
  return useChatSessionStore((state) => ({
    createSession: state.createSession,
    deleteSession: state.deleteSession,
    updateSession: state.updateSession,
    setActiveSession: state.setActiveSession,
    sendMessage: state.sendMessage,
    sendMessageStream: state.sendMessageStream,
    loadSessions: state.loadSessions,
    refreshContext: state.refreshContext,
    setSessionMode: state.setSessionMode,
  }));
}
