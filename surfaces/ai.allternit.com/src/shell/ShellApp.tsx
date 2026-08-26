// @ts-nocheck
import React, { useMemo, useReducer, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatformUser, isPlatformAuthDisabled, isDesktopShell } from '../lib/platform-auth-client';
import { getSession } from '../lib/auth-browser';
import { useCompanyConfig } from '../providers/company-config-provider';

import { ShellFrame } from './ShellFrame';
import { ShellRail } from './ShellRail';
import { type AppMode } from './ShellHeader';

import { ModeProvider, useMode } from '../providers/mode-provider';
import { GlobalDropzoneProvider } from '../components/GlobalDropzone';
import { OnboardingPortal } from '../components/onboarding';
import { useOnboardingStore } from '../stores/onboarding-store';
import { setupApi } from '@/services/setup-api';
import { shouldRunWizard } from '@/lib/wizard-check';
import { ShellCanvas } from './ShellCanvas';
import { ShellOverlayLayer } from './ShellOverlayLayer';
import { VisionGlass } from './VisionGlass';
import { initBrowserSurfaceBridge } from '../integration/execution/browser.bridge';
import { installDesktopStreamingGuard } from '../lib/sse/desktop-streaming-guard';
import { useAllternitHotkeys, PLATFORM_SHORTCUTS } from '../vendor/hotkeys';
import { createInitialNavState, navReducer } from '../nav/nav.store';
import { selectActiveView } from '../nav/nav.selectors';
import { ViewHost } from '../views/ViewHost';
import type { ViewType } from '../nav/nav.types';
import { ConsoleDrawer } from '../drawers/ConsoleDrawer';
import { useRunnerStore } from '../runner/runner.store';
import { useSidecarStore } from '../stores/sidecar-store';
import { usePendingChatModelStore } from '../stores/pending-chat-model.store';
import { useAgentStore } from '../lib/agents';
import type { Agent } from '../lib/agents/agent.types';
import { useAgentBootstrap } from '../lib/agents/useAgentBootstrap';
import { isBot } from '@/lib/bots/bot-profile';
import { useStartBotSession } from '@/lib/bots/useStartBotSession';
import { useStackProviders } from '@/lib/bots/use-stack-providers';
import { NativeAgentApiError } from '../lib/agents/native-agent-api';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { useCodeSessionStore } from '../views/code/CodeSessionStore';
import { useCodeModeStore } from '../views/code/CodeModeStore';
import { useCoworkSessionStore } from '../views/cowork/CoworkSessionStore';
import { useDesignSessionStore } from '../views/design/DesignSessionStore';
// Modularized Shell Components
import { getShellViewRegistry } from './ViewRegistry';

import { useResolvedTheme, useThemeStore } from '../design/ThemeStore';
import { usePanelLayout } from '../hooks/usePanelLayout';
import { useIsMobile } from '../hooks/useMediaQuery';
import { usePermissionGuide } from '../lib/usePermissionGuide';

import { TooltipProvider } from '../components/ui/tooltip';
import { VoiceProvider } from '../providers/voice-provider';
import { VoicePresence } from '../components/ai-elements/voice-presence';
import { AgentActivityPanel } from '../views/agent-activity/AgentActivityPanel';
import { useMonitorThreads } from '../views/mail-monitor/monitor.helpers';
import { useAgentSurfaceModeStore } from '../stores/agent-surface-mode.store';
import { FloatingAvatar } from '../components/agents/FloatingAvatar';
import { SessionProvider } from '../providers/session-provider';
import { RailControls } from './FloatingWidgets';
import { FindInPageOverlay } from './FindInPageOverlay';
import { ArtifactSidecar } from './ArtifactSidecar';

import { createModuleLogger } from '@/lib/logger';
import { openDesignWindow } from '@/lib/open-design-window';
import {
  buildModeSystemPrompt,
  getAgentModeContract,
  type CanonicalAgentModeId,
} from '@/lib/agents/agent-mode-contracts';

const logger = createModuleLogger('ShellApp');

// Lazy-loaded UI Components
const ControlCenter        = React.lazy(() => import('./ControlCenter').then(m => ({ default: m.ControlCenter })));
const SettingsOverlay      = React.lazy(() => import('../views/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const PluginManagerOverlay = React.lazy(() => import('../views/plugins').then(m => ({ default: m.PluginManager })));

const BROWSER_MODE_VIEW_TYPES = new Set<ViewType>([
  'browser',
  'browserview',
  'mini-apps-store',
  'browser-extensions',
  'site-apis',
  'mini-app',
  'addin-word',
  'addin-excel',
  'addin-ppt',
  'hermes',
  'openclaw',
  'openclaw-chat',
  'openclaw-sessions',
  // Builtin mini-apps surfaced in the ACI Mini-apps rail section.
  'brain',
  'vault-viewer',
  'oh-my-pi',
  // Allternit Office editors are surfaced from the ACI "Office & Extensions"
  // launcher and should stay in browser mode so the rail remains expanded.
  'docs',
  'sheets',
  'slides',
  'pdf',
  'sign',
]);

// Inner app component that uses mode context
function ShellAppInner(): React.ReactNode {
  const navigate = useNavigate();
  const detachedParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const detachedSessionId = detachedParams.get('detachedSessionId');
  const detachedWorkspaceId = detachedParams.get('detachedWorkspaceId');
  const isDetachedCodeSession = detachedParams.get('detachedSurface') === 'code' && Boolean(detachedSessionId);
  const [nav, dispatch] = useReducer(navReducer, undefined, createInitialNavState);
  const active = selectActiveView(nav)!;

  const { startSession: startBotSession } = useStartBotSession(
    useCallback((sessionId: string) => {
      // Bot sessions render in the standard chat surface so they match regular
      // sessions and stay in the Bots section of the rail.
      useChatSessionStore.getState().setActiveSession(sessionId);
      dispatch({ type: 'OPEN_VIEW', viewType: 'chat', context: { sessionId, originView: active.viewType } });
    }, [active.viewType])
  );
  useStackProviders();
  const { mode: activeMode, setMode: setActiveMode, isLoaded: modeLoaded } = useMode();

  const handleStartBotSession = useCallback(async (agent: Agent) => {
    const surfaceModeState = useAgentSurfaceModeStore.getState();
    // Bot sessions are always chat-origin sessions (created in ChatSessionStore),
    // so the surface agent binding is for the chat surface.
    const modeId = surfaceModeState.selectedModeBySurface['chat'];
    const sessionId = await startBotSession(agent, { modeId: modeId ?? undefined });
    if (sessionId) {
      useAgentSurfaceModeStore.getState().setSelectedAgent('chat', agent.id);
    }
  }, [startBotSession]);
  const { isLoaded: authLoaded, isSignedIn } = usePlatformUser();
  const { config: companyConfig } = useCompanyConfig();
  const desktopSelfHosted = isDesktopShell() && companyConfig?.selfHosted === true;
  const themePreference = useThemeStore((state) => state.theme);
  const setThemePreference = useThemeStore((state) => state.setTheme);
  const theme = useResolvedTheme(themePreference);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [hoveredModeIcon, setHoveredModeIcon] = useState<AppMode | null>(null);
  const [railHovered, setRailHovered] = useState(false);
  const [isRailPeekOpen, setIsRailPeekOpen] = useState(false);
  const [isFindInPageOpen, setIsFindInPageOpen] = useState(false);
  const { railWidth, setRailWidth } = usePanelLayout();

  // Mobile layout (< 768px): the rail renders as a slide-out drawer owned here
  // so it can be closed on navigation; ShellFrame handles the presentation.
  const isMobile = useIsMobile();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setIsMobileDrawerOpen(false);
  }, [isMobile]);

  // Close the mobile rail drawer whenever the active view changes.
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [active.viewType]);

  // Temporarily show a condensed rail while hovering a collapsed mode icon or
  // moving from that icon into the rail preview. Hovering the collapse control
  // itself only reveals the mode switchers.
  useEffect(() => {
    if (hoveredModeIcon || railHovered) {
      setIsRailPeekOpen(true);
      return;
    }
    const timer = setTimeout(() => setIsRailPeekOpen(false), 150);
    return () => clearTimeout(timer);
  }, [hoveredModeIcon, railHovered]);

  // Tracks whether the most recent mode change was triggered by a view change
  // (e.g. opening Dispatch while in browser mode). When true, the mode-to-view
  // sync effect should not override the view that just opened.
  const modeChangeSourceRef = useRef<'initial' | 'user' | 'sync'>('initial');

  useEffect(() => {
    if (!isDetachedCodeSession || !detachedSessionId) return;
    setActiveMode('code');
    void useCodeSessionStore.getState().loadSessions().then(() => {
      useCodeSessionStore.getState().setActiveSession(detachedSessionId);
      if (detachedWorkspaceId) useCodeModeStore.getState().setActiveWorkspace(detachedWorkspaceId);
      dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
    });
  }, [detachedSessionId, detachedWorkspaceId, isDetachedCodeSession, setActiveMode]);

  const {
    isOpen: sidecarOpen,
    activePanel: sidecarActivePanel,
    panels: sidecarPanels,
    setOpen: setSidecarOpen,
    setActivePanel: setSidecarPanel,
  } = useSidecarStore();
  const hasExpandedArtifact = Boolean(sidecarPanels.artifact.activeArtifactId);
  const hasExpandedChangeset = Boolean(sidecarPanels.changeset.activeChangeSetId);
  const visibleSidecarOpen =
    activeMode === 'cowork'
      ? sidecarOpen
      : sidecarOpen &&
        (
          (sidecarActivePanel === 'artifact' && hasExpandedArtifact) ||
          (sidecarActivePanel === 'changeset' && hasExpandedChangeset)
        );

  const handleSidecarToggle = useCallback(() => {
    if (activeMode === 'cowork') {
      if (!sidecarOpen) setSidecarPanel('context');
      setSidecarOpen(!sidecarOpen);
      return;
    }

    if (visibleSidecarOpen) {
      setSidecarOpen(false);
    }
  }, [activeMode, sidecarOpen, visibleSidecarOpen, setSidecarOpen, setSidecarPanel]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Fetch agents on mount for agent mode selection
  useEffect(() => {
    let cancelled = false
    const loadAgents = async () => {
      try {
        await useAgentStore.getState().fetchAgents()
      } catch {
        if (!cancelled && process.env.NODE_ENV === 'development') {
          console.debug("[ShellApp] Agents fetch skipped (backend not running)")
        }
      }
    }
    void loadAgents()
    return () => {
      cancelled = true
    }
  }, [])

  // One-time agent seeding bootstrap after auth loads
  useAgentBootstrap({ enabled: authLoaded && (isSignedIn || isPlatformAuthDisabled() || desktopSelfHosted) });

  // Load sessions from mode-specific stores and connect to live sync
  useEffect(() => {
    if (!authLoaded) return;

    let cancelled = false;
    let disconnectors: Array<() => void> = [];

    const isAgentAuthError = (error: unknown) =>
      error instanceof NativeAgentApiError
        ? error.isAuthError()
        : typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          ((((error as { statusCode?: unknown }).statusCode) === 401) ||
            (((error as { statusCode?: unknown }).statusCode) === 403));

    const initSessionSync = async () => {
      const canSync = isSignedIn || isPlatformAuthDisabled() || desktopSelfHosted;
      if (!canSync) {
        return;
      }

      const loaders = [
        useChatSessionStore.getState().loadSessions,
        useCoworkSessionStore.getState().loadSessions,
        useCodeSessionStore.getState().loadSessions,
        useDesignSessionStore.getState().loadSessions,
      ];

      let sawAuthFailure = false;

      await Promise.all(
        loaders.map(async (load) => {
          try {
            await load();
          } catch (error) {
            if (isAgentAuthError(error)) {
              sawAuthFailure = true;
            }
          }
        }),
      );

      if (cancelled || sawAuthFailure) {
        return;
      }

      disconnectors = [
        useChatSessionStore.getState().connectSessionSync(),
        useCoworkSessionStore.getState().connectSessionSync(),
        useCodeSessionStore.getState().connectSessionSync(),
        useDesignSessionStore.getState().connectSessionSync(),
      ];
    };

    void initSessionSync();

    return () => {
      cancelled = true;
      disconnectors.forEach((disconnect) => disconnect());
      disconnectors = [];
    };
  }, [authLoaded, isSignedIn]);

  useEffect(() => {
    if (activeMode !== 'cowork' && sidecarActivePanel === 'context' && sidecarOpen) {
      setSidecarOpen(false);
    }
  }, [activeMode, sidecarActivePanel, sidecarOpen, setSidecarOpen]);

  const open = useCallback((viewType: ViewType, context?: any): void => {
    if (viewType === 'design') {
      openDesignWindow();
      return;
    }
    dispatch({ type: 'OPEN_VIEW', viewType, context });
  }, []);
  const openNew = useCallback((viewType: ViewType) => {
    if (viewType === 'design') {
      openDesignWindow();
      return;
    }
    dispatch({ type: 'OPEN_VIEW', viewType, allowNew: true });
  }, []);

  // When another surface requests "chat with this model" (e.g. Model Lab),
  // open the chat view and let the mounted ModelSelectionProvider apply it.
  useEffect(() => {
    const unsubscribe = usePendingChatModelStore.subscribe((state, prevState) => {
      if (state.pending && state.pending !== prevState.pending) {
        dispatch({ type: 'OPEN_VIEW', viewType: 'chat' });
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync view to persisted mode once mode is loaded from localStorage, or when
  // the user explicitly changes mode. Do not override a view that was just
  // opened because the mode-sync effect changed mode in response to that view.
  useEffect(() => {
    if (!modeLoaded) return;
    if (typeof window !== 'undefined' && window.location.pathname === '/shell/recents') {
      open('recents');
      return;
    }
    if (modeChangeSourceRef.current === 'sync') {
      modeChangeSourceRef.current = 'initial';
      return;
    }
    if (activeMode === 'chat') open('chat');
    else if (activeMode === 'cowork') {
      // See handleModeChange: cowork always opens on the session/chat screen.
      useAgentSurfaceModeStore.getState().setSelectedMode('cowork', 'execute');
      open('workspace');
    }
    else if (activeMode === 'code') open('code');
    else if (activeMode === 'design') {
      setActiveMode('chat');
      open('chat');
    }
    else if (activeMode === 'browser') open('browser');
    else open('chat'); // fallback
  }, [modeLoaded, activeMode, open]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setAgentActivityPanelOpen((prev) => !prev);
      }
      if (isMeta && event.key.toLowerCase() === "f" && window.allternit?.findInPage) {
        event.preventDefault();
        setIsFindInPageOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const runner = useRunnerStore();
  
  useAllternitHotkeys(PLATFORM_SHORTCUTS.GLOBAL.TOGGLE_AGENT_RUNNER.keys, () => {
    runner.openCompact();
  });

  const handleOpenAgentSession = useCallback(async (
    text: string,
    surface: AppMode,
    execution?: { modeId: CanonicalAgentModeId; templateTitle?: string },
  ) => {
    const surfaceModeState = useAgentSurfaceModeStore.getState();
    const selectedAgentId = surfaceModeState.selectedAgentIdBySurface[surface];
    const selectedAgent = useAgentStore.getState().agents.find((a) => a.id === selectedAgentId);

    // If the user selected a packaged bot, start a dedicated bot session that
    // reuses an existing bot chat session when one exists, then stream the
    // opening message so it behaves like a real bot session rather than a
    // generic home chat.
    if (selectedAgent && isBot(selectedAgent)) {
      try {
        const modeId = execution?.modeId ?? surfaceModeState.selectedModeBySurface[surface];
        const sessionId = await startBotSession(selectedAgent, { modeId: modeId ?? undefined });
        if (!sessionId) {
          logger.error({ surface }, 'Failed to start bot session');
          return;
        }
        void useChatSessionStore.getState().sendMessageStream(sessionId, { text });
        return;
      } catch (err) {
        logger.error({ err: err }, 'Failed to create bot session');
        return;
      }
    }

    const modeId = execution?.modeId ?? surfaceModeState.selectedModeBySurface[surface];
    const contract = getAgentModeContract(modeId);

    if (!contract) {
      logger.error({ modeId, surface }, 'Refusing to start an agent session without a valid mode contract');
      return;
    }

    // "Code" isn't just an artifact type like Website/Docs — it has its own
    // dedicated IDE-like surface. Picking Code mode from Chat/Cowork must
    // mount the session there, not create it in-place in the composer's
    // current surface (which is always 'chat' for the launch composer).
    const targetSurface: AppMode = modeId === 'code' ? 'code' : surface;

    try {
      const store = targetSurface === 'code'
        ? useCodeSessionStore
        : targetSurface === 'cowork'
          ? useCoworkSessionStore
          : targetSurface === 'design'
            ? useDesignSessionStore
            : useChatSessionStore;
      const sessionId = await store.getState().createSession({
        name: text.slice(0, 50) || 'New Session',
        sessionMode: 'agent',
        agentId: selectedAgentId ?? undefined,
        systemPrompt: buildModeSystemPrompt(contract, execution?.templateTitle),
        metadata: {
          agentModeId: contract.id,
          agentModeLabel: contract.label,
          templateTitle: execution?.templateTitle,
          artifactKind: contract.artifactKind,
          requiredCapabilities: contract.requiredCapabilities,
          requiredEvidence: contract.requiredEvidence,
          executionStatus: 'pending',
          originSurface: targetSurface,
        },
      });

      store.getState().setActiveSession(sessionId);

      const agentSessionViewType = `${targetSurface}-agent-session` as ViewType;
      const originView = active.viewType;
      dispatch({
        type: 'OPEN_VIEW',
        viewType: agentSessionViewType,
        context: { sessionId, originView },
      });
      void store.getState().sendMessageStream(sessionId, { text });
    } catch (err) {
      logger.error({ err: err }, 'Failed to create session');
    }
  }, [active.viewType, dispatch, startBotSession]);

  const registry = useMemo(() => getShellViewRegistry({ handleOpenAgentSession, handleStartBotSession, open }), [handleOpenAgentSession, handleStartBotSession, open]);

  useEffect(() => {
    const cleanup = initBrowserSurfaceBridge();
    return () => cleanup();
  }, []);

  useEffect(() => {
    installDesktopStreamingGuard();
  }, []);

  // Settings renders as an overlay above the active view (never replaces it),
  // so closing returns to exactly what was on screen underneath.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string | undefined>(undefined);
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);

  // Plugin Manager overlay (opened from Customize rail tab)
  const [pluginManagerOpen, setPluginManagerOpen] = useState(false);
  const [pluginManagerTab, setPluginManagerTab] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handleOpenSettings = (e: Event): void => {
      const detail = (e as CustomEvent<{ section?: string; tab?: string }>).detail;
      setSettingsSection(detail?.section);
      setSettingsTab(detail?.tab);
      setSettingsOpen(true);
    };
    window.addEventListener('allternit:open-settings', handleOpenSettings);
    return () => window.removeEventListener('allternit:open-settings', handleOpenSettings);
  }, []);

  useEffect(() => {
    const handleCloseSettings = (): void => {
      setSettingsOpen(false);
      setSettingsSection(undefined);
      setSettingsTab(undefined);
    };
    window.addEventListener('allternit:close-settings', handleCloseSettings);
    return () => window.removeEventListener('allternit:close-settings', handleCloseSettings);
  }, []);

  useEffect(() => {
    const handleOpenLabs = (): void => { open('labs'); };
    window.addEventListener('allternit:open-labs', handleOpenLabs);
    return () => window.removeEventListener('allternit:open-labs', handleOpenLabs);
  }, [open]);

  useEffect(() => {
    const handleOpenView = (e: Event): void => {
      const detail = (e as CustomEvent<{ viewType?: ViewType; allowNew?: boolean; context?: unknown }>).detail;
      if (!detail?.viewType) return;
      if (detail.viewType === 'design') {
        openDesignWindow();
        return;
      }
      dispatch({
        type: 'OPEN_VIEW',
        viewType: detail.viewType,
        allowNew: detail.allowNew,
        context: detail.context,
      });
    };
    window.addEventListener('allternit:open-view', handleOpenView);
    return () => window.removeEventListener('allternit:open-view', handleOpenView);
  }, []);

  useEffect(() => {
    const handleOpenAgentActivity = (): void => {
      setAgentActivityPanelOpen(true);
    };
    window.addEventListener('allternit:open-agent-activity', handleOpenAgentActivity);
    return () => window.removeEventListener('allternit:open-agent-activity', handleOpenAgentActivity);
  }, []);

  const handleModeChange = useCallback((mode: AppMode): void => {
    if (mode === 'design') {
      openDesignWindow();
      return;
    }

    modeChangeSourceRef.current = 'user';
    setActiveMode(mode);
    if (mode === 'chat') open('chat');
    if (mode === 'cowork') {
      // Always enter cowork on the session/chat screen — a persisted sub-mode
      // (Routines/Loops/etc.) from a previous visit must not take over the
      // center content.
      useAgentSurfaceModeStore.getState().setSelectedMode('cowork', 'execute');
      open('workspace');
    }
    if (mode === 'code') open('code');
    if (mode === 'browser') open('browser');
  }, [setActiveMode, open]);

  useEffect(() => {
    const handleSwitchMode = (e: Event): void => {
      const mode = (e as CustomEvent<{ mode: AppMode }>).detail?.mode;
      if (mode) handleModeChange(mode);
    };
    window.addEventListener('allternit:switch-mode', handleSwitchMode);
    return () => window.removeEventListener('allternit:switch-mode', handleSwitchMode);
  }, [handleModeChange]);

  // Keep persisted mode in sync with the current view: browser views put the
  // app in browser mode; leaving browser mode for a non-browser view switches
  // back to chat. Mark these as sync-driven so the mode-to-view effect does not
  // immediately override the view that triggered the change.
  useEffect(() => {
    if (BROWSER_MODE_VIEW_TYPES.has(active.viewType)) {
      if (activeMode !== 'browser') {
        modeChangeSourceRef.current = 'sync';
        setActiveMode('browser');
      }
    } else if (activeMode === 'browser') {
      modeChangeSourceRef.current = 'sync';
      setActiveMode('chat');
    }
  }, [active.viewType, activeMode, setActiveMode]);

  // Apps & Extensions wants the full canvas width: collapse the rail when the
  // view opens (the user can re-expand or peek it back at any time).
  useEffect(() => {
    if (active.viewType === 'apps-extensions') setIsRailCollapsed(true);
  }, [active.viewType]);

  const [session, setSession] = useState(null);
  useEffect(() => { void getSession().then(setSession); }, []);

  const [agentActivityPanelOpen, setAgentActivityPanelOpen] = useState(false);
  const { unreadCount: agentActivityUnreadCount } = useMonitorThreads();
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const permissions = usePermissionGuide();
  const [permissionBannerDismissed, setPermissionBannerDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('allternit-permission-banner-dismissed') === '1';
  });

  const shouldHideRail = active.viewType === 'labs';
  const effectiveRailCollapsed = isRailCollapsed || shouldHideRail;
  const peekRail = isRailCollapsed && !shouldHideRail && isRailPeekOpen;

  // Persist rail collapse state on the document root so embedded surfaces
  // (Allternit Office, PDF viewer) can shift their top chrome clear of the
  // fixed rail-controls widget / window traffic lights.
  useEffect(() => {
    document.documentElement.setAttribute('data-rail-collapsed', String(effectiveRailCollapsed));
  }, [effectiveRailCollapsed]);

  return (
    <TooltipProvider>
      <VoiceProvider>
      <SessionProvider session={session}>
        <VisionGlass />
        <VoicePresence compact={false} />

        {permissions.isSupported && permissions.anyDenied && !permissionBannerDismissed && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 220,
            background: 'var(--status-warning)', color: 'var(--ui-text-inverse)', padding: '8px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontSize: 13, fontWeight: 500
          }}>
            <span>⚠️ System permissions needed for desktop automation</span>
            <button type="button"
              onClick={() => {
                if (permissions.accessibility === 'denied') {
                  permissions.presentGuide('accessibility');
                } else if (permissions.screenRecording === 'denied') {
                  permissions.presentGuide('screen-recording');
                }
              }}
              style={{
                padding: '4px 12px', borderRadius: 4, border: '1px solid #1a1a1a',
                background: 'transparent', color: 'var(--ui-text-inverse)', fontSize: 12,
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              Fix Permissions
            </button>
            <button type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'permissions' } }));
              }}
              style={{
                padding: '4px 12px', borderRadius: 4, border: 'none',
                background: 'transparent', color: 'var(--ui-text-inverse)', fontSize: 12,
                textDecoration: 'underline', cursor: 'pointer'
              }}
            >
              Settings
            </button>
            <button type="button"
              onClick={() => {
                setPermissionBannerDismissed(true);
                window.localStorage.setItem('allternit-permission-banner-dismissed', '1');
                void permissions.dismiss();
              }}
              style={{
                padding: '4px 12px', borderRadius: 4, border: 'none',
                background: 'transparent', color: 'var(--ui-text-inverse)', fontSize: 12,
                textDecoration: 'underline', cursor: 'pointer', marginLeft: 8
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        
        <ShellFrame
          isRailCollapsed={effectiveRailCollapsed}
          railWidth={railWidth}
          onRailWidthChange={setRailWidth}
          onRailHover={setRailHovered}
          peekRail={peekRail}
          mobileRailOpen={isMobileDrawerOpen}
          onMobileRailClose={() => setIsMobileDrawerOpen(false)}
          rail={
            <ShellRail
              activeViewType={active.viewType}
              onOpen={open as (view: string, context?: Record<string, unknown>) => void}
              onNew={openNew as unknown as () => void}
              mode={activeMode}
              isCollapsed={isRailCollapsed}
              onToggle={() => setIsRailCollapsed(!isRailCollapsed)}
              onModeChange={handleModeChange}
              theme={theme}
              onThemeToggle={() => setThemePreference(theme === 'light' ? 'dark' : 'light')}
              onOpenControlCenter={() => setIsControlCenterOpen(true)}
              onSidecarToggle={handleSidecarToggle}
              sidecarOpen={visibleSidecarOpen}
              onOpenCustomize={(tab) => {
                setPluginManagerTab(tab);
                setPluginManagerOpen(true);
              }}
              sessionOnlyId={isDetachedCodeSession ? detachedSessionId ?? undefined : undefined}
            />
          }
          canvas={
            <ShellCanvas>
              <ViewHost active={active} registry={registry} />
            </ShellCanvas>
          }
          sidecarOpen={visibleSidecarOpen}
          sidecar={<ArtifactSidecar />}
          overlays={<>
            <ShellOverlayLayer />
          </>}
          dock={null}
        />
        
                {!isDetachedCodeSession && active.viewType !== 'settings' && <RailControls
                  mode={activeMode}
                  onModeChange={handleModeChange}
                  onToggleRail={() => {
                    // On mobile the title-bar sidebar toggle opens the rail drawer.
                    if (isMobile) setIsMobileDrawerOpen((v) => !v);
                    else setIsRailCollapsed(!isRailCollapsed);
                  }}
                  railWidth={railWidth}
                  onAgentActivityOpen={() => setAgentActivityPanelOpen(true)}
                  agentActivityUnreadCount={agentActivityUnreadCount}
                  onModeHover={setHoveredModeIcon}
                  onNewChat={() => {
                    useChatSessionStore.getState().setActiveSession(null);
                    useChatStore.getState().setActiveThread(null);
                    useChatStore.getState().setActiveProject(null);
                    handleModeChange('chat');
                  }}
                  onNewAgentSession={async () => {
                    const originSurface =
                      active.viewType === 'browser' || active.viewType === 'browserview'
                        ? 'browser'
                        : activeMode === 'cowork'
                        ? 'cowork'
                        : activeMode === 'code'
                          ? 'code'
                          : activeMode === 'design'
                            ? 'design'
                            : 'chat';
                    const selectedAgentId =
                      useAgentSurfaceModeStore.getState().selectedAgentIdBySurface[
                        originSurface
                      ];
                    const selectedAgent =
                      selectedAgentId
                        ? useAgentStore
                            .getState()
                            .agents.find((agent) => agent.id === selectedAgentId) ?? null
                        : null;
                    const originView = active.viewType;
                    try {
                      if (originSurface === 'browser') {
                        open('browser');
                        return;
                      }

                      const store = originSurface === 'code'
                        ? useCodeSessionStore
                        : originSurface === 'cowork'
                          ? useCoworkSessionStore
                          : originSurface === 'design'
                            ? useDesignSessionStore
                            : useChatSessionStore;
                      const sessionId = await store.getState().createSession({
                        name: 'Agent Session',
                        sessionMode: 'agent',
                        agentId: selectedAgent?.id,
                        agentName: selectedAgent?.name,
                        metadata: { originSurface },
                      });

                      store.getState().setActiveSession(sessionId);

                      if (selectedAgent?.id) {
                        useAgentSurfaceModeStore
                          .getState()
                          .setSelectedAgent(originSurface, selectedAgent.id);
                      }

                      const agentSessionViewType = `${originSurface}-agent-session` as ViewType;
                      dispatch({
                        type: 'OPEN_VIEW',
                        viewType: agentSessionViewType,
                        context: { sessionId, originView },
                      });
                    } catch (error) {
                      logger.error({ err: error }, '[ShellApp] Failed to create agent session from rail controls');
                      open('native-agent');
                    }
                  }}
                  isRailCollapsed={isRailCollapsed}
                  onBack={() => dispatch({ type: 'BACK' })}
                  onForward={() => dispatch({ type: 'FORWARD' })}
                  canGoBack={nav.history.length > 1}
                  canGoForward={nav.future.length > 0}
                />}
        <FindInPageOverlay open={isFindInPageOpen} onClose={() => setIsFindInPageOpen(false)} />
        {active.viewType === 'code' && <ConsoleDrawer />}
        <AgentActivityPanel
          open={agentActivityPanelOpen}
          onClose={() => setAgentActivityPanelOpen(false)}
        />
        <ControlCenter
          isOpen={isControlCenterOpen}
          onClose={() => setIsControlCenterOpen(false)}
          isDevMode={process.env.NODE_ENV === 'development'}
          onOpenView={open as (viewType: string) => void}
        />
        {settingsOpen && (
          <React.Suspense fallback={null}>
            {/* Settings now renders PluginManager as its own nested overlay
                for "Browse"/"Open full manager" (see SettingsView.tsx) rather
                than closing here and reopening a separate top-level
                IntegrationsPanel — that round-trip navigated away from
                Settings instead of overlaying on top of it. */}
            <SettingsOverlay
              initialSection={settingsSection}
              initialTab={settingsTab}
              onClose={() => setSettingsOpen(false)}
            />
          </React.Suspense>
        )}
        {pluginManagerOpen && (
          <React.Suspense fallback={null}>
            <PluginManagerOverlay
              isOpen
              initialTab={pluginManagerTab as any}
              onClose={() => setPluginManagerOpen(false)}
              onOpenSettings={() => {
                setPluginManagerOpen(false);
                setSettingsOpen(true);
              }}
            />
          </React.Suspense>
        )}
        <FloatingAvatar />
      </SessionProvider>
      </VoiceProvider>
    </TooltipProvider>
  );
}

function OnboardingGate(): React.ReactNode | null {
  const hasCompleted = useOnboardingStore((s) => s.hasCompletedOnboarding);
  const hasHydrated = useOnboardingStore((s) => s.hasHydrated);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const [backendChecked, setBackendChecked] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;

    // Desktop first-launch hint
    const desktop = window.allternit?.app;
    if (desktop?.isFirstLaunch) {
      desktop.isFirstLaunch().then((isFirst: boolean) => {
        if (isFirst) resetOnboarding();
      }).catch(() => {});
    }

    // OpenClaw-style wizard version check against the server-side user config.
    // If onboarding is incomplete or the app version has changed, force the wizard.
    // If the server already records a completed wizard for this version, sync that
    // to local state so users do not see the wizard again after clearing storage.
    let cancelled = false;
    setupApi
      .getConfig()
      .then((config) => {
        if (cancelled) return;
        if (shouldRunWizard(config.user.onboardingComplete, config.user.wizard)) {
          resetOnboarding();
        } else {
          completeOnboarding();
        }
      })
      .catch(() => {
        // Offline or misconfigured: fall back to local store state.
      })
      .finally(() => {
        if (!cancelled) setBackendChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, resetOnboarding, completeOnboarding]);

  if (!hasHydrated) return null;
  if (!backendChecked) return null;
  if (hasCompleted) return null;
  return <OnboardingPortal />;
}

function AuthGate({ children }: { children: React.ReactNode }): React.ReactNode | null {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = usePlatformUser();
  const { config: companyConfig, isLoading: companyConfigLoading } = useCompanyConfig();
  // Self-hosted desktop builds ship with no Clerk credentials and are not
  // meant to pair with Allternit Cloud at all — without this, an unpaired
  // self-hosted desktop app bounces every route to /sign-in, which then
  // dead-ends because there's no Clerk key to sign in with.
  const desktopSelfHosted = isDesktopShell() && companyConfig?.selfHosted === true;
  const [allowed, setAllowed] = useState(isPlatformAuthDisabled());

  useEffect(() => {
    if (!isLoaded || companyConfigLoading) return;
    if (isSignedIn || isPlatformAuthDisabled() || desktopSelfHosted) {
      setAllowed(true);
    } else {
      if (window.location.pathname.startsWith('/sign-in')) return;
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/sign-in?redirect_url=${returnUrl}`, { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate, companyConfigLoading, desktopSelfHosted]);

  if (!allowed) return null;

  return <>{children}</>;
}

export function ShellApp(): React.ReactNode {
  return (
    <AuthGate>
      <ModeProvider>
        <GlobalDropzoneProvider>
          <OnboardingGate />
          <ShellAppInner />
        </GlobalDropzoneProvider>
      </ModeProvider>
    </AuthGate>
  );
}
