import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  members?: WorkspaceMember[];
  invitations?: WorkspaceInvitation[];
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId?: string;
  agentId?: string;
  role: 'owner' | 'admin' | 'member' | 'agent';
  joinedAt: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  members: Record<string, WorkspaceMember[]>;
  invitations: Record<string, WorkspaceInvitation[]>;
  isLoading: boolean;
  error: string | null;

  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, slug: string, description?: string) => Promise<Workspace | null>;
  joinWorkspace: (token: string) => Promise<void>;
  addMember: (workspaceId: string, email: string, role: string) => Promise<void>;
  removeMember: (workspaceId: string, memberId: string) => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
  fetchMembers: (workspaceId: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,
      members: {},
      invitations: {},
      isLoading: false,
      error: null,

      fetchWorkspaces: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/v1/workspaces');
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          set({ workspaces: data.workspaces || [], isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      },

      createWorkspace: async (name, slug, description) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/v1/workspaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, slug, description }),
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          const ws = data.workspace;
          set((state) => ({
            workspaces: [ws, ...state.workspaces],
            activeWorkspaceId: state.activeWorkspaceId ?? ws.id,
            isLoading: false,
          }));
          return ws;
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          return null;
        }
      },

      joinWorkspace: async (token) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`/api/v1/workspaces/join?token=${encodeURIComponent(token)}`, {
            method: 'POST',
          });
          if (!res.ok) throw new Error(await res.text());
          await get().fetchWorkspaces();
          set({ isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      },

      addMember: async (workspaceId, email, role) => {
        try {
          const res = await fetch(`/api/v1/workspaces/${workspaceId}/invites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role }),
          });
          if (!res.ok) throw new Error(await res.text());
          await get().fetchMembers(workspaceId);
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      removeMember: async (workspaceId, memberId) => {
        try {
          await fetch(`/api/v1/workspaces/${workspaceId}/members?id=${memberId}`, {
            method: 'DELETE',
          });
          set((state) => ({
            members: {
              ...state.members,
              [workspaceId]: state.members[workspaceId]?.filter((m) => m.id !== memberId) || [],
            },
          }));
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      fetchMembers: async (workspaceId) => {
        try {
          const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`);
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          set((state) => ({
            members: { ...state.members, [workspaceId]: data.members || [] },
          }));
        } catch (err: any) {
          set({ error: err.message });
        }
      },
    }),
    {
      name: 'allternit-workspace-storage',
      partialize: (state) => ({
        activeWorkspaceId: state.activeWorkspaceId,
      }),
    }
  )
);
