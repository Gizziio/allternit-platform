import { create } from 'zustand';
import type { SubmitMessageParams } from '../lib/ai/rust-stream-adapter';

interface PendingSubmitState {
  params: SubmitMessageParams | null;
  set: (params: SubmitMessageParams) => void;
  consume: () => SubmitMessageParams | null;
}

export const usePendingSubmitStore = create<PendingSubmitState>((set, get) => ({
  params: null,
  set: (params) => set({ params }),
  consume: () => {
    const { params } = get();
    if (params) set({ params: null });
    return params;
  },
}));
