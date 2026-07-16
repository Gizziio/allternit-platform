// @ts-nocheck

"use client";

import React, { useEffect } from 'react';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';
import { RunListItem } from './RunListItem';

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-studio-border-subtle bg-studio-card/50 p-4 text-sm text-studio-text-secondary">
      {children}
    </div>
  );
}

export const RunsTab = ({ agent }: { agent: Agent }) => {
  const { runs, fetchRuns, cancelRun } = useAgentStore();
  const agentRuns = runs[agent.id] || [];

  useEffect(() => {
    fetchRuns(agent.id);
  }, [agent.id, fetchRuns]);

  return (
    <div className="h-full p-5">
      <div className="flex flex-col gap-3">
        {agentRuns.length === 0 ? (
          <EmptyMessage>No runs yet.</EmptyMessage>
        ) : (
          agentRuns.map((run) => (
            <RunListItem
              key={run.id}
              run={run}
              onCancel={run.status === 'running' ? () => cancelRun(agent.id, run.id) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
};
