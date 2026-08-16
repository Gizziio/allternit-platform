/**
 * Agent Checkpoint Store
 *
 * In-memory store for bot checkpoints. In production this will be backed by
 * the Rails ledger/vault; for now it provides the API surface the nightly
 * review engine consumes.
 *
 * @module agent-checkpoint-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AgentCheckpoint, CheckpointCollection } from './agent-checkpoint';
import { memoryClient } from './memory-client';

interface AgentCheckpointState {
  checkpoints: AgentCheckpoint[];
}

interface AgentCheckpointActions {
  setCheckpoint: (checkpoint: AgentCheckpoint) => void;
  getCheckpointsForAgent: (agentId: string) => AgentCheckpoint[];
  getActiveOrBlockedCheckpoints: (agentIds?: string[]) => AgentCheckpoint[];
  buildCollection: (agentIds?: string[]) => CheckpointCollection;
  reset: () => void;
}

const initialState: AgentCheckpointState = {
  checkpoints: [],
};

export const useAgentCheckpointStore = create<AgentCheckpointState & AgentCheckpointActions>()(
  immer((set, get) => ({
    ...initialState,

    setCheckpoint: (checkpoint) => {
      set((state) => {
        const idx = state.checkpoints.findIndex(
          (c) => c.agentId === checkpoint.agentId && c.taskId === checkpoint.taskId,
        );
        if (idx >= 0) {
          state.checkpoints[idx] = checkpoint;
        } else {
          state.checkpoints.push(checkpoint);
        }
      });

      // Persist checkpoint observation to Memory Kernel in the background
      try {
        void memoryClient.recordObservation(
          'checkpoint',
          JSON.stringify({
            taskId: checkpoint.taskId,
            agentId: checkpoint.agentId,
            agentRole: checkpoint.agentRole,
            status: checkpoint.status,
            result: checkpoint.result,
            nextStep: checkpoint.nextStep,
            blocker: checkpoint.blocker,
            updatedAt: checkpoint.updatedAt,
          }),
          {
            agentId: checkpoint.agentId,
            source: 'agent-checkpoint-store',
          },
        );
      } catch {
        // Degrade silently
      }
    },

    getCheckpointsForAgent: (agentId) => {
      return get().checkpoints.filter((c) => c.agentId === agentId);
    },

    getActiveOrBlockedCheckpoints: (agentIds) => {
      return get().checkpoints.filter(
        (c) =>
          (agentIds === undefined || agentIds.includes(c.agentId)) &&
          (c.status === 'active' || c.status === 'blocked'),
      );
    },

    buildCollection: (agentIds) => {
      const checkpoints = get().getActiveOrBlockedCheckpoints(agentIds);
      return {
        checkpoints,
        participatingAgentIds: Array.from(new Set(checkpoints.map((c) => c.agentId))),
        collectedAt: new Date().toISOString(),
      };
    },

    reset: () => set(initialState),
  })),
);
