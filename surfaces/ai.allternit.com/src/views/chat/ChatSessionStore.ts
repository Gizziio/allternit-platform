/**
 * Chat Session Store (Production Implementation)
 * 
 * **ARCHITECTURE**: Mode-specific isolated store. Chat sessions are completely
 * separate from Code and Cowork sessions. They do not sync, share, or appear
 * in other modes. This is intentional (like Claude Desktop).
 * 
 * **BACKEND**: Uses native-agent-api with origin_surface='chat' tag.
 * 
 * @module ChatSessionStore
 * @see docs/SESSION_ARCHITECTURE.md for full documentation
 */

import { 
  createModeSessionStore, 
  type ModeSession, 
  type CreateModeSessionOptions,
  type SendMessageOptions,
  type ModeSessionMessage,
} from '@/lib/agents/mode-session-store';

// Local alias for use within this file
type ChatSession = ModeSession;

export type {
  ModeSession as ChatSession,
  CreateModeSessionOptions as CreateChatSessionOptions,
  SendMessageOptions as ChatSendMessageOptions,
  ModeSessionMessage,
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
  return useChatSessionStore((state) => state.sessions ?? []);
}

export function useActiveChatSession() {
  return useChatSessionStore((state) => {
    if (!state.activeSessionId) return null;
    return (state.sessions ?? []).find((s) => s.id === state.activeSessionId) || null;
  });
}

function useActiveChatSessionId() {
  return useChatSessionStore((state) => state.activeSessionId);
}

function useIsChatSessionLoading() {
  return useChatSessionStore((state) => state.isLoading);
}

function useChatSessionError() {
  return useChatSessionStore((state) => state.error);
}

// ---------------------------------------------------------------------------
// Helper: Get agent sessions only
// ---------------------------------------------------------------------------

function useAgentChatSessions() {
  return useChatSessionStore((state) => 
    (state.sessions ?? []).filter((s) => s.metadata.sessionMode === 'agent')
  );
}

// ---------------------------------------------------------------------------
// Helper: Get sessions by project
// ---------------------------------------------------------------------------

function useChatSessionsByProject(projectId: string | null) {
  return useChatSessionStore((state) => {
    const sessions = state.sessions ?? [];
    if (!projectId) return sessions;
    return sessions.filter((s) => s.metadata.projectId === projectId);
  });
}

// ---------------------------------------------------------------------------
// Sync state
// ---------------------------------------------------------------------------

function useChatSessionSyncState() {
  return useChatSessionStore((state) => ({
    isConnected: state.isSyncConnected,
    error: state.syncError,
  }));
}

// ---------------------------------------------------------------------------
// Unread counts
// ---------------------------------------------------------------------------

function useChatSessionUnreadCount(sessionId: string | null) {
  return useChatSessionStore((state) => 
    sessionId ? (state.unreadCounts[sessionId] || 0) : 0
  );
}

function useChatTotalUnreadCount() {
  return useChatSessionStore((state) => 
    Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0)
  );
}

function useChatUnreadCounts() {
  return useChatSessionStore((state) => state.unreadCounts);
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Get sessions for a specific project
 * Filters sessions by projectId metadata
 */
function getChatSessionsForProject(
  sessions: ChatSession[],
  projectId: string
): ChatSession[] {
  return sessions.filter((s) => s.metadata?.projectId === projectId);
}

/**
 * Get root sessions (not in any project)
 * Filters sessions that don't have a projectId
 */
function getRootChatSessions(sessions: ChatSession[]): ChatSession[] {
  return sessions.filter((s) => !s.metadata?.projectId);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function useChatSessionActions() {
  return useChatSessionStore((state) => ({
    createSession: state.createSession,
    deleteSession: state.deleteSession,
    updateSession: state.updateSession,
    setActiveSession: state.setActiveSession,
    sendMessage: state.sendMessage,
    sendMessageStream: state.sendMessageStream,
    sendRoutedTurn: state.sendRoutedTurn,
    loadSessions: state.loadSessions,
    refreshContext: state.refreshContext,
    setSessionMode: state.setSessionMode,
    connectSessionSync: state.connectSessionSync,
    disconnectSessionSync: state.disconnectSessionSync,
    markSessionRead: state.markSessionRead,
  }));
}
