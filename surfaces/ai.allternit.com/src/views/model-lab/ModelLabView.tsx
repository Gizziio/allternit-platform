'use client';

import React, { useEffect } from 'react';
import {
  Gauge,
  BookOpen,
  FlaskConical,
  Cloud,
  MessageSquare,
  Cpu,
} from 'lucide-react';
import { useModelLabStore, type ModelLabTab } from '@/lib/model-lab/store';
import { Pill } from '@/components/ui/Pill';
import { LocalRuntimePanel } from './LocalRuntimePanel';
import { ExplorePanel } from './ExplorePanel';
import { TrainingPanel } from './TrainingPanel';
import { CloudPanel } from './CloudPanel';
import { PlaygroundPanel } from './PlaygroundPanel';
import { LocalStudioPanel } from './LocalStudioPanel';

const TABS: { id: ModelLabTab; label: string; icon: React.ElementType }[] = [
  { id: 'engine', label: 'Engine', icon: Gauge },
  { id: 'catalog', label: 'Catalog', icon: BookOpen },
  { id: 'train', label: 'Train', icon: FlaskConical },
  { id: 'studio', label: 'Studio', icon: Cpu },
  { id: 'cloud', label: 'Cloud', icon: Cloud },
  { id: 'playground', label: 'Playground', icon: MessageSquare },
];

export function ModelLabView(): React.ReactNode {
  const { activeTab, setActiveTab, startPolling, stopPolling } = useModelLabStore();

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--shell-view-bg)] text-[var(--text-primary)] overflow-auto">
      <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12 flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1
              className="text-3xl font-medium tracking-tight m-0"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Model Lab
            </h1>
            <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
              Train, deploy, and chat with open-weights models — locally or in the cloud.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="border-none bg-transparent p-0 cursor-pointer"
                >
                  <Pill active={isActive} icon={<Icon size={13} />} size="md">
                    {tab.label}
                  </Pill>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0">
          {activeTab === 'engine' && <LocalRuntimePanel />}
          {activeTab === 'catalog' && <ExplorePanel />}
          {activeTab === 'train' && <TrainingPanel />}
          {activeTab === 'studio' && <LocalStudioPanel />}
          {activeTab === 'cloud' && <CloudPanel />}
          {activeTab === 'playground' && <PlaygroundPanel />}
        </div>
      </div>
    </div>
  );
}

export default ModelLabView;
