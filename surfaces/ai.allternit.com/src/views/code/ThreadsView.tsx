'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  Cpu,
  MagnifyingGlass,
  CaretDown,
  ArrowSquareOut,
  Trash,
  DotsThreeVertical,
} from '@phosphor-icons/react';
import { useCodeSessionStore, type CodeSession } from '@/views/code/CodeSessionStore';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import GlassSurface from '@/design/GlassSurface';

type CodeStatusFilter = 'all' | 'regular' | 'agent';
type CodeDateFilter = 'all' | 'today' | 'week' | 'month';
type CodeGroupBy = 'none' | 'date' | 'status' | 'project' | 'environment';
type CodeSortBy = 'lastActivity' | 'name' | 'created';

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

export function ThreadsView(): React.ReactNode {
  const sessions = useCodeSessionStore((s) => s.sessions ?? []);
  const activeSessionId = useCodeSessionStore((s) => s.activeSessionId);
  const setActiveSession = useCodeSessionStore((s) => s.setActiveSession);
  const deleteSession = useCodeSessionStore((s) => s.deleteSession);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CodeStatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<'all' | string>('all');
  const [dateFilter, setDateFilter] = useState<CodeDateFilter>('all');
  const [groupBy, setGroupBy] = useState<CodeGroupBy>('date');
  const [sortBy, setSortBy] = useState<CodeSortBy>('lastActivity');
  const [deleteTarget, setDeleteTarget] = useState<CodeSession | null>(null);

  const projectOptions = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => { if (s.metadata?.projectId) set.add(s.metadata.projectId); });
    return Array.from(set).sort();
  }, [sessions]);

  const environmentOptions = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => { if (s.metadata?.workspaceId) set.add(s.metadata.workspaceId); });
    return Array.from(set).sort();
  }, [sessions]);

  const processedGroups = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    let list = sessions.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      if (q && !(s.name || 'Untitled Session').toLowerCase().includes(q)) return false;
      if (statusFilter !== 'all') {
        const mode = s.metadata?.sessionMode ?? 'regular';
        if (statusFilter === 'agent' && mode !== 'agent') return false;
        if (statusFilter === 'regular' && mode !== 'regular') return false;
      }
      if (projectFilter !== 'all' && s.metadata?.projectId !== projectFilter) return false;
      if (environmentFilter !== 'all' && s.metadata?.workspaceId !== environmentFilter) return false;
      if (dateFilter !== 'all') {
        const date = new Date(s.updatedAt || 0);
        if (dateFilter === 'today' && date < now) return false;
        if (dateFilter === 'week' && date < weekAgo) return false;
        if (dateFilter === 'month' && date < monthAgo) return false;
      }
      return true;
    });

    list = list.slice().sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    if (groupBy === 'none') return [{ key: 'All', items: list }];

    const groups: Record<string, CodeSession[]> = {};
    list.forEach((s) => {
      let key = 'Other';
      if (groupBy === 'date') key = groupKeyForDate(new Date(s.updatedAt || 0).getTime());
      else if (groupBy === 'status') key = s.metadata?.sessionMode === 'agent' ? 'Agent' : 'Regular';
      else if (groupBy === 'project') key = s.metadata?.projectId || 'No project';
      else if (groupBy === 'environment') key = s.metadata?.workspaceId || 'No environment';
      groups[key] = groups[key] ?? [];
      groups[key].push(s);
    });

    return Object.entries(groups).map(([key, items]) => ({ key, items }));
  }, [
    sessions,
    searchQuery,
    statusFilter,
    projectFilter,
    environmentFilter,
    dateFilter,
    groupBy,
    sortBy,
  ]);

  const openSession = useCallback((session: CodeSession) => {
    setActiveSession(session.id);
    const isAgent = session.metadata?.sessionMode === 'agent';
    const viewType = isAgent ? 'code-agent-session' : 'code';
    window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: 'code' } }));
    window.dispatchEvent(
      new CustomEvent('allternit:open-view', {
        detail: {
          viewType,
          context: isAgent ? { sessionId: session.id, originView: 'code' } : undefined,
        },
      }),
    );
  }, [setActiveSession]);

  const hasFilters =
    statusFilter !== 'all' ||
    projectFilter !== 'all' ||
    environmentFilter !== 'all' ||
    dateFilter !== 'all' ||
    groupBy !== 'date' ||
    sortBy !== 'lastActivity';
  const filterLabel = hasFilters ? 'Filtered' : 'All';

  return (
    <GlassSurface>
      <div className="w-full h-full flex flex-col bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-solid border-[var(--border-subtle)] shrink-0">
          <h1 className="text-xl font-semibold tracking-tight">Code Recents</h1>
          <div className="flex items-center gap-2">
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
                  <FilterRow label="Status" value={statusFilter === 'all' ? 'All' : statusFilter}>
                    <div className="flex flex-col gap-0.5">
                      {(['all', 'regular', 'agent'] as const).map((s) => (
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
                  <FilterRow label="Project" value={projectFilter === 'all' ? 'All' : projectFilter}>
                    <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => setProjectFilter('all')}
                        className={cn(
                          "text-left px-2 py-1.5 rounded-md text-[13px] transition-colors",
                          projectFilter === 'all' ? "bg-[var(--surface-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                        )}
                      >
                        All
                      </button>
                      {projectOptions.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setProjectFilter(p)}
                          className={cn(
                            "text-left px-2 py-1.5 rounded-md text-[13px] transition-colors truncate",
                            projectFilter === p ? "bg-[var(--surface-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                          )}
                          title={p}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </FilterRow>
                  <FilterRow label="Environment" value={environmentFilter === 'all' ? 'All' : environmentFilter}>
                    <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => setEnvironmentFilter('all')}
                        className={cn(
                          "text-left px-2 py-1.5 rounded-md text-[13px] transition-colors",
                          environmentFilter === 'all' ? "bg-[var(--surface-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                        )}
                      >
                        All
                      </button>
                      {environmentOptions.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setEnvironmentFilter(e)}
                          className={cn(
                            "text-left px-2 py-1.5 rounded-md text-[13px] transition-colors truncate",
                            environmentFilter === e ? "bg-[var(--surface-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                          )}
                          title={e}
                        >
                          {e}
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
                      {(['none', 'date', 'status', 'project', 'environment'] as const).map((g) => (
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
                  <FilterRow label="Sort by" value={sortBy === 'lastActivity' ? 'Last activity' : sortBy === 'name' ? 'Name' : 'Created'}>
                    <div className="flex flex-col gap-0.5">
                      {(['lastActivity', 'name', 'created'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSortBy(s)}
                          className={cn(
                            "text-left px-2 py-1.5 rounded-md text-[13px] transition-colors",
                            sortBy === s ? "bg-[var(--surface-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                          )}
                        >
                          {s === 'lastActivity' ? 'Last activity' : s === 'name' ? 'Name' : 'Created'}
                        </button>
                      ))}
                    </div>
                  </FilterRow>
                </div>
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={() => {
                setActiveSession(null);
                window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: 'code' } }));
                window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'code', allowNew: true } }));
              }}
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
              aria-label="Search code recents"
              type="text"
              placeholder="Search code recents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] text-[14px] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {!processedGroups.some((g) => g.items.length > 0) ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="size-14 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-tertiary)]">
                <MagnifyingGlass size={28} />
              </div>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">No code recents found</h3>
              <p className="text-[13px] text-[var(--text-tertiary)] max-w-xs">
                {searchQuery || hasFilters
                  ? 'Try adjusting your search or filters.'
                  : 'Start a new code session to see it here.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 pb-8">
              {processedGroups.map((group) =>
                group.items.length > 0 ? (
                  <div key={group.key}>
                    {groupBy !== 'none' && (
                      <div className="sticky top-0 z-10 py-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--shell-frame-bg)]">
                        {group.key}
                      </div>
                    )}
                    <div className="flex flex-col">
                      {group.items.map((session) => {
                        const isActive = activeSessionId === session.id;
                        return (
                          <div
                            key={session.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openSession(session)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openSession(session);
                              }
                            }}
                            className={cn(
                              "group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors",
                              isActive ? "bg-[var(--surface-active)]" : "hover:bg-[var(--surface-hover)]"
                            )}
                          >
                            <Cpu
                              size={18}
                              className={cn(
                                "shrink-0",
                                session.metadata?.sessionMode === 'agent'
                                  ? "text-[var(--accent-primary)]"
                                  : "text-[var(--text-tertiary)]"
                              )}
                              weight="bold"
                            />
                            <span className="flex-1 min-w-0 text-[14px] text-[var(--text-primary)] truncate">
                              {session.name || 'Untitled Session'}
                            </span>
                            <span className="text-[12px] text-[var(--text-tertiary)] whitespace-nowrap shrink-0">
                              {formatItemDate(new Date(session.updatedAt || 0).getTime())}
                            </span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--surface-hover)] transition-all"
                                  title="Delete session"
                                >
                                  <DotsThreeVertical size={14} />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-40 p-1.5 bg-[var(--surface-panel)] border-[var(--border-subtle)]" align="end">
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(session)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border-none bg-transparent cursor-pointer text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
                                >
                                  <Trash size={14} />
                                  <span>Delete</span>
                                </button>
                              </PopoverContent>
                            </Popover>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openSession(session); }}
                              className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--surface-hover)] transition-all"
                              title="Open"
                            >
                              <ArrowSquareOut size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm p-5 rounded-2xl bg-[var(--surface-panel)] border border-solid border-[var(--border-subtle)] shadow-[var(--shadow-xl)]">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Delete Session?</h3>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">
              Are you sure you want to delete &ldquo;{deleteTarget.name || 'Untitled Session'}&rdquo;? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium border border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { deleteSession(deleteTarget.id); setDeleteTarget(null); }}
                className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-[var(--status-error)] text-white hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </GlassSurface>
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
}): React.ReactNode {
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

export default ThreadsView;
