import { create } from 'zustand';
import { ChangeSet, FileChange, UUID } from '../core/contracts';

interface ChangeSetStore {
  changeSets: Record<UUID, ChangeSet>;
  activeChangeSetId: UUID | null;
  
  // Actions
  addChangeSet: (changeSet: ChangeSet) => void;
  updateChangeSet: (id: UUID, updates: Partial<ChangeSet>) => void;
  deleteChangeSet: (id: UUID) => void;
  setActiveChangeSet: (id: UUID | null) => void;
  
  // File change actions
  updateFileChange: (changeSetId: UUID, fileChangeId: UUID, updates: Partial<FileChange>) => void;
  acceptHunk: (changeSetId: UUID, fileChangeId: UUID, hunkId: string) => void;
  rejectHunk: (changeSetId: UUID, fileChangeId: UUID, hunkId: string) => void;
}

export const useChangeSetStore = create<ChangeSetStore>((set, get) => ({
  changeSets: {},
  activeChangeSetId: null,
  
  addChangeSet: (changeSet) => set((state) => ({
    changeSets: { ...state.changeSets, [changeSet.id]: changeSet }
  })),
  
  updateChangeSet: (id, updates) => set((state) => ({
    changeSets: {
      ...state.changeSets,
      [id]: { ...state.changeSets[id], ...updates }
    }
  })),
  
  deleteChangeSet: (id) => set((state) => {
    const { [id]: _, ...rest } = state.changeSets;
    return {
      changeSets: rest,
      activeChangeSetId: state.activeChangeSetId === id ? null : state.activeChangeSetId
    };
  }),
  
  setActiveChangeSet: (id) => set({ activeChangeSetId: id }),
  
  updateFileChange: (changeSetId, fileChangeId, updates) => set((state) => {
    const changeSet = state.changeSets[changeSetId];
    if (!changeSet) return state;
    
    const nextChanges = changeSet.changes.map(c => 
      c.id === fileChangeId ? { ...c, ...updates } : c
    );
    
    return {
      changeSets: {
        ...state.changeSets,
        [changeSetId]: { ...changeSet, changes: nextChanges }
      }
    };
  }),
  
  acceptHunk: (changeSetId, fileChangeId, hunkId) => {
    // Basic implementation for now
    get().updateFileChange(changeSetId, fileChangeId, { reviewState: 'accepted' });
  },
  
  rejectHunk: (changeSetId, fileChangeId, hunkId) => {
    // Basic implementation for now
    get().updateFileChange(changeSetId, fileChangeId, { reviewState: 'rejected' });
  },
}));
