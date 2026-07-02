"use client";

import React from 'react';
import { 
  PuzzlePiece, 
  MagnifyingGlass, 
  Plus,
  ArrowSquareOut
} from '@phosphor-icons/react';
import { useExtensionsManager } from './browser-extensions/main/useExtensionsManager';
import { ExtensionCard } from './browser-extensions/main/ExtensionCard';
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
    { id: 'all', label: 'All Extensions' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'automation', label: 'Automation' },
    { id: 'ai', label: 'AI Powered' },
    { id: 'utilities', label: 'Utilities' },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--surface-canvas)] relative overflow-hidden font-sans">
      {/* Toast Notification */}
      {showNotification && (
        <div className="fixed top-6 right-6 z-[100] p-3 px-5 rounded-lg bg-zinc-900 border border-solid border-white/10 shadow-2xl animate-in slide-in-from-right-4 duration-300">
          <span className="text-[13px] font-semibold text-white">{showNotification}</span>
        </div>
      )}

      {/* Branded Header */}
      <header className="px-8 py-8 shrink-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-bold m-0 tracking-tight text-[var(--ui-text-primary)]">Browser Extensions</h1>
            <p className="text-[14px] text-[var(--ui-text-secondary)] mt-1 opacity-70">Enhance your agent's browsing capabilities with native plugins</p>
          </div>
          <button type="button" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] font-bold text-[14px] border-none cursor-pointer shadow-lg hover:opacity-90 active:scale-95 transition-all">
            <Plus size={18} weight="bold" />
            Upload Extension
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[300px]">
            <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input aria-label="Input" type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search installed and available extensions…"
              className="w-full h-11 pl-11 pr-4 bg-black/20 border border-solid border-white/5 rounded-xl text-[14px] text-white outline-none focus:border-[var(--accent-primary)]/40 transition-all"
            />
          </div>

          {/* Categories */}
          <div className="flex items-center bg-black/20 p-1 rounded-xl border border-solid border-white/5">
            {categories.map((cat) => (
              <button type="button"
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-4 py-2 rounded-lg border-none text-[12px] font-bold cursor-pointer transition-all duration-200",
                  activeCategory === cat.id 
                    ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] shadow-sm" 
                    : "text-zinc-500 hover:text-white"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-12">
        {filteredExtensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-40 grayscale">
            <PuzzlePiece size={64} weight="thin" />
            <p className="text-[16px] mt-4 font-medium">No extensions found</p>
            <p className="text-[13px] mt-1">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

        {/* Developer Sandbox Promo */}
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-solid border-blue-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <PuzzlePiece size={120} weight="duotone" />
          </div>
          <div className="relative z-10 max-w-xl">
            <h2 className="text-xl font-bold mb-2">Build your own extensions</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Our SDK allows you to create native browser extensions that can interact with agent context, handle complex page automation, and surface unique tools.
            </p>
            <button type="button" className="flex items-center gap-2 text-[var(--accent-primary)] font-bold text-sm bg-transparent border-none cursor-pointer group-hover:underline">
              Open Developer Documentation <ArrowSquareOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BrowserExtensionsView;
