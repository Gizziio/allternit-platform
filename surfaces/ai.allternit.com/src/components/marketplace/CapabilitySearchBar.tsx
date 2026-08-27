'use client';

import React from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export type CapabilityCategory = 'all' | 'skills' | 'tools' | 'plugins' | 'mcps' | 'connectors' | 'workflows';

export interface CapabilitySearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  activeCategory: CapabilityCategory;
  onCategoryChange: (category: CapabilityCategory) => void;
  placeholder?: string;
  className?: string;
}

const CATEGORIES: { id: CapabilityCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'skills', label: 'Skills' },
  { id: 'tools', label: 'Tools' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'mcps', label: 'MCPs' },
  { id: 'connectors', label: 'Connectors' },
  { id: 'workflows', label: 'Workflows' },
];

export function CapabilitySearchBar({
  query,
  onQueryChange,
  activeCategory,
  onCategoryChange,
  placeholder = 'Search capabilities…',
  className,
}: CapabilitySearchBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      {/* Search input */}
      <div className="relative flex-1 min-w-[220px] max-w-[400px]">
        <MagnifyingGlass
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
        />
        <input
          aria-label="Search capabilities"
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 pl-10 pr-10 bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)] transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={16} weight="bold" />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <nav className="flex items-center p-1 rounded-xl bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            type="button"
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg border-none text-[13px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap',
              activeCategory === cat.id
                ? 'bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
            )}
          >
            {cat.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
