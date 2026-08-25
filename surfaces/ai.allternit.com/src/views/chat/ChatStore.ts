/**
 * ChatStore - UI state and project management for Chat mode
 * 
 * **ARCHITECTURE**: 
 * - Thread state is DERIVED from ChatSessionStore (via subscription)
 * - Project state is OWNED here and persisted to localStorage
 * - Completely independent from Code and Cowork modes
 * 
 * **SESSION MANAGEMENT**: Delegates to ChatSessionStore for all
 * session CRUD operations (create, delete, update, send message).
 * 
 * @module ChatStore
 * @see ChatSessionStore for session management
 * @see SESSION_ARCHITECTURE.md for full documentation
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';
import {
  useChatSessionStore,
  type ChatSession,
} from './ChatSessionStore';
import * as kernelProjects from '../../integration/kernel/projects';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatThread {
  id: string;
  title: string;
  projectId?: string;
  mode?: ChatThreadMode;
  agentId?: string;
  updatedAt: number;
}

export type ChatThreadMode = 'llm' | 'agent';

export interface ProjectFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  addedAt: number;
}

export interface ChatProject {
  id: string;
  localKey?: string;
  title: string;
  description?: string;
  threadIds: string[];
  files: ProjectFile[];
  connectors?: string[];
  instructions?: string[];
  createdAt: number;
  isFavorite?: boolean;
  isArchived?: boolean;
}

// ---------------------------------------------------------------------------
// Session → ChatThread mapper
// ---------------------------------------------------------------------------

function mapSession(s: ChatSession): ChatThread {
  return {
    id: s.id,
    title: s.name ?? 'Untitled',
    mode: s.metadata.sessionMode === 'agent' ? 'agent' : 'llm',
    agentId: s.metadata.agentId,
    projectId: s.metadata.projectId,
    updatedAt: new Date(s.updatedAt).getTime(),
  };
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface ChatState {
  // Threads derived from ChatSessionStore
  threads: ChatThread[];
  activeThreadId: string | null;

  // ChatStore-owned state
  projects: ChatProject[];
  activeProjectId: string | null;
  activeProjectLocalKey: string | null;

  // Thread ops
  createThread: (
    title: string,
    projectId?: string,
    mode?: ChatThreadMode,
    agentId?: string | null,
  ) => Promise<string>;
  deleteThread: (id: string) => void;
  renameThread: (id: string, title: string) => void;
  setThreadMode: (id: string, mode: ChatThreadMode, agentId?: string | null) => void;
  setActiveThread: (id: string | null) => void;

  // Project ops
  createProject: (title: string) => Promise<string>;
  deleteProject: (id: string) => void;
  renameProject: (id: string, title: string) => void;
  updateProjectDetails: (id: string, details: { title?: string; description?: string }) => void;
  setActiveProject: (id: string | null, localKey?: string | null) => void;
  moveThreadToProject: (threadId: string, projectId: string | null) => void;
  addFileToProject: (projectId: string, file: Omit<ProjectFile, 'id' | 'addedAt'>) => void;
  removeFileFromProject: (projectId: string, fileId: string) => void;
  addConnectorToProject: (projectId: string, connectorId: string) => void;
  removeConnectorFromProject: (projectId: string, connectorId: string) => void;
  updateProjectInstructions: (projectId: string, instructions: string[]) => void;

  // Project metadata
  toggleProjectFavorite: (projectId: string) => void;
  toggleProjectArchive: (projectId: string) => void;

  // Sync from ChatSessionStore
  _syncFromSessionStore: (sessions: ChatSession[], activeSessionId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      // Thread state - synced from ChatSessionStore
      threads: [],
      activeThreadId: null,

      // Owned
      projects: [],
      activeProjectId: null,
      activeProjectLocalKey: null,

      // Thread ops - delegate to ChatSessionStore
      createThread: async (title, projectId, mode = 'llm', agentId = null) => {
        const sessionId = await useChatSessionStore.getState().createSession({
          name: title,
          projectId,
          sessionMode: mode === 'agent' ? 'agent' : 'regular',
          agentId: agentId ?? undefined,
        });
        set({ activeProjectId: null, activeProjectLocalKey: null });
        return sessionId;
      },

      deleteThread: (id) => {
        void useChatSessionStore.getState().deleteSession(id);
      },

      renameThread: (id, title) => {
        void useChatSessionStore.getState().updateSession(id, { name: title });
      },

      setThreadMode: (id, mode, agentId = null) => {
        void useChatSessionStore.getState().setSessionMode(
          id,
          mode === 'agent' ? 'agent' : 'regular',
          agentId ?? undefined
        );
      },

      setActiveThread: (id) => {
        useChatSessionStore.getState().setActiveSession(id);
        set({ activeProjectId: null, activeProjectLocalKey: null });
      },

      // Project ops
      createProject: async (title) => {
        let id: string;
        try {
          // The workflow-creation call has no client-side timeout; race it so a slow
          // or unresponsive backend can't leave project creation hanging forever with
          // no feedback (matches the instant, local-first UX of the other project modes).
          const proj = await Promise.race([
            kernelProjects.createProject(title),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('createProject timed out')), 4000),
            ),
          ]);
          id = proj.id;
        } catch {
          id = `local-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }
        const localKey = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          projects: [
            {
              id,
              localKey,
              title,
              threadIds: [],
              files: [],
              connectors: [],
              createdAt: Date.now(),
              isFavorite: false,
              isArchived: false,
            },
            ...state.projects,
          ],
          activeProjectId: id,
          activeProjectLocalKey: localKey,
          activeThreadId: null,
        }));
        return id;
      },

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
          activeProjectLocalKey:
            state.activeProjectId === id ? null : state.activeProjectLocalKey,
        })),

      renameProject: (id, title) =>
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, title } : p)),
        })),

      updateProjectDetails: (id, details) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...(details.title !== undefined ? { title: details.title } : {}),
                  ...(details.description !== undefined ? { description: details.description } : {}),
                }
              : p,
          ),
        })),

      setActiveProject: (id, localKey = null) =>
        set((state) => ({
          activeProjectId: id,
          activeProjectLocalKey:
            id === null
              ? null
              : localKey ??
                state.projects.find((p) => p.id === id)?.localKey ??
                null,
          activeThreadId: null,
        })),

      moveThreadToProject: (threadId, projectId) =>
        set((state) => {
          // Remove from every project's threadIds, then add to the target project.
          const projects = state.projects.map((p) => {
            const withoutThread = p.threadIds.filter((id) => id !== threadId);
            if (projectId !== null && p.id === projectId) {
              return {
                ...p,
                threadIds: withoutThread.includes(threadId)
                  ? withoutThread
                  : [...withoutThread, threadId],
              };
            }
            return { ...p, threadIds: withoutThread };
          });
          // Update session metadata
          void useChatSessionStore.getState().updateSession(threadId, {
            metadata: { projectId: projectId ?? undefined, originSurface: 'chat' as const },
          });
          return { projects };
        }),

      addFileToProject: (projectId, file) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  files: [
                    ...p.files,
                    {
                      ...file,
                      id: Math.random().toString(36).substring(7),
                      addedAt: Date.now(),
                    },
                  ],
                }
              : p,
          ),
        })),

      removeFileFromProject: (projectId, fileId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, files: p.files.filter((f) => f.id !== fileId) }
              : p,
          ),
        })),

      addConnectorToProject: (projectId, connectorId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId && !(p.connectors ?? []).includes(connectorId)
              ? { ...p, connectors: [...(p.connectors ?? []), connectorId] }
              : p,
          ),
        })),

      removeConnectorFromProject: (projectId, connectorId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, connectors: (p.connectors ?? []).filter((id) => id !== connectorId) }
              : p,
          ),
        })),

      updateProjectInstructions: (projectId, instructions) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, instructions } : p
          ),
        })),

      toggleProjectFavorite: (projectId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, isFavorite: !p.isFavorite } : p
          ),
        })),

      toggleProjectArchive: (projectId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, isArchived: !p.isArchived } : p
          ),
        })),

      _syncFromSessionStore: (sessions, activeSessionId) => {
        set({ threads: sessions.map(mapSession), activeThreadId: activeSessionId });
      },
    }),
    {
      name: 'allternit-chat-storage-v6',
      storage: createBrowserJSONStorage(),
      partialize: (state) => ({
        projects: state.projects,
        // activeProjectId is intentionally NOT persisted - it's navigation state.
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Sync threads and activeThreadId from ChatSessionStore
// ---------------------------------------------------------------------------

useChatSessionStore.subscribe((state) => {
  useChatStore.getState()._syncFromSessionStore(state.sessions, state.activeSessionId);
});
