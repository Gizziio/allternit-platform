/**
 * Code Session Store (Production Implementation)
 * 
 * Owns all code-mode sessions completely independently from Chat and Cowork.
 * Optimized for development workflows with:
 * - Code editing and generation
 * - Terminal integration
 * - File workspace context
 * 
 * PRODUCTION FEATURES:
 * - Automatic agent workspace loading
 * - SOUL.md trust tier enforcement (especially for code safety)
 * - HEARTBEAT.md task execution
 * - Context sent with every message
 * 
 * @module CodeSessionStore
 */

import { 
  createModeSessionStore, 
  type ModeSession, 
  type CreateModeSessionOptions,
  type SendMessageOptions,
} from '@/lib/agents/mode-session-store';

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
  return useCodeSessionStore((state) => state.sessions);
}

export function useActiveCodeSession() {
  return useCodeSessionStore((state) => {
    if (!state.activeSessionId) return null;
    return state.sessions.find((s) => s.id === state.activeSessionId) || null;
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
  }));
}
