//! bb project surface store.
//!
//! Owns the list of bb-native projects fetched from `/api/v1/bb/projects` and
//! exposes CRUD operations that mirror the other mode-specific project stores
//! so the unified Projects hub can treat bb as a first-class project mode.

import { create } from 'zustand';
import {
  listBBProjects,
  createBBProject,
  updateBBProject,
  deleteBBProject,
  type BBApiProject,
  type BBProjectCreateInput,
} from '@/lib/agents/bb-sync';

export interface BBProject {
  id: string;
  nativeId: string;
  name: string;
  kind: string;
  gitRemoteUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

interface BBProjectState {
  projects: BBProject[];
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  createProject: (name: string, kind?: 'standard' | 'personal', gitRemoteUrl?: string) => Promise<BBProject>;
  renameProject: (id: string, name: string) => void;
  updateProjectDetails: (id: string, details: { name?: string; gitRemoteUrl?: string | null }) => void;
  toggleProjectFavorite: (_id: string) => void;
  toggleProjectArchive: (_id: string) => void;
  deleteProject: (id: string) => void;
}

function mapApiProject(p: BBApiProject): BBProject {
  return {
    id: `bb-${p.id}`,
    nativeId: p.id,
    name: p.name,
    kind: p.kind,
    gitRemoteUrl: p.git_remote_url,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export const useBBProjectStore = create<BBProjectState>()((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await listBBProjects();
      set({ projects: res.items.map(mapApiProject), isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  createProject: async (name, kind = 'standard', gitRemoteUrl) => {
    const input: BBProjectCreateInput = { name, kind, gitRemoteUrl };
    const created = await createBBProject(input);
    const mapped = mapApiProject(created);
    set((state) => ({ projects: [mapped, ...state.projects] }));
    return mapped;
  },

  renameProject: async (id, name) => {
    const updated = await updateBBProject(id, { name });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.nativeId === id ? mapApiProject(updated) : p
      ),
    }));
  },

  updateProjectDetails: async (id, details) => {
    const updated = await updateBBProject(id, {
      name: details.name,
      gitRemoteUrl: details.gitRemoteUrl,
    });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.nativeId === id ? mapApiProject(updated) : p
      ),
    }));
  },

  // Favorites and archives are not persisted server-side in the minimal bb
  // parity layer; they are kept as client-only UI state for now.
  toggleProjectFavorite: (_id) => {
    // no-op placeholder to satisfy the unified project contract
  },

  toggleProjectArchive: (_id) => {
    // no-op placeholder to satisfy the unified project contract
  },

  deleteProject: async (id) => {
    await deleteBBProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.nativeId !== id),
    }));
  },
}));
