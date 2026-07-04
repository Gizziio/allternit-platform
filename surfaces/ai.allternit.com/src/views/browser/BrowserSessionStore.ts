// @ts-nocheck
import {
  createModeSessionStore,
  type ModeSession,
  type CreateModeSessionOptions,
  type SendMessageOptions,
  type ModeSessionMessage,
} from '@/lib/agents/mode-session-store';
import { useShallow } from 'zustand/react/shallow';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('BrowserSessionStore');

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

export function useBrowserSessions() {
  return useBrowserSessionStore((state) => state.sessions ?? []);
}

export function useActiveBrowserSession() {
  return useBrowserSessionStore((state) => {
    if (!state.activeSessionId) return null;
    return (state.sessions ?? []).find((s) => s.id === state.activeSessionId) || null;
  });
}

export function useActiveBrowserSessionId() {
  return useBrowserSessionStore((state) => state.activeSessionId);
}

export function useIsBrowserSessionLoading() {
  return useBrowserSessionStore((state) => state.isLoading);
}

export function useBrowserSessionError() {
  return useBrowserSessionStore((state) => state.error);
}

export function useBrowserSessionActions() {
  return useBrowserSessionStore(
    useShallow((state) => ({
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
    }))
  );
}

export async function createBrowserSession(options?: CreateModeSessionOptions): Promise<string> {
  const sessionId = await useBrowserSessionStore.getState().createSession(options);

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
      const existing = useBrowserSessionStore.getState().sessions.find((s) => s.id === sessionId)?.metadata;
      useBrowserSessionStore.getState().updateSession(sessionId, {
        metadata: { ...existing, originSurface: 'browser', memoryContext },
      });
    })
    .catch((err) => { logger.error({ err: err }, 'Failed to fetch memory context'); });

  return sessionId;
}
