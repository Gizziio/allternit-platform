"use client";

import React from 'react';
import {
  PuzzlePiece,
  MagnifyingGlass,
  Plus,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { useExtensionsManager } from './browser-extensions/main/useExtensionsManager';
import { ExtensionCard } from './browser-extensions/main/ExtensionCard';
import { EmptyState } from '@/components/settings/EmptyState';
import { cn } from '@/lib/utils';
import type { ExtensionCategory } from './browser-extensions/main/BrowserExtensions.types';

export function BrowserExtensionsView() {
  const {
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    showNotification,
    filteredExtensions,
    handleToggle,
    handleInstall,
    handleUninstall,
  } = useExtensionsManager();

  const categories: { id: ExtensionCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'automation', label: 'Automation' },
    { id: 'ai', label: 'AI Powered' },
    { id: 'utilities', label: 'Utilities' },
    { id: 'office', label: 'Office' },
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
          <div>
            <h1 className="text-[24px] font-bold m-0 tracking-tight text-[var(--text-primary)]">Allternit Extensions</h1>
            <p className="text-[14px] text-[var(--text-secondary)] mt-1 m-0">
              Enable browser and Office surfaces that use the same Allternit brain and harness
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-semibold cursor-pointer transition-colors hover:brightness-110"
          >
            <Plus size={18} weight="bold" />
            Upload Extension
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[260px] max-w-[420px]">
            <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              aria-label="Search extensions"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search installed and available extensions…"
              className="w-full h-10 pl-10 pr-4 bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
          </div>

          {/* Categories */}
          <div className="flex items-center p-1 rounded-xl bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)]">
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
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 pb-12">
        {filteredExtensions.length === 0 ? (
          <div className="max-w-[520px]">
            <EmptyState
              icon={<PuzzlePiece size={64} weight="thin" />}
              title="No extensions found"
              caption={searchQuery || activeCategory !== 'all'
                ? 'Try adjusting your filters or search query.'
                : 'Install browser extensions to give your agent new capabilities.'}
              ctaLabel={searchQuery || activeCategory !== 'all' ? 'Clear filters' : 'Browse marketplace'}
              primaryCta
              onCtaClick={() => {
                if (searchQuery || activeCategory !== 'all') {
                  setSearchQuery('');
                  setActiveCategory('all');
                } else {
                  window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'marketplace' } }));
                }
              }}
              className="bg-[var(--bg-secondary)] rounded-2xl border border-solid border-[var(--border-subtle)]"
            />
            <div className="mt-6 p-6 rounded-2xl bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)]">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 mb-1">Build your own extensions</h3>
              <p className="text-[13px] text-[var(--text-secondary)] m-0 mb-4 leading-relaxed">
                Our SDK allows you to create native browser extensions that interact with agent context, handle page automation, and surface unique tools.
              </p>
              <button
                type="button"
                onClick={() => window.open('https://allternit.com/developers', '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-1.5 text-[var(--accent-primary)] text-[13px] font-semibold bg-transparent border-none cursor-pointer hover:underline"
              >
                Open Developer Documentation <ArrowSquareOut size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredExtensions.map((ext) => (
              <ExtensionCard
                key={ext.id}
                extension={ext}
                onToggle={handleToggle}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowserExtensionsView;
