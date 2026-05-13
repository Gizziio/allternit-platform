
"use client";

import React from 'react';
import { CaretLeft, X } from '@phosphor-icons/react';
import { AgentAvatar } from '@/components/Avatar/AgentAvatar';
import type { Agent, CharacterStats } from '@/lib/agents/agent.types';

type TabId = 'overview' | 'runs' | 'tasks' | 'checkpoints' | 'tools' | 'comms' | 'monitoring' | 'environment' | 'swarm' | 'character' | 'workspace' | 'settings';

interface DashboardHeaderProps {
  agent: Agent;
  stats?: CharacterStats;
  onClose?: () => void;
  activeTab: TabId;
}

const tabLabels: Record<TabId, string> = {
  overview: 'Overview',
  runs: 'Runs',
  tasks: 'Tasks',
  checkpoints: 'Checkpoints',
  tools: 'Tools',
  comms: 'Comms',
  monitoring: 'Monitoring',
  environment: 'Environment',
  swarm: 'Swarm',
  character: 'Character',
  workspace: 'Workspace',
  settings: 'Settings',
};

export const DashboardHeader = ({ agent, stats, onClose, activeTab }: DashboardHeaderProps) => {
  return (
    <div className="bg-studio-card text-studio-text-primary flex items-center justify-between border-b border-studio-border-subtle px-5 py-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg border-none bg-transparent p-2 text-studio-text-secondary"
        >
          <CaretLeft size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-lg border border-studio-border-subtle">
            <AgentAvatar config={agent.config?.avatar as any} size={40} />
          </div>
          <div>
            <h3 className="font-semibold text-base text-white [font-family:var(--font-research)]">{agent.name}</h3>
            <p className="text-xs text-studio-text-muted mt-0.5">
              {stats?.class || 'Agent'} • Level {stats?.level || 1}
            </p>
          </div>
        </div>

        <div className="mx-2 h-6 w-px bg-studio-border-subtle" />

        <span className="text-sm font-medium capitalize text-studio-text-secondary">
          {tabLabels[activeTab]}
        </span>
      </div>

      <button
        onClick={onClose}
        className="cursor-pointer rounded-lg border-none bg-transparent p-2 text-studio-text-secondary"
      >
        <X size={18} />
      </button>
    </div>
  );
};
