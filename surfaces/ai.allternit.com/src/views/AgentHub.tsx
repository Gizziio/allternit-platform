"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretDown, Check, Plus } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/lib/agents/agent.store';

import { TABS, type AgentTab } from './agent-hub/main/AgentHub.constants';
import { AgentHubContent } from './agent-hub/main/AgentHubContent';

export function AgentHub() {
  const [activeTab, setActiveTab] = useState<AgentTab>('studio');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const tabMenuRef = useRef<HTMLDivElement | null>(null);
  const setIsCreating = useAgentStore((state) => state.setIsCreating);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const activeTabInfo = TABS.find((t) => t.id === activeTab) || TABS[0];

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
    <div className="flex flex-col h-full w-full bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-solid border-[var(--border-subtle)] shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Agent Hub</h1>

        <div className="flex items-center gap-2">
          {activeTab === 'studio' && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              Create Agent
            </button>
          )}

          <div className="relative" ref={tabMenuRef}>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
            >
              <activeTabInfo.icon size={14} className="text-[var(--accent-primary)]" />
              <span className="text-[var(--text-primary)]">{activeTabInfo.label}</span>
              <CaretDown size={12} className={cn('transition-transform duration-200', showDropdown && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-56 bg-[var(--surface-panel)] border border-solid border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden p-1 z-50"
                >
                  {TABS.map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setShowDropdown(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-none text-[13px] font-medium text-left transition-colors cursor-pointer',
                        activeTab === tab.id
                          ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                          : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
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
        </div>
      </div>

      {/* Main Content Area */}
      <AgentHubContent activeTab={activeTab} />
    </div>
  );
}

export default AgentHub;
