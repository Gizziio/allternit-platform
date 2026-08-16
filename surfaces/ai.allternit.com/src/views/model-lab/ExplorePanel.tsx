'use client';

import React, { useState } from 'react';
import { Compass, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GuidesPanel } from './GuidesPanel';
import { CatalogPanel } from './CatalogPanel';

type ExploreSubTab = 'discover' | 'catalog';

const SUB_TABS: { id: ExploreSubTab; label: string; icon: React.ElementType }[] = [
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'catalog', label: 'Catalog', icon: BookOpen },
];

export function ExplorePanel(): React.ReactNode {
  const [subTab, setSubTab] = useState<ExploreSubTab>('discover');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Catalog</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Discover Unsloth guides and search the Hugging Face model catalog.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {subTab === 'discover' && <GuidesPanel />}
      {subTab === 'catalog' && <CatalogPanel />}
    </div>
  );
}

export default ExplorePanel;
