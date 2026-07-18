import { create } from 'zustand';

/**
 * Bridge between the chat composer (MiroFish's single entry point) and the
 * results-only MiroFishPanel. The composer publishes a submitted prompt
 * here when the Agent Swarm → Population Simulation sub-mode is active;
 * the panel consumes it and drives the run. Deliberately not persisted —
 * a pending prompt only means anything in the moment it was sent.
 */
interface MiroFishRunState {
  /** Monotonic id so the same prompt text can be submitted twice. */
  pendingRunId: number;
  pendingPrompt: string | null;
  requestRun: (prompt: string) => void;
  clearPending: () => void;
}

export const useMiroFishRunStore = create<MiroFishRunState>()((set, get) => ({
  pendingRunId: 0,
  pendingPrompt: null,
  requestRun: (prompt) =>
    set({ pendingPrompt: prompt, pendingRunId: get().pendingRunId + 1 }),
  clearPending: () => set({ pendingPrompt: null }),
}));
