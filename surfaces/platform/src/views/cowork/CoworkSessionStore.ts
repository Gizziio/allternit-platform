/**
 * Cowork Session Store (Production Implementation)
 * 
 * Owns all cowork-mode sessions completely independently from Chat and Code.
 * Like Claude Desktop's "Projects" tab - sessions here don't appear in Chat.
 * 
 * PRODUCTION FEATURES:
 * - Automatic agent workspace loading
 * - SOUL.md trust tier enforcement
 * - HEARTBEAT.md task execution (optimized for cowork workflows)
 * - Context sent with every message
 * 
 * Cowork mode is optimized for:
 * - Longer running tasks
 * - Artifacts and workspace integration
 * - Computer use capabilities
 * 
 * @module CoworkSessionStore
 */

import { 
  createModeSessionStore, 
  type ModeSession, 
  type CreateModeSessionOptions,
  type SendMessageOptions,
} from '@/lib/agents/mode-session-store';

export type { 
  ModeSession as CoworkSession, 
  CreateModeSessionOptions as CreateCoworkSessionOptions,
  SendMessageOptions as CoworkSendMessageOptions,
};

export const useCoworkSessionStore = createModeSessionStore({
  name: 'CoworkSessionStore',
  storageKey: 'allternit-cowork-sessions',
  originSurface: 'cowork',
});

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

export function useCoworkSessions() {
  return useCoworkSessionStore((state) => state.sessions);
}

export function useActiveCoworkSession() {
  return useCoworkSessionStore((state) => {
    if (!state.activeSessionId) return null;
    return state.sessions.find((s) => s.id === state.activeSessionId) || null;
  });
}

export function useActiveCoworkSessionId() {
  return useCoworkSessionStore((state) => state.activeSessionId);
}

export function useIsCoworkSessionLoading() {
  return useCoworkSessionStore((state) => state.isLoading);
}

export function useCoworkSessionError() {
  return useCoworkSessionStore((state) => state.error);
}

// ---------------------------------------------------------------------------
// Helper: Get agent sessions only
// ---------------------------------------------------------------------------

export function useAgentCoworkSessions() {
  return useCoworkSessionStore((state) => 
    state.sessions.filter((s) => s.metadata.sessionMode === 'agent')
  );
}

// ---------------------------------------------------------------------------
// Helper: Get sessions by task
// ---------------------------------------------------------------------------

export function useCoworkSessionsByTask(taskId: string | null) {
  return useCoworkSessionStore((state) => {
    if (!taskId) return state.sessions;
    return state.sessions.filter((s) => s.metadata.taskId === taskId);
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function useCoworkSessionActions() {
  return useCoworkSessionStore((state) => ({
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
