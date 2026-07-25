/**
 * Agent Runs & Metrics API Client
 *
 * GET /api/v1/agents/:id/runs — run history (newest first, limit 50)
 * GET /api/v1/agents/metrics?agentId=… — run metric samples
 *   (run / run_success / run_failure / run_duration_ms rows)
 */

import { apiRequestWithError, runtimeApiUrl } from './api-config';

export interface AgentRunRecord {
  id: string;
  agent_id: string;
  status: string;
  output?: string | null;
  error?: string | null;
  duration_ms?: number | null;
  created_at: string;
  completed_at?: string | null;
}

export interface AgentMetricRow {
  /** Sample kind: 'run' | 'run_success' | 'run_failure' | 'run_duration_ms' | … */
  unit: string;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
}

export const agentRunsApi = {
  /** GET /api/v1/agents/:id/runs */
  async listRuns(agentId: string): Promise<AgentRunRecord[]> {
    const data = await apiRequestWithError<{ runs: AgentRunRecord[] }>(
      runtimeApiUrl(`/agents/${encodeURIComponent(agentId)}/runs`),
    );
    return data.runs ?? [];
  },

  /** GET /api/v1/agents/metrics?agentId=… */
  async listMetrics(agentId: string): Promise<AgentMetricRow[]> {
    const params = new URLSearchParams({ agentId });
    const data = await apiRequestWithError<AgentMetricRow[] | { metrics: AgentMetricRow[] }>(
      runtimeApiUrl(`/agents/metrics?${params.toString()}`),
    );
    return Array.isArray(data) ? data : (data.metrics ?? []);
  },
};

export interface AgentRunMetricsSummary {
  totalRuns: number;
  /** 0–1, or null when no run has completed yet. */
  successRate: number | null;
  avgDurationMs: number | null;
}

/**
 * Aggregate run metric samples into a small summary. Tolerant of the
 * metadata shape — duration samples carry their value in metadata
 * (`value` / `duration_ms` / `ms`).
 */
export function summarizeRunMetrics(rows: AgentMetricRow[]): AgentRunMetricsSummary {
  let runSamples = 0;
  let successes = 0;
  let failures = 0;
  let durationTotal = 0;
  let durationCount = 0;

  for (const row of rows) {
    switch (row.unit) {
      case 'run':
        runSamples += 1;
        break;
      case 'run_success':
        successes += 1;
        break;
      case 'run_failure':
        failures += 1;
        break;
      case 'run_duration_ms': {
        const meta = row.metadata ?? {};
        const raw = meta.value ?? meta.duration_ms ?? meta.ms;
        const value = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isFinite(value)) {
          durationTotal += value;
          durationCount += 1;
        }
        break;
      }
      default:
        break;
    }
  }

  const completed = successes + failures;
  return {
    totalRuns: runSamples > 0 ? runSamples : completed,
    successRate: completed > 0 ? successes / completed : null,
    avgDurationMs: durationCount > 0 ? durationTotal / durationCount : null,
  };
}
