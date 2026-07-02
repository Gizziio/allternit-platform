"use client";

import React from 'react';
import { 
  Storefront, 
  MagnifyingGlass, 
  Sparkle,
  ArrowRight
} from '@phosphor-icons/react';
import { useMarketplaceManager } from './marketplace/main/useMarketplaceManager';
import { MarketplaceItemCard } from './marketplace/main/MarketplaceItemCard';
import { Badge } from "@/components/ui/badge";
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
    { id: 'agents', label: 'Specialist Agents' },
    { id: 'plugins', label: 'Plugin Suites' },
    { id: 'workflows', label: 'Workflow DAGs' },
    { id: 'knowledge', label: 'Expert Packs' },
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
      <header className="px-8 py-8 shrink-0 bg-[rgba(15,12,10,0.4)] backdrop-blur-md border-b border-solid border-white/5">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-[var(--accent-primary)]/10 flex items-center justify-center border border-solid border-[var(--accent-primary)]/20 shadow-[0_0_24px_rgba(212,176,140,0.1)]">
              <Storefront size={28} weight="duotone" className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <h1 className="text-[28px] font-bold m-0 tracking-tight text-[var(--ui-text-primary)]">Marketplace</h1>
              <p className="text-[14px] text-[var(--ui-text-secondary)] mt-1 opacity-70">Discover and install powerful AI resources for your workspace</p>
            </div>
          </div>
          
          {/* Top Info Pill */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-solid border-white/10">
            <Sparkle size={16} weight="fill" className="text-yellow-500" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-zinc-400">Next Gen Assets Available</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[320px]">
            <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input aria-label="Input" type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, type, or tags…"
              className="w-full h-12 pl-12 pr-4 bg-black/40 border border-solid border-white/10 rounded-2xl text-[15px] text-white outline-none focus:border-[var(--accent-primary)]/50 transition-all shadow-inner"
            />
          </div>

          {/* Categories */}
          <nav className="flex items-center bg-black/20 p-1.5 rounded-2xl border border-solid border-white/5">
            {categories.map((cat) => (
              <button type="button"
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-5 py-2.5 rounded-xl border-none text-[13px] font-bold cursor-pointer transition-all duration-300",
                  activeCategory === cat.id 
                    ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] shadow-lg scale-105" 
                    : "text-zinc-500 hover:text-white"
                )}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto px-8 py-10 pb-20">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-40 grayscale">
            <Storefront size={64} weight="thin" />
            <p className="text-[18px] mt-4 font-bold">No resources found</p>
            <p className="text-[14px] mt-1 max-w-xs leading-relaxed">Try adjusting your filters or searching for something else in the Allternit directory.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <MarketplaceItemCard
                key={item.id}
                item={item}
                onInstall={handleInstall}
              />
            ))}
          </div>
        )}

        {/* Promotion Banner */}
        <div className="mt-16 p-10 rounded-3xl bg-gradient-to-r from-blue-900/20 via-indigo-900/10 to-transparent border border-solid border-white/5 relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 size-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />
          <div className="relative z-10 max-w-2xl">
            <Badge variant="outline" className="mb-4 text-[10px] font-black tracking-widest bg-blue-500/10 border-blue-500/30 text-blue-400">PARTNER PROGRAM</Badge>
            <h2 className="text-3xl font-bold mb-4">Are you a developer?</h2>
            <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
              Monetize your AI specialist agents and unique workflow DAGs by joining the Allternit Developer Network. Get discovered by thousands of teams.
            </p>
            <div className="flex gap-4">
              <button type="button" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-[15px] border-none cursor-pointer shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                Submit an Asset <ArrowRight size={18} weight="bold" />
              </button>
              <button type="button" className="px-6 py-3 rounded-xl bg-white/5 text-zinc-300 font-bold text-[15px] border border-solid border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                Developer Guide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketplaceView;
