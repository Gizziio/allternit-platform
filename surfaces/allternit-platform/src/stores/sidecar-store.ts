import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SidecarState, UUID } from '../core/contracts';

interface SidecarActions {
  setOpen: (isOpen: boolean) => void;
  toggle: () => void;
  setActivePanel: (panel: SidecarState['activePanel']) => void;
  setWidth: (width: number) => void;
  setResizing: (isResizing: boolean) => void;

  // Artifact actions
  setActiveArtifact: (artifactId: UUID | null) => void;
  setArtifactViewMode: (mode: SidecarState['panels']['artifact']['viewMode']) => void;
  togglePinArtifact: (artifactId: UUID) => void;

  // ChangeSet actions
  setActiveChangeSet: (changeSetId: UUID | null) => void;
}

export const useSidecarStore = create<SidecarState & SidecarActions>()(
  persist(
    (set) => ({
      isOpen: false,
      activePanel: 'artifact',
      width: 350,
      isResizing: false,

      panels: {
        artifact: {
          activeArtifactId: null,
          viewMode: 'preview',
          pinnedArtifacts: [],
        },
        context: {
          activeThreadId: null,
          showTokenCount: true,
          showModelInfo: true,
          showProjectContext: true,
        },
        agent: {
          activeRunId: null,
          filter: 'all',
          autoFollow: true,
        },
        changeset: {
          activeChangeSetId: null,
          filter: 'pending',
          showDiffView: true,
        },
        preview: {} as any, // Placeholder for future
      },

      history: [],
      toggleShortcut: 'Cmd+Shift+A',

      setOpen: (isOpen) => set({ isOpen }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setActivePanel: (panel) => set({ activePanel: panel }),
      setWidth: (width) => set({ width: Math.max(260, Math.min(700, width)) }),
      setResizing: (isResizing) => set({ isResizing }),

      setActiveArtifact: (artifactId) => set((state) => ({
        panels: {
          ...state.panels,
          artifact: {
            ...state.panels.artifact,
            activeArtifactId: artifactId,
          }
        }
      })),

      setArtifactViewMode: (mode) => set((state) => ({
        panels: {
          ...state.panels,
          artifact: {
            ...state.panels.artifact,
            viewMode: mode,
          }
        }
      })),

      togglePinArtifact: (artifactId) => set((state) => {
        const pinned = state.panels.artifact.pinnedArtifacts;
        const nextPinned = pinned.includes(artifactId)
          ? pinned.filter(id => id !== artifactId)
          : [...pinned, artifactId];

        return {
          panels: {
            ...state.panels,
            artifact: {
              ...state.panels.artifact,
              pinnedArtifacts: nextPinned,
            }
          }
        };
      }),

      setActiveChangeSet: (changeSetId) => set((state) => ({
        panels: {
          ...state.panels,
          changeset: {
            ...state.panels.changeset,
            activeChangeSetId: changeSetId,
          }
        }
      })),
    }),
    {
      name: 'allternit:sidecar-v1',
      // Only persist layout-relevant fields — skip ephemeral state
      partialize: (state) => ({
        width: state.width,
        activePanel: state.activePanel,
      }),
    },
  ),
);
