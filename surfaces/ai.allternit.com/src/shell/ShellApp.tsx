// @ts-nocheck
import React, { useMemo, useReducer, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatformUser, isPlatformAuthDisabled } from '../lib/platform-auth-client';
import { getSession } from '../lib/auth-browser';

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
import { LegacyWidgetsLayer } from './LegacyWidgets';
import { initBrowserSurfaceBridge } from '../integration/execution/browser.bridge';
import { installDesktopStreamingGuard } from '../lib/sse/desktop-streaming-guard';
import { useAllternitHotkeys, PLATFORM_SHORTCUTS } from '../vendor/hotkeys';
import { createInitialNavState, navReducer } from '../nav/nav.store';
import { selectActiveView } from '../nav/nav.selectors';
import { ViewHost } from '../views/ViewHost';
import type { ViewContext, ViewType } from '../nav/nav.types';
import { ConsoleDrawer } from '../drawers/ConsoleDrawer';
import { useRunnerStore } from '../runner/runner.store';
import { useSidecarStore } from '../stores/sidecar-store';
import { useAgentStore } from '../lib/agents';
import { NativeAgentApiError } from '../lib/agents/native-agent-api';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { useCodeSessionStore } from '../views/code/CodeSessionStore';
import { useCoworkSessionStore } from '../views/cowork/CoworkSessionStore';
import { useDesignSessionStore } from '../views/design/DesignSessionStore';
import { useBrowserStore } from '../capsules/browser';
import { useBrowserAgentStore } from '../capsules/browser/browserAgent.store';
import { useBrowserShortcutsStore } from '../capsules/browser/browserShortcuts.store';
import { cn } from '@/lib/utils';

// Modularized Shell Components
import { getShellViewRegistry } from './ViewRegistry';
import { ChatViewWrapper } from './ChatViewWrapper';
import { BrowserPaneWrapper, BrowserSurfaceFrame } from './BrowserPane';
import { 
  ChatErrorFallback, 
  OpenClawErrorFallback, 
  ErrorFallbackWrapper, 
  ElementsView 
} from './ShellFallbacks';

import { useResolvedTheme, useThemeStore } from '../design/ThemeStore';
import { usePanelLayout } from '../hooks/usePanelLayout';
import { usePermissionGuide } from '../lib/usePermissionGuide';

import { 
  TooltipProvider,
} from '../components/ui/tooltip';
import { VoiceProvider } from '../providers/voice-provider';
import { VoicePresence } from '../components/ai-elements/voice-presence';
import { ConversationMonitorOverlay } from './ConversationMonitorOverlay';
import { useAgentSurfaceModeStore } from '../stores/agent-surface-mode.store';
import { FloatingAvatar } from '../components/agents/FloatingAvatar';
import { SessionProvider } from '../providers/session-provider';
import { RailControls } from './FloatingWidgets';
import { SearchOverlay } from './SearchOverlay';
import { FindInPageOverlay } from './FindInPageOverlay';
import { ArtifactSidecar } from './ArtifactSidecar';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ShellApp');

// Lazy-loaded UI Components
const IntegrationsPanel    = React.lazy(() => import('./IntegrationsPanel').then(m => ({ default: m.IntegrationsPanel })));
const ControlCenter        = React.lazy(() => import('./ControlCenter').then(m => ({ default: m.ControlCenter })));
const SettingsOverlay      = React.lazy(() => import('../views/settings/SettingsView').then(m => ({ default: m.SettingsView })));

const BROWSER_MODE_VIEW_TYPES = new Set<ViewType>([
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

// Inner app component that uses mode context
function ShellAppInner(): React.ReactNode {
  const [nav, dispatch] = useReducer(navReducer, undefined, createInitialNavState);
  const active = selectActiveView(nav)!;
  const { mode: activeMode, setMode: setActiveMode, isLoaded: modeLoaded } = useMode();
  const { isLoaded: authLoaded, isSignedIn } = usePlatformUser();
  const themePreference = useThemeStore((state) => state.theme);
  const setThemePreference = useThemeStore((state) => state.setTheme);
  const theme = useResolvedTheme(themePreference);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFindInPageOpen, setIsFindInPageOpen] = useState(false);
  const { railWidth, setRailWidth } = usePanelLayout();

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
      } catch (error) {
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
      if (!isSignedIn) {
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

  // Sync view to persisted mode once mode is loaded from localStorage
  useEffect(() => {
    if (!modeLoaded) return;
    if (activeMode === 'chat') open('chat');
    else if (activeMode === 'cowork') open('workspace');
    else if (activeMode === 'code') open('code');
    else if (activeMode === 'design') open('design');
    else if (activeMode === 'browser') open('browser');
    else open('chat'); // fallback
  }, [modeLoaded, activeMode]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setMonitorOverlayOpen((prev) => !prev);
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

  const open = useCallback((viewType: ViewType, context?: any): void => {
    dispatch({ type: 'OPEN_VIEW', viewType, context });
  }, []);
  const openNew = useCallback((viewType: ViewType) => dispatch({ type: 'OPEN_VIEW', viewType, allowNew: true }), []);

  const handleOpenAgentSession = useCallback(async (text: string, surface: AppMode) => {
    const selectedAgentId = useAgentSurfaceModeStore.getState().selectedAgentIdBySurface[surface];

    try {
      const store = surface === 'code'
        ? useCodeSessionStore
        : surface === 'cowork'
          ? useCoworkSessionStore
          : surface === 'design'
            ? useDesignSessionStore
            : useChatSessionStore;
      const sessionId = await store.getState().createSession({
        name: text.slice(0, 50) || 'New Session',
        sessionMode: selectedAgentId ? 'agent' : 'regular',
        agentId: selectedAgentId ?? undefined,
      });

      store.getState().setActiveSession(sessionId);

      const viewTypeMap: Record<AppMode, ViewType> = {
        chat: 'chat',
        cowork: 'workspace',
        code: 'code',
        design: 'design',
        browser: 'browser',
      };
      dispatch({ type: 'OPEN_VIEW', viewType: viewTypeMap[surface] });
      void store.getState().sendMessageStream(sessionId, { text });
    } catch (err) {
      logger.error({ err: err }, 'Failed to create session');
    }
  }, []);

  const registry = useMemo(() => getShellViewRegistry({ handleOpenAgentSession, open }), [handleOpenAgentSession, open]);

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
    const handleSwitchMode = (e: Event): void => {
      const mode = (e as CustomEvent<{ mode: AppMode }>).detail?.mode;
      if (mode) handleModeChange(mode);
    };
    window.addEventListener('allternit:switch-mode', handleSwitchMode);
    return () => window.removeEventListener('allternit:switch-mode', handleSwitchMode);
  }, []);

  const handleModeChange = useCallback((mode: AppMode): void => {
    setActiveMode(mode);
    if (mode === 'chat') open('chat');
    if (mode === 'cowork') open('workspace');
    if (mode === 'code') open('code');
    if (mode === 'design') open('design');
    if (mode === 'browser') open('browser');
  }, [setActiveMode, open]);

  useEffect(() => {
    if (BROWSER_MODE_VIEW_TYPES.has(active.viewType)) {
      if (activeMode !== 'browser') setActiveMode('browser');
    } else if (activeMode === 'browser') {
      setActiveMode('chat');
    }
  }, [active.viewType, activeMode, setActiveMode]);

  const [session, setSession] = useState(null);
  useEffect(() => { void getSession().then(setSession); }, []);

  const [monitorOverlayOpen, setMonitorOverlayOpen] = useState(false);
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [pluginPanelOpen, setPluginPanelOpen] = useState(false);
  const permissions = usePermissionGuide();

  const shouldHideRail = active.viewType === 'labs';

  return (
    <TooltipProvider>
      <VoiceProvider>
      <SessionProvider session={session}>
        <VisionGlass />
        <VoicePresence compact={false} />

        {permissions.isSupported && permissions.anyDenied && (
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
          </div>
        )}
        
        <ShellFrame
          isRailCollapsed={isRailCollapsed || shouldHideRail}
          railWidth={railWidth}
          onRailWidthChange={setRailWidth}
          rail={
            <ShellRail
              activeViewType={active.viewType}
              onOpen={open as (view: string) => void}
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
            <LegacyWidgetsLayer />
          </>}
          dock={null}
        />
        
                {!pluginPanelOpen && active.viewType !== 'settings' && <RailControls
                  mode={activeMode}
                  onModeChange={handleModeChange}
                  onToggleRail={() => setIsRailCollapsed(!isRailCollapsed)}
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
                      });

                      store.getState().setActiveSession(sessionId);

                      if (selectedAgent?.id) {
                        useAgentSurfaceModeStore
                          .getState()
                          .setSelectedAgent(originSurface, selectedAgent.id);
                      }

                      if (originSurface === 'cowork') {
                        handleModeChange('cowork');
                        return;
                      }

                      if (originSurface === 'design') {
                        handleModeChange('design');
                        return;
                      }

                      handleModeChange(originSurface === 'code' ? 'code' : 'chat');
                    } catch (error) {
                      logger.error({ err: error }, '[ShellApp] Failed to create agent session from rail controls');
                      open('native-agent');
                    }
                  }}
                  isRailCollapsed={isRailCollapsed}
                  activeViewType={active.viewType}
                  onOpenView={open as (viewType: string) => void}
                  onOpenIntegrations={() => setPluginPanelOpen(true)}
                  onOpenLabs={() => open('labs')}
                  onSearchOpen={() => setIsSearchOpen(true)}
                />}
                <SearchOverlay open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        <FindInPageOverlay open={isFindInPageOpen} onClose={() => setIsFindInPageOpen(false)} />
        {active.viewType === 'code' && <ConsoleDrawer />}
        <ConversationMonitorOverlay
          open={monitorOverlayOpen}
          onClose={() => setMonitorOverlayOpen(false)}
        />
        <ControlCenter
          isOpen={isControlCenterOpen}
          onClose={() => setIsControlCenterOpen(false)}
          isDevMode={process.env.NODE_ENV === 'development'}
          onOpenView={open as (viewType: string) => void}
        />
        <IntegrationsPanel
          isOpen={pluginPanelOpen}
          onClose={() => setPluginPanelOpen(false)}
          onOpenSettings={() => {
            setPluginPanelOpen(false);
            sessionStorage.setItem('allternit-settings-section', 'integrations');
            sessionStorage.setItem('allternit-settings-tab', 'connectors');
            setSettingsOpen(true);
          }}
        />

        {settingsOpen && (
          <React.Suspense fallback={null}>
            <SettingsOverlay initialSection={settingsSection} initialTab={settingsTab} />
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
  const [allowed, setAllowed] = useState(isPlatformAuthDisabled());

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn || isPlatformAuthDisabled()) {
      setAllowed(true);
    } else {
      if (window.location.pathname.startsWith('/sign-in')) return;
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/sign-in?redirect_url=${returnUrl}`, { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

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
