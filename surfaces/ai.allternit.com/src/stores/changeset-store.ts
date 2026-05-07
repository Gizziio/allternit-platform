import { create } from 'zustand';
import { ChangeSet, FileChange, UUID } from '../core/contracts';

function updateHunkAcceptance(change: FileChange, hunkId: string, accepted: boolean): FileChange {
  const nextHunks = change.hunks.map((hunk) => {
    if (hunk.id !== hunkId) return hunk;

    const nextLines = hunk.lines.map((line) => ({
      ...line,
      isAccepted: line.type === 'context' ? line.isAccepted : accepted,
    }));

    const acceptedCount = nextLines.filter((line) => line.type !== 'context' && line.isAccepted === true).length;
    const rejectedCount = nextLines.filter((line) => line.type !== 'context' && line.isAccepted === false).length;
    const pendingCount = nextLines.filter((line) => line.type !== 'context' && line.isAccepted == null).length;

    return {
      ...hunk,
      lines: nextLines,
      isAccepted: pendingCount > 0 ? null : accepted,
      acceptedCount,
      rejectedCount,
      pendingCount,
    };
  });

  const acceptedHunks = nextHunks.filter((hunk) => hunk.isAccepted === true).length;
  const rejectedHunks = nextHunks.filter((hunk) => hunk.isAccepted === false).length;
  const pendingHunks = nextHunks.filter((hunk) => hunk.isAccepted == null).length;

  let reviewState: FileChange['reviewState'] = 'pending';
  if (pendingHunks === 0 && acceptedHunks === nextHunks.length) {
    reviewState = 'accepted';
  } else if (pendingHunks === 0 && rejectedHunks === nextHunks.length) {
    reviewState = 'rejected';
  } else if (acceptedHunks > 0 || rejectedHunks > 0) {
    reviewState = 'partial';
  }

  return {
    ...change,
    hunks: nextHunks,
    reviewState,
    reviewedAt: reviewState === 'pending' ? undefined : new Date().toISOString(),
  };
}

function recalculateChangeSet(changeSet: ChangeSet, changes: FileChange[]): ChangeSet {
  const totalFiles = changes.length;
  const totalHunks = changes.reduce((sum, change) => sum + change.hunks.length, 0);
  const acceptedFiles = changes.filter((change) => change.reviewState === 'accepted').length;
  const rejectedFiles = changes.filter((change) => change.reviewState === 'rejected').length;
  const partialFiles = changes.filter((change) => change.reviewState === 'partial').length;
  const pendingFiles = changes.filter((change) => change.reviewState === 'pending').length;

  const acceptedHunks = changes.reduce(
    (sum, change) => sum + change.hunks.filter((hunk) => hunk.isAccepted === true).length,
    0,
  );
  const rejectedHunks = changes.reduce(
    (sum, change) => sum + change.hunks.filter((hunk) => hunk.isAccepted === false).length,
    0,
  );
  const pendingHunks = changes.reduce(
    (sum, change) => sum + change.hunks.filter((hunk) => hunk.isAccepted == null).length,
    0,
  );

  let status: ChangeSet['status'] = 'pending';
  if (pendingHunks === 0 && acceptedHunks === totalHunks && totalHunks > 0) {
    status = 'approved';
  } else if (pendingHunks === 0 && rejectedHunks === totalHunks && totalHunks > 0) {
    status = 'rejected';
  } else if (acceptedHunks > 0 || rejectedHunks > 0 || partialFiles > 0) {
    status = 'partial';
  } else if (totalHunks > 0) {
    status = 'in_review';
  }

  return {
    ...changeSet,
    changes,
    status,
    reviewProgress: {
      totalFiles,
      totalHunks,
      acceptedFiles,
      rejectedFiles,
      pendingFiles,
      acceptedHunks,
      rejectedHunks,
      pendingHunks,
    },
    userReview: {
      ...changeSet.userReview,
      completedAt: pendingHunks === 0 && totalHunks > 0 ? new Date().toISOString() : undefined,
    },
    updatedAt: new Date().toISOString(),
  };
}

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
        [changeSetId]: recalculateChangeSet(changeSet, nextChanges)
      }
    };
  }),
  
  acceptHunk: (changeSetId, fileChangeId, hunkId) => set((state) => {
    const changeSet = state.changeSets[changeSetId];
    if (!changeSet) return state;

    const nextChanges = changeSet.changes.map((change) =>
      change.id === fileChangeId ? updateHunkAcceptance(change, hunkId, true) : change,
    );

    return {
      changeSets: {
        ...state.changeSets,
        [changeSetId]: recalculateChangeSet(changeSet, nextChanges),
      },
    };
  }),
  
  rejectHunk: (changeSetId, fileChangeId, hunkId) => set((state) => {
    const changeSet = state.changeSets[changeSetId];
    if (!changeSet) return state;

    const nextChanges = changeSet.changes.map((change) =>
      change.id === fileChangeId ? updateHunkAcceptance(change, hunkId, false) : change,
    );

    return {
      changeSets: {
        ...state.changeSets,
        [changeSetId]: recalculateChangeSet(changeSet, nextChanges),
      },
    };
  }),
}));
