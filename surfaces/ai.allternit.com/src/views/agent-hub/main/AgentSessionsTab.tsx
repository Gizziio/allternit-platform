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
  window.dispatchEvent(
    new CustomEvent('allternit:open-view', {
      detail: {
        viewType: `${item.surface}-agent-session`,
        context: { sessionId: item.id, originView: SURFACE_META[item.surface].viewType },
      },
    }),
  );
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
    <div className="h-full w-full overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-8 pb-12 pt-6">
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 transition-colors focus-within:border-[var(--accent-primary)]">
          <MagnifyingGlass size={16} className="text-[var(--text-tertiary)] shrink-0" />
          <input
            aria-label="Search agent sessions"
            type="text"
            placeholder="Search agent sessions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-none bg-transparent text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {(['all', 'chat', 'code', 'cowork', 'design'] as const).map((surface) => (
            <button
              key={surface}
              type="button"
              onClick={() => setSurfaceFilter(surface)}
              className={cn(
                "h-8 rounded-lg px-3 text-xs font-medium capitalize transition-colors",
                surfaceFilter === surface
                  ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              {surface === 'all' ? 'All' : SURFACE_META[surface].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Robot size={48} className="text-[var(--text-tertiary)] opacity-40" />
            <h3 className="text-sm font-normal text-[var(--text-secondary)]">No agent sessions.</h3>
            <p className="text-[13px] text-[var(--text-tertiary)] max-w-xs">
              {searchQuery || surfaceFilter !== 'all'
                ? 'Try adjusting your search or surface filter.'
                : 'Start an agent session from chat, code, cowork, or design to see it here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  className="group flex min-h-[150px] cursor-pointer flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-primary)]"><Robot size={20} weight="duotone" /></div>
                    <span className="flex items-center gap-1.5 rounded-full bg-[var(--surface-hover)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                      <SurfaceIcon size={12} />
                      {SURFACE_META[item.surface].label}
                    </span>
                  </div>
                  <div className="mt-4 min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-[var(--text-primary)]">{item.name}</span>
                    {item.agentName && (
                      <span className="mt-1 block truncate text-[13px] text-[var(--text-secondary)]">{item.agentName}</span>
                    )}
                  </div>
                  <span className="mt-3 text-xs text-[var(--text-tertiary)]">
                    {formatSessionDate(item.updatedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
