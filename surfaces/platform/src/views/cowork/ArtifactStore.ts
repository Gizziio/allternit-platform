import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ArtifactType = 'document' | 'code' | 'ui-block' | 'board' | 'table';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string; // for code
  isPinned: boolean;
  version: number;
}

interface ArtifactState {
  artifacts: Artifact[];
  activeArtifactId: string | null;
  
  // Actions
  createArtifact: (type: ArtifactType, title: string, content: string) => void;
  updateArtifact: (id: string, content: string) => void;
  setActiveArtifact: (id: string | null) => void;
  togglePin: (id: string) => void;
  deleteArtifact: (id: string) => void;
}

export const useArtifactStore = create<ArtifactState>()(
  persist(
    (set) => ({
      artifacts: [],
      activeArtifactId: null,

      createArtifact: (type, title, content) => set((state) => {
        const id = Math.random().toString(36).substring(7);
        const newArt: Artifact = { id, type, title, content, isPinned: false, version: 1 };
        return {
          artifacts: [...state.artifacts, newArt],
          activeArtifactId: id
        };
      }),

      updateArtifact: (id, content) => set((state) => ({
        artifacts: state.artifacts.map(a => a.id === id ? { ...a, content, version: a.version + 1 } : a)
      })),

      setActiveArtifact: (id) => set({ activeArtifactId: id }),

      togglePin: (id) => set((state) => ({
        artifacts: state.artifacts.map(a => a.id === id ? { ...a, isPinned: !a.isPinned } : a)
      })),

      deleteArtifact: (id) => set((state) => ({
        artifacts: state.artifacts.filter(a => a.id !== id),
        activeArtifactId: state.activeArtifactId === id ? null : state.activeArtifactId
      }))
    }),
    { name: 'a2r-artifact-storage' }
  )
);
