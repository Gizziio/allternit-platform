/**
 * Browser Session Store
 *
 * **ARCHITECTURE**: Isolated session store for Browser mode.
 * Separates browser agent sessions from general chat history.
 *
 * **BACKEND**: origin_surface='browser'
 */

import {
  createModeSessionStore,
  type ModeSession,
  type CreateModeSessionOptions,
  type SendMessageOptions,
  type ModeSessionMessage,
} from '@/lib/agents/mode-session-store';

// Local alias
type BrowserSession = ModeSession;

export type {
  ModeSession as BrowserSession,
  CreateModeSessionOptions as CreateBrowserSessionOptions,
  SendMessageOptions as BrowserSendMessageOptions,
  ModeSessionMessage,
};

export const useBrowserSessionStore = createModeSessionStore({
  name: 'BrowserSessionStore',
  storageKey: 'allternit-browser-sessions',
  originSurface: 'browser',
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function useBrowserSessionActions() {
  return useBrowserSessionStore((state) => ({
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
