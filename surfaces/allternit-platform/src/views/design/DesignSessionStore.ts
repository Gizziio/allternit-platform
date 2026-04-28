import {
  createModeSessionStore,
  type ModeSession,
  type CreateModeSessionOptions,
  type SendMessageOptions,
  type ModeSessionMessage,
} from '@/lib/agents/mode-session-store';

/**
 * DesignSessionStore - Dedicated session management for Allternit Studio.
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
  originSurface: 'chat', // Use 'chat' as surface type for LLM compatibility, but store is isolated
});

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
  }));
}
