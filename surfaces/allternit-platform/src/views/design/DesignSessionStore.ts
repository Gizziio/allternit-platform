/**
 * Design Session Store
 * 
 * **ARCHITECTURE**: Isolated session store for Blueprint Studio (Design Mode).
 * Separates design manifestations from general chat history.
 * 
 * **BACKEND**: origin_surface='design'
 */

import { 
  createModeSessionStore, 
  type ModeSession, 
  type CreateModeSessionOptions,
  type SendMessageOptions,
  type ModeSessionMessage,
} from '@/lib/agents/mode-session-store';

// Local alias
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
