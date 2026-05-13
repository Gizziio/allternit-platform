
import React from 'react';
import type { AgentRun } from '@/lib/agents/agent.types';

interface RunListItemProps {
  run: AgentRun;
  onCancel?: () => void;
  compact?: boolean;
}

function StatusBadge({ status }: { status: AgentRun['status'] }) {
  const styles: Record<AgentRun['status'], string> = {
    queued: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
    running: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
    completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    failed: 'border-red-500/40 bg-red-500/10 text-red-300',
    cancelled: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  };

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

export const RunListItem = ({ run, onCancel, compact }: RunListItemProps) => {
  return (
    <div className="flex items-center justify-between rounded-lg border border-studio-border-subtle bg-studio-card p-3.5">
      <div>
        <div className="text-sm font-medium text-studio-text-primary">Run {run.id.slice(0, 8)}</div>
        <div className="text-xs text-studio-text-muted">
          {new Date(run.startedAt).toLocaleString()}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <StatusBadge status={run.status} />
        {onCancel && (
          <button onClick={onCancel} className="text-xs text-red-500 hover:underline">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
