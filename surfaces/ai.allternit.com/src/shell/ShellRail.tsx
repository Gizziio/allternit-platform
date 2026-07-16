import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import type { AppMode } from './ShellHeader';
import {
  CaretDown,
  CaretRight,
  Gear,
  ChatTeardropText,
  Robot,
  Cpu,
  CheckSquare,
  UsersThree,
  AppWindow,
  Plugs,
  PuzzlePiece,
  Globe,
  PushPinSlash,
  Palette,
  House,
  TerminalWindow,
  FileText,
  Clock,
  FolderOpen,
  DownloadSimple,
  SlidersHorizontal,
  Plus,
  Target,
  ArrowSquareOut,
  Trash,
  DotsThreeVertical,
  Check,
} from '@phosphor-icons/react';
import { getPinnedMiniApps, unpinMiniApp, seedDefaultMiniApps } from '../views/aci/mini-app-registry';
import type { InstalledMiniApp } from '../views/aci/mini-app.types';
import { useChatStore } from '../views/chat/ChatStore';

import { useCoworkStore } from '../views/cowork/CoworkStore';


import { useSurfaceAgentModeEnabled } from '../lib/agents/surface-agent-context';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { useBrowserAgentStore } from '../capsules/browser/browserAgent.store';
import { useCodeSessionStore } from '../views/code/CodeSessionStore';
import { useCoworkSessionStore } from '../views/cowork/CoworkSessionStore';
import type { ModeSession } from '../lib/agents/mode-session-store';

type NativeSession = ModeSession;  // For backward compatibility
import {
  getAgentSessionDescriptor,
} from '../lib/agents/session-metadata';
import { useAgentSurfaceModeStore } from '../stores/agent-surface-mode.store';

import { SettingsDrilldown } from './SettingsDrilldown';
import { getAgentModeSurfaceTheme } from '../views/chat/agentModeSurfaceTheme';
import type { AgentModeSurface } from '../stores/agent-surface-mode.store';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DeleteConfirmModal } from './DeleteConfirmModal';

const MINI_APP_CATEGORY_ICONS: Record<string, Icon> = {
  runtime:       Cpu,
  connector:     Plugs,
  communication: Globe,
  data:          Globe,
  tool:          Gear,
  custom:        AppWindow,
};

function usePinnedMiniApps(): InstalledMiniApp[] {
  const [pinned, setPinned] = useState<InstalledMiniApp[]>(() => {
    seedDefaultMiniApps();
    return getPinnedMiniApps();
  });
  useEffect(() => {
    const sync = () => setPinned(getPinnedMiniApps());
    window.addEventListener('allternit:mini-apps-changed', sync);
    return () => window.removeEventListener('allternit:mini-apps-changed', sync);
  }, []);
  return pinned;
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

interface ShellRailProps {
  activeViewType?: string;
  onOpen?: (view: string, context?: Record<string, unknown>) => void;
  onNew?: () => void;
  mode?: AppMode;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onModeChange?: (mode: AppMode) => void;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
  onOpenControlCenter?: () => void;
  onSidecarToggle?: () => void;
  sidecarOpen?: boolean;
  onOpenCustomize?: (tab?: string) => void;
  sessionOnlyId?: string;
}

const BROWSER_MODE_VIEW_TYPES = new Set<string>([
  'browser',
  'browserview',
  'mini-apps-store',
  'browser-extensions',
  'mini-app',
  'addin-word',
  'addin-excel',
  'addin-ppt',
  'hermes',
  'openclaw',
  'openclaw-chat',
  'openclaw-sessions',
]);

export function ShellRail({
  activeViewType,
  onOpen,
  onNew: _onNew,
  mode = 'chat',
  isCollapsed,
  onModeChange,
  onOpenCustomize,
  sessionOnlyId,
}: ShellRailProps): React.ReactNode | null {
  // Determine current surface for agent mode glow
  const currentSurface: AgentModeSurface = 
    mode === 'browser' ? 'browser' :
    mode === 'cowork' ? 'cowork' : 
    mode === 'code' ? 'code' : 'chat';
  
  const isAgentActive = useSurfaceAgentModeEnabled(currentSurface);
  const surfaceTheme = isAgentActive ? getAgentModeSurfaceTheme(currentSurface) : null;

  // Chat Store
  const chatStore = useChatStore();
  
  // Mode-specific session stores
  const chatSessions = useStoreWithEqualityFn(useChatSessionStore, (s) => s.sessions ?? [], shallow);
  const codeSessions = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.sessions ?? [], shallow);
  const coworkSessions = useStoreWithEqualityFn(useCoworkSessionStore, (s) => s.sessions ?? [], shallow);
  const activeChatSessionId = useStoreWithEqualityFn(useChatSessionStore, (s) => s.activeSessionId);
  const activeCodeSessionId = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.activeSessionId);
  const activeCoworkSessionId = useStoreWithEqualityFn(useCoworkSessionStore, (s) => s.activeSessionId);
  const setActiveChatSession = useStoreWithEqualityFn(useChatSessionStore, (s) => s.setActiveSession);
  const setActiveCodeSession = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.setActiveSession);
  const setActiveNativeSession = mode === 'code' ? setActiveCodeSession : setActiveChatSession;
  
  // Cowork Store
  const coworkStore = useCoworkStore();
  
  const setSelectedSurfaceAgent = useStoreWithEqualityFn(useAgentSurfaceModeStore, (s) => s.setSelectedAgent);

  const browserAgentSessions = useBrowserAgentStore((state) => state.pageAgentSessions);
  const aciSessionId = useBrowserAgentStore((state) => state.aciSessionId);
  const pinnedMiniApps = usePinnedMiniApps();

  const [recentsExpanded, setRecentsExpanded] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'chat' | 'cowork' | 'task' | 'agent' | 'browser' | 'code'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; kind: string } | null>(null);

  // Code-mode recents filters (code-only, separate from global home/browser recents)
  const [codeRecentsExpanded, setCodeRecentsExpanded] = useState(true);
  const [codeStatusFilter, setCodeStatusFilter] = useState<'all' | 'regular' | 'agent'>('all');
  const [codeProjectFilter, setCodeProjectFilter] = useState<'all' | string>('all');
  const [codeEnvironmentFilter, setCodeEnvironmentFilter] = useState<'all' | string>('all');
  const [codeDateFilter, setCodeDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [codeGroupBy, setCodeGroupBy] = useState<'none' | 'date' | 'status' | 'project' | 'environment'>('date');
  const [codeSortBy, setCodeSortBy] = useState<'lastActivity' | 'name' | 'created'>('lastActivity');

  // Per-mode rail tab visibility (browser/code only; home has no More menu)
  const [browserRailTabs, setBrowserRailTabs] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return { 'mini-apps-store': true, 'browser-extensions': true };
    try {
      const saved = JSON.parse(localStorage.getItem('allternit-browser-rail-tabs') ?? '{}');
      return { 'mini-apps-store': true, 'browser-extensions': true, ...saved };
    } catch {
      return { 'mini-apps-store': true, 'browser-extensions': true };
    }
  });
  const [codeRailTabs, setCodeRailTabs] = useState<Record<string, boolean>>(() => {
    const defaults = { 'agent-hub': true, 'projects': true, 'artifacts-library': true, 'code-automations': true };
    if (typeof window === 'undefined') return defaults;
    try {
      const saved = JSON.parse(localStorage.getItem('allternit-code-rail-tabs') ?? '{}');
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  });

  const toggleBrowserRailTab = useCallback((id: string) => {
    setBrowserRailTabs((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem('allternit-browser-rail-tabs', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const toggleCodeRailTab = useCallback((id: string) => {
    setCodeRailTabs((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem('allternit-code-rail-tabs', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const recentItems = useMemo(() => {
    const list: {
      id: string;
      title: string;
      mode: AppMode;
      icon: any;
      isActive: boolean;
      updatedAt: number;
      kind: 'chat' | 'cowork' | 'task' | 'agent' | 'browser' | 'code';
      status: 'active' | 'completed' | 'archived';
      sessionId?: string | null;
    }[] = [];

    // Chat sessions
    (chatSessions || []).forEach(s => {
      const isAgent = (s.metadata as Record<string, unknown> | undefined)?.sessionMode === 'agent';
      list.push({
        id: s.id,
        title: s.name || 'Untitled Session',
        mode: 'chat',
        icon: isAgent ? Robot : ChatTeardropText,
        isActive: activeChatSessionId === s.id && activeViewType === 'chat',
        updatedAt: new Date(s.updatedAt || 0).getTime(),
        kind: isAgent ? 'agent' : 'chat',
        status: 'active',
        sessionId: s.id,
      });
    });

    // Code sessions
    (codeSessions || []).forEach(s => {
      list.push({
        id: s.id,
        title: s.name || 'Untitled Code Session',
        mode: 'code',
        icon: Cpu,
        isActive: activeCodeSessionId === s.id && activeViewType === 'code',
        updatedAt: new Date(s.updatedAt || 0).getTime(),
        kind: 'code',
        status: 'active',
        sessionId: s.id,
      });
    });

    // Cowork sessions (skip ones already surfaced through a bound task)
    const taskBoundSessionIds = new Set(
      (coworkStore.tasks || []).map((t) => t.sessionId).filter(Boolean),
    );
    (coworkSessions || []).forEach(s => {
      if (taskBoundSessionIds.has(s.id)) return;
      const isAgent = (s.metadata as Record<string, unknown> | undefined)?.sessionMode === 'agent';
      list.push({
        id: s.id,
        title: s.name || 'Untitled Cowork Session',
        mode: 'cowork',
        icon: isAgent ? Robot : UsersThree,
        isActive: activeCoworkSessionId === s.id && activeViewType === 'workspace',
        updatedAt: new Date(s.updatedAt || 0).getTime(),
        kind: 'cowork',
        status: 'active',
        sessionId: s.id,
      });
    });

    // Cowork tasks
    (coworkStore.tasks || []).forEach(t => {
      const status = t.status === 'completed' ? 'completed' : t.status === 'archived' ? 'archived' : 'active';
      list.push({
        id: t.id,
        title: t.title || 'Untitled Task',
        mode: 'cowork',
        icon: t.mode === 'agent' ? Robot : CheckSquare,
        isActive: coworkStore.activeTaskId === t.id && activeViewType === 'workspace',
        updatedAt: new Date(t.updatedAt || t.createdAt || 0).getTime(),
        kind: t.mode === 'agent' ? 'agent' : 'task',
        status,
        sessionId: t.sessionId,
      });
    });

    // Browser agent sessions (ACI session store — the only recents shown in ACI mode)
    (browserAgentSessions || []).forEach(s => {
      list.push({
        id: s.id,
        title: s.task || 'Untitled Browser Run',
        mode: 'browser',
        icon: Globe,
        isActive: s.sessionId != null && s.sessionId === aciSessionId,
        updatedAt: Number(s.createdAt || 0),
        kind: 'browser',
        status: s.status === 'completed' ? 'completed' : 'active',
        sessionId: s.id,
      });
    });

    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [chatSessions, activeChatSessionId, codeSessions, activeCodeSessionId, coworkSessions, activeCoworkSessionId, coworkStore.tasks, coworkStore.activeTaskId, browserAgentSessions, aciSessionId, activeViewType]);

  const filteredRecentItems = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // ACI (browser) mode recents come exclusively from the ACI session store;
    // other modes show the merged cross-mode recents.
    const base = mode === 'browser'
      ? recentItems.filter((item) => item.mode === 'browser')
      : recentItems;

    const filtered = base.filter((item) => {
      // The ACI panel has no type filter; ignore typeFilter there so a value
      // set in another mode can't blank the list.
      if (mode !== 'browser' && typeFilter !== 'all' && item.kind !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (dateFilter !== 'all') {
        const date = new Date(item.updatedAt);
        if (dateFilter === 'today' && date < now) return false;
        if (dateFilter === 'week' && date < weekAgo) return false;
        if (dateFilter === 'month' && date < monthAgo) return false;
      }
      return true;
    });

    // Cross-mode recents stay capped; the ACI list is bounded by the store
    // itself (PAGE_AGENT_SESSION_LIMIT) so it is shown in full.
    return mode === 'browser' ? filtered : filtered.slice(0, 15);
  }, [recentItems, typeFilter, statusFilter, dateFilter, mode]);

  // Code-mode recents: filter, sort, and group code sessions only
  const codeProjectOptions = useMemo(() => {
    const set = new Set<string>();
    (codeSessions || []).forEach((s) => {
      if (s.metadata?.projectId) set.add(s.metadata.projectId);
    });
    return Array.from(set).sort();
  }, [codeSessions]);

  const codeEnvironmentOptions = useMemo(() => {
    const set = new Set<string>();
    (codeSessions || []).forEach((s) => {
      if (s.metadata?.workspaceId) set.add(s.metadata.workspaceId);
    });
    return Array.from(set).sort();
  }, [codeSessions]);

  const processedCodeSessions = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    let list = (codeSessions || []).filter((s) => {
      if (codeStatusFilter !== 'all') {
        const mode = s.metadata?.sessionMode ?? 'regular';
        if (codeStatusFilter === 'agent' && mode !== 'agent') return false;
        if (codeStatusFilter === 'regular' && mode !== 'regular') return false;
      }
      if (codeProjectFilter !== 'all' && s.metadata?.projectId !== codeProjectFilter) return false;
      if (codeEnvironmentFilter !== 'all' && s.metadata?.workspaceId !== codeEnvironmentFilter) return false;
      if (codeDateFilter !== 'all') {
        const date = new Date(s.updatedAt || 0);
        if (codeDateFilter === 'today' && date < now) return false;
        if (codeDateFilter === 'week' && date < weekAgo) return false;
        if (codeDateFilter === 'month' && date < monthAgo) return false;
      }
      return true;
    });

    list = list.slice().sort((a, b) => {
      if (codeSortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (codeSortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    if (codeGroupBy === 'none') return [{ key: 'All', items: list }];

    const groups: Record<string, ModeSession[]> = {};
    list.forEach((s) => {
      let key = 'Other';
      if (codeGroupBy === 'date') key = groupKeyForDate(new Date(s.updatedAt || 0).getTime());
      else if (codeGroupBy === 'status') key = s.metadata?.sessionMode === 'agent' ? 'Agent' : 'Regular';
      else if (codeGroupBy === 'project') key = s.metadata?.projectId || 'No project';
      else if (codeGroupBy === 'environment') key = s.metadata?.workspaceId || 'No environment';
      groups[key] = groups[key] ?? [];
      groups[key].push(s);
    });

    return Object.entries(groups).map(([key, items]) => ({ key, items }));
  }, [
    codeSessions,
    codeStatusFilter,
    codeProjectFilter,
    codeEnvironmentFilter,
    codeDateFilter,
    codeGroupBy,
    codeSortBy,
  ]);

  const openNativeSessionSurface = useCallback((session: NativeSession): void => {
    const descriptor = getAgentSessionDescriptor(session.metadata);
    const originSurface = descriptor.originSurface || 'chat';

    setActiveNativeSession(session.id);

    if (originSurface === 'code') {
      useCodeSessionStore.getState().setActiveSession(session.id);
    } else if (originSurface === 'cowork') {
      useCoworkSessionStore.getState().setActiveSession(session.id);
    } else if (originSurface === 'browser') {
      useChatSessionStore.getState().setActiveSession(session.id);
    } else {
      useChatSessionStore.getState().setActiveSession(session.id);
    }
    if (descriptor.agentId) {
      setSelectedSurfaceAgent(originSurface, descriptor.agentId);
    }

    if (originSurface === 'browser') {
      onOpen?.('browser');
      return;
    }

    if (originSurface === 'code') {
      onModeChange?.('code');
      onOpen?.('code');
    } else if (originSurface === 'cowork') {
      onModeChange?.('cowork');
      onOpen?.('workspace');
    } else {
      onModeChange?.('chat');
      onOpen?.('chat');
    }
  }, [
    onModeChange,
    onOpen,
    setActiveNativeSession,
    setSelectedSurfaceAgent,
  ]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    const { id, kind } = deleteTarget;
    if (kind === 'chat' || kind === 'agent') {
      useChatSessionStore.getState().deleteSession(id);
    } else if (kind === 'cowork') {
      useCoworkSessionStore.getState().deleteSession(id);
    } else if (kind === 'code') {
      useCodeSessionStore.getState().deleteSession(id);
    } else if (kind === 'task') {
      useCoworkStore.getState().deleteTask(id);
    } else if (kind === 'browser') {
      useBrowserAgentStore.getState().deletePageAgentSession?.(id);
    }
    setDeleteTarget(null);
  }, [deleteTarget]);

  const isCodeMode = mode === 'code';

  if (isCollapsed) return null;

  if (sessionOnlyId) {
    const session = codeSessions.find((item) => item.id === sessionOnlyId);
    return (
      <div className="size-full flex flex-col bg-[var(--shell-rail-bg)] overflow-hidden">
        <div className="h-11 shrink-0" />
        <div className="px-3 pt-3">
          <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--shell-item-muted)]">Code session</div>
          <button type="button" onClick={() => session && openNativeSessionSurface(session)} className="mt-2 flex w-full items-center gap-2.5 rounded-xl border-none bg-[var(--shell-item-active-bg)] px-3 py-2.5 text-left text-[var(--shell-item-active-fg)] cursor-pointer">
            <TerminalWindow size={15} weight="fill" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{session?.name || 'Session'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="size-full flex flex-col bg-[var(--shell-rail-bg)] relative overflow-hidden outline-none"
      style={{
        /* Mode-aware CSS custom properties scoped to this rail */
        ['--shell-item-active-bg' as string]: `color-mix(in srgb, ${surfaceTheme?.accent ?? 'var(--accent-primary)'} 16%, var(--surface-panel))`,
        ['--shell-item-active-fg' as string]: surfaceTheme?.accent ?? 'var(--accent-primary)',
        ['--accent-primary' as string]: surfaceTheme?.accent ?? 'var(--accent-primary)',
      }}
    >
      {/* SPACER FOR FIXED CONTROLS */}
      <div style={{ height: 44 }} />

      {/* SEGMENTED SWITCHER [ Home | Code | Browser ] */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex p-0.5 bg-[var(--surface-hover)] rounded-xl gap-0.5 border border-solid border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => {
              onModeChange?.('chat');
              onOpen?.('chat');
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border-none text-[11px] font-bold cursor-pointer transition-all duration-200",
              mode === 'chat'
                ? "bg-[var(--bg-primary)] text-[var(--accent-primary)] shadow-[var(--shadow-sm)]"
                : "bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)]"
            )}
          >
            <House size={13} weight={mode === 'chat' ? "fill" : "bold"} />
            Home
          </button>
          <button
            type="button"
            onClick={() => {
              onModeChange?.('code');
              onOpen?.('code');
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border-none text-[11px] font-bold cursor-pointer transition-all duration-200",
              mode === 'code'
                ? "bg-[var(--bg-primary)] text-[var(--accent-primary)] shadow-[var(--shadow-sm)]"
                : "bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)]"
            )}
          >
            <TerminalWindow size={13} weight={mode === 'code' ? "fill" : "bold"} />
            Code
          </button>
          <button
            type="button"
            onClick={() => {
              onModeChange?.('browser');
              onOpen?.('browser');
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border-none text-[11px] font-bold cursor-pointer transition-all duration-200",
              mode === 'browser'
                ? "bg-[var(--bg-primary)] text-[var(--accent-primary)] shadow-[var(--shadow-sm)]"
                : "bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)]"
            )}
          >
            <Globe size={13} weight={mode === 'browser' ? "fill" : "bold"} />
            ACI
          </button>
        </div>
      </div>

      {/* NEW BUTTON */}
      <div className="px-3 pb-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (mode === 'browser') {
              onModeChange?.('browser');
              onOpen?.('browser');
            } else if (isCodeMode) {
              useCodeSessionStore.getState().setActiveSession(null);
              onOpen?.('code');
            } else {
              chatStore.setActiveThread(null);
              useChatSessionStore.getState().setActiveSession(null);
              onOpen?.('chat');
            }
          }}
          className="w-full flex items-center gap-2 py-1.5 px-3 rounded-xl border-none bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] text-[var(--shell-item-fg)] font-semibold cursor-pointer text-left transition-colors"
        >
          <Plus size={16} weight="bold" className="text-[var(--accent-primary)]" />
          <span className="text-[12px]">{mode === 'browser' ? 'New Session' : isCodeMode ? 'New Thread' : 'New'}</span>
        </button>
      </div>

      {/* SIDEBAR MAIN BODY (Browser tabs + sessions, Home tabs + recents, or Code tabs + threads) */}
      {mode === 'browser' ? (
        <>
          {/* BROWSER TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            {browserRailTabs['mini-apps-store'] && (
              <RailItem
                icon={AppWindow}
                label="Mini-apps Store"
                isActive={activeViewType === 'mini-apps-store'}
                onClick={() => onOpen?.('mini-apps-store')}
              />
            )}
            {browserRailTabs['browser-extensions'] && (
              <RailItem
                icon={PuzzlePiece}
                label="Office & Extensions"
                isActive={activeViewType === 'browser-extensions'}
                onClick={() => onOpen?.('browser-extensions')}
              />
            )}
            <MoreDropdown
              tabs={[
                { id: 'mini-apps-store', label: 'Mini-apps Store', icon: AppWindow, visible: browserRailTabs['mini-apps-store'] },
                { id: 'browser-extensions', label: 'Office & Extensions', icon: PuzzlePiece, visible: browserRailTabs['browser-extensions'] },
              ]}
              onToggle={toggleBrowserRailTab}
              onCustomize={() => onOpenCustomize?.()}
              onOpenDesign={() => onModeChange?.('design')}
              onOpenAppsExtensions={() => onOpen?.('apps-extensions')}
            />
          </div>

          {/* BROWSER PINNED MINI-APPS */}
          {pinnedMiniApps.length > 0 && (
            <>
              <div className="px-3 py-2 flex items-center text-[var(--shell-item-muted)] text-[12px] font-extrabold uppercase tracking-[0.08em] select-none">
                <span>Mini-apps</span>
              </div>
              <div className="shrink-0 max-h-[180px] overflow-y-auto px-2 flex flex-col gap-0.5">
                {pinnedMiniApps.map((app) => (
                  <PinnedMiniAppItem
                    key={app.id}
                    app={app}
                    isActive={activeViewType === app.surface?.viewType}
                    onOpen={() => {
                      const viewType = app.surface?.viewType ?? 'mini-app';
                      const context = viewType === 'mini-app'
                        ? { url: app.surface?.url ?? app.url, name: app.name, category: app.category, version: app.version }
                        : undefined;
                      onOpen?.(viewType, context);
                    }}
                    onUnpin={() => unpinMiniApp(app.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* BROWSER RECENTS — ACI sessions only (from the ACI session store) */}
          <RecentsPanel
            expanded={recentsExpanded}
            onToggle={() => setRecentsExpanded((v) => !v)}
            title="Recents"
            openAllTitle="Open all recents"
            onOpenAll={() => onOpen?.('recents')}
            filter={
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="size-6 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-colors"
                    title="Filter recents"
                  >
                    <SlidersHorizontal size={13} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-56 p-3 bg-[var(--surface-panel)] border-[var(--border-subtle)] shadow-[var(--shadow-lg)] z-[200]"
                  side="bottom"
                  align="end"
                  sideOffset={6}
                  collisionPadding={12}
                >
                  <div className="flex flex-col gap-3">
                    <FilterRow label="Status" value={statusFilter === 'all' ? 'All' : statusFilter}>
                      <div className="flex flex-col gap-0.5">
                        {(['all', 'active', 'completed', 'archived'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                              "text-left px-2 py-1.5 rounded-md text-[12px] capitalize transition-colors",
                              statusFilter === s ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
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
                              "text-left px-2 py-1.5 rounded-md text-[12px] transition-colors",
                              dateFilter === d ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                            )}
                          >
                            {d === 'week' ? 'Last 7 days' : d === 'month' ? 'Last 30 days' : d === 'all' ? 'All' : 'Today'}
                          </button>
                        ))}
                      </div>
                    </FilterRow>
                  </div>
                </PopoverContent>
              </Popover>
            }
          >
            {filteredRecentItems.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-[var(--shell-item-muted)] text-center">
                No recent items match your filters
              </div>
            )}
            {filteredRecentItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative w-full flex items-center gap-2.5 py-1.5 px-3 rounded-xl cursor-pointer transition-all duration-200 font-medium",
                    item.isActive
                      ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold"
                      : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (item.mode === 'chat' || item.mode === 'code') {
                        const session = item.mode === 'code'
                          ? codeSessions.find(s => s.id === item.id)
                          : chatSessions.find(s => s.id === item.id);
                        if (session) openNativeSessionSurface(session);
                      } else if (item.kind === 'cowork') {
                        useCoworkSessionStore.getState().setActiveSession(item.id);
                        onModeChange?.('cowork');
                        onOpen?.('workspace');
                      } else if (item.mode === 'cowork') {
                        coworkStore.setActiveTask(item.id);
                        const coworkTask = coworkStore.tasks.find(t => t.id === item.id);
                        useCoworkSessionStore.getState().setActiveSession(coworkTask?.sessionId ?? null);
                        onModeChange?.('cowork');
                        onOpen?.('workspace');
                      } else if (item.mode === 'browser') {
                        onModeChange?.('browser');
                        onOpen?.('browser');
                      }
                    }}
                    className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium"
                  >
                    <IconComponent size={15} weight={item.isActive ? 'fill' : 'bold'} />
                    <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{item.title}</span>
                  </button>
                  <RecentItemMenu
                    onDelete={() => setDeleteTarget({ id: item.id, title: item.title, kind: item.kind })}
                  />
                </div>
              );
            })}
          </RecentsPanel>
        </>
      ) : !isCodeMode ? (
        <>
          {/* HOME TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            <RailItem
              icon={Robot}
              label="Agent Hub"
              isActive={activeViewType === 'agent-hub'}
              onClick={() => onOpen?.('agent-hub')}
            />
            <RailItem
              icon={FolderOpen}
              label="Projects"
              isActive={activeViewType === 'project' && !chatStore.activeProjectId}
              onClick={() => {
                useChatStore.getState().setActiveProject(null);
                window.dispatchEvent(new CustomEvent('allternit:projects-reset'));
                onOpen?.('project');
              }}
            />
            <RailItem
              icon={FileText}
              label="Artifacts Library"
              isActive={activeViewType === 'library'}
              onClick={() => onOpen?.('library')}
            />
            <RailItem
              icon={Clock}
              label="Automation Tasks"
              isActive={activeViewType === 'goals-list' || activeViewType === 'cron' || activeViewType === 'cowork-cron'}
              onClick={() => onOpen?.('goals-list')}
            />
            <div className="relative">
              <RailItem
                icon={Target}
                label="Dispatch"
                isActive={activeViewType === 'dispatch'}
                onClick={() => onOpen?.('dispatch')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-[var(--surface-hover)] text-[var(--shell-item-muted)] text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-solid border-[var(--border-subtle)]">
                Beta
              </span>
            </div>
            <RailItem
              icon={SlidersHorizontal}
              label="Customize"
              isActive={false}
              onClick={() => onOpenCustomize?.()}
            />
          </div>

          {/* HOME RECENTS */}
          <RecentsPanel
            expanded={recentsExpanded}
            onToggle={() => setRecentsExpanded((v) => !v)}
            title="Recents"
            openAllTitle="Open all recents"
            onOpenAll={() => onOpen?.('recents')}
            filter={
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="size-6 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-colors"
                    title="Filter recents"
                  >
                    <SlidersHorizontal size={13} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-56 p-3 bg-[var(--surface-panel)] border-[var(--border-subtle)] shadow-[var(--shadow-lg)] z-[200]"
                  side="bottom"
                  align="end"
                  sideOffset={6}
                  collisionPadding={12}
                >
                  <div className="flex flex-col gap-3">
                    <FilterRow label="Type" value={typeFilter === 'all' ? 'All' : typeFilter}>
                      <div className="flex flex-col gap-0.5">
                        {(['all', 'chat', 'cowork', 'task', 'agent', 'browser', 'code'] as const).map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setTypeFilter(k)}
                            className={cn(
                              "text-left px-2 py-1.5 rounded-md text-[12px] capitalize transition-colors",
                              typeFilter === k ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                            )}
                          >
                            {k}
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
                              "text-left px-2 py-1.5 rounded-md text-[12px] capitalize transition-colors",
                              statusFilter === s ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
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
                              "text-left px-2 py-1.5 rounded-md text-[12px] transition-colors",
                              dateFilter === d ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                            )}
                          >
                            {d === 'week' ? 'Last 7 days' : d === 'month' ? 'Last 30 days' : d === 'all' ? 'All' : 'Today'}
                          </button>
                        ))}
                      </div>
                    </FilterRow>
                  </div>
                </PopoverContent>
              </Popover>
            }
          >
            {filteredRecentItems.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-[var(--shell-item-muted)] text-center">
                No recent items match your filters
              </div>
            )}
            {filteredRecentItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative w-full flex items-center gap-2.5 py-1.5 px-3 rounded-xl cursor-pointer transition-all duration-200 font-medium",
                    item.isActive
                      ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold"
                      : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (item.mode === 'chat' || item.mode === 'code') {
                        const session = item.mode === 'code'
                          ? codeSessions.find(s => s.id === item.id)
                          : chatSessions.find(s => s.id === item.id);
                        if (session) openNativeSessionSurface(session);
                      } else if (item.kind === 'cowork') {
                        useCoworkSessionStore.getState().setActiveSession(item.id);
                        onModeChange?.('cowork');
                        onOpen?.('workspace');
                      } else if (item.mode === 'cowork') {
                        coworkStore.setActiveTask(item.id);
                        const coworkTask = coworkStore.tasks.find(t => t.id === item.id);
                        useCoworkSessionStore.getState().setActiveSession(coworkTask?.sessionId ?? null);
                        onModeChange?.('cowork');
                        onOpen?.('workspace');
                      } else if (item.mode === 'browser') {
                        onModeChange?.('browser');
                        onOpen?.('browser');
                      }
                    }}
                    className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium"
                  >
                    <IconComponent size={15} weight={item.isActive ? 'fill' : 'bold'} />
                    <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{item.title}</span>
                  </button>
                  <RecentItemMenu
                    onDelete={() => setDeleteTarget({ id: item.id, title: item.title, kind: item.kind })}
                  />
                </div>
              );
            })}
          </RecentsPanel>
        </>
      ) : (
        <>
          {/* CODE TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            {codeRailTabs['agent-hub'] && (
              <RailItem
                icon={Robot}
                label="Agent Hub"
                isActive={activeViewType === 'agent-hub'}
                onClick={() => onOpen?.('agent-hub')}
              />
            )}
            {codeRailTabs['projects'] && (
              <RailItem
                icon={FolderOpen}
                label="Projects"
                isActive={activeViewType === 'project' && !chatStore.activeProjectId}
                onClick={() => {
                  useChatStore.getState().setActiveProject(null);
                  window.dispatchEvent(new CustomEvent('allternit:projects-reset'));
                  onOpen?.('project');
                }}
              />
            )}
            {codeRailTabs['artifacts-library'] && (
              <RailItem
                icon={FileText}
                label="Artifacts Library"
                isActive={activeViewType === 'library'}
                onClick={() => onOpen?.('library')}
              />
            )}
            {codeRailTabs['code-automations'] && (
              <RailItem
                icon={Clock}
                label="Automation Tasks"
                isActive={activeViewType === 'code-automations'}
                onClick={() => onOpen?.('code-automations')}
              />
            )}
            <MoreDropdown
              tabs={[
                { id: 'agent-hub', label: 'Agent Hub', icon: Robot, visible: codeRailTabs['agent-hub'] },
                { id: 'projects', label: 'Projects', icon: FolderOpen, visible: codeRailTabs['projects'] },
                { id: 'artifacts-library', label: 'Artifacts Library', icon: FileText, visible: codeRailTabs['artifacts-library'] },
                { id: 'code-automations', label: 'Automation Tasks', icon: Clock, visible: codeRailTabs['code-automations'] },
              ]}
              onToggle={toggleCodeRailTab}
              onCustomize={() => onOpenCustomize?.()}
              onOpenDesign={() => onModeChange?.('design')}
              onOpenAppsExtensions={() => onOpen?.('apps-extensions')}
            />
          </div>

          {/* CODE RECENTS */}
          <RecentsPanel
            expanded={codeRecentsExpanded}
            onToggle={() => setCodeRecentsExpanded((v) => !v)}
            title="Recents"
            openAllTitle="Open all code recents"
            onOpenAll={() => onOpen?.('code-threads')}
            filter={
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="size-6 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-colors"
                    title="Filter recents"
                  >
                    <SlidersHorizontal size={13} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-56 p-3 bg-[var(--surface-panel)] border-[var(--border-subtle)] shadow-[var(--shadow-lg)] z-[200]"
                  side="bottom"
                  align="end"
                  sideOffset={6}
                  collisionPadding={12}
                >
                  <div className="flex flex-col gap-3">
                    <FilterRow label="Status" value={codeStatusFilter === 'all' ? 'All' : codeStatusFilter}>
                      <div className="flex flex-col gap-0.5">
                        {(['all', 'regular', 'agent'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCodeStatusFilter(s)}
                            className={cn(
                              "text-left px-2 py-1.5 rounded-md text-[12px] capitalize transition-colors",
                              codeStatusFilter === s ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </FilterRow>
                    <FilterRow label="Project" value={codeProjectFilter === 'all' ? 'All' : codeProjectFilter}>
                      <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => setCodeProjectFilter('all')}
                          className={cn(
                            "text-left px-2 py-1.5 rounded-md text-[12px] transition-colors",
                            codeProjectFilter === 'all' ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                          )}
                        >
                          All
                        </button>
                        {codeProjectOptions.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCodeProjectFilter(p)}
                            className={cn(
                              "text-left px-2 py-1.5 rounded-md text-[12px] transition-colors truncate",
                              codeProjectFilter === p ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                            )}
                            title={p}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </FilterRow>
                    <FilterRow label="Environment" value={codeEnvironmentFilter === 'all' ? 'All' : codeEnvironmentFilter}>
                      <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => setCodeEnvironmentFilter('all')}
                          className={cn(
                            "text-left px-2 py-1.5 rounded-md text-[12px] transition-colors",
                            codeEnvironmentFilter === 'all' ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                          )}
                        >
                          All
                        </button>
                        {codeEnvironmentOptions.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => setCodeEnvironmentFilter(e)}
                            className={cn(
                              "text-left px-2 py-1.5 rounded-md text-[12px] transition-colors truncate",
                              codeEnvironmentFilter === e ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                            )}
                            title={e}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </FilterRow>
                    <FilterRow label="Last activity" value={codeDateFilter === 'all' ? 'All' : codeDateFilter}>
                      <div className="flex flex-col gap-0.5">
                        {(['all', 'today', 'week', 'month'] as const).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setCodeDateFilter(d)}
                            className={cn(
                              "text-left px-2 py-1.5 rounded-md text-[12px] transition-colors",
                              codeDateFilter === d ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                            )}
                          >
                            {d === 'week' ? 'Last 7 days' : d === 'month' ? 'Last 30 days' : d === 'all' ? 'All' : 'Today'}
                          </button>
                        ))}
                      </div>
                    </FilterRow>
                    <FilterRow label="Group by" value={codeGroupBy === 'none' ? 'None' : codeGroupBy}>
                      <div className="flex flex-col gap-0.5">
                        {(['none', 'date', 'status', 'project', 'environment'] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setCodeGroupBy(g)}
                            className={cn(
                              "text-left px-2 py-1.5 rounded-md text-[12px] capitalize transition-colors",
                              codeGroupBy === g ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                            )}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </FilterRow>
                    <FilterRow label="Sort by" value={codeSortBy === 'lastActivity' ? 'Last activity' : codeSortBy === 'name' ? 'Name' : 'Created'}>
                      <div className="flex flex-col gap-0.5">
                        {(['lastActivity', 'name', 'created'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCodeSortBy(s)}
                            className={cn(
                              "text-left px-2 py-1.5 rounded-md text-[12px] transition-colors",
                              codeSortBy === s ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]" : "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
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
            }
          >
            {!processedCodeSessions.some((g) => g.items.length > 0) ? (
              <div className="px-3 py-4 text-[12px] text-[var(--shell-item-muted)] text-center">
                No code recents match your filters
              </div>
            ) : (
              processedCodeSessions.map((group) =>
                group.items.length > 0 ? (
                  <React.Fragment key={group.key}>
                    {codeGroupBy !== 'none' && (
                      <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--shell-item-muted)] select-none">
                        {group.key}
                      </div>
                    )}
                    {group.items.map((s) => {
                      const isActive = activeCodeSessionId === s.id;
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "group relative w-full flex items-center gap-2.5 py-1.5 px-3 rounded-xl cursor-pointer transition-all duration-200 font-medium",
                            isActive
                              ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold"
                              : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => openNativeSessionSurface(s)}
                            className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium"
                          >
                            <Cpu size={15} weight={isActive ? 'fill' : 'bold'} />
                            <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{s.name || 'Untitled Session'}</span>
                          </button>
                          <RecentItemMenu
                            onDelete={() => setDeleteTarget({ id: s.id, title: s.name || 'Untitled Session', kind: 'code' })}
                          />
                        </div>
                      );
                    })}
                  </React.Fragment>
                ) : null
              )
            )}
          </RecentsPanel>
        </>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <DeleteConfirmModal
          title={deleteTarget.kind === 'task' ? 'Delete Task?' : 'Delete Session?'}
          itemName={deleteTarget.title}
          itemType={deleteTarget.kind === 'task' ? 'task' : 'session'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* FOOTER */}
      <div className="flex flex-col border-t border-solid border-[var(--shell-divider)] bg-[var(--shell-rail-bg)] shrink-0">
        <button
          type="button"
          onClick={() => {
            onModeChange?.('design');
          }}
          className="w-full flex items-center gap-2.5 p-[10px_16px] text-[var(--shell-item-fg)] cursor-pointer hover:bg-[var(--shell-item-hover)] border-none bg-transparent font-semibold text-[13px] text-left transition-colors"
        >
          <Palette size={18} weight="bold" className="text-[var(--shell-item-muted)]" />
          <span>Design</span>
        </button>

        <div className="h-px bg-[var(--shell-divider)] w-full" />

        <div className="flex items-center p-[10px_16px] gap-2">
          <SettingsDrilldown>
            <button
              type="button"
              className="flex-1 flex items-center gap-3 border-none bg-transparent cursor-pointer text-left hover:bg-[var(--shell-item-hover)] transition-colors rounded-lg p-[6px_8px] -ml-2"
            >
              <div className="size-8 rounded-full bg-gradient-to-br from-[var(--accent-chat)] to-[var(--accent-primary)] shrink-0 flex items-center justify-center text-[var(--bg-primary)] text-[14px] font-bold">
                J
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-1.5 text-[var(--shell-item-fg)] text-[13px] font-semibold">
                <span>Joe</span>
                <span className="text-[var(--shell-item-muted)] font-normal">· Pro</span>
                <CaretDown size={12} className="text-[var(--shell-item-muted)]" />
              </div>
            </button>
          </SettingsDrilldown>
          <button
            type="button"
            onClick={() => onOpen?.('apps-extensions')}
            title="Apps & Extensions"
            className="size-8 flex items-center justify-center rounded-lg border-none bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] cursor-pointer transition-colors shrink-0"
          >
            <DownloadSimple size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RecentsPanel({
  expanded,
  onToggle,
  title,
  children,
  openAllTitle,
  onOpenAll,
  filter,
}: {
  expanded: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
  openAllTitle?: string;
  onOpenAll?: () => void;
  filter?: React.ReactNode;
}): React.ReactNode {
  return (
    <div className="flex-1 min-h-0 flex flex-col px-2">
      <div className="group px-1 py-2 flex items-center justify-between text-[var(--shell-item-muted)] text-[12px] font-extrabold uppercase tracking-[0.08em] select-none">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] cursor-pointer"
        >
          <CaretRight
            size={12}
            className={cn(
              "transition-transform duration-200",
              expanded && "rotate-90"
            )}
          />
          <span>{title}</span>
        </button>
        <div className="flex items-center gap-0.5 bg-[var(--shell-rail-bg)] pl-2 pr-1 -mr-1 rounded-md">
          {onOpenAll && (
            <button
              type="button"
              onClick={onOpenAll}
              className="opacity-0 group-hover:opacity-100 size-6 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all"
              title={openAllTitle}
            >
              <ArrowSquareOut size={13} />
            </button>
          )}
          {filter}
        </div>
      </div>
      {expanded && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function RailItem({ id, icon: Icon, label, isActive, onClick }: {
  id?: string;
  icon: Icon;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}): React.ReactNode {
  return (
    <button type="button"
      onClick={onClick}
      data-rail-item={id}
      className={cn(
        "w-full flex items-center gap-2.5 py-1.5 px-3 rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium",
        isActive
          ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold"
          : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
      )}
    >
      {Icon && <Icon size={15} weight={isActive ? 'fill' : 'bold'} />}
      <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{label}</span>
    </button>
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
      <div className="flex items-center justify-between text-[11px] text-[var(--shell-item-muted)] px-1">
        <span>{label}</span>
        <span className="capitalize">{value}</span>
      </div>
      {children}
    </div>
  );
}

function RecentItemMenu({ onDelete }: { onDelete: () => void }): React.ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 size-6 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all shrink-0"
          title="More"
        >
          <DotsThreeVertical size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-40 p-1.5 bg-[var(--surface-panel)] border-[var(--border-subtle)]"
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={8}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => { setOpen(false); onDelete(); }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-[var(--status-error)] hover:bg-[var(--shell-danger-soft-bg)] border-none bg-transparent cursor-pointer text-left transition-colors"
        >
          <Trash size={14} />
          Delete
        </button>
      </PopoverContent>
    </Popover>
  );
}

function PinnedMiniAppItem({ app, isActive, onOpen, onUnpin }: {
  app: InstalledMiniApp;
  isActive?: boolean;
  onOpen: () => void;
  onUnpin: () => void;
}): React.ReactNode {
  const [hovered, setHovered] = useState(false);
  const AppIcon = (MINI_APP_CATEGORY_ICONS[app.category] ?? AppWindow) as Icon;
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button type="button"
        onClick={onOpen}
        data-rail-item={app.id}
        className={cn(
          "w-full flex items-center gap-2.5 py-1.5 px-3 rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium pr-8",
          isActive
            ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold"
            : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
        )}
      >
        <AppIcon size={15} weight={isActive ? 'fill' : 'bold'} />
        <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{app.name}</span>
      </button>
      {hovered && (
        <button type="button"
          onClick={(e) => { e.stopPropagation(); onUnpin(); }}
          title="Unpin from rail"
          className="absolute right-2 size-5 flex items-center justify-center rounded border-none bg-transparent cursor-pointer text-[var(--shell-item-muted)] hover:text-[var(--status-error)] transition-colors"
        >
          <PushPinSlash size={12} />
        </button>
      )}
    </div>
  );
}

interface MoreDropdownTab {
  id: string;
  label: string;
  icon: Icon;
  visible: boolean;
}

function MoreDropdown({
  tabs,
  onToggle,
  onCustomize,
  onOpenDesign,
  onOpenAppsExtensions,
}: {
  tabs: MoreDropdownTab[];
  onToggle: (id: string) => void;
  onCustomize: () => void;
  onOpenDesign: () => void;
  onOpenAppsExtensions: () => void;
}): React.ReactNode {
  const [open, setOpen] = useState(false);
  const anyHidden = tabs.some((t) => !t.visible);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative z-10 w-full flex items-center gap-2.5 py-1.5 px-3 rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium",
            anyHidden
              ? "bg-[var(--shell-item-hover)] text-[var(--accent-primary)]"
              : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
          )}
        >
          <span className="relative shrink-0">
            <SlidersHorizontal size={15} weight="bold" />
            {anyHidden && (
              <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[var(--accent-primary)]" />
            )}
          </span>
          <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">More</span>
          <CaretDown size={12} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2 bg-[var(--surface-panel)] border-[var(--border-subtle)] z-[100]"
        side="bottom"
        align="start"
        sideOffset={4}
        collisionPadding={8}
        style={{ zIndex: 100 }}
      >
        <div className="flex flex-col gap-0.5">
          <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--shell-item-muted)]">
            Show in rail
          </div>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onToggle(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border-none bg-transparent cursor-pointer text-left text-[12px] transition-colors",
                  tab.visible
                    ? "text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                    : "text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
                )}
              >
                <span className={cn(
                  "size-4 rounded border border-solid flex items-center justify-center shrink-0",
                  tab.visible
                    ? "bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--bg-primary)]"
                    : "border-[var(--shell-item-muted)] bg-transparent"
                )}>
                  {tab.visible && <Check size={10} weight="bold" />}
                </span>
                <Icon size={14} className="shrink-0" />
                <span className="flex-1 min-w-0 truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="h-px bg-[var(--shell-divider)] my-2" />

        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => { setOpen(false); onCustomize(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border-none bg-transparent cursor-pointer text-left text-[12px] text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] transition-colors"
          >
            <SlidersHorizontal size={14} />
            <span>Customize shellrail</span>
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onOpenDesign(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border-none bg-transparent cursor-pointer text-left text-[12px] text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] transition-colors"
          >
            <Palette size={14} />
            <span>Design</span>
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onOpenAppsExtensions(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border-none bg-transparent cursor-pointer text-left text-[12px] text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] transition-colors"
          >
            <DownloadSimple size={14} />
            <span>Apps & Extensions</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
