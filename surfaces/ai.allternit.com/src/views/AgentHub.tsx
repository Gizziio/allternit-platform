"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretDown, Check, Plus, Users } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

import { TABS, type AgentTab } from './agent-hub/main/AgentHub.constants';
import { AgentHubContent } from './agent-hub/main/AgentHubContent';
import { CreateBotForm } from './agent-view/components/CreateBotForm';

interface AgentHubProps {
  initialTab?: AgentTab;
  onSessionStarted?: (sessionId: string, botId: string) => void;
}

export function AgentHub({ initialTab = 'bots', onSessionStarted }: AgentHubProps) {
  const [activeTab, setActiveTab] = useState<AgentTab>(initialTab);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const tabMenuRef = useRef<HTMLDivElement | null>(null);

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
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="shrink-0">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-8 pt-10">
          <h1 className="text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            Bot Hub
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('allternit:open-view', { detail: { viewType: 'bot-roster' } })
                )
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            >
              <Users size={16} />
              Bot Roster
            </button>

            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-[13px] font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              Create bot
            </button>

            <div className="relative" ref={tabMenuRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
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
                    className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 shadow-2xl"
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
      </div>

      <AgentHubContent
        activeTab={activeTab}
        onSessionStarted={onSessionStarted}
        onCreate={() => setIsCreateOpen(true)}
      />

      <CreateBotForm isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}

export default AgentHub;
