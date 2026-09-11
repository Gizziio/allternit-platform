import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { useSettingsValue } from '@/hooks/useSettingsState';
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
  Users,
  AppWindow,
  Plugs,
  PuzzlePiece,
  Globe,
  PushPin,
  PushPinSlash,
  PencilSimple,
  MagnifyingGlass,
  X,
  Palette,
  House,
  TerminalWindow,
  FileText,
  Clock,
  FolderOpen,
  DownloadSimple,
  SlidersHorizontal,
  Plus,
  ArrowSquareOut,
  Trash,
  DotsThreeVertical,
  Check,
  Brain,
  DesktopTower,
  Record,
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
import { useAgentStore, getVisibleAttention, type BotAttentionEntry } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';
import {
  isBot,
  getBotDisplayName,
} from '@/lib/bots/bot-profile';
import { useAgentsWithSwarms } from '@/lib/agents';
import { deriveBotPresence, type BotPresenceState } from '@/lib/bots/bot-presence';
import { useBotHasNewActivity } from '@/lib/bots/bot-activity-watermark';
import { useBotRosterStore } from '@/lib/bots/bot-roster.store';
import { useBotRoutineStore } from '@/lib/bots/bot-routine.service';
import { useCommRailsMailStore } from '@/lib/bots/commrails-mail.store';
import { useCommRailSections } from '@/lib/bots/use-commrail-sections';
import { useBotStatus } from '@/lib/bots/bot-operational-state.store';
import { openBotCanonicalChat, openBotChatView } from '@/lib/bots/bot-canonical-chat.service';
import { useGroupChatStore } from '@/lib/bots/group-chat.store';
import type { GroupChat } from '@/lib/bots/group-chat.types';
import { useStartBotSession } from '@/lib/bots/useStartBotSession';
import { BotAvatar } from '@/views/bots/BotAvatar';
import { GroupChatAvatar } from '@/views/bots/GroupChatAvatar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { openNativeSessionPicker } from '@/components/native-sessions/NativeSessionPicker';
import { NativeSourceBadge } from '@/components/native-sessions/NativeOriginBanner';
import { sourceRefFromMetadata } from '@/lib/agents/native-sessions-api';

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

interface RailRecentItem {
  id: string;
  title: string;
  mode: AppMode;
  icon: any;
  isActive: boolean;
  updatedAt: number;
  kind: 'chat' | 'cowork' | 'task' | 'agent' | 'browser' | 'code';
  status: 'active' | 'completed' | 'archived';
  sessionId?: string | null;
}

interface PinnedRailEntry {
  id: string;
  kind: RailRecentItem['kind'];
  mode: AppMode;
  pinnedAt: number;
}

const HOME_TAB_VIEWS = ['agent-hub', 'project', 'library', 'model-lab', 'goals-list', 'cron', 'cowork-cron', 'fabric-session', 'remote-control'];
const CODE_TAB_VIEWS = ['agent-hub', 'project', 'library', 'code-automations'];
const BROWSER_TAB_VIEWS = ['mini-apps-store', 'browser-extensions', 'site-apis'];
const BOT_TAB_VIEWS = ['agent-hub', 'groups-list', 'group-chat'];

// Sticky tab selection: a clicked tab keeps its highlight when sub-navigation
// moves the active view off the exact tab view (e.g. Bot Hub starting a bot
// session, Automation Tasks navigating to the cron view). Only tab clicks
// call selectTab — recents/session rows never change it.
function useStickyTab(currentView: string | undefined, tabViews: string[]): {
  isTabActive: (view: string) => boolean;
  selectTab: (view: string) => void;
} {
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const isTabActive = useCallback(
    (view: string) => {
      if (currentView === view) return true;
      return (
        lastSelected === view &&
        currentView != null &&
        !tabViews.includes(currentView)
      );
    },
    [currentView, lastSelected, tabViews],
  );
  const selectTab = useCallback((view: string) => setLastSelected(view), []);
  return { isTabActive, selectTab };
}

function NewRailButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}): React.ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full flex items-center gap-2 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none cursor-pointer text-left transition-colors font-semibold",
        isActive
          ? "bg-[var(--surface-active)] text-[var(--shell-item-active-fg)]"
          : "bg-transparent text-[var(--shell-item-fg)] hover:bg-[var(--surface-hover)] hover:text-[var(--shell-item-active-fg)]"
      )}
    >
      <Plus size={16} weight="bold" className={isActive ? "text-[var(--accent-primary)]" : "text-[var(--shell-item-muted)] group-hover:text-[var(--accent-primary)] transition-colors"} />
      <span className="text-[12px]">{label}</span>
    </button>
  );
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

  // Settings → Appearance → Show sidebar labels (default on). Reacts live to
  // the toggle via the settings-changed event dispatched by useSettingsState.
  const [showSidebarLabels] = useSettingsValue('appearance.showSidebarLabels', true);

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
  const accountLabel = useMemo(() => {
    const raw = (currentUserDisplayName ?? 'Account').trim();
    const at = raw.indexOf('@');
    if (at > 1) return raw.slice(0, at);
    return raw || 'Account';
  }, [currentUserDisplayName]);

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
      return window.localStorage.getItem('allternit:rail:recents-expanded') !== 'false';
    } catch {
      return true;
    }
  });
  const [typeFilter, setTypeFilter] = useState<'all' | 'chat' | 'cowork' | 'task' | 'agent' | 'browser' | 'code' | 'bb'>('all');
  const [teammatesExpanded, setTeammatesExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem('allternit:rail:teammates-expanded') !== 'false';
    } catch {
      return true;
    }
  });
  const handleToggleTeammatesExpanded = useCallback(() => {
    setTeammatesExpanded((prev) => {
      const next = !prev;
      try { window.localStorage.setItem('allternit:rail:teammates-expanded', String(next)); } catch {}
      return next;
    });
  }, []);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; kind: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // Pinned rail entries (favorites) — persisted, pruned visually when the
  // underlying session/task disappears from recentItems.
  const [pinnedEntries, setPinnedEntries] = useState<PinnedRailEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('allternit:rail:pinned');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.id === 'string') : [];
    } catch {
      return [];
    }
  });
  const [pinnedExpanded, setPinnedExpanded] = useState(true);

  // RECENTS overflow: raise the 15-row cap to 50 with in-list search (M7).
  const [recentsOverflowOpen, setRecentsOverflowOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('allternit:rail:recents-overflow') === 'true';
    } catch {
      return false;
    }
  });
  const [recentsSearch, setRecentsSearch] = useState('');

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

  const agents = useAgentStore((s) => s.agents);
  const bots = useMemo(() => agents.filter(isBot), [agents]);
  const { sections: commRailSections, visibility: commRailVisibility } =
    useCommRailSections();
  const sessionsSection = commRailSections.find((s) => s.id === 'comrails-sessions');
  const needsYouSection = commRailSections.find((s) => s.id === 'comrails-needs-you');

  // Bot-mode rail data: pinned bots (bot-roster store), canonical-chat recency
  // for ordering, and group chats with unread counts.
  const pinnedBotIds = useBotRosterStore((s) => s.pinnedBotIds);
  const canonicalChatIds = useBotRosterStore((s) => s.canonicalChatIds);
  const pinBot = useBotRosterStore((s) => s.pinBot);
  const unpinBot = useBotRosterStore((s) => s.unpinBot);
  // Drag-to-pin state (raw HTML5 DnD, same pattern as BrowserPane shortcuts).
  const [draggingBotId, setDraggingBotId] = useState<string | null>(null);
  const [pinDropActive, setPinDropActive] = useState(false);
  const groupChats = useGroupChatStore((s) => s.groups);
  const activeGroupId = useGroupChatStore((s) => s.activeGroupId);
  const getGroupUnreadCount = useGroupChatStore((s) => s.getUnreadCount);
  const setActiveGroup = useGroupChatStore((s) => s.setActiveGroup);

  const homeSticky = useStickyTab(activeViewType, HOME_TAB_VIEWS);
  const codeSticky = useStickyTab(activeViewType, CODE_TAB_VIEWS);
  const browserSticky = useStickyTab(activeViewType, BROWSER_TAB_VIEWS);
  const botSticky = useStickyTab(activeViewType, BOT_TAB_VIEWS);

  // Clicking a bot row starts (or reuses) the bot's canonical session and then
  // opens the bot-chat-session view — never the bot detail view.
  const { startSession: startBotSession, isStarting: isBotSessionStarting } = useStartBotSession(
    useCallback((startedSessionId: string, startedBotId: string) => {
      openBotChatView(startedSessionId, startedBotId, 'agent-hub');
    }, [])
  );

  const handleOpenBot = useCallback((bot: Agent) => {
    void startBotSession(bot);
  }, [startBotSession]);

  const pinnedBots = useMemo(
    () =>
      pinnedBotIds.flatMap((id) => {
        const bot = bots.find((b) => b.id === id);
        return bot ? [bot] : [];
      }),
    [pinnedBotIds, bots]
  );

  const sortedBots = useMemo(() => {
    const activityOf = (bot: Agent): number => {
      const sid = canonicalChatIds[bot.id];
      const session = sid ? (chatSessions || []).find((s) => s.id === sid) : null;
      return session ? new Date(session.updatedAt || 0).getTime() : 0;
    };
    return [...bots].sort((a, b) => {
      const aPinned = pinnedBotIds.includes(a.id) ? 0 : 1;
      const bPinned = pinnedBotIds.includes(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      const diff = activityOf(b) - activityOf(a);
      if (diff !== 0) return diff;
      return getBotDisplayName(a).localeCompare(getBotDisplayName(b));
    });
  }, [bots, pinnedBotIds, canonicalChatIds, chatSessions]);

  const sortedGroupChats = useMemo(
    () =>
      Object.values(groupChats).sort(
        (a, b) =>
          new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
      ),
    [groupChats]
  );

  const handleToggleRecentsExpanded = useCallback(() => {
    setRecentsExpanded((v) => {
      const next = !v;
      try { localStorage.setItem('allternit:rail:recents-expanded', String(next)); } catch {}
      return next;
    });
  }, []);

  const togglePinnedEntry = useCallback((item: { id: string; kind: RailRecentItem['kind']; mode: AppMode }) => {
    setPinnedEntries((prev) => {
      const exists = prev.some((p) => p.id === item.id);
      const next = exists
        ? prev.filter((p) => p.id !== item.id)
        : [...prev, { id: item.id, kind: item.kind, mode: item.mode, pinnedAt: Date.now() }];
      try { localStorage.setItem('allternit:rail:pinned', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const isPinned = useCallback((id: string) => pinnedEntries.some((p) => p.id === id), [pinnedEntries]);

  const toggleRecentsOverflow = useCallback(() => {
    setRecentsOverflowOpen((v) => {
      const next = !v;
      try { localStorage.setItem('allternit:rail:recents-overflow', String(next)); } catch {}
      return next;
    });
    setRecentsSearch('');
  }, []);

  const recentItems = useMemo(() => {
    const list: RailRecentItem[] = [];

    const botIds = new Set(bots.map((b) => b.id));
    const botNames = new Set(bots.map((b) => b.name.toLowerCase()));

    const isAgentSession = (md?: Record<string, unknown>) =>
      md?.isBot === true ||
      md?.agentId != null ||
      md?.agent_id != null ||
      (md?.agentName && botNames.has(String(md.agentName).toLowerCase()));

    // Chat sessions (bot sessions live under the Bots panel or Bot Hub, not Recents)
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

    // Code sessions (bot sessions live under the Bots panel or Bot Hub, not Recents)
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

    return filtered;
  }, [recentItems, typeFilter, statusFilter, dateFilter, mode]);

  // Pinned rows stay live by intersecting pinned ids with recentItems (status
  // dots, streaming, unread all keep working). Sorted by pinnedAt desc.
  const { pinnedVisible, pinnedOverflowCount } = useMemo(() => {
    if (pinnedEntries.length === 0) return { pinnedVisible: [] as RailRecentItem[], pinnedOverflowCount: 0 };
    const byId = new Map(recentItems.map((i) => [i.id, i]));
    const pinned = pinnedEntries
      .filter((p) => byId.has(p.id))
      .sort((a, b) => b.pinnedAt - a.pinnedAt)
      .map((p) => byId.get(p.id)!);
    return {
      pinnedVisible: pinned.slice(0, 10),
      pinnedOverflowCount: Math.max(0, pinned.length - 10),
    };
  }, [pinnedEntries, recentItems]);

  // M7: home/code recents show 15 rows plus a "More…" row; opening the
  // overflow raises the cap to 50 and enables in-list search. ACI/browser
  // mode recents stay store-bounded and untouched.
  const visibleRecentItems = useMemo(() => {
    if (mode === 'browser') return filteredRecentItems;
    if (!recentsOverflowOpen) return filteredRecentItems.slice(0, 15);
    const q = recentsSearch.trim().toLowerCase();
    const searched = q
      ? filteredRecentItems.filter((i) => i.title.toLowerCase().includes(q))
      : filteredRecentItems;
    return searched.slice(0, 50);
  }, [filteredRecentItems, recentsOverflowOpen, recentsSearch, mode]);
  const recentsOverflowCount = mode === 'browser' ? 0 : Math.max(0, filteredRecentItems.length - 15);

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
      bot: 'agent-hub',
    };
    const defaultView = defaultViews[originSurface] ?? 'chat';
    const isAgent = descriptor.sessionMode === 'agent';
    const targetView = isAgent ? `${originSurface}-agent-session` : defaultView;
    onModeChange?.(originSurface === 'design' ? 'design' : originSurface === 'cowork' ? 'cowork' : originSurface === 'code' ? 'code' : originSurface === 'bot' ? 'bot' : 'chat');
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

  // Shared "New" behavior for the rail button and the RECENTS header "+".
  const handleNewSession = useCallback(() => {
    if (mode === 'browser') {
      onModeChange?.('browser');
      onOpen?.('browser');
    } else if (mode === 'code') {
      useCodeSessionStore.getState().setActiveSession(null);
      onOpen?.('code');
    } else {
      // Canonical-chat guard (spec Phase 0): when the active session is a
      // bot's canonical chat, "New" must not spawn a blank non-bot session
      // from inside it (the Hermes analog of rerouting /new → /compact).
      // Reroute to the bot's home instead, leaving the canonical chat intact.
      const chatState = useChatSessionStore.getState();
      const activeSession = (chatState.sessions ?? []).find(
        (s) => s.id === chatState.activeSessionId,
      );
      const canonicalBotId = activeSession?.metadata?.botCanonicalFor;
      if (typeof canonicalBotId === 'string' && canonicalBotId) {
        onOpen?.('bot-home', { botId: canonicalBotId });
        return;
      }
      chatStore.setActiveThread(null);
      useChatSessionStore.getState().setActiveSession(null);
      onOpen?.('chat');
    }
  }, [mode, chatStore, onModeChange, onOpen]);

  // Same navigation as clicking a recent row — used by row clicks, the
  // context-menu "Open" item, and PINNED rows.
  const openRecentItem = useCallback((item: RailRecentItem) => {
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
  }, [codeSessions, chatSessions, coworkSessions, coworkStore, openNativeSessionSurface, onModeChange, onOpen]);

  // Context-menu rename commit, dispatched per item kind. Browser items get
  // no rename. Cowork-mode "agent" kind is ambiguous between an agent task
  // and an agent session, so it is resolved against the task list.
  const commitRename = useCallback((item: RailRecentItem, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === item.title) return;
    const task = item.mode === 'cowork' ? coworkStore.tasks.find(t => t.id === item.id) : undefined;
    if (item.kind === 'task' || task) {
      useCoworkStore.getState().renameTask(item.id, trimmed);
      return;
    }
    if (item.mode === 'cowork') {
      useCoworkSessionStore.getState().updateSession(item.id, { name: trimmed });
    } else if (item.mode === 'code') {
      useCodeSessionStore.getState().updateSession(item.id, { name: trimmed });
    } else {
      useChatSessionStore.getState().updateSession(item.id, { name: trimmed });
    }
  }, [coworkStore.tasks]);

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
            {showSidebarLabels ? 'Home' : null}
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
            {showSidebarLabels ? 'Code' : null}
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
            {showSidebarLabels ? 'ACI' : null}
          </button>
        </div>
      </div>

      {/* SIDEBAR MAIN BODY (Browser tabs + sessions, Home tabs + recents, or Code tabs + threads) */}
      {mode === 'browser' ? (
        <>
          {/* BROWSER TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            <NewRailButton
              label="New Session"
              isActive={isNewActive}
              onClick={handleNewSession}
            />
            {browserRailTabs['mini-apps-store'] && (
              <RailItem
                icon={AppWindow}
                label="Mini-apps Store"
                isActive={browserSticky.isTabActive('mini-apps-store')}
                onClick={() => {
                  browserSticky.selectTab('mini-apps-store');
                  onOpen?.('mini-apps-store');
                }}
              />
            )}
            {browserRailTabs['browser-extensions'] && (
              <RailItem
                icon={PuzzlePiece}
                label="Office & Extensions"
                isActive={browserSticky.isTabActive('browser-extensions')}
                onClick={() => {
                  browserSticky.selectTab('browser-extensions');
                  onOpen?.('browser-extensions');
                }}
              />
            )}
            {browserRailTabs['site-apis'] && (
              <RailItem
                icon={Record}
                label="Teach"
                isActive={browserSticky.isTabActive('site-apis')}
                onClick={() => {
                  browserSticky.selectTab('site-apis');
                  onOpen?.('site-apis');
                }}
              />
            )}
            <MoreDropdown
              tabs={[
                { id: 'mini-apps-store', label: 'Mini-apps Store', icon: AppWindow, visible: browserRailTabs['mini-apps-store'] },
                { id: 'browser-extensions', label: 'Office & Extensions', icon: PuzzlePiece, visible: browserRailTabs['browser-extensions'] },
                { id: 'site-apis', label: 'Teach', icon: Record, visible: browserRailTabs['site-apis'] },
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
            onAdd={handleNewSession}
            addTitle="New Session"
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
                onClick={() => openRecentItem(item)}
                onRenameCommit={item.kind === 'browser' ? undefined : commitRename}
                pinned={isPinned(item.id)}
                onPinToggle={() => togglePinnedEntry(item)}
                onUnpin={isPinned(item.id) ? () => togglePinnedEntry(item) : undefined}
                onDelete={() => setDeleteTarget({ id: item.id, title: item.title, kind: item.kind })}
              />
            ))}
          </RecentsPanel>
        </>
      ) : mode === 'bot' ? (
        <>
          {/* BOT TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            <NewRailButton
              label="New"
              isActive={isNewActive}
              onClick={handleNewSession}
            />
            <RailItem
              icon={Robot}
              label="Bot Hub"
              isActive={botSticky.isTabActive('agent-hub')}
              onClick={() => {
                botSticky.selectTab('agent-hub');
                window.dispatchEvent(
                  new CustomEvent('allternit:open-view', {
                    detail: { viewType: 'agent-hub' },
                  }),
                );
              }}
            />
            <RailItem
              id="groups-list"
              icon={Users}
              label="Groups"
              isActive={botSticky.isTabActive('groups-list') || activeViewType === 'group-chat'}
              onClick={() => {
                botSticky.selectTab('groups-list');
                onOpen?.('groups-list');
              }}
            />
          </div>

          {/* BOT PINNED — self-prunes when empty; drop zone appears while a bot
              row is being dragged so users can discover pinning */}
          {(pinnedBots.length > 0 || draggingBotId !== null) && (
            <RecentsPanel shrink expanded onToggle={() => {}} title="Pinned Bots">
              {draggingBotId !== null && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    setPinDropActive(true);
                  }}
                  onDragLeave={() => setPinDropActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const droppedId = e.dataTransfer.getData('text/plain') || draggingBotId;
                    if (droppedId) pinBot(droppedId);
                    setPinDropActive(false);
                    setDraggingBotId(null);
                  }}
                  className={cn(
                    "mx-2 mb-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-[12px] transition-colors",
                    pinDropActive
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--shell-item-hover)]"
                      : "border-[var(--border-subtle)] text-[var(--shell-item-muted)]"
                  )}
                >
                  <PushPin size={13} />
                  <span>{pinDropActive ? 'Drop to pin' : 'Drag a bot here to pin'}</span>
                </div>
              )}
              {pinnedBots.length === 0 ? (
                draggingBotId === null ? (
                  <div className="px-3 py-3 text-[12px] text-[var(--shell-item-muted)]">
                    Pin bots from the bot picker
                  </div>
                ) : null
              ) : (
                pinnedBots.map((bot) => (
                  <BotRailRow
                    key={bot.id}
                    bot={bot}
                    isActive={
                      activeViewType === 'bot-chat-session' &&
                      activeChatSessionId === canonicalChatIds[bot.id]
                    }
                    disabled={isBotSessionStarting}
                    onOpen={() => handleOpenBot(bot)}
                    onUnpin={() => unpinBot(bot.id)}
                  />
                ))
              )}
            </RecentsPanel>
          )}

          {/* BOT LIST — all bots, pinned first, then by canonical chat activity */}
          <RecentsPanel expanded onToggle={() => {}} title="Bots">
            {sortedBots.length === 0 && (
              <div className="px-3 py-3 text-[12px] text-[var(--shell-item-muted)]">
                No bots yet — create one in Bot Hub
              </div>
            )}
            {sortedBots.map((bot) => (
              <BotRailRow
                key={bot.id}
                bot={bot}
                isActive={
                  activeViewType === 'bot-chat-session' &&
                  activeChatSessionId === canonicalChatIds[bot.id]
                }
                disabled={isBotSessionStarting}
                onOpen={() => handleOpenBot(bot)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', bot.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggingBotId(bot.id);
                }}
                onDragEnd={() => {
                  setDraggingBotId(null);
                  setPinDropActive(false);
                }}
              />
            ))}
          </RecentsPanel>

          {/* GROUP CHATS — unread badge convention matches GroupsListView.
              Always rendered so the empty state and creation affordance stay discoverable */}
          <RecentsPanel shrink expanded onToggle={() => {}} title="Group Chats">
            {sortedGroupChats.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-[var(--shell-item-muted)]">
                No group chats yet
              </div>
            ) : (
              sortedGroupChats.map((group) => (
                <BotGroupRailRow
                  key={group.id}
                  group={group}
                  unread={getGroupUnreadCount(group.id)}
                  isActive={activeViewType === 'group-chat' && activeGroupId === group.id}
                  onOpen={() => {
                    setActiveGroup(group.id);
                    onOpen?.('group-chat', { groupId: group.id });
                  }}
                />
              ))
            )}
            <button
              type="button"
              onClick={() => onOpen?.('groups-list')}
              className="w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl bg-transparent border-none cursor-pointer text-left text-[12px] text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] transition-all"
            >
              <Plus size={13} />
              <span>New group chat</span>
            </button>
          </RecentsPanel>

          <RecentsPanel
            shrink
            expanded
            onToggle={() => {}}
            title="Sessions"
          >
            {(sessionsSection?.items.length ?? 0) === 0 ||
            (sessionsSection?.items.length === 1 &&
              sessionsSection.items[0]?.id === 'ao-down') ? (
              <div className="px-3 py-3 text-[12px] text-[var(--shell-item-muted)]">
                {commRailVisibility.aoRunning
                  ? 'No ao sessions'
                  : 'ao is not running'}
              </div>
            ) : (
              sessionsSection?.items.map((item) => (
                <div
                  key={item.id}
                  className="w-full flex items-center gap-2.5 py-1.5 px-3 rounded-xl text-[12px] text-[var(--shell-item-fg)]"
                >
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {item.label}
                  </span>
                  {item.status ? (
                    <span className="shrink-0 text-[11px] text-[var(--shell-item-muted)]">
                      {item.status}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </RecentsPanel>

          {(needsYouSection?.items.length ?? 0) > 0 && (
            <RecentsPanel shrink expanded onToggle={() => {}} title="Needs you">
              {needsYouSection?.items.map((item) => (
                <div
                  key={item.id}
                  className="w-full flex items-center gap-2.5 py-1.5 px-3 rounded-xl text-[12px] text-[var(--accent-primary)]"
                >
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {item.label}
                  </span>
                </div>
              ))}
            </RecentsPanel>
          )}
        </>
      ) : !isCodeMode ? (
        <>
          {/* HOME TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            <NewRailButton
              label="New"
              isActive={isNewActive}
              onClick={handleNewSession}
            />
            <RailItem
              icon={Robot}
              label="Bot Hub"
              isActive={homeSticky.isTabActive('agent-hub')}
              onClick={() => {
                homeSticky.selectTab('agent-hub');
                onOpen?.('agent-hub');
              }}
            />
            <RailItem
              icon={FolderOpen}
              label="Projects"
              isActive={homeSticky.isTabActive('project') && !chatStore.activeProjectId}
              onClick={() => {
                homeSticky.selectTab('project');
                useChatStore.getState().setActiveProject(null);
                window.dispatchEvent(new CustomEvent('allternit:projects-reset'));
                onOpen?.('project');
              }}
            />
            <RailItem
              icon={FileText}
              label="Artifacts Library"
              isActive={homeSticky.isTabActive('library')}
              onClick={() => {
                homeSticky.selectTab('library');
                onOpen?.('library');
              }}
            />
            <RailItem
              icon={Cpu}
              label="Model Lab"
              isActive={homeSticky.isTabActive('model-lab')}
              onClick={() => {
                homeSticky.selectTab('model-lab');
                onOpen?.('model-lab');
              }}
            />
            <RailItem
              icon={Clock}
              label="Automation Tasks"
              isActive={homeSticky.isTabActive('goals-list') || activeViewType === 'cron' || activeViewType === 'cowork-cron'}
              onClick={() => {
                homeSticky.selectTab('goals-list');
                onOpen?.('goals-list');
              }}
            />
            <RailItem
              icon={DesktopTower}
              label="Fabric Transport"
              isActive={homeSticky.isTabActive('fabric-session') || activeViewType === 'remote-control'}
              onClick={() => {
                homeSticky.selectTab('fabric-session');
                onOpen?.('fabric-session');
              }}
            />
            <RailItem
              icon={SlidersHorizontal}
              label="Customize"
              isActive={false}
              onClick={() => onOpenCustomize?.()}
            />
          </div>

          {/* HOME TEAMMATES — bots with presence, unread mail, or attention.
              Self-prunes to nothing when quiet (spec Phase 1). */}
          <TeammatesRailSection
            expanded={teammatesExpanded}
            onToggle={handleToggleTeammatesExpanded}
            onOpen={onOpen}
          />

          {/* HOME PINNED — self-prunes when nothing pinned remains live */}
          {pinnedVisible.length > 0 && (
            <RecentsPanel
              shrink
              expanded={pinnedExpanded}
              onToggle={() => setPinnedExpanded((v) => !v)}
              title="Pinned"
            >
              {pinnedVisible.map((item) => (
                <RecentRailItem
                  key={item.id}
                  item={item}
                  onClick={() => openRecentItem(item)}
                  onRenameCommit={item.kind === 'browser' ? undefined : commitRename}
                  pinned
                  onPinToggle={() => togglePinnedEntry(item)}
                  onUnpin={() => togglePinnedEntry(item)}
                  onDelete={() => setDeleteTarget({ id: item.id, title: item.title, kind: item.kind })}
                />
              ))}
              {pinnedOverflowCount > 0 && (
                <div className="px-3 py-1.5 text-[11px] text-[var(--shell-item-muted)]">
                  {pinnedOverflowCount} more in Recents
                </div>
              )}
            </RecentsPanel>
          )}

        {/* HOME RECENTS */}
          <RecentsPanel
            expanded={recentsExpanded}
            onToggle={handleToggleRecentsExpanded}
            title="Recents"
            openAllTitle="Open all recents"
            onOpenAll={() => onOpen?.('recents')}
            onAdd={handleNewSession}
            addTitle="New session"
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
                        {(['all', 'chat', 'cowork', 'task', 'agent', 'browser', 'code', 'bb'] as const).map((k) => (
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
            {recentsOverflowOpen && (
              <div className="relative flex items-center px-1 pb-1">
                <MagnifyingGlass size={12} className="absolute left-3 text-[var(--shell-item-muted)] pointer-events-none" />
                <input
                  type="text"
                  value={recentsSearch}
                  onChange={(e) => setRecentsSearch(e.target.value)}
                  placeholder="Search recents"
                  className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--surface-hover)] py-1.5 pl-7 pr-7 text-[12px] text-[var(--shell-item-fg)] outline-none placeholder:text-[var(--shell-item-muted)] focus:border-[var(--accent-primary)]"
                />
                {recentsSearch && (
                  <button
                    type="button"
                    onClick={() => setRecentsSearch('')}
                    title="Clear search"
                    className="absolute right-2 size-5 flex items-center justify-center rounded border-none bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] cursor-pointer transition-colors"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            )}
            {visibleRecentItems.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-[var(--shell-item-muted)] text-center">
                {recentsSearch ? 'No matches' : 'No recent items match your filters'}
              </div>
            )}
            {visibleRecentItems.map((item) => (
              <RecentRailItem
                key={item.id}
                item={item}
                onClick={() => openRecentItem(item)}
                onRenameCommit={item.kind === 'browser' ? undefined : commitRename}
                pinned={isPinned(item.id)}
                onPinToggle={() => togglePinnedEntry(item)}
                onUnpin={isPinned(item.id) ? () => togglePinnedEntry(item) : undefined}
                onDelete={() => setDeleteTarget({ id: item.id, title: item.title, kind: item.kind })}
              />
            ))}
            {!recentsOverflowOpen && recentsOverflowCount > 0 && (
              <button
                type="button"
                onClick={toggleRecentsOverflow}
                className="w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none bg-transparent cursor-pointer text-left transition-colors text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
              >
                <CaretRight size={13} />
                <span className="text-[12px]">More…</span>
              </button>
            )}
            {recentsOverflowOpen && filteredRecentItems.length > 15 && (
              <button
                type="button"
                onClick={toggleRecentsOverflow}
                className="w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none bg-transparent cursor-pointer text-left transition-colors text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
              >
                <CaretRight size={13} className="rotate-90" />
                <span className="text-[12px]">Show less</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openNativeSessionPicker(mode === 'cowork' ? 'cowork' : 'chat')}
              className="w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none bg-transparent cursor-pointer text-left transition-colors text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
            >
              <TerminalWindow size={13} />
              <span className="text-[12px]">Continue CLI session…</span>
            </button>
          </RecentsPanel>
        </>
      ) : (
        <>
          {/* CODE TABS */}
          <div className="px-2 pb-2 shrink-0 flex flex-col gap-0.5">
            <NewRailButton
              label="New Thread"
              isActive={isNewActive}
              onClick={handleNewSession}
            />
            {codeRailTabs['agent-hub'] && (
              <RailItem
                icon={Robot}
                label="Bot Hub"
                isActive={codeSticky.isTabActive('agent-hub')}
                onClick={() => {
                  codeSticky.selectTab('agent-hub');
                  onOpen?.('agent-hub');
                }}
              />
            )}
            {codeRailTabs['projects'] && (
              <RailItem
                icon={FolderOpen}
                label="Projects"
                isActive={codeSticky.isTabActive('project') && !chatStore.activeProjectId}
                onClick={() => {
                  codeSticky.selectTab('project');
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
                isActive={codeSticky.isTabActive('library')}
                onClick={() => {
                  codeSticky.selectTab('library');
                  onOpen?.('library');
                }}
              />
            )}
            {codeRailTabs['code-automations'] && (
              <RailItem
                icon={Clock}
                label="Automation Tasks"
                isActive={codeSticky.isTabActive('code-automations')}
                onClick={() => {
                  codeSticky.selectTab('code-automations');
                  onOpen?.('code-automations');
                }}
              />
            )}
            <MoreDropdown
              tabs={[
                { id: 'agent-hub', label: 'Bot Hub', icon: Robot, visible: codeRailTabs['agent-hub'] },
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
            onAdd={handleNewSession}
            addTitle="New Thread"
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
                            {renamingId === s.id ? (
                              <InlineRenameInput
                                initialValue={s.name || 'Untitled Session'}
                                onCommit={(value) => {
                                  setRenamingId(null);
                                  const trimmed = value.trim();
                                  if (trimmed) useCodeSessionStore.getState().updateSession(s.id, { name: trimmed });
                                }}
                                onCancel={() => setRenamingId(null)}
                              />
                            ) : (
                              <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{s.name || 'Untitled Session'}</span>
                            )}
                            <NativeSourceBadge source={sourceRefFromMetadata(s.metadata as Record<string, unknown>)} />
                          </button>
                          <RecentItemMenu
                            onOpen={() => openNativeSessionSurface(s)}
                            onRename={() => setRenamingId(s.id)}
                            pinned={isPinned(s.id)}
                            onPinToggle={() => togglePinnedEntry({ id: s.id, kind: 'code', mode: 'code' })}
                            onDelete={() => setDeleteTarget({ id: s.id, title: s.name || 'Untitled Session', kind: 'code' })}
                          />
                        </div>
                      );
                    })}
                  </React.Fragment>
                ) : null
              )
            )}
            <button
              type="button"
              onClick={() => openNativeSessionPicker('code')}
              className="w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none bg-transparent cursor-pointer text-left transition-colors text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
            >
              <TerminalWindow size={13} />
              <span className="text-[12px]">Continue CLI session…</span>
            </button>
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

        <div className="flex items-center p-[10px_12px] gap-1 min-w-0">
          <div className="min-w-0 flex-1 overflow-hidden">
            <SettingsDrilldown>
              <button
                type="button"
                title={currentUserDisplayName ?? 'Account'}
                className="w-full min-w-0 flex items-center gap-2 border-none bg-transparent cursor-pointer text-left hover:bg-[var(--shell-item-hover)] transition-colors rounded-lg p-[6px_8px] -ml-1"
              >
                <div className="size-8 rounded-full bg-gradient-to-br from-[var(--accent-chat)] to-[var(--accent-primary)] shrink-0 flex items-center justify-center text-[var(--bg-primary)] text-[14px] font-bold">
                  {accountInitial}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden flex items-center gap-1 text-[var(--shell-item-fg)] text-[13px] font-semibold">
                  <span className="truncate">{accountLabel}</span>
                  <CaretDown size={12} className="text-[var(--shell-item-muted)] shrink-0" />
                </div>
              </button>
            </SettingsDrilldown>
          </div>
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
  onRenameCommit,
  pinned,
  onPinToggle,
  onUnpin,
  onDelete,
}: {
  item: RailRecentItem;
  onClick: () => void;
  onRenameCommit?: (item: RailRecentItem, name: string) => void;
  pinned?: boolean;
  onPinToggle?: () => void;
  onUnpin?: () => void;
  onDelete: () => void;
}): React.ReactNode {
  const IconComponent = item.icon;
  const [renaming, setRenaming] = useState(false);
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
          {renaming ? (
            <InlineRenameInput
              initialValue={item.title}
              onCommit={(value) => onRenameCommit?.(item, value)}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <div className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
              {item.title}
            </div>
          )}
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
      {onUnpin && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onUnpin(); }}
          title="Unpin from rail"
          className="opacity-0 max-md:opacity-100 group-hover:opacity-100 shrink-0 -ml-1 size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all"
        >
          <PushPinSlash size={13} />
        </button>
      )}
      <RecentItemMenu
        onOpen={onClick}
        onRename={onRenameCommit ? () => setRenaming(true) : undefined}
        pinned={pinned}
        onPinToggle={onPinToggle}
        onDelete={onDelete}
      />
    </div>
  );
}

function TeammatesRailSection({
  expanded,
  onToggle,
  onOpen,
}: {
  expanded: boolean;
  onToggle: () => void;
  onOpen?: (view: string, context?: Record<string, unknown>) => void;
}): React.ReactNode | null {
  const agents = useAgentsWithSwarms();
  const bots = useMemo(() => agents.filter(isBot), [agents]);
  const attention = useAgentStore((state) => state.attention);
  const visibleAttention = useMemo(
    () => getVisibleAttention(attention, agents),
    [attention, agents],
  );
  const sessions = useChatSessionStore((s) => s.sessions);
  const streamingBySession = useChatSessionStore((s) => s.streamingBySession);
  const canonicalChatIds = useBotRosterStore((s) => s.canonicalChatIds);
  const routines = useBotRoutineStore((s) => s.routines);
  const mailMessages = useCommRailsMailStore((s) => s.messages);

  // Pure presence derivation for every bot, recomputed on store changes.
  const presenceByBot = useMemo(() => {
    const map: Record<string, BotPresenceState> = {};
    for (const bot of bots) {
      const canonicalId = canonicalChatIds[bot.id];
      const session = canonicalId ? (sessions ?? []).find((s) => s.id === canonicalId) : undefined;
      let routineActivityAt = 0;
      for (const routine of Object.values(routines)) {
        if (routine.botId !== bot.id) continue;
        if (routine.lastRunAt && routine.lastRunAt > routineActivityAt) routineActivityAt = routine.lastRunAt;
      }
      map[bot.id] = deriveBotPresence({
        streaming: canonicalId ? (streamingBySession[canonicalId]?.isStreaming ?? false) : false,
        sessionActivityAt: session ? new Date(session.updatedAt || 0).getTime() : 0,
        routineActivityAt,
      });
    }
    return map;
  }, [bots, sessions, streamingBySession, canonicalChatIds, routines]);

  const unreadByBot = useMemo(() => {
    const map: Record<string, number> = {};
    for (const bot of bots) {
      map[bot.id] = mailMessages.filter(
        (m) => m.toAgentId === bot.id && (m.status === 'unread' || m.requiresAck),
      ).length;
    }
    return map;
  }, [bots, mailMessages]);

  const entries = useMemo(() => {
    const list = bots
      .map((bot) => ({
        bot,
        presence: presenceByBot[bot.id] ?? { presence: 'idle' as const, lastActivityAt: 0 },
        attentionEntry: visibleAttention[bot.id] as BotAttentionEntry | undefined,
        unreadCount: unreadByBot[bot.id] ?? 0,
      }))
      .filter(
        (e) =>
          e.presence.presence !== 'idle' || e.unreadCount > 0 || Boolean(e.attentionEntry),
      );
    const rank = { working: 0, active: 1, idle: 2 } as const;
    list.sort((a, b) =>
      rank[a.presence.presence] - rank[b.presence.presence] ||
      b.presence.lastActivityAt - a.presence.lastActivityAt,
    );
    return list;
  }, [bots, presenceByBot, visibleAttention, unreadByBot]);

  // Self-pruning: render nothing when no bot has anything to show.
  if (entries.length === 0) return null;

  const visible = entries.slice(0, 6);
  const overflowCount = entries.length - visible.length;

  return (
    <RecentsPanel
      shrink
      expanded={expanded}
      onToggle={onToggle}
      title="Teammates"
    >
      {visible.map((entry) => (
        <TeammatesRailRow
          key={entry.bot.id}
          bot={entry.bot}
          presence={entry.presence}
          attentionEntry={entry.attentionEntry}
          unreadCount={entry.unreadCount}
          onOpen={onOpen}
        />
      ))}
      {overflowCount > 0 && (
        <button
          type="button"
          onClick={() => onOpen?.('agent-hub')}
          className="px-3 py-1.5 text-left text-[11px] text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] bg-transparent border-none cursor-pointer transition-colors"
        >
          All teammates
        </button>
      )}
    </RecentsPanel>
  );
}

function TeammatesRailRow({
  bot,
  presence,
  attentionEntry,
  unreadCount,
  onOpen,
}: {
  bot: Agent;
  presence: BotPresenceState;
  attentionEntry?: BotAttentionEntry;
  unreadCount: number;
  onOpen?: (view: string, context?: Record<string, unknown>) => void;
}): React.ReactNode {
  const canonicalChatId = useBotRosterStore((s) => s.canonicalChatIds[bot.id] ?? null);
  const routines = useBotRoutineStore((s) => s.routines);
  const sessionSummary = useSessionSummary(canonicalChatId);
  const { startSession } = useStartBotSession(
    useCallback((sessionId: string, botId: string) => {
      openBotChatView(sessionId, botId, 'chat');
    }, []),
  );

  const handleOpenChat = useCallback(async () => {
    const sessionId = await openBotCanonicalChat({
      botId: bot.id,
      botName: bot.botProfile?.displayName ?? bot.name,
      setActive: false,
    });
    openBotChatView(sessionId, bot.id, 'chat');
  }, [bot.id, bot.name, bot.botProfile?.displayName]);

  // Status line priority: working > attention > recent routine > last message.
  const routine = useMemo(() => {
    let latest: { title: string; lastRunAt?: number } | undefined;
    for (const r of Object.values(routines)) {
      if (r.botId !== bot.id || !r.lastRunAt) continue;
      if (!latest || (r.lastRunAt ?? 0) > (latest.lastRunAt ?? 0)) latest = r;
    }
    return latest;
  }, [routines, bot.id]);

  const working = presence.presence === 'working';
  // Watermark unread: canonical-chat activity newer than the watermark while
  // that chat is not focused (refresh-in-place handles the focused case).
  const hasNewActivity = useBotHasNewActivity(bot.id);
  const statusText = working
    ? 'Working…'
    : attentionEntry
      ? attentionEntry.hint
      : routine
        ? `⏰ ran ${routine.title} · ${formatRelativeTime(routine.lastRunAt ?? 0)}`
        : sessionSummary.lastMessage;

  return (
    <div className="group relative w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl cursor-pointer transition-all duration-200 font-medium bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]">
      <button
        type="button"
        onClick={handleOpenChat}
        className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium"
      >
        <div className="relative shrink-0">
          <BotAvatar bot={bot} size={24} />
          {presence.presence !== 'idle' && (
            <span
              className={cn(
                'absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-[var(--shell-rail-bg)]',
                working ? 'bg-[var(--accent-primary)]' : 'bg-[var(--status-success)]',
              )}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
            {bot.botProfile?.displayName ?? bot.name}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--shell-item-muted)] overflow-hidden">
            {working && (
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-primary)] opacity-75" />
                <span className="relative inline-flex rounded-full size-1.5 bg-[var(--accent-primary)]" />
              </span>
            )}
            <span className="truncate flex-1">{statusText}</span>
            {hasNewActivity && (
              <span
                className="shrink-0 size-2 rounded-full bg-[var(--accent-primary)]"
                title="New activity"
              />
            )}
            {unreadCount > 0 && (
              <span className="shrink-0 rounded-full bg-[var(--accent-primary)] text-[var(--shell-rail-bg)] text-[9px] font-bold px-1.5 py-px">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void startSession(bot); }}
        title="Start session"
        className="opacity-0 max-md:opacity-100 group-hover:opacity-100 shrink-0 size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all"
      >
        <Play size={13} weight="fill" />
      </button>
      <TeammatesRowMenu
        onOpenChat={() => void handleOpenChat()}
        onOpenHome={() => onOpen?.('bot-home', { botId: bot.id })}
        onStartSession={() => void startSession(bot)}
      />
    </div>
  );
}

function TeammatesRowMenu({
  onOpenChat,
  onOpenHome,
  onStartSession,
}: {
  onOpenChat?: () => void;
  onOpenHome?: () => void;
  onStartSession?: () => void;
}): React.ReactNode {
  const [open, setOpen] = useState(false);
  const run = (fn?: () => void) => () => {
    setOpen(false);
    fn?.();
  };
  const itemClass =
    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] border-none bg-transparent cursor-pointer text-left transition-colors';
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
        className="w-44 p-1.5 bg-[var(--surface-panel)] border-[var(--border-subtle)]"
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={8}
        onClick={(e) => e.stopPropagation()}
      >
        {onOpenChat && (
          <button type="button" onClick={run(onOpenChat)} className={itemClass}>
            <ArrowSquareOut size={14} />
            Open chat
          </button>
        )}
        {onOpenHome && (
          <button type="button" onClick={run(onOpenHome)} className={itemClass}>
            <House size={14} />
            Bot home
          </button>
        )}
        {onStartSession && (
          <button type="button" onClick={run(onStartSession)} className={itemClass}>
            <Play size={14} />
            Start session
          </button>
        )}
      </PopoverContent>
    </Popover>
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
  onAdd,
  addTitle,
  shrink,
}: {
  expanded: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
  openAllTitle?: string;
  onOpenAll?: () => void;
  filter?: React.ReactNode;
  onAdd?: () => void;
  addTitle?: string;
  shrink?: boolean;
}): React.ReactNode {
  return (
    <div className={cn("flex flex-col px-2", shrink ? "shrink-0" : "flex-1 min-h-0")}>
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
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="opacity-0 max-md:opacity-100 group-hover:opacity-100 size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all"
              title={addTitle}
            >
              <Plus size={13} weight="bold" />
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
            onClick={onToggle}
            className="size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-colors"
            title={expanded ? 'Hide sessions' : 'Show sessions'}
          >
            {expanded ? (
              <CaretDown size={12} className="transition-transform duration-200" />
            ) : (
              <CaretRight size={12} className="transition-transform duration-200" />
            )}
          </button>
        </div>
      </div>
      {expanded && (
        <div className={cn(shrink ? "" : "flex-1 overflow-y-auto min-h-0", "flex flex-col gap-0.5")}>
          <div className="flex flex-col gap-0.5">{children}</div>
        </div>
      )}
    </div>
  );
}

function RailItem({ id, icon: Icon, label, isActive, onClick, badge }: {
  id?: string;
  icon: Icon;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  /** Optional count pill (e.g. unified Inbox badge). Hidden when 0. */
  badge?: number;
}): React.ReactNode {
  const [showSidebarLabels] = useSettingsValue('appearance.showSidebarLabels', true);
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
      {showSidebarLabels && <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{label}</span>}
      {badge !== undefined && badge > 0 && (
        <span className="shrink-0 rounded-full bg-[var(--accent-primary)] text-[var(--shell-rail-bg)] text-[9px] font-bold px-1.5 py-px">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
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

function InlineRenameInput({ initialValue, onCommit, onCancel }: {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}): React.ReactNode {
  // Enter/blur commit and Esc cancel can both fire for one edit; guard so the
  // commit runs at most once.
  const finishedRef = useRef(false);
  const finish = useCallback((commit: boolean, value: string) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (commit) onCommit(value);
    else onCancel();
  }, [onCommit, onCancel]);
  return (
    <input
      type="text"
      autoFocus
      defaultValue={initialValue}
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(true, e.currentTarget.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(false, '');
        }
      }}
      onBlur={(e) => finish(true, e.currentTarget.value)}
      className="min-w-0 flex-1 rounded-md border border-solid border-[var(--border-subtle)] bg-[var(--surface-hover)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--shell-item-fg)] outline-none focus:border-[var(--accent-primary)]"
    />
  );
}

function RecentItemMenu({ onOpen, onRename, pinned, onPinToggle, onDelete }: {
  onOpen?: () => void;
  onRename?: () => void;
  pinned?: boolean;
  onPinToggle?: () => void;
  onDelete: () => void;
}): React.ReactNode {
  const [open, setOpen] = useState(false);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
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
        {onOpen && (
          <button
            type="button"
            onClick={run(onOpen)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] border-none bg-transparent cursor-pointer text-left transition-colors"
          >
            <ArrowSquareOut size={14} />
            Open
          </button>
        )}
        {onRename && (
          <button
            type="button"
            onClick={run(onRename)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] border-none bg-transparent cursor-pointer text-left transition-colors"
          >
            <PencilSimple size={14} />
            Rename
          </button>
        )}
        {onPinToggle && (
          <button
            type="button"
            onClick={run(onPinToggle)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] border-none bg-transparent cursor-pointer text-left transition-colors"
          >
            {pinned ? <PushPinSlash size={14} /> : <PushPin size={14} />}
            {pinned ? 'Unpin' : 'Pin to rail'}
          </button>
        )}
        <div className="h-px bg-[var(--shell-divider)] my-1" />
        <button
          type="button"
          onClick={run(onDelete)}
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

function BotNeedsYouHint({ botId }: { botId: string }): React.ReactNode {
  const { needsAttention, hasPendingApprovals } = useBotStatus(botId);
  if (!needsAttention && !hasPendingApprovals) return null;
  return (
    <span className="shrink-0 text-[10px] font-medium text-[var(--accent-primary)]">
      Needs you
    </span>
  );
}

function BotRailRow({ bot, isActive, disabled, onOpen, onUnpin, draggable, onDragStart, onDragEnd }: {
  bot: Agent;
  isActive?: boolean;
  disabled?: boolean;
  onOpen: () => void;
  onUnpin?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}): React.ReactNode {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl cursor-pointer transition-all duration-200 font-medium",
        isActive
          ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold"
          : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium disabled:opacity-60"
      >
        <BotAvatar bot={bot} size={22} />
        <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
          {getBotDisplayName(bot)}
        </span>
        <BotNeedsYouHint botId={bot.id} />
      </button>
      {onUnpin && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onUnpin(); }}
          title="Unpin from rail"
          className="opacity-0 max-md:opacity-100 group-hover:opacity-100 shrink-0 -ml-1 size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all"
        >
          <PushPinSlash size={13} />
        </button>
      )}
    </div>
  );
}

function BotGroupRailRow({ group, unread, isActive, onOpen }: {
  group: GroupChat;
  unread: number;
  isActive?: boolean;
  onOpen: () => void;
}): React.ReactNode {
  return (
    <div
      className={cn(
        "group relative w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl cursor-pointer transition-all duration-200 font-medium",
        isActive
          ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold"
          : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium"
      >
        <GroupChatAvatar name={group.name} members={group.members} size={22} />
        <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
          {group.name}
        </span>
        {unread > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 text-[11px] font-semibold text-[var(--ui-text-inverse)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
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
