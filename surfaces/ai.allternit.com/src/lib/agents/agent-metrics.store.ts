import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface AgentMetric {
  id: string;
  agentId: string;
  runId?: string;
  metricType: 'latency' | 'tokens' | 'cost' | 'success' | 'tool_calls';
  value: number;
  unit: string;
  timestamp: string;
}

export interface MetricsSummary {
  agentId: string;
  totalRuns: number;
  avgLatency: number;
  totalTokens: number;
  totalCost: number;
  successRate: number;
}

interface AgentMetricsState {
  metrics: AgentMetric[];
  summary: MetricsSummary[];
  isLoading: boolean;
  timeRange: '1h' | '24h' | '7d' | '30d';
}

interface AgentMetricsActions {
  fetchMetrics: (agentId?: string) => Promise<void>;
  setTimeRange: (range: AgentMetricsState['timeRange']) => void;
}

export const useAgentMetricsStore = create<AgentMetricsState & AgentMetricsActions>()(
  devtools((set, get) => ({
    metrics: [],
    summary: [],
    isLoading: false,
    timeRange: '7d',

    fetchMetrics: async (agentId) => {
      set({ isLoading: true });
      const days = { '1h': 1, '24h': 1, '7d': 7, '30d': 30 }[get().timeRange];
      try {
        const params = new URLSearchParams();
        if (agentId) params.set('agentId', agentId);
        params.set('days', String(days));
        const res = await fetch(`/api/v1/agents/metrics?${params}`);
        if (res.ok) {
          const data = await res.json();
          set({ metrics: data.metrics || [], summary: data.summary || [] });
        }
      } catch (e) {
        console.error('Failed to fetch metrics', e);
      } finally {
        set({ isLoading: false });
      }
    },

    setTimeRange: (range) => set({ timeRange: range }),
  }))
);
