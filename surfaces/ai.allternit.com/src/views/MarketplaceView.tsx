"use client";

import React from 'react';
import {
  Storefront,
  MagnifyingGlass,
  PuzzlePiece,
  ArrowRight,
} from '@phosphor-icons/react';
import { useMarketplaceManager } from './marketplace/main/useMarketplaceManager';
import { MarketplaceItemCard } from './marketplace/main/MarketplaceItemCard';
import { EmptyState } from '@/components/settings/EmptyState';
import { cn } from '@/lib/utils';
import type { MarketplaceCategory } from './marketplace/main/Marketplace.types';

export function MarketplaceView() {
  const {
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    showNotification,
    filteredItems,
    handleInstall,
  } = useMarketplaceManager();

  const categories: { id: MarketplaceCategory; label: string }[] = [
    { id: 'all', label: 'Featured' },
    { id: 'agents', label: 'Agents' },
    { id: 'plugins', label: 'Plugins' },
    { id: 'workflows', label: 'Workflows' },
    { id: 'knowledge', label: 'Knowledge' },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[var(--shell-view-bg)] relative overflow-hidden">
      {/* Toast Notification */}
      {showNotification && (
        <div className="fixed top-6 right-6 z-[100] p-3 px-5 rounded-lg bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] shadow-2xl animate-in slide-in-from-right-4 duration-300">
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{showNotification}</span>
        </div>
      )}

      {/* Header */}
      <header className="px-8 py-7 shrink-0 border-b border-solid border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-[var(--accent-primary)]/10 flex items-center justify-center border border-solid border-[var(--accent-primary)]/20">
              <Storefront size={28} weight="duotone" className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold m-0 tracking-tight text-[var(--text-primary)]">Marketplace</h1>
              <p className="text-[14px] text-[var(--text-secondary)] mt-1 m-0">
                Discover and install extensions for your workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.open('https://allternit.com/developers', '_blank', 'noopener,noreferrer')}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-[13px] font-semibold cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
          >
            Developer portal <ArrowRight size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[260px] max-w-[420px]">
            <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              aria-label="Search marketplace"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, type, or tags…"
              className="w-full h-10 pl-10 pr-4 bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
          </div>

          {/* Categories */}
          <nav className="flex items-center p-1 rounded-xl bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)]">
            {categories.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg border-none text-[13px] font-semibold cursor-pointer transition-all duration-200",
                  activeCategory === cat.id
                    ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                )}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 pb-20">
        {filteredItems.length === 0 ? (
          <EmptyState
            icon={<PuzzlePiece size={64} weight="thin" />}
            title="No extensions found"
            caption={searchQuery || activeCategory !== 'all'
              ? 'Try adjusting your filters or searching for something else in the Allternit directory.'
              : 'The marketplace is empty right now. Check back soon for new extensions.'}
            ctaLabel="Clear filters"
            primaryCta
            onCtaClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
            className="bg-[var(--bg-secondary)] rounded-2xl border border-solid border-[var(--border-subtle)]"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredItems.map((item) => (
              <MarketplaceItemCard
                key={item.id}
                item={item}
                onInstall={handleInstall}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MarketplaceView;
