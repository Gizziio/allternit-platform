// @ts-nocheck

"use client";

import React, { useEffect } from 'react';
import { useIsClient } from '@/lib/hooks/use-is-client';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-studio-border-subtle bg-studio-card p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-studio-text-secondary">{label}</div>
      <div className="text-2xl font-semibold text-studio-text-primary">{value}</div>
    </div>
  );
}

export const MonitoringTab = ({ agent }: { agent: Agent }) => {
  const { runs, fetchRuns, eventStreamConnected } = useAgentStore();
  const isClient = useIsClient();
  const agentRuns = runs[agent.id] || [];

  useEffect(() => {
    fetchRuns(agent.id);
  }, [agent.id, fetchRuns]);

  const running = agentRuns.filter((r) => r.status === 'running').length;
  const completed = agentRuns.filter((r) => r.status === 'completed').length;
  const failed = agentRuns.filter((r) => r.status === 'failed').length;

  return (
    <div className="h-full p-5">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            label="Connection"
            value={
              <span className={eventStreamConnected ? 'text-emerald-400' : 'text-studio-text-muted'}>
                {eventStreamConnected ? '● Live' : 'Offline'}
              </span>
            }
          />
          <StatBox label="Status" value={<span className="capitalize">{agent.status}</span>} />
          <StatBox label="Running" value={running} />
          <StatBox label="Completed" value={completed} />
          <StatBox label="Failed" value={failed} />
          <StatBox
            label="Last Run"
            value={agent.lastRunAt && isClient ? new Date(agent.lastRunAt).toLocaleString() : '—'}
          />
        </div>

        {(agent.successRate != null || agent.avgResponseTime != null) && (
          <div className="grid grid-cols-2 gap-3">
            {agent.successRate != null && <StatBox label="Success Rate" value={`${agent.successRate}%`} />}
            {agent.avgResponseTime != null && <StatBox label="Avg Response" value={`${agent.avgResponseTime}s`} />}
          </div>
        )}
      </div>
    </div>
  );
};
