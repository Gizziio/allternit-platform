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
  Brain,
  Play,
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
import { useDesignSessionStore } from '../views/design/DesignSessionStore';
import type { ModeSession } from '../lib/agents/mode-session-store';

type NativeSession = ModeSession;  // For backward compatibility
import {
  getAgentSessionDescriptor,
} from '../lib/agents/session-metadata';
import { useAgentSurfaceModeStore } from '../stores/agent-surface-mode.store';

import { getCurrentUserProfile } from '@/lib/design/current-user';
import { SettingsDrilldown } from './SettingsDrilldown';
import { getAgentModeSurfaceTheme } from '../views/chat/agentModeSurfaceTheme';
import type { AgentModeSurface } from '../stores/agent-surface-mode.store';
import { cn } from '@/lib/utils';
import { BOT_TEMPLATES } from '@/lib/bots/bots.manifest';
import { getBotIcon } from '@/lib/bots/bot-icons';
import { useStartBotSession } from '@/lib/bots/useStartBotSession';
import { useAgentStore } from '@/lib/agents/agent.store';
import { useCommRailsUnreadCount } from '@/lib/bots/comrails-mail.store';
import {
  getBotAccentColor,
  getBotDisplayName,
  getBotTagline,
  isBot,
} from '@/lib/bots/bot-profile';
import type { Agent } from '@/lib/agents/agent.types';
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

const MINI_APP_ID_ICONS: Record<string, Icon> = {
  'second-brain': Brain,
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

  // The account footer used to show a hardcoded "Joe · Pro" placeholder that
  // never reflected a real signed-in identity. /api/v1/me is backend-resolved
  // and accurate in every auth mode (real Clerk session, desktop bootstrap,
  // or local-dev-bypass), unlike the Clerk-only hooks used elsewhere in
  // Settings, which report signed-out in self-hosted/no-Clerk-key builds.
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getCurrentUserProfile()
      .then((profile) => {
        if (!cancelled) setCurrentUserDisplayName(profile.name || profile.email || null);
      })
      .catch(() => {
        if (!cancelled) setCurrentUserDisplayName(null);
      });
    return () => { cancelled = true; };
  }, []);
  const accountInitial = (currentUserDisplayName ?? '?').trim().charAt(0).toUpperCase() || '?';

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
  const activeChatThreadId = useChatStore((s) => s.activeThreadId);
  const pinnedMiniApps = usePinnedMiniApps();

  // The "New" rail button should only look active when the user is on an
  // empty surface for that mode (no active session/thread selected).
  const isNewActive =
    mode === 'browser'
      ? activeViewType === 'browser' && !aciSessionId
      : mode === 'code'
        ? activeViewType === 'code' && !activeCodeSessionId
        : activeViewType === 'chat' && !activeChatSessionId && !activeChatThreadId;

  const [recentsExpanded, setRecentsExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem('allternit:rail:bots-expanded') !== 'true';
    } catch {
      return true;
    }
  });
  const [botsExpanded, setBotsExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('allternit:rail:bots-expanded') === 'true';
    } catch {
      return false;
    }
  });
  const [startingBotId, setStartingBotId] = useState<string | null>(null);
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
    const defaults = { 'mini-apps-store': true, 'browser-extensions': true, 'site-apis': true };
    if (typeof window === 'undefined') return defaults;
    try {
      const saved = JSON.parse(localStorage.getItem('allternit-browser-rail-tabs') ?? '{}');
      return { ...defaults, ...saved };
    } catch {
      return defaults;
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

  const { startSession: startBotSession } = useStartBotSession(
    useCallback((sessionId: string) => {
      // Open the bot session view so the rail entry is tied to a real session,
      // not a generic home chat.
      onOpen?.('chat-agent-session', { sessionId, originView: activeViewType ?? 'chat' });
    }, [onOpen, activeViewType])
  );

  const agents = useAgentStore((s) => s.agents);
  const bots = useMemo(() => agents.filter(isBot), [agents]);

  const handleSelectBots = useCallback(() => {
    setBotsExpanded(true);
    setRecentsExpanded(false);
    try { localStorage.setItem('allternit:rail:bots-expanded', 'true'); } catch {}
  }, []);

  const handleSelectRecents = useCallback(() => {
    setRecentsExpanded(true);
    setBotsExpanded(false);
    try { localStorage.setItem('allternit:rail:bots-expanded', 'false'); } catch {}
  }, []);

  const handleToggleExpanded = useCallback(() => {
    if (botsExpanded) {
      setBotsExpanded((v) => !v);
    } else {
      setRecentsExpanded((v) => !v);
    }
  }, [botsExpanded]);

  const handleCreateBot = useCallback(() => {
    onOpen?.('agent-hub');
  }, [onOpen]);

  const handleStartBot = useCallback(async (bot: Agent) => {
    setStartingBotId(bot.id);
    try {
      await startBotSession(bot);
      // Bind this bot as the chat surface's selected agent so the composer
      // shows the bot pill and the mode dock for switching execution modes.
      useAgentSurfaceModeStore.getState().setSelectedAgent('chat', bot.id);
    } finally {
      setStartingBotId(null);
    }
  }, [startBotSession]);

  const handleOpenBotHome = useCallback((bot: Agent) => {
    onOpen?.('bot-home', { botId: bot.id });
  }, [onOpen]);

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

    const botIds = new Set(bots.map((b) => b.id));
    const botNames = new Set(bots.map((b) => b.name.toLowerCase()));

    const isAgentSession = (md?: Record<string, unknown>) =>
      md?.isBot === true ||
      md?.agentId != null ||
      md?.agent_id != null ||
      (md?.agentName && botNames.has(String(md.agentName).toLowerCase()));

    // Chat sessions (agent/bot sessions live under the Bots panel or Agent | Bot Hub, not Recents)
    (chatSessions || []).forEach(s => {
      const md = s.metadata as Record<string, unknown> | undefined;
      if (isAgentSession(md)) return;
      const isAgent = md?.sessionMode === 'agent';
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

    // Code sessions (agent/bot sessions live under the Bots panel or Agent | Bot Hub, not Recents)
    (codeSessions || []).forEach(s => {
      const md = s.metadata as Record<string, unknown> | undefined;
      if (isAgentSession(md)) return;
      const isAgent = md?.sessionMode === 'agent';
      list.push({
        id: s.id,
        title: s.name || 'Untitled Code Session',
        mode: 'code',
        icon: isAgent ? Robot : Cpu,
        isActive: activeCodeSessionId === s.id && activeViewType === 'code',
        updatedAt: new Date(s.updatedAt || 0).getTime(),
        kind: isAgent ? 'agent' : 'code',
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
  }, [chatSessions, activeChatSessionId, codeSessions, activeCodeSessionId, coworkSessions, activeCoworkSessionId, coworkStore.tasks, coworkStore.activeTaskId, browserAgentSessions, aciSessionId, activeViewType, bots]);

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
      : mode === 'code'
        ? recentItems.filter((item) => item.mode === 'code')
        : recentItems.filter((item) => item.mode === 'chat' || item.mode === 'cowork');

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
    } else if (originSurface === 'design') {
      useDesignSessionStore.getState().setActiveSession(session.id);
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

    const defaultViews: Record<Exclude<typeof originSurface, 'browser'>, string> = {
      chat: 'chat',
      cowork: 'workspace',
      code: 'code',
      design: 'design',
    };
    const defaultView = defaultViews[originSurface] ?? 'chat';
    const isAgent = descriptor.sessionMode === 'agent';
    const targetView = isAgent ? `${originSurface}-agent-session` : defaultView;
    onModeChange?.(originSurface === 'design' ? 'design' : originSurface === 'cowork' ? 'cowork' : originSurface === 'code' ? 'code' : 'chat');
    onOpen?.(targetView, isAgent ? {
      sessionId: session.id,
      originView: defaultView,
    } : undefined);
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
          <button type="button" onClick={() => session && openNativeSessionSurface(session)} className="mt-2 flex w-full items-center gap-2.5 rounded-xl border-none bg-[var(--shell-item-active-bg)] px-3 py-2.5 max-md:min-h-11 text-left text-[var(--shell-item-active-fg)] cursor-pointer">
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
              "flex-1 flex items-center justify-center gap-1 py-1.5 max-md:min-h-11 rounded-lg border-none text-[11px] font-bold cursor-pointer transition-all duration-200",
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
              "flex-1 flex items-center justify-center gap-1 py-1.5 max-md:min-h-11 rounded-lg border-none text-[11px] font-bold cursor-pointer transition-all duration-200",
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
              "flex-1 flex items-center justify-center gap-1 py-1.5 max-md:min-h-11 rounded-lg border-none text-[11px] font-bold cursor-pointer transition-all duration-200",
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
      <div className="px-2 pb-2 shrink-0">
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
          className={cn(
            "group w-full flex items-center gap-2 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none cursor-pointer text-left transition-colors font-semibold",
            isNewActive
              ? "bg-[var(--surface-active)] text-[var(--shell-item-active-fg)]"
              : "bg-transparent text-[var(--shell-item-fg)] hover:bg-[var(--surface-hover)] hover:text-[var(--shell-item-active-fg)]"
          )}
        >
          <Plus size={16} weight="bold" className={isNewActive ? "text-[var(--accent-primary)]" : "text-[var(--shell-item-muted)] group-hover:text-[var(--accent-primary)] transition-colors"} />
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
            {browserRailTabs['site-apis'] && (
              <RailItem
                icon={Plugs}
                label="Site APIs"
                isActive={activeViewType === 'site-apis'}
                onClick={() => onOpen?.('site-apis')}
              />
            )}
            <MoreDropdown
              tabs={[
                { id: 'mini-apps-store', label: 'Mini-apps Store', icon: AppWindow, visible: browserRailTabs['mini-apps-store'] },
                { id: 'browser-extensions', label: 'Office & Extensions', icon: PuzzlePiece, visible: browserRailTabs['browser-extensions'] },
                { id: 'site-apis', label: 'Site APIs', icon: Plugs, visible: browserRailTabs['site-apis'] },
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
                    className="size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-colors"
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
            {filteredRecentItems.map((item) => (
              <RecentRailItem
                key={item.id}
                item={item}
                onClick={() => {
                  if (item.mode === 'chat' || item.mode === 'code') {
                    const session = item.mode === 'code'
                      ? codeSessions.find(s => s.id === item.id)
                      : chatSessions.find(s => s.id === item.id);
                    if (session) openNativeSessionSurface(session);
                  } else if (item.kind === 'cowork') {
                    const sessionId = item.id;
                    useCoworkSessionStore.getState().setActiveSession(sessionId);
                    const session = coworkSessions.find(s => s.id === sessionId);
                    const isAgent = session?.metadata?.sessionMode === 'agent';
                    onModeChange?.('cowork');
                    onOpen?.(isAgent ? 'cowork-agent-session' : 'workspace', isAgent ? { sessionId, originView: 'workspace' } : undefined);
                  } else if (item.mode === 'cowork') {
                    coworkStore.setActiveTask(item.id);
                    const coworkTask = coworkStore.tasks.find(t => t.id === item.id);
                    const sessionId = coworkTask?.sessionId ?? null;
                    useCoworkSessionStore.getState().setActiveSession(sessionId);
                    const session = sessionId ? coworkSessions.find(s => s.id === sessionId) : null;
                    const isAgent = session?.metadata?.sessionMode === 'agent' || coworkTask?.mode === 'agent';
                    onModeChange?.('cowork');
                    onOpen?.(isAgent ? 'cowork-agent-session' : 'workspace', isAgent ? { sessionId, originView: 'workspace' } : undefined);
                  } else if (item.mode === 'browser') {
                    onModeChange?.('browser');
                    onOpen?.('browser');
                  }
                }}
                onDelete={() => setDeleteTarget({ id: item.id, title: item.title, kind: item.kind })}
              />
            ))}
          </RecentsPanel>
        </>
      ) : !isCodeMode ? (
        <>
          {/* HOME TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            <RailItem
              icon={Robot}
              label="Agent | Bot Hub"
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
              icon={Cpu}
              label="Model Lab"
              isActive={activeViewType === 'model-lab'}
              onClick={() => onOpen?.('model-lab')}
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

        {/* HOME RECENTS + BOTS */}
          <RecentsPanel
            expanded={recentsExpanded}
            onToggle={handleSelectRecents}
            title="Recents"
            openAllTitle="Open all recents"
            onOpenAll={() => onOpen?.('recents')}
            botsExpanded={botsExpanded}
            onBotsToggle={handleSelectBots}
            onToggleExpanded={handleToggleExpanded}
            bots={bots}
            startingBotId={startingBotId}
            onStartBot={handleStartBot}
            onOpenBotHome={handleOpenBotHome}
            onCreateBot={handleCreateBot}
            filter={
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-colors"
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
            {filteredRecentItems.map((item) => (
              <RecentRailItem
                key={item.id}
                item={item}
                onClick={() => {
                  if (item.mode === 'chat' || item.mode === 'code') {
                    const session = item.mode === 'code'
                      ? codeSessions.find(s => s.id === item.id)
                      : chatSessions.find(s => s.id === item.id);
                    if (session) openNativeSessionSurface(session);
                  } else if (item.kind === 'cowork') {
                    const sessionId = item.id;
                    useCoworkSessionStore.getState().setActiveSession(sessionId);
                    const session = coworkSessions.find(s => s.id === sessionId);
                    const isAgent = session?.metadata?.sessionMode === 'agent';
                    onModeChange?.('cowork');
                    onOpen?.(isAgent ? 'cowork-agent-session' : 'workspace', isAgent ? { sessionId, originView: 'workspace' } : undefined);
                  } else if (item.mode === 'cowork') {
                    coworkStore.setActiveTask(item.id);
                    const coworkTask = coworkStore.tasks.find(t => t.id === item.id);
                    const sessionId = coworkTask?.sessionId ?? null;
                    useCoworkSessionStore.getState().setActiveSession(sessionId);
                    const session = sessionId ? coworkSessions.find(s => s.id === sessionId) : null;
                    const isAgent = session?.metadata?.sessionMode === 'agent' || coworkTask?.mode === 'agent';
                    onModeChange?.('cowork');
                    onOpen?.(isAgent ? 'cowork-agent-session' : 'workspace', isAgent ? { sessionId, originView: 'workspace' } : undefined);
                  } else if (item.mode === 'browser') {
                    onModeChange?.('browser');
                    onOpen?.('browser');
                  }
                }}
                onDelete={() => setDeleteTarget({ id: item.id, title: item.title, kind: item.kind })}
              />
            ))}
          </RecentsPanel>
        </>
      ) : (
        <>
          {/* CODE TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            {codeRailTabs['agent-hub'] && (
              <RailItem
                icon={Robot}
                label="Agent | Bot Hub"
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
                { id: 'agent-hub', label: 'Agent | Bot Hub', icon: Robot, visible: codeRailTabs['agent-hub'] },
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
                    className="size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-colors"
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
                            "group relative w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl cursor-pointer transition-all duration-200 font-medium",
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
                {accountInitial}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-1.5 text-[var(--shell-item-fg)] text-[13px] font-semibold">
                <span className="truncate">{currentUserDisplayName ?? 'Account'}</span>
                <CaretDown size={12} className="text-[var(--shell-item-muted)] shrink-0" />
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

function formatRelativeTime(ts: number): string {
  if (!ts || Number.isNaN(ts)) return '';
  const now = Date.now();
  const diff = now - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getLastMessagePreview(messages?: Array<{ role: string; content: string }>, maxLength = 28): string {
  if (!messages || messages.length === 0) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m) continue;
    const text = (m.content || '').trim();
    if (!text) continue;
    if (text.length > maxLength) return `${text.slice(0, maxLength)}…`;
    return text;
  }
  return '';
}

interface SessionSummary {
  lastMessage: string;
  lastMessageAt: number;
  isStreaming: boolean;
  unread: number;
}

function useSessionSummary(sessionId?: string | null): SessionSummary {
  return useStoreWithEqualityFn(
    useChatSessionStore,
    useCallback(
      (state) => {
        if (!sessionId) {
          return { lastMessage: '', lastMessageAt: 0, isStreaming: false, unread: 0 };
        }
        const session = state.sessions.find((s) => s.id === sessionId);
        const streaming = state.streamingBySession[sessionId]?.isStreaming ?? false;
        const unread = state.unreadCounts[sessionId] || 0;
        if (!session) {
          return { lastMessage: '', lastMessageAt: 0, isStreaming: streaming, unread };
        }
        return {
          lastMessage: getLastMessagePreview(session.messages),
          lastMessageAt: new Date(session.updatedAt || 0).getTime(),
          isStreaming: streaming,
          unread,
        };
      },
      [sessionId]
    ),
    shallow
  );
}

function RecentRailItem({
  item,
  onClick,
  onDelete,
}: {
  item: {
    id: string;
    title: string;
    mode: AppMode;
    icon: any;
    isActive: boolean;
    updatedAt: number;
    kind: 'chat' | 'cowork' | 'task' | 'agent' | 'browser' | 'code';
    status: 'active' | 'completed' | 'archived';
    sessionId?: string | null;
  };
  onClick: () => void;
  onDelete: () => void;
}): React.ReactNode {
  const IconComponent = item.icon;
  const sessionSummary = useSessionSummary(
    item.sessionId && (item.mode === 'chat' || item.kind === 'agent') ? item.sessionId : null
  );
  const { lastMessage, isStreaming, unread } = sessionSummary;
  const hasUnread = unread > 0;
  const isDone = item.status === 'completed' || (!isStreaming && lastMessage && !hasUnread);
  const timeText = item.updatedAt ? formatRelativeTime(item.updatedAt) : '';

  return (
    <div
      className={cn(
        "group relative w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl cursor-pointer transition-all duration-200 font-medium",
        item.isActive
          ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold"
          : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium"
      >
        <div className="relative shrink-0">
          <IconComponent size={15} weight={item.isActive ? 'fill' : 'bold'} />
          {isStreaming && (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--accent-primary)] border border-[var(--shell-rail-bg)]" />
          )}
          {!isStreaming && hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--accent-primary)] border border-[var(--shell-rail-bg)]" />
          )}
          {!isStreaming && !hasUnread && isDone && (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--status-success)] border border-[var(--shell-rail-bg)]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
            {item.title}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--shell-item-muted)] overflow-hidden">
            {isStreaming && (
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-primary)] opacity-75" />
                <span className="relative inline-flex rounded-full size-1.5 bg-[var(--accent-primary)]" />
              </span>
            )}
            <span className="truncate flex-1">{isStreaming ? 'Working…' : lastMessage || ''}</span>
            {timeText && <span className="shrink-0 text-[10px] opacity-60">{timeText}</span>}
          </div>
        </div>
      </button>
      <RecentItemMenu onDelete={onDelete} />
    </div>
  );
}

function BotMailBadge({ botId }: { botId: string }): React.ReactNode | null {
  const unread = useCommRailsUnreadCount(botId);
  if (unread <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]">
      {unread > 99 ? '99+' : unread}
    </span>
  );
}

function BotRailItem({
  id,
  name,
  accentColor,
  isStarting,
  badge,
  onClick,
  onStart,
}: {
  id: string;
  name: string;
  accentColor: string;
  isStarting: boolean;
  badge?: React.ReactNode;
  onClick: () => void;
  onStart: (e: React.MouseEvent) => void;
}): React.ReactNode {
  const sessionId = useStoreWithEqualityFn(
    useChatSessionStore,
    useCallback(
      (state) => {
        const session = state.sessions
          .filter((s) => s.metadata?.agentId === id)
          .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0];
        return session?.id ?? null;
      },
      [id]
    ),
    shallow
  );
  const sessionSummary = useSessionSummary(sessionId);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const { lastMessage, lastMessageAt, isStreaming } = sessionSummary;
  const statusText = isStarting
    ? 'Starting…'
    : isStreaming
    ? 'Working…'
    : lastMessage || '';
  const timeText = !isStarting && !isStreaming && lastMessageAt ? formatRelativeTime(lastMessageAt) : '';

  return (
    <div
      data-rail-item={id}
      className="group w-full flex items-center gap-0.5 py-1.5 px-2 max-md:min-h-11 rounded-xl transition-all duration-200 font-medium bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
    >
      <button
        type="button"
        disabled={isStarting}
        onClick={onClick}
        className="flex flex-1 min-w-0 items-center gap-2.5 border-none bg-transparent p-0 text-left cursor-pointer font-medium text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] disabled:opacity-50"
      >
        <div
          className="flex shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
          style={{
            width: 24,
            height: 24,
            background: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
            color: accentColor,
            border: `1.5px solid ${accentColor}40`,
          }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center text-[12px] overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="truncate">{name}</span>
            {badge}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--shell-item-muted)] overflow-hidden">
            {isStreaming && (
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-primary)] opacity-75" />
                <span className="relative inline-flex rounded-full size-1.5 bg-[var(--accent-primary)]" />
              </span>
            )}
            <span className="truncate flex-1">{statusText}</span>
            {timeText && <span className="shrink-0 text-[10px] opacity-60">{timeText}</span>}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onStart}
        disabled={isStarting}
        className="opacity-0 group-hover:opacity-100 shrink-0 rounded-md p-1 text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] disabled:opacity-50 transition-opacity border-none bg-transparent cursor-pointer"
        title="Start session"
      >
        <Play size={12} weight="fill" />
      </button>
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
  botsExpanded,
  onBotsToggle,
  onToggleExpanded,
  bots,
  startingBotId,
  onStartBot,
  onOpenBotHome,
  onCreateBot,
}: {
  expanded: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
  openAllTitle?: string;
  onOpenAll?: () => void;
  filter?: React.ReactNode;
  botsExpanded?: boolean;
  onBotsToggle?: () => void;
  onToggleExpanded?: () => void;
  bots?: Agent[];
  startingBotId?: string | null;
  onStartBot?: (bot: Agent) => void;
  onOpenBotHome?: (bot: Agent) => void;
  onCreateBot?: () => void;
}): React.ReactNode {
  const combined = botsExpanded !== undefined && onBotsToggle && bots && onStartBot && onOpenBotHome && onCreateBot;
  const listExpanded = expanded || (combined && botsExpanded);
  return (
    <div className="flex-1 min-h-0 flex flex-col px-2">
      <div className="group px-1 py-2 flex items-center justify-between text-[var(--shell-item-muted)] text-[12px] font-extrabold uppercase tracking-[0.08em] select-none">
        {combined ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBotsToggle}
              className={cn(
                "bg-transparent border-none cursor-pointer transition-colors",
                botsExpanded ? "text-[var(--shell-item-fg)]" : "text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)]"
              )}
            >
              <span>Bots</span>
            </button>
            <span className="text-[var(--shell-item-muted)]" aria-hidden="true">|</span>
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                "bg-transparent border-none cursor-pointer transition-colors",
                expanded ? "text-[var(--shell-item-fg)]" : "text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)]"
              )}
            >
              <span>{title}</span>
            </button>
          </div>
        ) : (
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
        )}
        <div className="flex items-center gap-0.5 bg-[var(--shell-rail-bg)] pl-2 pr-1 -mr-1 rounded-md">
          {combined && (
            <button
              type="button"
              onClick={onCreateBot}
              className="opacity-0 max-md:opacity-100 group-hover:opacity-100 size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all"
              title="Create Bot"
            >
              <Plus size={13} />
            </button>
          )}
          {onOpenAll && (
            <button
              type="button"
              onClick={onOpenAll}
              className="opacity-0 max-md:opacity-100 group-hover:opacity-100 size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all"
              title={openAllTitle}
            >
              <ArrowSquareOut size={13} />
            </button>
          )}
          {filter}
          <button
            type="button"
            onClick={onToggleExpanded ?? onToggle}
            className="size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-colors"
            title={listExpanded ? 'Hide sessions' : 'Show sessions'}
          >
            {listExpanded ? (
              <CaretDown size={12} className="transition-transform duration-200" />
            ) : (
              <CaretRight size={12} className="transition-transform duration-200" />
            )}
          </button>
        </div>
      </div>
      {listExpanded && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5">
          {combined && botsExpanded && (
            <div className="flex flex-col gap-0.5 pb-2">
              {bots.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-[var(--shell-item-muted)]">
                  No bots yet.
                </div>
              )}
              {bots.map((bot) => {
                const displayName = getBotDisplayName(bot);
                const accentColor = getBotAccentColor(bot) ?? 'var(--accent-primary)';
                const isStarting = startingBotId === bot.id;
                return (
                  <BotRailItem
                    key={bot.id}
                    id={bot.id}
                    name={displayName}
                    accentColor={accentColor}
                    isStarting={isStarting}
                    badge={<BotMailBadge botId={bot.id} />}
                    onClick={() => onOpenBotHome(bot)}
                    onStart={(e) => {
                      e.stopPropagation();
                      onStartBot(bot);
                    }}
                  />
                );
              })}
            </div>
          )}
          {expanded && <div className="flex flex-col gap-0.5">{children}</div>}
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
        "w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium",
        isActive
          ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold shadow-[inset_3px_0_0_0_var(--shell-item-active-fg)]"
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
          className="opacity-0 max-md:opacity-100 group-hover:opacity-100 size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all shrink-0"
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
  const AppIcon = (MINI_APP_ID_ICONS[app.id] ?? MINI_APP_CATEGORY_ICONS[app.category] ?? AppWindow) as Icon;
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
          "w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium pr-8",
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
