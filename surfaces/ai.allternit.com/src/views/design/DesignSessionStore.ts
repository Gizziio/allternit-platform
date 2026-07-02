// @ts-nocheck
import {
  createModeSessionStore,
  type ModeSession,
  type CreateModeSessionOptions,
  type SendMessageOptions,
  type ModeSessionMessage,
} from '@/lib/agents/mode-session-store';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('DesignSessionStore');

/**
 * DesignSessionStore - Dedicated session management for Allternit Design.
 * Completely independent from Chat, Code, and Cowork modes.
 */

// Local alias for use within this file
type DesignSession = ModeSession;

export type {
  ModeSession as DesignSession,
  CreateModeSessionOptions as CreateDesignSessionOptions,
  SendMessageOptions as DesignSendMessageOptions,
  ModeSessionMessage,
};

export const useDesignSessionStore = createModeSessionStore({
  name: 'DesignSessionStore',
  storageKey: 'allternit-design-sessions',
  originSurface: 'design',
});

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

export function useDesignSessions() {
  return useDesignSessionStore((state) => state.sessions ?? []);
}

export function useActiveDesignSession() {
  return useDesignSessionStore((state) => {
    if (!state.activeSessionId) return null;
    return (state.sessions ?? []).find((s) => s.id === state.activeSessionId) || null;
  });
}

export function useActiveDesignSessionId() {
  return useDesignSessionStore((state) => state.activeSessionId);
}

export function useIsDesignSessionLoading() {
  return useDesignSessionStore((state) => state.isLoading);
}

export function useDesignSessionError() {
  return useDesignSessionStore((state) => state.error);
}

export function useAgentDesignSessions() {
  return useDesignSessionStore((state) =>
    state.sessions.filter((s) => s.metadata.sessionMode === 'agent')
  );
}

export function useDesignSessionSyncState() {
  return useDesignSessionStore((state) => ({
    isConnected: state.isSyncConnected,
    error: state.syncError,
  }));
}

export function useDesignSessionUnreadCount(sessionId: string | null) {
  return useDesignSessionStore((state) =>
    sessionId ? (state.unreadCounts[sessionId] || 0) : 0
  );
}

export function useDesignTotalUnreadCount() {
  return useDesignSessionStore((state) =>
    Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0)
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function useDesignSessionActions() {
  return useDesignSessionStore((state) => ({
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

export async function createDesignSession(options?: CreateModeSessionOptions): Promise<string> {
  const sessionId = await useDesignSessionStore.getState().createSession(options);

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
      const existing = useDesignSessionStore.getState().sessions.find((s) => s.id === sessionId)?.metadata;
      useDesignSessionStore.getState().updateSession(sessionId, {
        metadata: { ...existing, originSurface: 'design', memoryContext },
      });
    })
    .catch((err) => { logger.error({ err: err }, 'Failed to fetch memory context'); });

  return sessionId;
}
