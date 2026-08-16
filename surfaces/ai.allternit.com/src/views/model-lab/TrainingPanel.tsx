'use client';

import React, { useState } from 'react';
import { Flask, ListChecks, CheckCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TrainPanel } from './TrainPanel';
import { JobsMonitor } from './JobsMonitor';

type TrainingSubTab = 'train' | 'jobs';

const SUB_TABS: { id: TrainingSubTab; label: string; icon: React.ElementType }[] = [
  { id: 'train', label: 'New job', icon: Flask },
  { id: 'jobs', label: 'Jobs', icon: ListChecks },
];

export function TrainingPanel(): React.ReactNode {
  const [subTab, setSubTab] = useState<TrainingSubTab>('train');
  const [justCreated, setJustCreated] = useState(false);

  const handleJobCreated = () => {
    setJustCreated(true);
    setSubTab('jobs');
    // Clear the transient success indicator after a few seconds.
    window.setTimeout(() => setJustCreated(false), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Train</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Fine-tune, export, merge, and evaluate open-weights models.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {justCreated && (
            <div className="flex items-center gap-1.5 text-xs text-green-500 px-2">
              <CheckCircle size={14} weight="fill" />
              Job created
            </div>
          )}
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={cn(
                  'h-8 px-3 text-sm font-medium rounded-full border transition-all duration-200 flex items-center gap-1.5',
                  active
                    ? 'bg-[var(--text-primary)] text-[var(--bg-elevated)] border-[var(--text-primary)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
                )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {subTab === 'train' && <TrainPanel onJobCreated={handleJobCreated} />}
      {subTab === 'jobs' && <JobsMonitor />}
    </div>
  );
}

export default TrainingPanel;
