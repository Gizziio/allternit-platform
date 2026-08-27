/**
 * Pending chat model selection store.
 *
 * Lets parts of the app that are not inside the Chat <ModelSelectionProvider>
 * (e.g. Model Lab drawers) request "chat with this model". When a chat view
 * mounts, the provider reads this store and applies the selection.
 */

import { create } from 'zustand';
import type { ModelSelection } from '@/components/model-picker';

interface PendingChatModelState {
  pending: ModelSelection | null;
  setPending: (selection: ModelSelection | null) => void;
}

export const usePendingChatModelStore = create<PendingChatModelState>((set) => ({
  pending: null,
  setPending: (selection) => set({ pending: selection }),
}));
