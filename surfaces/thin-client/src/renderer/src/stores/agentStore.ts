/**
 * Agent Store - Thin Client
 *
 * Fetches agents from the gizzi-code server via @a2r/sdk.
 */

import { create } from 'zustand';
import { sdk } from '../lib/sdk';

// ============================================================================
// Types
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  description?: string;
  status: 'idle' | 'running' | 'paused' | 'error';
  type: string;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

interface AgentState {
  agents: Agent[];
  selectedAgentId: string | null;
  isLoadingAgents: boolean;
  error: string | null;
}

interface AgentActions {
  fetchAgents: () => Promise<void>;
  selectAgent: (agentId: string | null) => void;
  clearError: () => void;
}

export type AgentStore = AgentState & AgentActions;

// ============================================================================
// Store
// ============================================================================

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  selectedAgentId: null,
  isLoadingAgents: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoadingAgents: true, error: null });
    try {
      const { data, error } = await sdk.agent.list();
      if (error || !data) throw new Error((error as any)?.message ?? 'No data');

      const raw: any[] = Array.isArray(data) ? data : (data as any).agents ?? [];
      const agents: Agent[] = raw.map(a => ({
        id: a.id ?? `agent-${Math.random().toString(36).slice(2)}`,
        name: a.name ?? 'Unnamed Agent',
        description: a.description,
        status: a.status ?? 'idle',
        type: a.type ?? 'assistant',
        config: a.config,
        createdAt: a.createdAt ?? a.created_at,
        updatedAt: a.updatedAt ?? a.updated_at,
      }));

      set({ agents, isLoadingAgents: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch agents';
      set({
        agents: [],
        error: /fetch|network|abort/i.test(msg) ? 'API_OFFLINE' : msg,
        isLoadingAgents: false,
      });
    }
  },

  selectAgent: agentId => set({ selectedAgentId: agentId }),
  clearError: () => set({ error: null }),
}));

export default useAgentStore;
