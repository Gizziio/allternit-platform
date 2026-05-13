
"use client";

import React from 'react';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent, CharacterStats } from '@/lib/agents/agent.types';
import { Badge } from '@/components/ui/badge';
import { RunListItem } from './RunListItem'; // This will be created later

import { Play, CheckSquare, EnvelopeSimple, UserCircle, Clock, Lightning } from '@phosphor-icons/react';

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-studio-text-primary">
        <Icon size={16} />
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-studio-border-subtle bg-studio-card p-4">
      <div className="mb-2 flex items-center justify-between text-studio-text-secondary">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        <Icon size={16} />
      </div>
      <div className="text-2xl font-semibold text-studio-text-primary">{value}</div>
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-studio-border-subtle bg-studio-card/50 p-4 text-sm text-studio-text-secondary">
      {children}
    </div>
  );
}

export const OverviewTab = ({ agent, stats }: { agent: Agent; stats?: CharacterStats }) => {
  const { runs, tasks, mail } = useAgentStore();
  const agentRuns = runs[agent.id] || [];
  const agentTasks = tasks[agent.id] || [];
  const agentMail = mail[agent.id] || [];

  const recentRuns = agentRuns.slice(0, 3);
  const pendingTasks = agentTasks.filter(t => t.status === 'pending');
  const unreadMessages = agentMail.filter(m => m.status === 'unread').length;

  return (
    <div className="h-full p-5">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-4 gap-3">
          <StatBox label="Total Runs" value={agentRuns.length} icon={Play} />
          <StatBox label="Pending Tasks" value={pendingTasks.length} icon={CheckSquare} />
          <StatBox label="Unread Messages" value={unreadMessages} icon={EnvelopeSimple} />
          <StatBox label="Level" value={stats?.level || 1} icon={UserCircle} />
        </div>

        <Section title="Recent Runs" icon={Clock}>
          {recentRuns.length === 0 ? (
            <EmptyMessage>No recent runs</EmptyMessage>
          ) : (
            <div className="flex flex-col gap-2.5">
              {recentRuns.map(run => (
                <RunListItem key={run.id} run={run} compact />
              ))}
            </div>
          )}
        </Section>

        {agent.description && (
          <Section title="About" icon={UserCircle}>
            <div className="rounded-lg border border-studio-border-subtle bg-studio-card p-4 text-sm leading-relaxed text-studio-text-secondary">
              {agent.description}
            </div>
          </Section>
        )}

        {agent.capabilities && agent.capabilities.length > 0 && (
          <Section title="Capabilities" icon={Lightning}>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map(cap => (
                <Badge key={cap} variant="outline">{cap}</Badge>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};
