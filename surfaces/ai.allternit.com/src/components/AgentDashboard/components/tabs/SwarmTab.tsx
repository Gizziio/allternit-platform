// @ts-nocheck

"use client";

import React from 'react';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-studio-border-subtle bg-studio-card/50 p-4 text-sm text-studio-text-secondary">
      {children}
    </div>
  );
}

function AgentRow({ agent, onSelect }: { agent: Agent; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      className="flex w-full items-center justify-between rounded-lg border border-studio-border-subtle bg-studio-card p-3.5 text-left transition-colors hover:border-studio-border-hover"
    >
      <div>
        <div className="text-sm font-medium text-studio-text-primary">{agent.name}</div>
        <div className="text-xs text-studio-text-muted">{agent.description}</div>
      </div>
      <span className="text-xs capitalize text-studio-text-secondary">{agent.type}</span>
    </button>
  );
}

export const SwarmTab = ({ agent }: { agent: Agent }) => {
  const { agents, selectAgent } = useAgentStore();
  const parent = agent.parentAgentId ? agents.find((a) => a.id === agent.parentAgentId) : undefined;
  const children = agents.filter((a) => a.parentAgentId === agent.id);

  return (
    <div className="h-full p-5">
      <div className="flex flex-col gap-5">
        {parent && (
          <section className="flex flex-col gap-3">
            <div className="text-sm font-semibold text-studio-text-primary">Parent</div>
            <AgentRow agent={parent} onSelect={selectAgent} />
          </section>
        )}

        <section className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-studio-text-primary">
            Sub-agents ({children.length})
          </div>
          {children.length === 0 ? (
            <EmptyMessage>This agent has no sub-agents.</EmptyMessage>
          ) : (
            <div className="flex flex-col gap-2.5">
              {children.map((child) => (
                <AgentRow key={child.id} agent={child} onSelect={selectAgent} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
