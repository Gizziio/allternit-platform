// @ts-nocheck

"use client";

import React, { useEffect } from 'react';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent, TaskStatus } from '@/lib/agents/agent.types';

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-studio-border-subtle bg-studio-card/50 p-4 text-sm text-studio-text-secondary">
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  'in-progress': 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  failed: 'border-red-500/40 bg-red-500/10 text-red-300',
  cancelled: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
};

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

export const TasksTab = ({ agent }: { agent: Agent }) => {
  const { tasks, fetchTasks } = useAgentStore();
  const agentTasks = tasks[agent.id] || [];

  useEffect(() => {
    fetchTasks(agent.id);
  }, [agent.id, fetchTasks]);

  return (
    <div className="h-full p-5">
      <div className="flex flex-col gap-2.5">
        {agentTasks.length === 0 ? (
          <EmptyMessage>No tasks yet.</EmptyMessage>
        ) : (
          agentTasks
            .slice()
            .sort((a, b) => a.priority - b.priority)
            .map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-studio-border-subtle bg-studio-card p-3.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-studio-text-primary">{task.title}</div>
                  {task.description && (
                    <div className="truncate text-xs text-studio-text-muted">{task.description}</div>
                  )}
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))
        )}
      </div>
    </div>
  );
};
