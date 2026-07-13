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
  Sparkle,
  Cpu,
  CheckSquare,
  GraduationCap,
  BookOpen,
  AppWindow,
  Plugs,
  Globe,
  PushPinSlash,
  Palette,
  House,
  TerminalWindow,
  FileText,
  CalendarCheck,
  Clock,
  ArrowsClockwise,
  FolderOpen,
  DownloadSimple,
  SlidersHorizontal,
  Plus,
  Target,
  ArrowSquareOut,
  Trash,
  DotsThreeVertical,
} from '@phosphor-icons/react';
import { getPinnedMiniApps, unpinMiniApp, seedDefaultMiniApps } from '../views/aci/mini-app-registry';
import type { InstalledMiniApp } from '../views/aci/mini-app.types';
import { useChatStore } from '../views/chat/ChatStore';

import { useCoworkStore } from '../views/cowork/CoworkStore';
import { useCodeModeStore } from '../views/code/CodeModeStore';
import { RAIL_CONFIG, type RailConfigSection } from './rail/rail.config';
import { COWORK_RAIL_CONFIG } from './rail/cowork.config';
import { CODE_RAIL_CONFIG } from './rail/code.config';
import { DESIGN_RAIL_CONFIG } from './rail/design.config';
import { BROWSER_RAIL_CONFIG } from './rail/browser.config';
import { useFeaturePlugins } from '../plugins/useFeaturePlugins';


import { ProjectRailSection, type UnifiedProject, type UnifiedItem } from './rail/ProjectRailSection';
import { useSurfaceAgentModeEnabled } from '../lib/agents/surface-agent-context';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { useBrowserStore } from '../capsules/browser/browser.store';
import { useBrowserAgentStore } from '../capsules/browser/browserAgent.store';
import { useCodeSessionStore } from '../views/code/CodeSessionStore';
import { useCoworkSessionStore } from '../views/cowork/CoworkSessionStore';
import type { ModeSession } from '../lib/agents/mode-session-store';

type NativeSession = ModeSession;  // For backward compatibility
import {
  formatAgentSessionMetaLabel,
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

interface ShellRailProps {
  activeViewType?: string;
  onOpen?: (view: string) => void;
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
  const activeChatSessionId = useStoreWithEqualityFn(useChatSessionStore, (s) => s.activeSessionId);
  const activeCodeSessionId = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.activeSessionId);
  const setActiveChatSession = useStoreWithEqualityFn(useChatSessionStore, (s) => s.setActiveSession);
  const setActiveCodeSession = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.setActiveSession);
  const setActiveNativeSession = mode === 'code' ? setActiveCodeSession : setActiveChatSession;
  
  // Cowork Store
  const coworkStore = useCoworkStore();
  
  const setSelectedSurfaceAgent = useStoreWithEqualityFn(useAgentSurfaceModeStore, (s) => s.setSelectedAgent);

  const browserAgentSessions = useBrowserAgentStore((state) => state.pageAgentSessions);

  const [recentsExpanded, setRecentsExpanded] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'chat' | 'task' | 'agent' | 'browser' | 'code'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; kind: string } | null>(null);

  const recentItems = useMemo(() => {
    const list: {
      id: string;
      title: string;
      mode: AppMode;
      icon: any;
      isActive: boolean;
      updatedAt: number;
      kind: 'chat' | 'task' | 'agent' | 'browser' | 'code';
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

    // Browser agent sessions
    (browserAgentSessions || []).forEach(s => {
      list.push({
        id: s.id,
        title: s.task || 'Untitled Browser Run',
        mode: 'browser',
        icon: Globe,
        isActive: activeViewType === 'browser',
        updatedAt: Number(s.createdAt || 0),
        kind: 'browser',
        status: 'active',
        sessionId: s.id,
      });
    });

    return list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 15);
  }, [chatSessions, activeChatSessionId, codeSessions, activeCodeSessionId, coworkStore.tasks, coworkStore.activeTaskId, browserAgentSessions, activeViewType]);

  const filteredRecentItems = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return recentItems.filter((item) => {
      if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (dateFilter !== 'all') {
        const date = new Date(item.updatedAt);
        if (dateFilter === 'today' && date < now) return false;
        if (dateFilter === 'week' && date < weekAgo) return false;
        if (dateFilter === 'month' && date < monthAgo) return false;
      }
      return true;
    });
  }, [recentItems, typeFilter, statusFilter, dateFilter]);

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

      {/* SEGMENTED SWITCHER [ Home | Code ] */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex p-0.5 bg-[var(--surface-hover)] rounded-xl gap-0.5 border border-solid border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => {
              onModeChange?.('chat');
              onOpen?.('chat');
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border-none text-[12px] font-bold cursor-pointer transition-all duration-200",
              !isCodeMode
                ? "bg-[var(--bg-primary)] text-[var(--accent-primary)] shadow-[var(--shadow-sm)]"
                : "bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)]"
            )}
          >
            <House size={14} weight={!isCodeMode ? "fill" : "bold"} />
            Home
          </button>
          <button
            type="button"
            onClick={() => {
              onModeChange?.('code');
              onOpen?.('code');
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border-none text-[12px] font-bold cursor-pointer transition-all duration-200",
              isCodeMode
                ? "bg-[var(--bg-primary)] text-[var(--accent-primary)] shadow-[var(--shadow-sm)]"
                : "bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)]"
            )}
          >
            <TerminalWindow size={14} weight={isCodeMode ? "fill" : "bold"} />
            Code
          </button>
        </div>
      </div>

      {/* NEW BUTTON */}
      <div className="px-3 pb-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (isCodeMode) {
              useCodeSessionStore.getState().setActiveSession(null);
              onOpen?.('code');
            } else {
              chatStore.setActiveThread(null);
              useChatSessionStore.getState().setActiveSession(null);
              onOpen?.('chat');
            }
          }}
          className="w-full flex items-center gap-2 p-[9px_12px] rounded-xl border-none bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] text-[var(--shell-item-fg)] font-semibold cursor-pointer text-left transition-colors"
        >
          <Plus size={16} weight="bold" className="text-[var(--accent-primary)]" />
          <span className="text-[13px]">{isCodeMode ? 'New Thread' : 'New'}</span>
        </button>
      </div>

      {/* SIDEBAR MAIN BODY (Home tabs + recents, or Code tabs + threads) */}
      {!isCodeMode ? (
        <>
          {/* HOME TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            <RailItem
              icon={FolderOpen}
              label="Projects"
              isActive={activeViewType === 'project' && !chatStore.activeProjectId}
              onClick={() => {
                useChatStore.getState().setActiveProject(null);
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
              icon={GraduationCap}
              label="A://Labs"
              isActive={activeViewType === 'labs'}
              onClick={() => onOpen?.('labs')}
            />
            <RailItem
              icon={Robot}
              label="Agent Hub"
              isActive={activeViewType === 'agent-hub'}
              onClick={() => onOpen?.('agent-hub')}
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

          {/* HOME RECENTS HEADER */}
          <div className="px-3 py-2 flex items-center justify-between text-[var(--shell-item-muted)] text-[12px] font-extrabold uppercase tracking-[0.08em] select-none">
            <button
              type="button"
              onClick={() => setRecentsExpanded((v) => !v)}
              className="flex items-center gap-1.5 bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] cursor-pointer"
            >
              <CaretRight
                size={12}
                className={cn(
                  "transition-transform duration-200",
                  recentsExpanded && "rotate-90"
                )}
              />
              <span>Recents</span>
            </button>
            <div className="flex items-center gap-0.5">
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
                  className="w-56 p-3 bg-[var(--surface-panel)] border-[var(--border-subtle)]"
                  side="bottom"
                  align="end"
                  sideOffset={6}
                  collisionPadding={12}
                >
                  <div className="flex flex-col gap-3">
                    <FilterRow label="Type" value={typeFilter === 'all' ? 'All' : typeFilter}>
                      <div className="flex flex-col gap-0.5">
                        {(['all', 'chat', 'task', 'agent', 'browser', 'code'] as const).map((k) => (
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
              <button
                type="button"
                onClick={() => onOpen?.('chats-and-tasks')}
                className="size-6 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-colors"
                title="Open all recents"
              >
                <ArrowSquareOut size={13} />
              </button>
            </div>
          </div>

          {/* HOME RECENTS LIST */}
          {recentsExpanded && (
            <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-0.5">
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
                      "group relative w-full flex items-center gap-2.5 p-[9px_12px] rounded-xl cursor-pointer transition-all duration-200 font-medium",
                      item.isActive
                        ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-bold shadow-[var(--shadow-sm)]"
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
                      <IconComponent size={18} weight={item.isActive ? 'fill' : 'bold'} />
                      <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{item.title}</span>
                    </button>
                    <RecentItemMenu
                      onDelete={() => setDeleteTarget({ id: item.id, title: item.title, kind: item.kind })}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* CODE TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            <RailItem
              icon={Robot}
              label="Agent Hub"
              isActive={activeViewType === 'agent-hub'}
              onClick={() => onOpen?.('agent-hub')}
            />
            <RailItem
              icon={CalendarCheck}
              label="Cron"
              isActive={activeViewType === 'code-automations'}
              onClick={() => onOpen?.('code-automations')}
            />
          </div>

          {/* CODE THREADS HEADER */}
          <div className="px-4 py-2 flex items-center justify-between text-[var(--shell-item-muted)] text-[12px] font-extrabold uppercase tracking-[0.08em] select-none">
            <span>Threads</span>
          </div>

          {/* CODE THREADS LIST */}
          <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-0.5">
            {codeSessions.map((s) => {
              const isActive = activeCodeSessionId === s.id;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "group relative w-full flex items-center gap-2.5 p-[9px_12px] rounded-xl cursor-pointer transition-all duration-200 font-medium",
                    isActive
                      ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-bold shadow-[var(--shadow-sm)]"
                      : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openNativeSessionSurface(s)}
                    className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium"
                  >
                    <Cpu size={18} weight={isActive ? 'fill' : 'bold'} />
                    <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{s.name || 'Untitled Session'}</span>
                  </button>
                  <RecentItemMenu
                    onDelete={() => setDeleteTarget({ id: s.id, title: s.name || 'Untitled Session', kind: 'code' })}
                  />
                </div>
              );
            })}
          </div>
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
            onOpen?.('design');
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
            onClick={() => onOpen?.('promotion')}
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
        "w-full flex items-center gap-2.5 p-[9px_12px] rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium",
        isActive
          ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-bold shadow-[var(--shadow-sm)]"
          : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
      )}
    >
      {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} />}
      <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{label}</span>
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
          "w-full flex items-center gap-2.5 p-[9px_12px] rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium pr-8",
          isActive
            ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-bold shadow-[var(--shadow-sm)]"
            : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
        )}
      >
        <AppIcon size={18} weight={isActive ? 'fill' : 'bold'} />
        <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{app.name}</span>
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
