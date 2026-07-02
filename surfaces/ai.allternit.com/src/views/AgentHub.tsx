"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CaretDown, 
  Check, 
  Sun, 
  Moon,
  Robot
} from '@phosphor-icons/react';
import { useThemeStore, resolveTheme } from '@/design/ThemeStore';
import { useStudioTheme } from './agent-view/useStudioTheme';
import { cn } from '@/lib/utils';

// Modularized AgentHub components
import { TABS, type AgentTab } from './agent-hub/main/AgentHub.constants';
import { useAgentSeeding } from './agent-hub/main/useAgentSeeding';
import { AgentHubContent } from './agent-hub/main/AgentHubContent';

export function AgentHub() {
  const [activeTab, setActiveTab] = useState<AgentTab>('studio');
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<AgentTab | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  const themePreference = useThemeStore((state) => state.theme);
  const setThemePreference = useThemeStore((state) => state.setTheme);
  const resolvedTheme = resolveTheme(themePreference);
  const STUDIO_THEME = useStudioTheme();
  const tabMenuRef = useRef<HTMLDivElement | null>(null);

  // Initialize client state
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Run initial agent seeding logic
  useAgentSeeding();

  const activeTabInfo = useMemo(() => 
    TABS.find(t => t.id === activeTab) || TABS[0],
    [activeTab]
  );

  // Handle clicking outside the mobile dropdown
  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  if (!isClient) return null;

  return (
    <div className="flex flex-col h-full w-full relative bg-transparent text-[var(--text-primary,#ececec)] overflow-hidden font-sans">
      {/* Header / Tab Navigation */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-solid border-[rgba(212,176,140,0.1)] bg-[rgba(15,12,10,0.4)] backdrop-blur-md z-20 shrink-0">
        <div className="flex items-center gap-6">
          {/* Branded Logo Section */}
          <div className="flex items-center gap-3">
            <div className="size-10 bg-[var(--accent-primary)]/10 rounded-xl flex items-center justify-center border border-solid border-[var(--accent-primary)]/20 shadow-[0_0_24px_rgba(212,176,140,0.08)]">
              <Robot size={22} weight="duotone" className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <h1 className="text-[19px] font-bold m-0 tracking-tight text-[var(--ui-text-primary)]">Agent Hub</h1>
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[var(--ui-text-muted)] opacity-50 mt-0.5">Autonomous Control Plane</p>
            </div>
          </div>

          {/* Desktop Tabs */}
          <nav className="hidden lg:flex items-center bg-black/20 p-1 rounded-xl border border-solid border-white/5 ml-4">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const isHovered = hoveredTab === tab.id;
              return (
                <button type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2 rounded-lg border-none text-[13px] font-semibold cursor-pointer transition-all duration-200",
                    isActive ? "text-white" : "text-[var(--ui-text-secondary)] hover:text-white"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="hub-tab-active"
                      className="absolute inset-0 bg-[var(--accent-primary)]/15 rounded-lg border border-solid border-[var(--accent-primary)]/30 shadow-[0_0_12px_rgba(212,176,140,0.1)]"
                    />
                  )}
                  <tab.icon size={16} weight={isActive ? "fill" : "regular"} className={cn("relative z-10", isActive && "text-[var(--accent-primary)]")} />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Mobile Tab Selector */}
          <div className="relative lg:hidden" ref={tabMenuRef}>
            <button type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-solid border-white/10 text-[13px] font-semibold text-white cursor-pointer"
            >
              <activeTabInfo.icon size={16} className="text-[var(--accent-primary)]" />
              {activeTabInfo.label}
              <CaretDown size={14} className={cn("transition-transform duration-200", showDropdown && "rotate-180")} />
            </button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-56 bg-[#1a1714] border border-solid border-white/10 rounded-xl shadow-2xl overflow-hidden p-1 z-50"
                >
                  {TABS.map((tab) => (
                    <button type="button"
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setShowDropdown(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-none text-[13px] font-medium text-left transition-colors cursor-pointer",
                        activeTab === tab.id ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <tab.icon size={16} />
                        {tab.label}
                      </div>
                      {activeTab === tab.id && <Check size={14} weight="bold" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />

          {/* Theme Toggle */}
          <button type="button"
            onClick={() => setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="size-9 flex items-center justify-center rounded-xl bg-white/5 border border-solid border-white/10 text-zinc-400 hover:text-white transition-all duration-200 cursor-pointer"
            title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <AgentHubContent activeTab={activeTab} />
      
      {/* Global CSS for Hub */}
      <style>{`
        [data-shell-card] {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
}

export default AgentHub;
