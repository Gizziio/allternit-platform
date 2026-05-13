
"use client";

import React from 'react';
import {
  SquaresFour,
  Play,
  CheckSquare,
  GitCommit,
  Wrench,
  EnvelopeSimple,
  ChartBar,
  Cube,
  Users,
  UserCircle,
  GearSix,
  FolderOpen,
} from '@phosphor-icons/react';

type TabId = 'overview' | 'runs' | 'tasks' | 'checkpoints' | 'tools' | 'comms' | 'monitoring' | 'environment' | 'swarm' | 'character' | 'workspace' | 'settings';

interface SidebarNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: 'overview', icon: SquaresFour, label: 'Overview' },
  { id: 'runs', icon: Play, label: 'Runs' },
  { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
  { id: 'checkpoints', icon: GitCommit, label: 'Checkpoints' },
  { id: 'tools', icon: Wrench, label: 'Tools' },
  { id: 'comms', icon: EnvelopeSimple, label: 'Comms' },
  { id: 'monitoring', icon: ChartBar, label: 'Monitor' },
  { id: 'environment', icon: Cube, label: 'Env' },
  { id: 'swarm', icon: Users, label: 'Swarm' },
  { id: 'character', icon: UserCircle, label: 'Character' },
  { id: 'workspace', icon: FolderOpen, label: 'Workspace' },
  { id: 'settings', icon: GearSix, label: 'Settings' },
];

export const SidebarNavigation = ({ activeTab, onTabChange }: SidebarNavigationProps) => {
  return (
    <div className="flex h-full w-40 flex-col gap-0.5 overflow-auto border-r border-studio-border-subtle bg-studio-card p-3">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2.5 rounded-lg border-none px-3 py-2.5 text-left text-sm font-medium transition-all duration-150
              ${
                isActive
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'bg-transparent text-studio-text-secondary'
              }
            `}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
