import React from "react";
import { 
  Globe, 
  Layers, 
  Search, 
  BookmarkPlus 
} from 'lucide-react';

interface CatalogViewHeaderProps {
  view: 'search' | 'browse' | 'curated';
  setView: (view: 'search' | 'browse' | 'curated') => void;
  curatedCount: number;
}

export const CatalogViewHeader: React.FC<CatalogViewHeaderProps> = ({
  view,
  setView,
  curatedCount,
}) => {
  const tabs = [
    { id: 'browse' as const, icon: Layers, label: 'Browse Categories' },
    { id: 'search' as const, icon: Search, label: 'Search' },
    { id: 'curated' as const, icon: BookmarkPlus, label: `Curated (${curatedCount})` },
  ];

  return (
    <div className="p-6 px-8 border-b border-solid border-[var(--border-subtle,#27272a)] bg-[var(--bg-secondary,#111113)]">
      <div className="flex items-center gap-3 mb-4">
        <Globe size={32} className="text-[var(--status-info)]" />
        <div>
          <h1 className="text-2xl font-bold m-0">
            Udemy Course Catalog
          </h1>
          <p className="text-[13px] text-[var(--text-muted,#a1a1aa)] m-0">
            Browse and curate free courses for A://Labs
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map(tab => (
          <button type="button"
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`
              flex items-center gap-1.5 px-4 py-2 rounded-md transition-all duration-150 cursor-pointer text-[14px] font-medium border border-solid
              ${view === tab.id 
                ? 'bg-[var(--accent,#7c3aed)] text-white border-none' 
                : 'bg-transparent border-[var(--border-subtle,#27272a)] text-[var(--text-secondary,#d4d4d8)] hover:bg-white/5'
              }
            `}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};
