"use client";

import React, { useMemo, useState } from 'react';
import type { Icon } from '@phosphor-icons/react';
import {
  ChatTeardropText,
  Code,
  MagnifyingGlass,
  PaintBrush,
  Robot,
  UsersThree,
} from '@phosphor-icons/react';
import { useChatSessionStore } from '../../chat/ChatSessionStore';
import { useCodeSessionStore } from '../../code/CodeSessionStore';
import { useCoworkSessionStore } from '../../cowork/CoworkSessionStore';
import { useDesignSessionStore } from '../../design/DesignSessionStore';
import type { ModeSession } from '@/lib/agents/mode-session-store';
import { cn } from '@/lib/utils';

type SessionSurface = 'chat' | 'code' | 'cowork' | 'design';

interface AgentSessionItem {
  id: string;
  name: string;
  agentName?: string;
  surface: SessionSurface;
  updatedAt: number;
}

const SURFACE_META: Record<SessionSurface, { label: string; icon: Icon; viewType: string }> = {
  chat: { label: 'Chat', icon: ChatTeardropText, viewType: 'chat' },
  code: { label: 'Code', icon: Code, viewType: 'code' },
  cowork: { label: 'Cowork', icon: UsersThree, viewType: 'workspace' },
  design: { label: 'Design', icon: PaintBrush, viewType: 'design' },
};

const SURFACE_STORES: Record<SessionSurface, typeof useChatSessionStore> = {
  chat: useChatSessionStore,
  code: useCodeSessionStore,
  cowork: useCoworkSessionStore,
  design: useDesignSessionStore,
};

function toItems(sessions: ModeSession[], surface: SessionSurface): AgentSessionItem[] {
  return sessions
    .filter((s) => s.metadata.sessionMode === 'agent')
    .map((s) => ({
      id: s.id,
      name: s.name || 'Untitled agent session',
      agentName: s.metadata.agentName,
      surface,
      updatedAt: new Date(s.updatedAt || 0).getTime(),
    }));
}

function formatSessionDate(ts: number): string {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function openSession(item: AgentSessionItem) {
  SURFACE_STORES[item.surface].getState().setActiveSession(item.id);
  window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: item.surface } }));
  window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: SURFACE_META[item.surface].viewType } }));
}

export function AgentSessionsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState<'all' | SessionSurface>('all');

  const chatSessions = useChatSessionStore((s) => s.sessions ?? []);
  const codeSessions = useCodeSessionStore((s) => s.sessions ?? []);
  const coworkSessions = useCoworkSessionStore((s) => s.sessions ?? []);
  const designSessions = useDesignSessionStore((s) => s.sessions ?? []);

  const items = useMemo<AgentSessionItem[]>(() => {
    return [
      ...toItems(chatSessions, 'chat'),
      ...toItems(codeSessions, 'code'),
      ...toItems(coworkSessions, 'cowork'),
      ...toItems(designSessions, 'design'),
    ].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [chatSessions, codeSessions, coworkSessions, designSessions]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (surfaceFilter !== 'all' && item.surface !== surfaceFilter) return false;
      if (q && !item.name.toLowerCase().includes(q) && !(item.agentName ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, searchQuery, surfaceFilter]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-solid border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3 flex-1 px-3.5 py-2 bg-[var(--surface-hover)] rounded-xl border border-solid border-[var(--border-subtle)] transition-colors focus-within:border-[var(--border-default)]">
          <MagnifyingGlass size={16} className="text-[var(--text-tertiary)] shrink-0" />
          <input
            aria-label="Search agent sessions"
            type="text"
            placeholder="Search agent sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] text-[14px] placeholder:text-[var(--text-tertiary)]"
          />
        </div>
        <div className="flex items-center gap-1 bg-[var(--surface-hover)] p-1 rounded-xl border border-solid border-[var(--border-subtle)]">
          {(['all', 'chat', 'code', 'cowork', 'design'] as const).map((surface) => (
            <button
              key={surface}
              type="button"
              onClick={() => setSurfaceFilter(surface)}
              className={cn(
                "px-3 py-1.5 rounded-lg border-none text-[13px] font-medium capitalize cursor-pointer transition-colors",
                surfaceFilter === surface
                  ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                  : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {surface === 'all' ? 'All' : SURFACE_META[surface].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="size-14 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-tertiary)]">
              <Robot size={28} />
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">No agent sessions</h3>
            <p className="text-[13px] text-[var(--text-tertiary)] max-w-xs">
              {searchQuery || surfaceFilter !== 'all'
                ? 'Try adjusting your search or surface filter.'
                : 'Start an agent session from chat, code, cowork, or design to see it here.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col pb-8">
            {filteredItems.map((item) => {
              const SurfaceIcon = SURFACE_META[item.surface].icon;
              return (
                <div
                  key={`${item.surface}:${item.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openSession(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openSession(item);
                    }
                  }}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <Robot size={18} weight="bold" className="shrink-0 text-[var(--accent-primary)]" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-[14px] text-[var(--text-primary)] truncate">{item.name}</span>
                    {item.agentName && (
                      <span className="block text-[12px] text-[var(--text-tertiary)] truncate">{item.agentName}</span>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] shrink-0">
                    <SurfaceIcon size={14} />
                    {SURFACE_META[item.surface].label}
                  </span>
                  <span className="text-[12px] text-[var(--text-tertiary)] whitespace-nowrap shrink-0 w-16 text-right">
                    {formatSessionDate(item.updatedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
