import { SkillsRegistryView } from '../views/code/SkillsRegistryView';
import { OpenClawControlUI } from '../views/openclaw/OpenClawControlUI';
import React, { useMemo, useReducer, useEffect, useCallback, useRef, useState } from 'react';
// Agent Session Views
import { ChatModeAgentSession } from '../views/agent-sessions/ChatModeAgentSession';
import { CoworkModeAgentTasks } from '../views/agent-sessions/CoworkModeAgentTasks';
import { CodeModeADE } from '../views/agent-sessions/CodeModeADE';
import { BrowserModeAgentSession } from '../views/agent-sessions/BrowserModeAgentSession';
import { ShellFrame } from './ShellFrame';
import { ShellRail } from './ShellRail';
import { type AppMode } from './ShellHeader';

import { ModeSwitcher } from './ModeSwitcher';
import { ModeProvider, useMode } from '../providers/mode-provider';
import { GlobalDropzoneProvider } from '../components/GlobalDropzone';
import { ShellCanvas } from './ShellCanvas';
import { ShellOverlayLayer } from './ShellOverlayLayer';
import { VisionGlass } from './VisionGlass';
import { LegacyWidgetsLayer } from './LegacyWidgets';
import { initBrowserSurfaceBridge } from '../integration/execution/browser.bridge';
import { useA2RHotkeys, PLATFORM_SHORTCUTS } from '../vendor/hotkeys';
import { createInitialNavState, navReducer } from '../nav/nav.store';
import { selectActiveView } from '../nav/nav.selectors';
import { createViewRegistry } from '../views/registry';
import { A2rCanvasView } from '../views/A2rCanvasView';
import { ViewHost } from '../views/ViewHost';
import type { ViewContext, ViewType } from '../nav/nav.types';
import { ConsoleDrawer } from '../drawers/ConsoleDrawer';
import { useRunnerStore } from '../runner/runner.store';
import { useSidecarStore } from '../stores/sidecar-store';
import { ChatView } from '../views/ChatView';
import { CoworkRoot } from '../views/cowork/CoworkRoot';
import { PluginRegistryView } from '../views/cowork/PluginRegistryView';
import { TerminalView } from '../views/TerminalView';
import { CodeRoot } from '../views/code/CodeRoot';
import { RunnerView } from '../views/RunnerView';
import { RailsView } from '../views/RailsView';
import { AgentSystemView } from '../views/AgentSystemView';
import { AgentView } from '../views/AgentView';
import { AgentHub } from '../views/AgentHub';
import { NativeAgentView } from '../views/NativeAgentView';
import {
  getOpenClawWorkspacePathFromAgent,
  useAgentStore,
  useEmbeddedAgentSessionStore,
  useNativeAgentStore,
} from '../lib/agents';
import { useBrowserStore } from '../capsules/browser';
import { BrowserCapsuleEnhanced } from '../capsules/browser/BrowserCapsuleEnhanced';
import { useBrowserAgentStore } from '../capsules/browser/browserAgent.store';
import { useBrowserShortcutsStore, getFaviconUrl } from '../capsules/browser/browserShortcuts.store';
import { GizziMascot } from '../components/ai-elements/GizziMascot';
import type { GizziEmotion } from '../components/ai-elements/GizziMascot';
import {
  Globe,
  MagnifyingGlass,
  X,
  Plus,
  Clock,
} from '@phosphor-icons/react';

import { useChatStore } from '../views/chat/ChatStore';
import { ProjectView } from '../views/ProjectView';
import { useArtifactStore } from '../views/cowork/ArtifactStore';
import { ToolsView } from "../views/code/ToolsView";
import { RunReplayView } from "../views/code/RunReplayView";
import { PromotionDashboardView } from "../views/code/PromotionDashboardView";
import { PlaygroundView } from "../views/PlaygroundView";
import { PluginManagerPanel } from "./PluginManagerPanel";
import { DagIntegrationPage } from "../views/DagIntegrationPage";
import { ControlCenter } from './ControlCenter';
// Agentation - UI iteration tool
import { Agentation } from 'agentation';
// Cloud Deploy View
import { CloudDeployView } from '../views/cloud-deploy/CloudDeployView';
// Node Management View
import { NodesView } from '../views/nodes';
// Capsule Management View (P3.9 MCP Apps)
import { CapsuleManagerView } from '../views/CapsuleManagerView';
// Operator Browser Control View (P3.10/P3.12)
import { OperatorBrowserView } from '../views/OperatorBrowserView';
// P3 UI Views (JSON Render, Form Surfaces, Canvas, Hooks)
import { A2RIXRendererView } from '../views/A2RIXRendererView';
import { FormSurfacesView } from '../views/FormSurfacesView';
import { CanvasProtocolView } from '../views/CanvasProtocolView';
import { HooksSystemView } from '../views/HooksSystemView';
// P4 UI Views (Evolution, Context, Memory, ACF)
import { EvolutionLayerView } from '../views/EvolutionLayerView';
import { ContextControlPlaneView } from '../views/ContextControlPlaneView';
import { MemoryKernelView } from '../views/MemoryKernelView';
import { AutonomousCodeFactoryView } from '../views/AutonomousCodeFactoryView';
// DAG Task Views - P4/P5 Integration
import {
  SwarmMonitor,
  PolicyManager,
  TaskExecutor,
  OntologyViewer,
  DirectiveCompiler,
  EvaluationHarness,
  GCAgents,
  ReceiptsViewer,
  PolicyGating,
  SecurityDashboard,
  PurposeBinding,
  BrowserView,
  DAGWIH,
  Checkpointing,
  ObservabilityDashboard,
  // Standalone views from DagIntegrationPage
  SwarmDashboard,
  IVKGEPanel,
  MultimodalInput,
  TamboStudio,
} from "../views/dag";
// Runtime Management Views
import { BudgetDashboardView } from '../views/runtime/BudgetDashboardView';
import { ReplayManagerView } from '../views/runtime/ReplayManagerView';
import { PrewarmManagerView } from '../views/runtime/PrewarmManagerView';
import { RuntimeOperationsView } from '../views/runtime/RuntimeOperationsView';
// Meta-Swarm Views
import { MetaSwarmDashboard } from '../views/MetaSwarmDashboard';
// Sprint 1 - History & Search views
import { HistoryView } from '../views/HistoryView';
import { ArchivedView } from '../views/ArchivedView';
import { SearchView } from '../views/SearchView';
import { DebugView } from '../views/code/DebugView';
// Sprint 1 - Cowork Analytics views
import { InsightsView } from '../views/cowork/InsightsView';
import { ActivityView } from '../views/cowork/ActivityView';
import { GoalsView } from '../views/cowork/GoalsView';
// Sprint 2 - Replace placeholder views
import { MarketplaceView } from '../views/MarketplaceView';
import { SettingsView } from '../views/settings/SettingsView';
import { useResolvedTheme, useThemeStore } from '../design/ThemeStore';
import { ModelManagementView } from '../views/settings/ModelManagementView';
import { MonitorView } from '../views/MonitorView';
// Sprint 4 - Cowork content views
import { RunsView as CoworkRunsView } from '../views/cowork/RunsView';
import { DraftsView } from '../views/cowork/DraftsView';
import { TasksView } from '../views/cowork/TasksView';
import { CronView } from '../views/cowork/CronView';
import { CoworkProjectView } from '../views/cowork/CoworkProjectView';
import { DocumentsView } from '../views/cowork/DocumentsView';
import { TablesView } from '../views/cowork/TablesView';
import { FilesView } from '../views/cowork/FilesView';
import { ExportsView } from '../views/cowork/ExportsView';
import ProductsDiscoveryView from '../views/products/ProductsDiscoveryView';
// Sprint 5 - Code sub-views
import { ExplorerView } from '../views/code/ExplorerView';
import { GitView } from '../views/code/GitView';
import { ThreadsView } from '../views/code/ThreadsView';
import { SkillsView } from '../views/code/SkillsView';
import { CodeProjectView } from '../views/code/CodeProjectView';
import { A2rOSView } from '../views/A2rOSView';
import { ErrorBoundary } from '../components/error-boundary';
import { TooltipProvider } from '../components/ui/tooltip';
import { VerificationView } from '../views/VerificationView';
import { ShellHeader } from './ShellHeader';
import { RailControls } from './FloatingWidgets';

// Stable Chat view that handles project/no-project logic internally
import { SessionProvider } from '../providers/session-provider';
import { ChatIdProvider } from '../providers/chat-id-provider';
import { DataStreamProvider } from '../providers/data-stream-provider';
import { MessageTreeProvider } from '../providers/message-tree-provider';
import { ChatInputProvider } from '../providers/chat-input-provider';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import { ChatModelsProvider } from '../providers/chat-models-provider';
import { ModelSelectionProvider } from '../providers/model-selection-provider';
import { VoiceProvider } from '../providers/voice-provider';
import { VoicePresence } from '../components/ai-elements/voice-presence';
import { ConversationMonitorOverlay } from './ConversationMonitorOverlay';
import { useAgentSurfaceModeStore } from '../stores/agent-surface-mode.store';

// Stable Chat view that handles project/no-project logic internally
const ChatViewWrapper = React.memo(function ChatViewWrapper({ 
  onOpenAgentSession 
}: { 
  onOpenAgentSession?: (text: string, surface: 'chat' | 'cowork' | 'code' | 'browser') => void;
}) {
  const { activeProjectId, activeThreadId } = useChatStore();
  const embeddedChatSessionId = useEmbeddedAgentSessionStore(
    (state) => state.sessionIdBySurface.chat,
  );
  
  // Generate a stable temporary chat ID - only regenerate when activeThreadId changes
  const effectiveChatId = useMemo(() => 
    embeddedChatSessionId || activeThreadId || `temp-${Date.now()}`, 
    [activeThreadId, embeddedChatSessionId]
  );
  
  // Show ProjectView only when a project is explicitly selected.
  // activeProjectId is no longer persisted, so this won't trigger on startup.
  if (activeProjectId && !embeddedChatSessionId) {
    return <ProjectView />;
  }

  return (
    <ErrorBoundary fallback={<ChatErrorFallback />}>
      <ChatIdProvider
        chatId={effectiveChatId}
        isPersisted={!!embeddedChatSessionId || !!activeThreadId}
        source="local"
      >
        <DataStreamProvider>
          <MessageTreeProvider>
            <PromptInputProvider>
              <ChatInputProvider>
                <ChatModelsProvider>
                  <ModelSelectionProvider>
                    <ChatView key={effectiveChatId} onOpenAgentSession={onOpenAgentSession} />
                  </ModelSelectionProvider>
                </ChatModelsProvider>
              </ChatInputProvider>
            </PromptInputProvider>
          </MessageTreeProvider>
        </DataStreamProvider>
      </ChatIdProvider>
    </ErrorBoundary>
  );
});

// Error fallback for chat
function ChatErrorFallback({ error }: { error?: Error }) {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          Chat Error
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
          There was a problem loading the chat interface.
        </p>
        {error && (
          <pre style={{ fontSize: 12, textAlign: 'left', background: 'var(--status-error-bg)', color: 'var(--ui-text-primary)', padding: 12, borderRadius: 4, maxWidth: 500, maxHeight: 200, overflow: 'auto', marginBottom: 16 }}>
            {error.message}
            {'\n'}
            {error.stack}
          </pre>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 16px', background: 'var(--accent-chat)', color: 'var(--shell-control-active-fg)', borderRadius: 6, border: 'none', cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

function OpenClawErrorFallback({ error }: { error?: Error }) {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 740 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          OpenClaw UI Error
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
          The OpenClaw control surface crashed during render.
        </p>
        {error && (
          <pre style={{ fontSize: 12, textAlign: 'left', background: 'var(--status-error-bg)', color: 'var(--ui-text-primary)', padding: 12, borderRadius: 4, maxHeight: 260, overflow: 'auto', marginBottom: 16 }}>
            {error.message}
            {'\n'}
            {error.stack}
          </pre>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 16px', background: 'var(--accent-chat)', color: 'var(--shell-control-active-fg)', borderRadius: 6, border: 'none', cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/**
 * Error fallback for critical views
 * Shows user-friendly error message with retry option
 */
function ViewErrorFallback({
  viewName,
  error,
  reset
}: {
  viewName: string;
  error?: Error;
  reset?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '40px',
        textAlign: 'center',
        background: 'var(--shell-frame-bg)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--status-error-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ui-text-primary)', marginBottom: '8px' }}>
        {viewName} Error
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--ui-text-secondary)', marginBottom: '24px', maxWidth: '400px' }}>
        Something went wrong loading this view. {error?.message && `(${error.message})`}
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        {reset && (
          <button
            onClick={reset}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: 'var(--shell-frame-bg)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid var(--ui-border-default)',
            background: 'transparent',
            color: 'var(--ui-text-primary)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

// Elements view placeholder
function ElementsView() {
  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 32,
      background: 'var(--bg-primary)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          Elements
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Component library and design system elements.
        </p>
      </div>
    </div>
  );
}

// Error fallback wrapper component for ErrorBoundary
function ErrorFallbackWrapper({ 
  viewName, 
  error, 
  reset 
}: { 
  viewName: string; 
  error?: Error; 
  reset?: () => void; 
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '40px',
        textAlign: 'center',
        background: 'var(--shell-frame-bg)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--status-error-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ui-text-primary)', marginBottom: '8px' }}>
        {viewName} Error
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--ui-text-secondary)', marginBottom: '24px', maxWidth: '400px' }}>
        Something went wrong loading this view. {error?.message && `(${error.message})`}
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        {reset && (
          <button
            onClick={reset}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: 'var(--shell-frame-bg)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid var(--ui-border-default)',
            background: 'transparent',
            color: 'var(--ui-text-primary)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

import { ArtifactSidecar } from './ArtifactSidecar';

// ── Browser Landing Animations (self-contained keyframes, no framer-motion) ──
const browserLandingAnimations = `
@keyframes browserFadeSlideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes browserBlurIn { from { opacity: 0; filter: blur(12px); transform: scale(1.1); } to { opacity: 1; filter: blur(0); transform: scale(1); } }
@keyframes browserClipReveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes browserLetterSpacingIn { from { opacity: 0; letter-spacing: 0.3em; } to { opacity: 1; letter-spacing: -0.01em; } }
@keyframes browserScaleIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
@keyframes browserSlideFromLeft { from { opacity: 0; transform: translateX(-60px) skewX(-8deg); } to { opacity: 1; transform: translateX(0) skewX(0); } }
@keyframes browserLandingFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes browserLandingFadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.97); } }
@keyframes browserCardSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
`;

const BROWSER_ANIM_NAMES = [
  'browserFadeSlideUp',
  'browserBlurIn',
  'browserClipReveal',
  'browserLetterSpacingIn',
  'browserScaleIn',
  'browserSlideFromLeft',
];

const BROWSER_TITLES = [
  "Navigator's Deck",
  'Browse & Build',
  'The Web Layer',
  'A2R Explorer',
  'Portal Online',
  'Web Surface',
];
const BROWSER_TAGLINES = [
  'AI-Powered Browsing',
  'Navigate with Intelligence',
  'Your Web, Amplified',
  'Explore Fearlessly',
  'Browse. Automate. Build.',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * BrowserPaneWrapper — owns the browser background and landing page.
 * When tabs are open the draggable card appears on top.
 * When no tabs → card is hidden, only the branded landing is visible.
 */
function BrowserPaneWrapper({ children }: { children: React.ReactNode }) {
  const { tabs, addTab, recentVisits } = useBrowserStore();
  const { shortcuts, addShortcut, removeShortcut, reorderShortcuts } = useBrowserShortcutsStore();
  const { mode: agentMode, setMode: setAgentMode, status: agentStatus } = useBrowserAgentStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [topOffset, setTopOffset] = useState(108);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(0);
  const hasTabs = tabs.length > 0;

  // Smooth transition state
  const [showLanding, setShowLanding] = useState(!hasTabs);
  const [landingAnim, setLandingAnim] = useState<'in' | 'out' | null>(null);
  const prevHadTabs = useRef(hasTabs);

  useEffect(() => {
    if (hasTabs && !prevHadTabs.current) {
      // Tabs appeared — no change needed, just hide landing
    } else if (!hasTabs && prevHadTabs.current) {
      // Tabs disappeared — fade landing in
      setShowLanding(true);
      setLandingAnim('in');
    } else if (!hasTabs) {
      setShowLanding(true);
    }

    if (hasTabs) {
      // Fade out landing then hide
      setLandingAnim('out');
      const timer = setTimeout(() => setShowLanding(false), 250);
      prevHadTabs.current = hasTabs;
      return () => clearTimeout(timer);
    }

    prevHadTabs.current = hasTabs;
  }, [hasTabs]);

  // Gizzi mascot state
  const [mascotEmotion, setMascotEmotion] = useState<GizziEmotion>('steady');
  const [isHovering, setIsHovering] = useState(false);

  // Randomized greeting (stable per mount)
  const greeting = useMemo(() => ({
    title: pickRandom(BROWSER_TITLES),
    tagline: pickRandom(BROWSER_TAGLINES),
    titleAnim: pickRandom(BROWSER_ANIM_NAMES),
    taglineAnim: pickRandom(BROWSER_ANIM_NAMES),
  }), []);

  // Shortcut editing + drag reorder
  const [editMode, setEditMode] = useState(false);
  const [addingShortcut, setAddingShortcut] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIcon, setNewIcon] = useState('🌐');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Favicon load error tracking
  const [faviconErrors, setFaviconErrors] = useState<Set<string>>(new Set());

  const agentActive = agentMode !== 'Human';

  const pulseMascot = useCallback((emotion: GizziEmotion) => {
    setMascotEmotion(emotion);
    setTimeout(() => setMascotEmotion('steady'), 640);
  }, []);

  // When tabs exist: push the card down. When no tabs: make card transparent/borderless.
  useEffect(() => {
    const card = wrapperRef.current?.closest('[data-shell-card]') as HTMLElement | null;
    if (!card) return;
    if (hasTabs) {
      card.style.marginTop = `${topOffset}px`;
      card.style.height = `calc(100% - ${topOffset}px)`;
      card.style.background = 'var(--shell-panel-bg)';
      card.style.border = '1px solid var(--shell-divider)';
      card.style.boxShadow = 'var(--shadow-xl)';
    } else {
      card.style.marginTop = '0';
      card.style.height = '100%';
      card.style.background = 'transparent';
      card.style.border = 'none';
      card.style.boxShadow = 'none';
    }
    return () => {
      card.style.marginTop = '';
      card.style.height = '100%';
      card.style.background = '';
      card.style.border = '';
      card.style.boxShadow = '';
    };
  }, [topOffset, hasTabs]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartOffset.current = topOffset;

    const handleMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientY - dragStartY.current;
      const next = Math.max(0, Math.min(600, dragStartOffset.current + delta));
      setTopOffset(next);
    };
    const handleUp = () => {
      isDragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [topOffset]);

  const handleAddShortcut = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    let url = newUrl.trim();
    if (!url.match(/^https?:\/\//)) url = `https://${url}`;
    addShortcut({ label: newLabel.trim(), url, icon: newIcon || '🌐' });
    setNewLabel('');
    setNewUrl('');
    setNewIcon('🌐');
    setAddingShortcut(false);
  };

  return (
    <>
      {/* Inject keyframe animations */}
      <style>{browserLandingAnimations}</style>

      {/* ── Browser Landing (visible when no tabs, with smooth transition) ── */}
      {showLanding && (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--shell-panel-bg) 84%, var(--accent-primary) 16%) 0%, var(--shell-frame-bg) 70%)',
          color: 'var(--ui-text-primary)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
          animation: landingAnim === 'out'
            ? 'browserLandingFadeOut 0.25s ease-out forwards'
            : landingAnim === 'in'
            ? 'browserLandingFadeIn 0.35s ease-out forwards'
            : undefined,
        }}>
          {/* Subtle dot grid (32px, opacity 0.03) */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.03,
            backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 60%, transparent) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 640, width: '100%', padding: '0 24px' }}>
            {/* ── Gizzi Mascot with hover bloom ── */}
            <div
              style={{ marginBottom: 24, position: 'relative', cursor: 'pointer' }}
              onMouseEnter={() => { setIsHovering(true); pulseMascot('pleased'); }}
              onMouseLeave={() => { setIsHovering(false); setMascotEmotion('steady'); }}
            >
              {/* Hover bloom backdrop */}
              <div style={{
                position: 'absolute',
                inset: -24,
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                filter: 'blur(48px)',
                transform: isHovering ? 'scale(1.1)' : 'scale(0.8)',
                opacity: isHovering ? 1 : 0,
                transition: 'transform 0.4s ease, opacity 0.4s ease',
                pointerEvents: 'none',
              }} />
              <div style={{
                transform: isHovering ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.3s ease',
              }}>
                <GizziMascot size={76} emotion={mascotEmotion} />
              </div>
            </div>

            {/* ── Animated Title (Georgia serif, 32px) ── */}
            <h1 style={{
              fontSize: 32,
              fontWeight: 500,
              color: 'var(--ui-text-primary)',
              marginBottom: 8,
              fontFamily: 'Georgia, "Times New Roman", serif',
              animation: `${greeting.titleAnim} 0.6s ease-out 100ms both`,
            }}>
              {greeting.title}
            </h1>

            {/* ── Tagline with flanking lines ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 32,
              animation: `${greeting.taglineAnim} 0.6s ease-out 350ms both`,
            }}>
              <div style={{ width: 32, height: 1, background: 'color-mix(in srgb, var(--accent-primary) 38%, transparent)' }} />
              <p style={{
                color: 'var(--ui-text-muted)',
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: 0,
              }}>
                {greeting.tagline}
              </p>
              <div style={{ width: 32, height: 1, background: 'color-mix(in srgb, var(--accent-primary) 38%, transparent)' }} />
            </div>

            {/* ── Search bar ── */}
            <div style={{ width: '100%', maxWidth: 560, marginBottom: 24 }}>
              <form onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                if (input?.value.trim()) {
                  const v = input.value.trim();
                  if (v.match(/^https?:\/\//) || (v.includes('.') && !v.includes(' '))) {
                    addTab(v.match(/^https?:\/\//) ? v : `https://${v}`);
                  } else {
                    addTab(`https://www.google.com/search?q=${encodeURIComponent(v)}`);
                  }
                  input.value = '';
                }
              }} style={{ position: 'relative' }}>
                <input type="text" placeholder="Search the web or enter a URL..."
                  style={{
                    width: '100%', height: 56, paddingLeft: 24, paddingRight: 56,
                    background: 'var(--surface-floating-muted)', border: '1px solid var(--shell-dialog-border)',
                    borderRadius: 16, color: 'var(--ui-text-primary)', fontSize: 18, outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--shell-dialog-border)'; }}
                />
                <button type="submit" style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  padding: 8, background: 'var(--accent-primary)', border: 'none', borderRadius: 8, cursor: 'pointer',
                }}>
                  <MagnifyingGlass style={{ width: 20, height: 20, color: 'var(--shell-frame-bg)' }} />
                </button>
              </form>
            </div>

            {/* ── Extension Status Pill ── */}
            <button
              onClick={() => setAgentMode(agentActive ? 'Human' : 'Assist')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                background: agentActive ? 'var(--shell-item-active-bg)' : 'var(--surface-floating-muted)',
                border: `1px solid ${agentActive ? 'var(--shell-dialog-border)' : 'var(--shell-divider)'}`,
                color: agentActive ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
                fontSize: 12, cursor: 'pointer', marginBottom: 32,
                transition: 'all 0.2s',
              }}
            >
              <span>🧩</span>
              <span>A2R Agent: {agentActive ? 'Active' : 'Off'}</span>
            </button>

            {/* ── Shortcut Grid ── */}
            <div style={{ width: '100%', maxWidth: 560 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button
                  onClick={() => setEditMode(!editMode)}
                  style={{
                    background: 'none', border: 'none', color: editMode ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
                    fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: '2px 4px',
                  }}
                >
                  {editMode ? 'Done' : 'Customize'}
                </button>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(shortcuts.length + 1, 4)}, 1fr)`,
                gap: 12,
              }}>
                {shortcuts.map((item, idx) => {
                  const faviconSrc = getFaviconUrl(item.url, 64);
                  const useFavicon = faviconSrc && !faviconErrors.has(item.id);
                  return (
                  <button key={item.id}
                    draggable={editMode}
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIdx !== null && dragIdx !== idx) reorderShortcuts(dragIdx, idx);
                      setDragIdx(null);
                      setDragOverIdx(null);
                    }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    onClick={() => !editMode && addTab(item.url)}
                  style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '16px 12px', borderRadius: 12, position: 'relative',
                      background: dragOverIdx === idx ? 'var(--shell-item-hover)' : 'var(--surface-panel-muted)',
                      border: `1px solid ${dragOverIdx === idx ? 'var(--accent-primary)' : 'var(--shell-divider)'}`,
                      cursor: editMode ? 'grab' : 'pointer', color: 'var(--ui-text-muted)', fontSize: 12,
                      transition: 'border-color 0.2s, color 0.2s, box-shadow 0.2s, background 0.15s',
                      opacity: dragIdx === idx ? 0.4 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!editMode) {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.color = 'var(--accent-primary)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (dragOverIdx !== idx) {
                        e.currentTarget.style.borderColor = 'var(--shell-divider)';
                      }
                      e.currentTarget.style.color = 'var(--ui-text-muted)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {editMode && (
                      <div
                        onClick={(e) => { e.stopPropagation(); removeShortcut(item.id); }}
                        style={{
                          position: 'absolute', top: -6, right: -6,
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'var(--status-error)', color: 'var(--shell-danger-fg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontSize: 12, lineHeight: 1, zIndex: 2,
                        }}
                      >
                        <X style={{ width: 12, height: 12 }} />
                      </div>
                    )}
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--shell-item-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, overflow: 'hidden' }}>
                      {useFavicon ? (
                        <img
                          src={faviconSrc}
                          alt=""
                          style={{ width: 28, height: 28, objectFit: 'contain' }}
                          onError={() => setFaviconErrors((prev) => new Set(prev).add(item.id))}
                        />
                      ) : (
                        item.icon || '🌐'
                      )}
                    </div>
                    <span>{item.label}</span>
                  </button>
                  );
                })}

                {/* Add shortcut card */}
                {!addingShortcut ? (
                  <button onClick={() => setAddingShortcut(true)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '16px 12px', borderRadius: 12,
                      background: 'transparent', border: '1px dashed var(--shell-divider)',
                      cursor: 'pointer', color: 'var(--ui-text-muted)', fontSize: 12,
                      transition: 'border-color 0.2s, color 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--shell-divider)'; e.currentTarget.style.color = 'var(--ui-text-muted)'; }}
                  >
                    <Plus style={{ width: 20, height: 20 }} />
                    <span>Add</span>
                  </button>
                ) : (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: 12, borderRadius: 12,
                    background: 'var(--surface-floating-muted)', border: '1px solid var(--shell-dialog-border)',
                    gridColumn: 'span 2',
                  }}>
                    <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Label" style={{
                        background: 'var(--surface-panel-muted)', border: '1px solid var(--shell-divider)',
                        borderRadius: 6, padding: '4px 8px', color: 'var(--ui-text-primary)', fontSize: 12, outline: 'none',
                      }}
                    />
                    <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="URL" style={{
                        background: 'var(--surface-panel-muted)', border: '1px solid var(--shell-divider)',
                        borderRadius: 6, padding: '4px 8px', color: 'var(--ui-text-primary)', fontSize: 12, outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={newIcon} onChange={(e) => setNewIcon(e.target.value)}
                        placeholder="Emoji" style={{
                          width: 40, background: 'var(--surface-panel-muted)', border: '1px solid var(--shell-divider)',
                          borderRadius: 6, padding: '4px 6px', color: 'var(--ui-text-primary)', fontSize: 12, outline: 'none', textAlign: 'center',
                        }}
                      />
                      <button onClick={handleAddShortcut} style={{
                        flex: 1, padding: '4px 8px', borderRadius: 6,
                        background: 'var(--accent-primary)', border: 'none', color: 'var(--shell-frame-bg)',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}>Save</button>
                      <button onClick={() => setAddingShortcut(false)} style={{
                        padding: '4px 8px', borderRadius: 6,
                        background: 'var(--surface-panel-muted)', border: 'none', color: 'var(--ui-text-muted)',
                        fontSize: 11, cursor: 'pointer',
                      }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Recently Visited ── */}
            {recentVisits.length > 0 && (
              <div style={{ width: '100%', maxWidth: 560, marginTop: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--ui-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <Clock style={{ width: 12, height: 12 }} />
                  <span>Recently Visited</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {recentVisits.slice(0, 6).map((visit) => {
                    const visitFavicon = getFaviconUrl(visit.url, 32);
                    return (
                      <button
                        key={visit.url + visit.visitedAt}
                        onClick={() => addTab(visit.url)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 8,
                          background: 'transparent', border: 'none',
                          cursor: 'pointer', color: 'var(--ui-text-muted)', fontSize: 12, textAlign: 'left', width: '100%',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--ui-text-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-muted)'; }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--shell-item-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {visitFavicon ? (
                            <img src={visitFavicon} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <Globe style={{ width: 12, height: 12, opacity: 0.4 }} />
                          )}
                        </div>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {visit.title}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--ui-text-muted)', flexShrink: 0 }}>
                          {new URL(visit.url).hostname}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Card content (only when tabs exist) ── */}
      <div ref={wrapperRef} style={{
        width: '100%', height: '100%',
        display: hasTabs ? 'flex' : 'none', flexDirection: 'column',
        animation: hasTabs ? 'browserCardSlideUp 0.3s ease-out' : undefined,
      }}>
        {/* Drag handle — top edge of the card */}
        <div
          onMouseDown={handleDragStart}
          style={{
            height: 8,
            flexShrink: 0,
            cursor: 'ns-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: 'var(--surface-panel-muted)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-panel-muted)'; }}
          />
        </div>
        {/* Browser content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </>
  );
}

// Inner app component that uses mode context
function ShellAppInner() {
  const [nav, dispatch] = useReducer(navReducer, undefined, createInitialNavState);
  const active = selectActiveView(nav)!;
  const { mode: activeMode, setMode: setActiveMode } = useMode();
  const themePreference = useThemeStore((state) => state.theme);
  const setThemePreference = useThemeStore((state) => state.setTheme);
  const theme = useResolvedTheme(themePreference);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);

  const { isOpen: sidecarOpen, toggle: toggleSidecar, setOpen: setSidecarOpen } = useSidecarStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Fetch agents on mount for agent mode selection
  useEffect(() => {
    let cancelled = false
    const loadAgents = async () => {
      try {
        // Fetch agents from registry API
        await useAgentStore.getState().fetchAgents()
      } catch (error) {
        // Silent fail - agents will be loaded on demand when needed
        if (!cancelled && import.meta.env.DEV) {
          console.debug("[ShellApp] Agents fetch skipped (backend not running)")
        }
      }
    }
    void loadAgents()
    return () => {
      cancelled = true
    }
  }, [])

  // Connect global session sync SSE and do initial fetch — both live here at app root
  useEffect(() => {
    void useNativeAgentStore.getState().fetchSessions().catch(() => {});
    return useNativeAgentStore.getState().connectSessionSync();
  }, []);

  // Close the sidecar when leaving browser view so it doesn't leak into other modes
  const isBrowserView = active.viewType === 'browser' || active.viewType === 'browserview';
  useEffect(() => {
    if (!isBrowserView && sidecarOpen) {
      setSidecarOpen(false);
    }
  }, [isBrowserView]);

  // Sync view to persisted mode on mount
  useEffect(() => {
    // On initial load, open the view that matches the persisted mode
    if (activeMode === 'chat') open('chat');
    else if (activeMode === 'cowork') open('workspace');
    else if (activeMode === 'code') open('code');
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setMonitorOverlayOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useA2RHotkeys(PLATFORM_SHORTCUTS.GLOBAL.TOGGLE_AGENT_RUNNER.keys, () => {
    runner.openCompact();
  });

  const open = useCallback((viewType: ViewType) => {
    dispatch({ type: 'OPEN_VIEW', viewType });
  }, []);
  const openNew = useCallback((viewType: ViewType) => dispatch({ type: 'OPEN_VIEW', viewType, allowNew: true }), []);

  // Handle opening agent session views from chat composer.
  // Creates a real gizzi session and routes the initial message via sendMessageStream
  // so the ChatView embedded session path handles streaming — no stub views involved.
  const handleOpenAgentSession = useCallback(async (text: string, surface: 'chat' | 'cowork' | 'code' | 'browser') => {
    const selectedAgentId = useAgentSurfaceModeStore.getState().selectedAgentIdBySurface[surface];

    try {
      const session = await useNativeAgentStore.getState().createSession(
        text.slice(0, 50) || 'New Session',
        undefined,
        {
          sessionMode: selectedAgentId ? 'agent' : 'regular',
          agentId: selectedAgentId ?? undefined,
          originSurface: surface,
        },
      );

      // Wire session to this surface so ChatView renders it as embedded
      useNativeAgentStore.getState().setSurfaceSession(surface, session.id);

      // Navigate to the matching surface view (ChatView, CoworkRoot, etc.)
      const viewTypeMap: Record<typeof surface, ViewType> = {
        chat: 'chat',
        cowork: 'workspace',
        code: 'code',
        browser: 'browser',
      };
      dispatch({ type: 'OPEN_VIEW', viewType: viewTypeMap[surface] });

      // Send the initial message through the real gizzi streaming pipeline
      void useNativeAgentStore.getState().sendMessageStream(session.id, text);
    } catch (err) {
      console.error('[handleOpenAgentSession] Failed to create session:', err);
    }
  }, []);

  // Helper to get pending agent message safely
  const getPendingAgentMessage = useCallback((): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    const msg = window.sessionStorage.getItem('a2r-pending-agent-message');
    // Clear after reading to prevent reuse
    window.sessionStorage.removeItem('a2r-pending-agent-message');
    return msg || undefined;
  }, []);

  const registry = useMemo(() => createViewRegistry({
    home: () => <ChatViewWrapper onOpenAgentSession={handleOpenAgentSession} />,
    chat: () => <ChatViewWrapper onOpenAgentSession={handleOpenAgentSession} />,
    "chat-legacy": () => <ChatViewWrapper onOpenAgentSession={handleOpenAgentSession} />,
    workspace: CoworkRoot,
    browser: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Browser" />}
        onError={(error, errorInfo) => {
          console.error('[Browser] Error:', error);
          console.error('[Browser] Component Stack:', errorInfo.componentStack);
        }}
      >
        <BrowserPaneWrapper><BrowserCapsuleEnhanced /></BrowserPaneWrapper>
      </ErrorBoundary>
    ),
    browserview: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Browser" />}
        onError={(error, errorInfo) => {
          console.error('[Browser] Error:', error);
          console.error('[Browser] Component Stack:', errorInfo.componentStack);
        }}
      >
        <BrowserPaneWrapper><BrowserCapsuleEnhanced /></BrowserPaneWrapper>
      </ErrorBoundary>
    ),
    studio: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Studio" />}
        onError={(error, errorInfo) => {
          console.error('[Studio] Error:', error);
          console.error('[Studio] Component Stack:', errorInfo.componentStack);
        }}
      >
        <AgentView />
      </ErrorBoundary>
    ),
    marketplace: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Marketplace" />}
        onError={(error, errorInfo) => {
          console.error('[Marketplace] Error:', error);
          console.error('[Marketplace] Component Stack:', errorInfo.componentStack);
        }}
      >
        <MarketplaceView />
      </ErrorBoundary>
    ),
    plugins: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Plugin Registry" />}
        onError={(error, errorInfo) => {
          console.error('[PluginRegistry] Error:', error);
          console.error('[PluginRegistry] Component Stack:', errorInfo.componentStack);
        }}
      >
        <PluginRegistryView />
      </ErrorBoundary>
    ),
    registry: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Tools Registry" />}
        onError={(error, errorInfo) => {
          console.error('[ToolsRegistry] Error:', error);
          console.error('[ToolsRegistry] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ToolsView />
      </ErrorBoundary>
    ),
    memory: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Skills Registry" />}
        onError={(error, errorInfo) => {
          console.error('[SkillsRegistry] Error:', error);
          console.error('[SkillsRegistry] Component Stack:', errorInfo.componentStack);
        }}
      >
        <SkillsRegistryView />
      </ErrorBoundary>
    ),
    settings: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Settings" />}
        onError={(error, errorInfo) => {
          console.error('[Settings] Error:', error);
          console.error('[Settings] Component Stack:', errorInfo.componentStack);
        }}
      >
        <SettingsView />
      </ErrorBoundary>
    ),
    terminal: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Terminal" />}
        onError={(error, errorInfo) => {
          console.error('[Terminal] Error:', error);
          console.error('[Terminal] Component Stack:', errorInfo.componentStack);
        }}
      >
        <TerminalView />
      </ErrorBoundary>
    ),
    monitor: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Monitor" />}
        onError={(error, errorInfo) => {
          console.error('[Monitor] Error:', error);
          console.error('[Monitor] Component Stack:', errorInfo.componentStack);
        }}
      >
        <MonitorView />
      </ErrorBoundary>
    ),
    runner: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Agent Runner" />}
        onError={(error, errorInfo) => {
          console.error('[Runner] Error:', error);
          console.error('[Runner] Component Stack:', errorInfo.componentStack);
        }}
      >
        <AgentSystemView />
      </ErrorBoundary>
    ),
    rails: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Rails" />}
        onError={(error, errorInfo) => {
          console.error('[Rails] Error:', error);
          console.error('[Rails] Component Stack:', errorInfo.componentStack);
        }}
      >
        <AgentSystemView />
      </ErrorBoundary>
    ),
    "run-replay": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Run Replay" />}
        onError={(error, errorInfo) => {
          console.error('[RunReplay] Error:', error);
          console.error('[RunReplay] Component Stack:', errorInfo.componentStack);
        }}
      >
        <RunReplayView />
      </ErrorBoundary>
    ),
    promotion: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Promotion Dashboard" />}
        onError={(error, errorInfo) => {
          console.error('[PromotionDashboard] Error:', error);
          console.error('[PromotionDashboard] Component Stack:', errorInfo.componentStack);
        }}
      >
        <PromotionDashboardView />
      </ErrorBoundary>
    ),
    "models-manage": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Model Management" />}
        onError={(error, errorInfo) => {
          console.error('[ModelManagement] Error:', error);
          console.error('[ModelManagement] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ModelManagementView />
      </ErrorBoundary>
    ),
    code: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Code Editor" />}
        onError={(error, errorInfo) => {
          console.error('[CodeRoot] Error:', error);
          console.error('[CodeRoot] Component Stack:', errorInfo.componentStack);
        }}
      >
        <CodeRoot />
      </ErrorBoundary>
    ),
    playground: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Playground" />}
        onError={(error, errorInfo) => {
          console.error('[Playground] Error:', error);
          console.error('[Playground] Component Stack:', errorInfo.componentStack);
        }}
      >
        <PlaygroundView />
      </ErrorBoundary>
    ),
    elements: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Elements" />}
        onError={(error, errorInfo) => {
          console.error('[Elements] Error:', error);
          console.error('[Elements] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ElementsView />
      </ErrorBoundary>
    ),
    agent: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Agent Hub" />}
        onError={(error, errorInfo) => {
          console.error('[AgentHub] Error:', error);
          console.error('[AgentHub] Component Stack:', errorInfo.componentStack);
        }}
      >
        <AgentHub />
      </ErrorBoundary>
    ),
    'agent-hub': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Agent Hub" />}
        onError={(error, errorInfo) => {
          console.error('[AgentHub] Error:', error);
          console.error('[AgentHub] Component Stack:', errorInfo.componentStack);
        }}
      >
        <AgentHub />
      </ErrorBoundary>
    ),
    "native-agent": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Native Agent" />}
        onError={(error, errorInfo) => {
          console.error('[NativeAgent] Error:', error);
          console.error('[NativeAgent] Component Stack:', errorInfo.componentStack);
        }}
      >
        <NativeAgentView onOpenRuntimeOps={() => open("runtime-ops")} />
      </ErrorBoundary>
    ),
    openclaw: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<OpenClawErrorFallback />}>
        <OpenClawControlUI />
      </ErrorBoundary>
    ),
    "openclaw-chat": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<OpenClawErrorFallback />}>
        <OpenClawControlUI />
      </ErrorBoundary>
    ),
    "openclaw-sessions": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<OpenClawErrorFallback />}>
        <OpenClawControlUI />
      </ErrorBoundary>
    ),
    dag: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load DAG Integration</div>}>
        <DagIntegrationPage />
      </ErrorBoundary>
    ),
    // Cloud Deploy View
    deploy: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Cloud Deploy</div>}>
        <CloudDeployView />
      </ErrorBoundary>
    ),
    // Node Management View
    nodes: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Nodes</div>}>
        <NodesView />
      </ErrorBoundary>
    ),
    // Capsule Management View (P3.9 MCP Apps)
    capsules: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Capsule Manager</div>}>
        <CapsuleManagerView />
      </ErrorBoundary>
    ),
    // Operator Browser Control View (P3.10/P3.12)
    operator: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Operator Browser</div>}>
        <OperatorBrowserView />
      </ErrorBoundary>
    ),
    // P3 UI Views
    "a2r-ix": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load A2R-IX Renderer</div>}>
        <A2RIXRendererView />
      </ErrorBoundary>
    ),
    "form-surfaces": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Form Surfaces</div>}>
        <FormSurfacesView />
      </ErrorBoundary>
    ),
    canvas: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Canvas Protocol</div>}>
        <CanvasProtocolView />
      </ErrorBoundary>
    ),
    "a2r-canvas": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load A2r-Canvas</div>}>
        <A2rCanvasView
          sourceView={(context.viewType as any) || 'chat'}
          sessionId={context.viewId}
        />
      </ErrorBoundary>
    ),
    // A2rOS - Super-Agent OS View
    "a2r-os": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load A2rOS</div>}>
        <A2rOSView context={context} />
      </ErrorBoundary>
    ),
    hooks: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Hooks System</div>}>
        <HooksSystemView />
      </ErrorBoundary>
    ),
    // P4 UI Views
    evolution: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Evolution Layer</div>}>
        <EvolutionLayerView />
      </ErrorBoundary>
    ),
    "context-control": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Context Control</div>}>
        <ContextControlPlaneView />
      </ErrorBoundary>
    ),
    "memory-kernel": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Memory Kernel</div>}>
        <MemoryKernelView />
      </ErrorBoundary>
    ),
    acf: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Autonomous Code Factory</div>}>
        <AutonomousCodeFactoryView />
      </ErrorBoundary>
    ),
    // Infrastructure views (P4 DAG tasks)
    swarm: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Swarm Monitor" />}
        onError={(error, errorInfo) => {
          console.error('[SwarmMonitor] Error:', error);
          console.error('[SwarmMonitor] Component Stack:', errorInfo.componentStack);
        }}
      >
        <SwarmMonitor />
      </ErrorBoundary>
    ),
    policy: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Policy Manager" />}
        onError={(error, errorInfo) => {
          console.error('[PolicyManager] Error:', error);
          console.error('[PolicyManager] Component Stack:', errorInfo.componentStack);
        }}
      >
        <PolicyManager />
      </ErrorBoundary>
    ),
    "task-executor": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Task Executor" />}
        onError={(error, errorInfo) => {
          console.error('[TaskExecutor] Error:', error);
          console.error('[TaskExecutor] Component Stack:', errorInfo.componentStack);
        }}
      >
        <TaskExecutor />
      </ErrorBoundary>
    ),
    ontology: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Ontology Viewer" />}
        onError={(error, errorInfo) => {
          console.error('[OntologyViewer] Error:', error);
          console.error('[OntologyViewer] Component Stack:', errorInfo.componentStack);
        }}
      >
        <OntologyViewer />
      </ErrorBoundary>
    ),
    // AI & Vision views (P4/P5 DAG tasks)
    ivkge: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="IVKGE Panel" />}
        onError={(error, errorInfo) => {
          console.error('[IVKGEPanel] Error:', error);
          console.error('[IVKGEPanel] Component Stack:', errorInfo.componentStack);
        }}
      >
        <IVKGEPanel />
      </ErrorBoundary>
    ),
    multimodal: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Multimodal Input" />}
        onError={(error, errorInfo) => {
          console.error('[MultimodalInput] Error:', error);
          console.error('[MultimodalInput] Component Stack:', errorInfo.componentStack);
        }}
      >
        <MultimodalInput />
      </ErrorBoundary>
    ),
    tambo: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Tambo Studio" />}
        onError={(error, errorInfo) => {
          console.error('[TamboStudio] Error:', error);
          console.error('[TamboStudio] Component Stack:', errorInfo.componentStack);
        }}
      >
        <TamboStudio />
      </ErrorBoundary>
    ),
    // Security & Governance views (P5 DAG tasks)
    receipts: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Receipts Viewer" />}
        onError={(error, errorInfo) => {
          console.error('[ReceiptsViewer] Error:', error);
          console.error('[ReceiptsViewer] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ReceiptsViewer />
      </ErrorBoundary>
    ),
    "policy-gating": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Policy Gating" />}
        onError={(error, errorInfo) => {
          console.error('[PolicyGating] Error:', error);
          console.error('[PolicyGating] Component Stack:', errorInfo.componentStack);
        }}
      >
        <PolicyGating />
      </ErrorBoundary>
    ),
    security: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Security Dashboard" />}
        onError={(error, errorInfo) => {
          console.error('[SecurityDashboard] Error:', error);
          console.error('[SecurityDashboard] Component Stack:', errorInfo.componentStack);
        }}
      >
        <SecurityDashboard />
      </ErrorBoundary>
    ),
    purpose: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Purpose Binding" />}
        onError={(error, errorInfo) => {
          console.error('[PurposeBinding] Error:', error);
          console.error('[PurposeBinding] Component Stack:', errorInfo.componentStack);
        }}
      >
        <PurposeBinding />
      </ErrorBoundary>
    ),
    // Browser & Execution views (P5 DAG tasks)
    "dag-wih": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="DAG WIH" />}
        onError={(error, errorInfo) => {
          console.error('[DAGWIH] Error:', error);
          console.error('[DAGWIH] Component Stack:', errorInfo.componentStack);
        }}
      >
        <DAGWIH />
      </ErrorBoundary>
    ),
    checkpointing: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Checkpointing" />}
        onError={(error, errorInfo) => {
          console.error('[Checkpointing] Error:', error);
          console.error('[Checkpointing] Component Stack:', errorInfo.componentStack);
        }}
      >
        <Checkpointing />
      </ErrorBoundary>
    ),
    // Observability views (P4 DAG tasks)
    observability: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Observability Dashboard" />}
        onError={(error, errorInfo) => {
          console.error('[ObservabilityDashboard] Error:', error);
          console.error('[ObservabilityDashboard] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ObservabilityDashboard />
      </ErrorBoundary>
    ),
    // Services views
    directive: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Directive Compiler" />}
        onError={(error, errorInfo) => {
          console.error('[DirectiveCompiler] Error:', error);
          console.error('[DirectiveCompiler] Component Stack:', errorInfo.componentStack);
        }}
      >
        <DirectiveCompiler />
      </ErrorBoundary>
    ),
    evaluation: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Evaluation Harness" />}
        onError={(error, errorInfo) => {
          console.error('[EvaluationHarness] Error:', error);
          console.error('[EvaluationHarness] Component Stack:', errorInfo.componentStack);
        }}
      >
        <EvaluationHarness />
      </ErrorBoundary>
    ),
    "gc-agents": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="GC Agents" />}
        onError={(error, errorInfo) => {
          console.error('[GCAgents] Error:', error);
          console.error('[GCAgents] Component Stack:', errorInfo.componentStack);
        }}
      >
        <GCAgents />
      </ErrorBoundary>
    ),
    // Runtime Management Views (N11, N12, N16)
    "runtime-ops": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Runtime Operations" />}
        onError={(error, errorInfo) => {
          console.error('[RuntimeOperations] Error:', error);
          console.error('[RuntimeOperations] Component Stack:', errorInfo.componentStack);
        }}
      >
        <RuntimeOperationsView onOpenView={open} />
      </ErrorBoundary>
    ),
    "budget-dashboard": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Budget Dashboard" />}
        onError={(error, errorInfo) => {
          console.error('[BudgetDashboard] Error:', error);
          console.error('[BudgetDashboard] Component Stack:', errorInfo.componentStack);
        }}
      >
        <BudgetDashboardView />
      </ErrorBoundary>
    ),
    "replay-manager": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Replay Manager" />}
        onError={(error, errorInfo) => {
          console.error('[ReplayManager] Error:', error);
          console.error('[ReplayManager] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ReplayManagerView />
      </ErrorBoundary>
    ),
    "prewarm-manager": ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Prewarm Manager" />}
        onError={(error, errorInfo) => {
          console.error('[PrewarmManager] Error:', error);
          console.error('[PrewarmManager] Component Stack:', errorInfo.componentStack);
        }}
      >
        <PrewarmManagerView />
      </ErrorBoundary>
    ),
    // Chat History views
    history: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="History" />}
        onError={(error, errorInfo) => {
          console.error('[History] Error:', error);
          console.error('[History] Component Stack:', errorInfo.componentStack);
        }}
      >
        <HistoryView />
      </ErrorBoundary>
    ),
    archived: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Archived" />}
        onError={(error, errorInfo) => {
          console.error('[Archived] Error:', error);
          console.error('[Archived] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ArchivedView />
      </ErrorBoundary>
    ),
    // Global Search
    search: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Search" />}
        onError={(error, errorInfo) => {
          console.error('[MagnifyingGlass] Error:', error);
          console.error('[MagnifyingGlass] Component Stack:', errorInfo.componentStack);
        }}
      >
        <SearchView />
      </ErrorBoundary>
    ),
    // Debug view
    debug: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Debug" />}
        onError={(error, errorInfo) => {
          console.error('[Debug] Error:', error);
          console.error('[Debug] Component Stack:', errorInfo.componentStack);
        }}
      >
        <DebugView />
      </ErrorBoundary>
    ),
    // Cowork Analytics views
    insights: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Insights" />}
        onError={(error, errorInfo) => {
          console.error('[Insights] Error:', error);
          console.error('[Insights] Component Stack:', errorInfo.componentStack);
        }}
      >
        <InsightsView />
      </ErrorBoundary>
    ),
    activity: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Activity" />}
        onError={(error, errorInfo) => {
          console.error('[Activity] Error:', error);
          console.error('[Activity] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ActivityView />
      </ErrorBoundary>
    ),
    goals: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Goals" />}
        onError={(error, errorInfo) => {
          console.error('[Goals] Error:', error);
          console.error('[Goals] Component Stack:', errorInfo.componentStack);
        }}
      >
        <GoalsView />
      </ErrorBoundary>
    ),
    // Sprint 4 - Cowork content views
    'cowork-runs': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Cowork Runs" />}
        onError={(error, errorInfo) => {
          console.error('[CoworkRuns] Error:', error);
          console.error('[CoworkRuns] Component Stack:', errorInfo.componentStack);
        }}
      >
        <CoworkRunsView />
      </ErrorBoundary>
    ),
    'cowork-drafts': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Drafts" />}
        onError={(error, errorInfo) => {
          console.error('[Drafts] Error:', error);
          console.error('[Drafts] Component Stack:', errorInfo.componentStack);
        }}
      >
        <DraftsView />
      </ErrorBoundary>
    ),
    'cowork-tasks': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Tasks" />}
        onError={(error, errorInfo) => {
          console.error('[Tasks] Error:', error);
          console.error('[Tasks] Component Stack:', errorInfo.componentStack);
        }}
      >
        <TasksView />
      </ErrorBoundary>
    ),
    'cowork-cron': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Cron" />}
        onError={(error, errorInfo) => {
          console.error('[Cron] Error:', error);
          console.error('[Cron] Component Stack:', errorInfo.componentStack);
        }}
      >
        <CronView />
      </ErrorBoundary>
    ),
    'cowork-project': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Cowork Project" />}
        onError={(error, errorInfo) => {
          console.error('[CoworkProject] Error:', error);
          console.error('[CoworkProject] Component Stack:', errorInfo.componentStack);
        }}
      >
        <CoworkProjectView />
      </ErrorBoundary>
    ),
    'cowork-documents': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Documents" />}
        onError={(error, errorInfo) => {
          console.error('[Documents] Error:', error);
          console.error('[Documents] Component Stack:', errorInfo.componentStack);
        }}
      >
        <DocumentsView />
      </ErrorBoundary>
    ),
    'cowork-tables': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Tables" />}
        onError={(error, errorInfo) => {
          console.error('[Tables] Error:', error);
          console.error('[Tables] Component Stack:', errorInfo.componentStack);
        }}
      >
        <TablesView />
      </ErrorBoundary>
    ),
    'cowork-files': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Files" />}
        onError={(error, errorInfo) => {
          console.error('[Files] Error:', error);
          console.error('[Files] Component Stack:', errorInfo.componentStack);
        }}
      >
        <FilesView />
      </ErrorBoundary>
    ),
    'cowork-exports': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Exports" />}
        onError={(error, errorInfo) => {
          console.error('[Exports] Error:', error);
          console.error('[Exports] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ExportsView />
      </ErrorBoundary>
    ),
    'cowork-new-task': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="New Task" />}
        onError={(error, errorInfo) => {
          console.error('[CoworkNewTask] Error:', error);
          console.error('[CoworkNewTask] Component Stack:', errorInfo.componentStack);
        }}
      >
        <CoworkRoot />
      </ErrorBoundary>
    ),
    products: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Products Discovery" />}
        onError={(error, errorInfo) => {
          console.error('[ProductsDiscovery] Error:', error);
          console.error('[ProductsDiscovery] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ProductsDiscoveryView />
      </ErrorBoundary>
    ),
    // Sprint 5 - Code sub-views
    'code-explorer': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Code Explorer" />}
        onError={(error, errorInfo) => {
          console.error('[CodeExplorer] Error:', error);
          console.error('[CodeExplorer] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ExplorerView />
      </ErrorBoundary>
    ),
    'code-git': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Git" />}
        onError={(error, errorInfo) => {
          console.error('[Git] Error:', error);
          console.error('[Git] Component Stack:', errorInfo.componentStack);
        }}
      >
        <GitView />
      </ErrorBoundary>
    ),
    'code-threads': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Code Threads" />}
        onError={(error, errorInfo) => {
          console.error('[CodeThreads] Error:', error);
          console.error('[CodeThreads] Component Stack:', errorInfo.componentStack);
        }}
      >
        <ThreadsView />
      </ErrorBoundary>
    ),
    'code-automations': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Code Cron" />}
        onError={(error, errorInfo) => {
          console.error('[CodeCron] Error:', error);
          console.error('[CodeCron] Component Stack:', errorInfo.componentStack);
        }}
      >
        <CronView />
      </ErrorBoundary>
    ),
    'code-skills': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Code Skills" />}
        onError={(error, errorInfo) => {
          console.error('[CodeSkills] Error:', error);
          console.error('[CodeSkills] Component Stack:', errorInfo.componentStack);
        }}
      >
        <SkillsView />
      </ErrorBoundary>
    ),
    'code-project': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Code Workspace" />}
        onError={(error, errorInfo) => {
          console.error('[CodeProject] Error:', error);
          console.error('[CodeProject] Component Stack:', errorInfo.componentStack);
        }}
      >
        <CodeProjectView />
      </ErrorBoundary>
    ),
    // Agent Session Views - Full-screen agent experiences
    'chat-agent-session': ({ context }: { context: ViewContext }) => (
      <ChatModeAgentSession 
        mode="chat"
        sessionId={context.viewId}
        context={typeof window !== 'undefined' ? window.sessionStorage.getItem('a2r-pending-agent-message') || undefined : undefined}
        onClose={() => open('chat')}
      />
    ),
    'cowork-agent-session': ({ context }: { context: ViewContext }) => (
      <CoworkModeAgentTasks 
        mode="cowork"
        onClose={() => open('workspace')}
      />
    ),
    'code-agent-session': ({ context }: { context: ViewContext }) => (
      <CodeModeADE 
        mode="code"
        sessionId={context.viewId}
        onClose={() => open('code')}
      />
    ),
    'browser-agent-session': ({ context }: { context: ViewContext }) => (
      <BrowserModeAgentSession 
        mode="browser"
        sessionId={context.viewId}
        onClose={() => open('browser')}
      />
    ),
    // New document/file - open workspace view with create mode
    'new-document': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div style={{ padding: 16, color: 'var(--text-secondary)' }}>Failed to load</div>}>
        <CoworkRoot />
      </ErrorBoundary>
    ),
    'new-file': ({ context }: { context: ViewContext }) => (
      <ErrorBoundary fallback={<div style={{ padding: 16, color: 'var(--text-secondary)' }}>Failed to load</div>}>
        <CodeRoot />
      </ErrorBoundary>
    ),
    // Visual Verification View
    verification: ({ context }: { context: ViewContext }) => (
      <ErrorBoundary
        fallback={<ErrorFallbackWrapper viewName="Visual Verification" />}
        onError={(error, errorInfo) => {
          console.error('[VisualVerification] Error:', error);
          console.error('[VisualVerification] Component Stack:', errorInfo.componentStack);
        }}
      >
        <VerificationView />
      </ErrorBoundary>
    ),
  }), [handleOpenAgentSession, open]);

  const runner = useRunnerStore();
  
  useA2RHotkeys(PLATFORM_SHORTCUTS.GLOBAL.TOGGLE_AGENT_RUNNER.keys, () => {
    runner.openCompact();
  });

  useEffect(() => {
    const cleanup = initBrowserSurfaceBridge();
    return () => cleanup();
  }, []);


  // Listen for settings open events from drill-down menu
  useEffect(() => {
    const handleOpenSettings = () => {
      open('settings');
    };
    window.addEventListener('a2r:open-settings' as any, handleOpenSettings);
    return () => window.removeEventListener('a2r:open-settings' as any, handleOpenSettings);
  }, [open]);

  // Listen for settings close events to return to previous view
  useEffect(() => {
    const handleCloseSettings = () => {
      // Navigate back to chat view when closing settings
      open('chat');
    };
    window.addEventListener('a2r:close-settings' as any, handleCloseSettings);
    return () => window.removeEventListener('a2r:close-settings' as any, handleCloseSettings);
  }, [open]);

  const handleModeChange = useCallback((mode: AppMode) => {
    setActiveMode(mode);
    if (mode === 'chat') open('chat');
    if (mode === 'cowork') open('workspace');
    if (mode === 'code') open('code');
  }, [setActiveMode, open]);

  // Get session from auth (will be passed from server component wrapper)
  const session = null; // TODO: Get from auth context

  const [monitorOverlayOpen, setMonitorOverlayOpen] = useState(false);
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [agentationEnabled, setAgentationEnabled] = useState(false);
  const [pluginPanelOpen, setPluginPanelOpen] = useState(false);

  return (
    <TooltipProvider>
      <VoiceProvider>
      <SessionProvider session={session}>
        <VisionGlass />
        
        {/* Global Voice Presence Overlay */}
        <VoicePresence compact={false} />
        
        <ShellFrame
          isRailCollapsed={isRailCollapsed}
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
              onSidecarToggle={toggleSidecar}
              sidecarOpen={sidecarOpen}
            />
          }
          canvas={
            <ShellCanvas>
              <ViewHost active={active} registry={registry} />
            </ShellCanvas>
          }
          sidecarOpen={sidecarOpen}
          sidecar={<ArtifactSidecar />}
          overlays={<>
            <ShellOverlayLayer />
            <LegacyWidgetsLayer />
          </>}
          dock={null}
        />
        
                <RailControls 
                  mode={activeMode}
                  onModeChange={handleModeChange}
                  onToggleRail={() => setIsRailCollapsed(!isRailCollapsed)}
                  onNewChat={() => {
                    // Clear any embedded session and active thread so ChatView renders
                    // the blank composer — the session is created when the user sends a message.
                    useEmbeddedAgentSessionStore.getState().clearSurfaceSession('chat');
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
                      const session = await useNativeAgentStore
                        .getState()
                        .createSession('Agent Session', undefined, {
                          originSurface,
                          sessionMode: 'agent',
                          agentId: selectedAgent?.id,
                          agentName: selectedAgent?.name,
                          workspaceScope: getOpenClawWorkspacePathFromAgent(selectedAgent) ?? undefined,
                          runtimeModel: selectedAgent?.model,
                          agentFeatures: {
                            workspace: true,
                            tools: true,
                          },
                        });

                      useNativeAgentStore.getState().setActiveSession(session.id);

                      if (
                        originSurface === 'chat' ||
                        originSurface === 'code' ||
                        originSurface === 'cowork' ||
                        originSurface === 'browser'
                      ) {
                        useEmbeddedAgentSessionStore
                          .getState()
                          .setSurfaceSession(originSurface, session.id);
                        if (selectedAgent?.id) {
                          useAgentSurfaceModeStore
                            .getState()
                            .setSelectedAgent(originSurface, selectedAgent.id);
                        }

                        if (originSurface === 'browser') {
                          setSidecarOpen(true);
                          open('browser');
                          return;
                        }

                        if (originSurface === 'cowork') {
                          handleModeChange('cowork');
                          return;
                        }

                        handleModeChange(originSurface === 'code' ? 'code' : 'chat');
                        return;
                      }

                      open('native-agent');
                    } catch (error) {
                      console.error('[ShellApp] Failed to create agent session from rail controls', error);
                      open('native-agent');
                    }
                  }}
                  isRailCollapsed={isRailCollapsed}
                  activeViewType={active.viewType}
                  onOpenView={open as (viewType: string) => void}
                  onOpenPlugins={() => setPluginPanelOpen(true)}
                />
        <ConsoleDrawer />
        <ConversationMonitorOverlay
          open={monitorOverlayOpen}
          onClose={() => setMonitorOverlayOpen(false)}
        />
        <ControlCenter
          isOpen={isControlCenterOpen}
          onClose={() => setIsControlCenterOpen(false)}
          isDevMode={process.env.NODE_ENV === 'development'}
          agentationEnabled={agentationEnabled}
          onToggleAgentation={setAgentationEnabled}
          onOpenView={open as (viewType: string) => void}
        />
        <PluginManagerPanel
          isOpen={pluginPanelOpen}
          onClose={() => setPluginPanelOpen(false)}
          onOpenSettings={() => {
            setPluginPanelOpen(false);
            sessionStorage.setItem('a2r-settings-section', 'integrations');
            sessionStorage.setItem('a2r-settings-tab', 'connectors');
            open('settings');
          }}
        />
        
        {/* Agentation - UI iteration tool (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <Agentation 
            endpoint="http://localhost:4747"
            onSessionCreated={(sessionId) => {
              console.log('[Agentation] Session started:', sessionId);
            }}
          />
        )}
      </SessionProvider>
      </VoiceProvider>
    </TooltipProvider>
  );
}

// Main ShellApp that provides Mode context
export function ShellApp() {
  return (
    <ModeProvider>
      <GlobalDropzoneProvider>
        <ShellAppInner />
      </GlobalDropzoneProvider>
    </ModeProvider>
  );
}

function Placeholder({ context }: { context: ViewContext }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{context.viewType}</div>
      <div style={{ opacity: 0.8 }}>View ID: {context.viewId}</div>
      <div style={{ opacity: 0.6, fontSize: '12px', marginTop: 8 }}>
        Replace this view via ViewRegistry or integration/a2r/legacy.bridge.
      </div>
    </div>
  );
}
