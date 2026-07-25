"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwise, CaretDown, CaretRight } from '@phosphor-icons/react';
import type { Agent } from '@/lib/agents/agent.types';
import {
  agentRunsApi,
  summarizeRunMetrics,
  type AgentRunMetricsSummary,
  type AgentRunRecord,
} from '@/lib/agents/agent-runs-api';
import { useIsClient } from '@/lib/hooks/use-is-client';
import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('RunsTab');

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
    running: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
    completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    failed: 'border-red-500/40 bg-red-500/10 text-red-300',
    error: 'border-red-500/40 bg-red-500/10 text-red-300',
    cancelled: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  };

  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
        styles[status] ?? 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300'
      )}
    >
      {status}
    </span>
  );
}

function RunRow({ run }: { run: AgentRunRecord }) {
  const isClient = useIsClient();
  const [expanded, setExpanded] = useState(false);
  const hasDetails = Boolean(run.output || run.error);

  return (
    <div className="rounded-lg border border-studio-border-subtle bg-studio-card overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-4 border-none bg-transparent p-3.5 text-left',
          hasDetails ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasDetails && (
            expanded ? (
              <CaretDown size={12} className="shrink-0 text-studio-text-muted" />
            ) : (
              <CaretRight size={12} className="shrink-0 text-studio-text-muted" />
            )
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-studio-text-primary">
              Run {run.id.slice(0, 8)}
            </div>
            <div className="text-xs text-studio-text-muted">
              {isClient ? new Date(run.created_at).toLocaleString() : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {typeof run.duration_ms === 'number' && (
            <span className="text-xs text-studio-text-muted font-mono">
              {formatDuration(run.duration_ms)}
            </span>
          )}
          <StatusBadge status={run.status} />
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="border-t border-solid border-studio-border-subtle p-3.5 flex flex-col gap-3">
          {run.error && (
            <div>
              <div className="text-xs font-semibold text-red-500 mb-1">Error</div>
              <pre className="max-h-48 overflow-auto rounded-md bg-red-500/10 p-2.5 text-xs font-mono text-red-400 whitespace-pre-wrap break-words">
                {run.error}
              </pre>
            </div>
          )}
          {run.output && (
            <div>
              <div className="text-xs font-semibold text-studio-text-secondary mb-1">Output</div>
              <pre className="max-h-64 overflow-auto rounded-md bg-studio-bg p-2.5 text-xs font-mono text-studio-text-primary whitespace-pre-wrap break-words">
                {run.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg border border-studio-border-subtle bg-studio-card p-3.5">
      <div className="text-xs text-studio-text-muted">{label}</div>
      <div className="text-lg font-semibold text-studio-text-primary mt-0.5">{value}</div>
    </div>
  );
}

export const RunsTab = ({ agent }: { agent: Agent }) => {
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [summary, setSummary] = useState<AgentRunMetricsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [runList, metricRows] = await Promise.all([
        agentRunsApi.listRuns(agent.id),
        agentRunsApi.listMetrics(agent.id).catch((e) => {
          // Metrics are a nice-to-have summary — keep the run list usable
          // if the metrics endpoint fails.
          logger.warn({ err: e }, 'Failed to load agent metrics');
          return [];
        }),
      ]);
      setRuns(runList);
      setSummary(summarizeRunMetrics(metricRows));
    } catch (e) {
      logger.error({ err: e }, 'Failed to load agent runs');
      setError(e instanceof Error ? e.message : 'Failed to load runs');
    } finally {
      setIsLoading(false);
    }
  }, [agent.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="h-full p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-studio-text-primary">Run history</span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={isLoading}
            className="p-1.5 rounded-md bg-transparent border-none text-studio-text-secondary cursor-pointer transition-colors hover:bg-studio-card disabled:opacity-50"
            title="Refresh runs"
          >
            <ArrowsClockwise size={16} className={isLoading ? 'animate-spin' : undefined} />
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 p-3">
            <span className="text-xs text-red-500">{error}</span>
          </div>
        )}

        {summary && (summary.totalRuns > 0 || summary.successRate !== null || summary.avgDurationMs !== null) && (
          <div className="flex gap-3">
            <SummaryStat label="Total runs" value={String(summary.totalRuns)} />
            <SummaryStat
              label="Success rate"
              value={summary.successRate !== null ? `${Math.round(summary.successRate * 100)}%` : '—'}
            />
            <SummaryStat
              label="Avg duration"
              value={summary.avgDurationMs !== null ? formatDuration(summary.avgDurationMs) : '—'}
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {runs.length === 0 && !isLoading ? (
            <div className="rounded-lg border border-dashed border-studio-border-subtle bg-studio-card/50 p-4 text-sm text-studio-text-secondary">
              No runs yet.
            </div>
          ) : (
            runs.map((run) => <RunRow key={run.id} run={run} />)
          )}
        </div>
      </div>
    </div>
  );
};
