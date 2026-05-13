
"use client";

import React from 'react';
import type { Agent, CharacterStats } from '@/lib/agents/agent.types';
import { OverviewTab } from './tabs/OverviewTab';
import { RunsTab } from './tabs/RunsTab';
import { TasksTab } from './tabs/TasksTab';
import { CheckpointsTab } from './tabs/CheckpointsTab';
import { ToolsTab } from './tabs/ToolsTab';
import { CommsTab } from './tabs/CommsTab';
import { MonitoringTab } from './tabs/MonitoringTab';
import { EnvironmentTab } from './tabs/EnvironmentTab';
import { SwarmTab } from './tabs/SwarmTab';
import { CharacterLayerPanel } from '@/views/agent-character/CharacterLayerPanel';
import { WorkspaceTab } from './tabs/WorkspaceTab';
import { SettingsTab } from './tabs/SettingsTab';

type TabId = 'overview' | 'runs' | 'tasks' | 'checkpoints' | 'tools' | 'comms' | 'monitoring' | 'environment' | 'swarm' | 'character' | 'workspace' | 'settings';

interface TabContentProps {
  tabId: TabId;
  agent: Agent;
  stats?: CharacterStats;
}

export const TabContent = ({ tabId, agent, stats }: TabContentProps) => {
  switch (tabId) {
    case 'overview':
      return <OverviewTab agent={agent} stats={stats} />;
    case 'runs':
      return <RunsTab agent={agent} />;
    case 'tasks':
      return <TasksTab agent={agent} />;
    case 'checkpoints':
      return <CheckpointsTab agent={agent} />;
    case 'tools':
      return <ToolsTab agent={agent} />;
    case 'comms':
      return <CommsTab agent={agent} />;
    case 'monitoring':
      return <MonitoringTab agent={agent} />;
    case 'environment':
      return <EnvironmentTab agent={agent} />;
    case 'swarm':
      return <SwarmTab agent={agent} />;
    case 'character':
      return <CharacterLayerPanel agentId={agent.id} />;
    case 'workspace':
      return <WorkspaceTab agent={agent} />;
    case 'settings':
      return <SettingsTab agent={agent} />;
    default:
      return null;
  }
};
