// @ts-nocheck

"use client";

import React, { useEffect } from 'react';
import { useIsClient } from '@/lib/hooks/use-is-client';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-studio-border-subtle bg-studio-card/50 p-4 text-sm text-studio-text-secondary">
      {children}
    </div>
  );
}

export const CheckpointsTab = ({ agent }: { agent: Agent }) => {
  const { checkpoints, fetchCheckpoints } = useAgentStore();
  const isClient = useIsClient();
  const agentCheckpoints = checkpoints[agent.id] || [];

  useEffect(() => {
    fetchCheckpoints(agent.id);
  }, [agent.id, fetchCheckpoints]);

  return (
    <div className="h-full p-5">
      <div className="flex flex-col gap-2.5">
        {agentCheckpoints.length === 0 ? (
          <EmptyMessage>No checkpoints yet.</EmptyMessage>
        ) : (
          agentCheckpoints.map((checkpoint) => (
            <div
              key={checkpoint.id}
              className="rounded-lg border border-studio-border-subtle bg-studio-card p-3.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-studio-text-primary">{checkpoint.label}</span>
                <span className="text-xs text-studio-text-muted">
                  {isClient ? new Date(checkpoint.timestamp).toLocaleString() : ''}
                </span>
              </div>
              {checkpoint.description && (
                <div className="mt-1 text-xs text-studio-text-secondary">{checkpoint.description}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
