/**
 * Code Session Store (Production Implementation)
 * 
 * **ARCHITECTURE**: Mode-specific isolated store. Code sessions are completely
 * separate from Chat and Cowork sessions. They do not sync, share, or appear
 * in other modes. This is intentional (like Claude Desktop).
 * 
 * **BACKEND**: Uses native-agent-api with origin_surface='code' tag.
 * 
 * @module CodeSessionStore
 * @see docs/SESSION_ARCHITECTURE.md for full documentation
 */

import { 
  createModeSessionStore, 
  type ModeSession, 
  type CreateModeSessionOptions,
  type SendMessageOptions,
} from '@/lib/agents/mode-session-store';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CodeSessionStore');

export type { 
  ModeSession as CodeSession, 
  CreateModeSessionOptions as CreateCodeSessionOptions,
  SendMessageOptions as CodeSendMessageOptions,
};

export const useCodeSessionStore = createModeSessionStore({
  name: 'CodeSessionStore',
  storageKey: 'allternit-code-sessions',
  originSurface: 'code',
});

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

export function useCodeSessions() {
  return useCodeSessionStore((state) => state.sessions ?? []);
}

export function useActiveCodeSession() {
  return useCodeSessionStore((state) => {
    if (!state.activeSessionId) return null;
    return (state.sessions ?? []).find((s) => s.id === state.activeSessionId) || null;
  });
}

export function useActiveCodeSessionId() {
  return useCodeSessionStore((state) => state.activeSessionId);
}

export function useIsCodeSessionLoading() {
  return useCodeSessionStore((state) => state.isLoading);
}

export function useCodeSessionError() {
  return useCodeSessionStore((state) => state.error);
}

// ---------------------------------------------------------------------------
// Helper: Get agent sessions only
// ---------------------------------------------------------------------------

export function useAgentCodeSessions() {
  return useCodeSessionStore((state) => 
    state.sessions.filter((s) => s.metadata.sessionMode === 'agent')
  );
}

// ---------------------------------------------------------------------------
// Helper: Get sessions by workspace
// ---------------------------------------------------------------------------

export function useCodeSessionsByWorkspace(workspaceId: string | null) {
  return useCodeSessionStore((state) => {
    if (!workspaceId) return state.sessions;
    return state.sessions.filter((s) => s.metadata.workspaceId === workspaceId);
  });
}

// ---------------------------------------------------------------------------
// Sync state
// ---------------------------------------------------------------------------

export function useCodeSessionSyncState() {
  return useCodeSessionStore((state) => ({
    isConnected: state.isSyncConnected,
    error: state.syncError,
  }));
}

// ---------------------------------------------------------------------------
// Unread counts
// ---------------------------------------------------------------------------

export function useCodeSessionUnreadCount(sessionId: string | null) {
  return useCodeSessionStore((state) => 
    sessionId ? (state.unreadCounts[sessionId] || 0) : 0
  );
}

export function useCodeTotalUnreadCount() {
  return useCodeSessionStore((state) => 
    Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0)
  );
}

export function useCodeUnreadCounts() {
  return useCodeSessionStore((state) => state.unreadCounts);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function useCodeSessionActions() {
  return useCodeSessionStore((state) => ({
    createSession: state.createSession,
    deleteSession: state.deleteSession,
    updateSession: state.updateSession,
    setActiveSession: state.setActiveSession,
    sendMessage: state.sendMessage,
    sendMessageStream: state.sendMessageStream,
    loadSessions: state.loadSessions,
    refreshContext: state.refreshContext,
    setSessionMode: state.setSessionMode,
    connectSessionSync: state.connectSessionSync,
    disconnectSessionSync: state.disconnectSessionSync,
    markSessionRead: state.markSessionRead,
    abortGeneration: state.abortGeneration,
  }));
}

// ---------------------------------------------------------------------------
// Session creation with memory/context parity (matches Cowork)
// ---------------------------------------------------------------------------

export async function createCodeSession(options?: CreateModeSessionOptions): Promise<string> {
  const sessionId = await useCodeSessionStore.getState().createSession(options);

  // Inject memory context — use semantic search when we have a task name, else formatted context list
  const taskName = options?.name;
  const memoryUrl = taskName
    ? `/api/v1/cowork/memory/search?query=${encodeURIComponent(taskName)}&limit=10`
    : `/api/v1/cowork/memory?limit=10&format=context`;

  fetch(memoryUrl)
    .then((r) => r.json())
    .then((data: { results?: Array<{ content: string }>; context?: string; entries?: Array<{ content: string }> }) => {
      let memoryContext = '';
      if (data.context) {
        memoryContext = data.context;
      } else if (data.results?.length) {
        memoryContext = `Relevant memory:\n${data.results.map((r) => r.content).join('\n')}`;
      } else if (data.entries?.length) {
        memoryContext = data.entries.map((e) => e.content).join('\n---\n');
      }
      if (!memoryContext) return;
      const existing = useCodeSessionStore.getState().sessions.find((s) => s.id === sessionId)?.metadata;
      useCodeSessionStore.getState().updateSession(sessionId, {
        metadata: { ...existing, originSurface: 'code', memoryContext },
      });
    })
    .catch((err) => { logger.error({ err: err }, 'Failed to fetch memory context'); });

  return sessionId;
}
