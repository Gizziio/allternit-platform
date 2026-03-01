import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as kernelChat from '../../integration/kernel/chat';
import * as kernelProjects from '../../integration/kernel/projects';

export interface ChatThread {
  id: string;
  title: string;
  projectId?: string;
  mode?: ChatThreadMode;
  agentId?: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export type ChatThreadMode = 'llm' | 'agent';

export interface ProjectFile {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: number;
}

export interface ChatProject {
  id: string;
  title: string;
  threadIds: string[];
  files: ProjectFile[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface ChatState {
  threads: ChatThread[];
  projects: ChatProject[];
  activeThreadId: string | null;
  sandboxMode: "read-only" | "full";
  activeProjectId: string | null;
  
  // OpenClaw bridge
  openclawConnected: boolean;
  agentSessions: Map<string, string>; // threadId -> sessionId
  setOpenClawConnected: (connected: boolean) => void;
  linkThreadToSession: (threadId: string, sessionId: string) => void;
  unlinkThreadFromSession: (threadId: string) => void;
  
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
  setSandboxMode: (mode: "read-only" | "full") => void;
  
  createProject: (title: string) => Promise<string>;
  deleteProject: (id: string) => void;
  renameProject: (id: string, title: string) => void;
  setActiveProject: (id: string | null) => void;
  moveThreadToProject: (threadId: string, projectId: string | null) => void;
  addFileToProject: (projectId: string, file: Omit<ProjectFile, 'id' | 'addedAt'>) => void;
  
  addMessage: (threadId: string, role: 'user' | 'assistant', text: string) => Promise<void>;
  syncWithKernel: () => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      threads: [{
        id: 'welcome',
        title: 'Welcome Session',
        mode: 'llm',
        messages: [{ id: 'm1', role: 'assistant', text: 'Hello! I am A2rchitech. How can I help?' }],
        updatedAt: Date.now(),
      }],
      projects: [],
      activeThreadId: 'welcome',
      sandboxMode: 'read-only',
      activeProjectId: null,
      
      // OpenClaw bridge state
      openclawConnected: false,
      agentSessions: new Map(),
      
      setOpenClawConnected: (connected) => set({ openclawConnected: connected }),
      
      linkThreadToSession: (threadId, sessionId) => set(state => {
        // Ensure agentSessions is a Map (might be plain object after persistence)
        const currentMap = state.agentSessions instanceof Map 
          ? state.agentSessions 
          : new Map<string, string>(Object.entries(state.agentSessions || {}));
        return {
          agentSessions: new Map<string, string>([...currentMap, [threadId, sessionId]])
        };
      }),
      
      unlinkThreadFromSession: (threadId) => set(state => {
        // Ensure agentSessions is a Map (might be plain object after persistence)
        const currentMap = state.agentSessions instanceof Map 
          ? state.agentSessions 
          : new Map<string, string>(Object.entries(state.agentSessions || {}));
        const newMap = new Map<string, string>(currentMap);
        newMap.delete(threadId);
        return { agentSessions: newMap };
      }),

      createThread: async (title, projectId, mode = 'llm', agentId = null) => {
        let id: string;
        try {
          id = await kernelChat.createThread(title, projectId, mode, agentId);
        } catch (error) {
          // Keep the UI responsive in dev/offline conditions even if kernel API is unavailable.
          console.warn('[ChatStore] createThread failed, falling back to local id', error);
          id = `local-thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }
        set(state => ({
          threads: [{
            id,
            title,
            projectId,
            mode,
            agentId: agentId || undefined,
            messages: [],
            updatedAt: Date.now(),
          }, ...state.threads],
          activeThreadId: id,
          activeProjectId: null
        }));
        return id;
      },

      deleteThread: (id) => set(state => ({
        threads: state.threads.filter(t => t.id !== id),
        activeThreadId: state.activeThreadId === id ? null : state.activeThreadId
      })),

      renameThread: (id, title) => set(state => ({
        threads: state.threads.map(t => t.id === id ? { ...t, title } : t)
      })),

      setThreadMode: (id, mode, agentId = null) => set(state => ({
        threads: state.threads.map(t => {
          if (t.id !== id) return t;
          return {
            ...t,
            mode,
            agentId: mode === 'agent' ? (agentId || t.agentId) : undefined,
            updatedAt: Date.now(),
          };
        })
      })),

      setActiveThread: (id) => set({ activeThreadId: id, activeProjectId: null }),
      
      setSandboxMode: (mode) => set({ sandboxMode: mode }),

      createProject: async (title) => {
        let id: string;
        try {
          const proj = await kernelProjects.createProject(title);
          id = proj.id;
        } catch (error) {
          console.warn('[ChatStore] createProject failed, falling back to local id', error);
          id = `local-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }
        set(state => ({
          projects: [{ id, title, threadIds: [], files: [], createdAt: Date.now() }, ...state.projects],
          activeProjectId: id,
          activeThreadId: null
        }));
        return id;
      },

      deleteProject: (id) => set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId
      })),

      renameProject: (id, title) => set(state => ({
        projects: state.projects.map(p => p.id === id ? { ...p, title } : p)
      })),

      setActiveProject: (id) => set({ activeProjectId: id, activeThreadId: null }),

      moveThreadToProject: (threadId, projectId) => set(state => ({
        threads: state.threads.map(t => t.id === threadId ? { ...t, projectId: projectId || undefined } : t)
      })),

      addFileToProject: (projectId, file) => set(state => ({
        projects: state.projects.map(p => p.id === projectId ? {
          ...p,
          files: [...p.files, { ...file, id: Math.random().toString(36).substring(7), addedAt: Date.now() }]
        } : p)
      })),

      addMessage: async (threadId, role, text) => {
        const message = { id: Date.now().toString(), role, text };
        set(state => ({
          threads: state.threads.map(t => t.id === threadId ? {
            ...t,
            messages: [...t.messages, message],
            updatedAt: Date.now()
          } : t)
        }));

        if (role === 'user') {
          try {
            await kernelChat.sendMessage(threadId, text, get().sandboxMode);
          } catch (error) {
            console.warn('[ChatStore] sendMessage failed after optimistic update', error);
          }
        }
      },

      syncWithKernel: async () => {}
    }),
    { name: 'a2r-chat-storage-v5' }
  )
);
