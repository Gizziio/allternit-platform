import { useIsClient } from '@/lib/hooks/use-is-client';
import React, { useState } from 'react';
import { Target, ArrowsClockwise, ArrowCounterClockwise } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import GoalsView from '@/views/cowork/GoalsView';
import RoutinesPanel from '@/views/cowork/RoutinesPanel';
import LoopMonitor from '@/views/cowork/LoopMonitor';

type AutomationTab = 'goals' | 'routines' | 'loops';

const TABS: { id: AutomationTab; label: string; icon: React.ReactNode }[] = [
  { id: 'goals', label: 'Goals', icon: <Target size={16} /> },
  { id: 'routines', label: 'Routines', icon: <ArrowsClockwise size={16} /> },
  { id: 'loops', label: 'Loops', icon: <ArrowCounterClockwise size={16} /> },
];

export const AutomationHub: React.FC = () => {
  const isClient = useIsClient();
  const [activeTab, setActiveTab] = useState<AutomationTab>('routines');

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-sm">
        Loading automation hub…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Hub Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Automation Hub</h2>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-2 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              activeTab === tab.id
                ? 'bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'goals' && <GoalsView />}
        {activeTab === 'routines' && <RoutinesPanel />}
        {activeTab === 'loops' && <LoopMonitor />}
      </div>
    </div>
  );
};

export default AutomationHub;
