'use client';

import React, { useMemo, useState, useCallback } from 'react';
import type { Icon } from '@phosphor-icons/react';
import {
  ChatTeardropText,
  CheckSquare,
  Robot,
  UsersThree,
  Globe,
  MagnifyingGlass,
  CaretDown,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { useChatSessionStore } from './chat/ChatSessionStore';
import { useCodeSessionStore } from './code/CodeSessionStore';
import { useCoworkSessionStore } from './cowork/CoworkSessionStore';
import { useCoworkStore } from './cowork/CoworkStore';
import { useBrowserAgentStore } from '../capsules/browser/browserAgent.store';
import { useChatStore } from './chat/ChatStore';
import { useCodeSessionStore as useCodeSessionStoreActions } from './code/CodeSessionStore';
import { useCoworkSessionStore as useCoworkSessionStoreActions } from './cowork/CoworkSessionStore';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { AppMode } from '../shell/ShellHeader';

type ItemKind = 'chat' | 'cowork' | 'task' | 'agent' | 'browser' | 'code';
type ItemStatus = 'active' | 'completed' | 'archived';
type DateFilter = 'all' | 'today' | 'week' | 'month';
type GroupBy = 'none' | 'date' | 'type';

interface RecentItem {
  id: string;
  title: string;
  kind: ItemKind;
  status: ItemStatus;
  updatedAt: number;
  mode: AppMode;
  sessionId?: string | null;
  projectId?: string;
}

const KIND_ICONS: Record<ItemKind, Icon> = {
  chat: ChatTeardropText,
  cowork: UsersThree,
  task: CheckSquare,
  agent: Robot,
  browser: Globe,
  code: Robot,
};

const KIND_LABELS: Record<ItemKind, string> = {
  chat: 'Chat',
  cowork: 'Cowork',
  task: 'Task',
  agent: 'Agent',
  browser: 'Browser',
  code: 'Code',
};

function toItemStatus(status?: string): ItemStatus {
  if (status === 'completed' || status === 'done') return 'completed';
  if (status === 'archived') return 'archived';
  return 'active';
}

function formatItemDate(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isCurrentYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: isCurrentYear ? undefined : 'numeric',
  });
}

function matchesDateFilter(ts: number, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  const date = new Date(ts);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (filter === 'today') return date >= now;
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (filter === 'week') return date >= weekAgo;
  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  if (filter === 'month') return date >= monthAgo;
  return true;
}

function groupKeyForDate(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === now.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  if (d.getTime() >= lastWeek.getTime()) return 'Previous 7 Days';
  return 'Older';
}

export function RecentsView(): React.ReactNode {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ItemStatus>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const chatSessions = useChatSessionStore((s) => s.sessions ?? []);
  const codeSessions = useCodeSessionStore((s) => s.sessions ?? []);
  const coworkSessions = useCoworkSessionStore((s) => s.sessions ?? []);
  const tasks = useCoworkStore((s) => s.tasks ?? []);
  const browserSessions = useBrowserAgentStore((s) => s.pageAgentSessions ?? []);

  const allItems = useMemo<RecentItem[]>(() => {
    const list: RecentItem[] = [];

    chatSessions.forEach((s) => {
      const isAgent = s.metadata?.sessionMode === 'agent';
      list.push({
        id: s.id,
        title: s.name || 'Untitled chat',
        kind: isAgent ? 'agent' : 'chat',
        status: 'active',
        updatedAt: new Date(s.updatedAt || 0).getTime(),
        mode: 'chat',
        sessionId: s.id,
      });
    });

    codeSessions.forEach((s) => {
      list.push({
        id: s.id,
        title: s.name || 'Untitled code session',
        kind: 'code',
        status: 'active',
        updatedAt: new Date(s.updatedAt || 0).getTime(),
        mode: 'code',
        sessionId: s.id,
      });
    });

    coworkSessions.forEach((s) => {
      list.push({
        id: s.id,
        title: s.name || 'Untitled cowork session',
        kind: 'task',
        status: 'active',
        updatedAt: new Date(s.updatedAt || 0).getTime(),
        mode: 'cowork',
        sessionId: s.id,
      });
    });

    tasks.forEach((t) => {
      list.push({
        id: t.id,
        title: t.title || 'Untitled task',
        kind: t.mode === 'agent' ? 'agent' : 'task',
        status: toItemStatus(t.status),
        updatedAt: new Date(t.updatedAt || t.createdAt || 0).getTime(),
        mode: 'cowork',
        sessionId: t.sessionId,
        projectId: t.projectId,
      });
    });

    browserSessions.forEach((s) => {
      list.push({
        id: s.id,
        title: s.task || 'Untitled browser run',
        kind: 'browser',
        status: 'active',
        updatedAt: Number(s.createdAt || 0),
        mode: 'browser',
        sessionId: s.id,
      });
    });

    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [chatSessions, codeSessions, coworkSessions, tasks, browserSessions]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allItems.filter((item) => {
      if (q && !item.title.toLowerCase().includes(q)) return false;
      if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!matchesDateFilter(item.updatedAt, dateFilter)) return false;
      return true;
    });
  }, [allItems, searchQuery, typeFilter, statusFilter, dateFilter]);

  const groupedItems = useMemo(() => {
    if (groupBy === 'none') return { 'All': filteredItems };
    if (groupBy === 'type') {
      const groups: Record<string, RecentItem[]> = {};
      filteredItems.forEach((item) => {
        const key = KIND_LABELS[item.kind];
        groups[key] = groups[key] ?? [];
        groups[key].push(item);
      });
      return groups;
    }
    const groups: Record<string, RecentItem[]> = {
      Today: [],
      Yesterday: [],
      'Previous 7 Days': [],
      Older: [],
    };
    filteredItems.forEach((item) => {
      const key = groupKeyForDate(item.updatedAt);
      groups[key] = groups[key] ?? [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredItems, groupBy]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openItem = useCallback((item: RecentItem) => {
    if (item.mode === 'chat') {
      useChatSessionStore.getState().setActiveSession(item.sessionId ?? item.id);
      useChatStore.getState().setActiveThread(item.sessionId ?? item.id);
      window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: 'chat' } }));
      window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'chat' } }));
    } else if (item.mode === 'code') {
      useCodeSessionStoreActions.getState().setActiveSession(item.sessionId ?? item.id);
      window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: 'code' } }));
      window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'code' } }));
    } else if (item.mode === 'cowork') {
      if (item.kind === 'task' && item.id) {
        useCoworkStore.getState().setActiveTask(item.id);
      }
      if (item.sessionId) {
        useCoworkSessionStoreActions.getState().setActiveSession(item.sessionId);
      }
      window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: 'cowork' } }));
      window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'workspace' } }));
    } else if (item.mode === 'browser') {
      window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: 'browser' } }));
      window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'browser' } }));
    }
  }, []);

  const handleNew = useCallback(() => {
    window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: 'chat' } }));
    window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'chat', allowNew: true } }));
  }, []);

  const hasFilters = typeFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all' || groupBy !== 'date';
  const filterLabel = hasFilters ? 'Filtered' : 'All';

  return (
    <div className="w-full h-full flex flex-col bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-solid border-[var(--border-subtle)] shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Recents</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectMode((v) => !v)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors",
              selectMode
                ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]"
                : "bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]"
            )}
          >
            Select
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
              >
                Filter by {filterLabel}
                <CaretDown size={12} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 bg-[var(--surface-panel)] border-[var(--border-subtle)]" align="end">
              <div className="flex flex-col gap-3">
                <FilterRow label="Type" value={typeFilter === 'all' ? 'All' : KIND_LABELS[typeFilter]}>
                  <div className="flex flex-col gap-0.5">
                    {(['all', 'chat', 'task', 'agent', 'browser', 'code'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setTypeFilter(k)}
                        className={cn(
                          "text-left px-2 py-1.5 rounded-md text-[13px] transition-colors",
                          typeFilter === k ? "bg-[var(--surface-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                        )}
                      >
                        {k === 'all' ? 'All' : KIND_LABELS[k]}
                      </button>
                    ))}
                  </div>
                </FilterRow>
                <FilterRow label="Status" value={statusFilter === 'all' ? 'All' : statusFilter}>
                  <div className="flex flex-col gap-0.5">
                    {(['all', 'active', 'completed', 'archived'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                          "text-left px-2 py-1.5 rounded-md text-[13px] capitalize transition-colors",
                          statusFilter === s ? "bg-[var(--surface-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </FilterRow>
                <FilterRow label="Last activity" value={dateFilter === 'all' ? 'All' : dateFilter}>
                  <div className="flex flex-col gap-0.5">
                    {(['all', 'today', 'week', 'month'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDateFilter(d)}
                        className={cn(
                          "text-left px-2 py-1.5 rounded-md text-[13px] capitalize transition-colors",
                          dateFilter === d ? "bg-[var(--surface-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                        )}
                      >
                        {d === 'week' ? 'Last 7 days' : d === 'month' ? 'Last 30 days' : d}
                      </button>
                    ))}
                  </div>
                </FilterRow>
                <FilterRow label="Group by" value={groupBy === 'none' ? 'None' : groupBy}>
                  <div className="flex flex-col gap-0.5">
                    {(['none', 'date', 'type'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGroupBy(g)}
                        className={cn(
                          "text-left px-2 py-1.5 rounded-md text-[13px] capitalize transition-colors",
                          groupBy === g ? "bg-[var(--surface-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </FilterRow>
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={handleNew}
            className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
          >
            New
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-solid border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3 px-3.5 py-2.5 bg-[var(--surface-hover)] rounded-xl border border-solid border-[var(--border-subtle)] transition-colors focus-within:border-[var(--border-default)]">
          <MagnifyingGlass size={16} className="text-[var(--text-tertiary)] shrink-0" />
          <input
            aria-label="Search recents"
            type="text"
            placeholder="Search recents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] text-[14px] placeholder:text-[var(--text-tertiary)]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="size-14 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-tertiary)]">
              <MagnifyingGlass size={28} />
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">No recents found</h3>
            <p className="text-[13px] text-[var(--text-tertiary)] max-w-xs">
              {searchQuery || hasFilters
                ? 'Try adjusting your search or filters.'
                : 'Start a new chat or task to see it here.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 pb-8">
            {Object.entries(groupedItems).map(([groupName, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={groupName}>
                  {groupBy !== 'none' && (
                    <div className="sticky top-0 z-10 py-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--shell-frame-bg)]">
                      {groupName}
                    </div>
                  )}
                  <div className="flex flex-col">
                    {items.map((item) => {
                      const Icon = KIND_ICONS[item.kind];
                      const selected = selectedIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => (selectMode ? toggleSelection(item.id) : openItem(item))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selectMode ? toggleSelection(item.id) : openItem(item);
                            }
                          }}
                          className={cn(
                            "group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors",
                            selected ? "bg-[var(--surface-active)]" : "hover:bg-[var(--surface-hover)]"
                          )}
                        >
                          {selectMode && (
                            <div className={cn(
                              "size-4 rounded border transition-colors shrink-0",
                              selected
                                ? "bg-[var(--accent-primary)] border-[var(--accent-primary)]"
                                : "border-[var(--border-default)] group-hover:border-[var(--border-subtle)]"
                            )} />
                          )}
                          <Icon
                            size={18}
                            className={cn(
                              "shrink-0",
                              item.kind === 'agent' ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)]"
                            )}
                            weight="bold"
                          />
                          <span className="flex-1 min-w-0 text-[14px] text-[var(--text-primary)] truncate">
                            {item.title}
                          </span>
                          <span className="text-[12px] text-[var(--text-tertiary)] whitespace-nowrap shrink-0">
                            {formatItemDate(item.updatedAt)}
                          </span>
                          {!selectMode && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openItem(item); }}
                              className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--surface-hover)] transition-all"
                              title="Open"
                            >
                              <ArrowSquareOut size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[12px] text-[var(--text-tertiary)] px-1">
        <span>{label}</span>
        <span className="capitalize">{value}</span>
      </div>
      {children}
    </div>
  );
}

export default RecentsView;
