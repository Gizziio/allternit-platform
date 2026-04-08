"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CaretDown,
  Code as CodeIcon,
  FolderSimple,
  Sparkle,
  TerminalWindow,
  Bug,
  Stack,
  Lightning,
} from '@phosphor-icons/react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { AgentContextStrip } from '@/components/agents/AgentContextStrip';
import type { GizziAttention } from '@/components/ai-elements/GizziMascot';
import { StreamingChatComposer } from '@/components/chat/StreamingChatComposer';
import { ChatComposer } from '../chat/ChatComposer';
import {
  useRustStreamAdapter,
  type ChatMessage as StreamChatMessage,
} from '@/lib/ai/rust-stream-adapter';
import { useRunnerStore } from '../../runner/runner.store';
import { useDrawerStore } from '../../drawers/drawer.store';
import {
  getActiveSession,
  getActiveWorkspace,
  getSessionsForWorkspace,
  useCodeModeStore,
} from './CodeModeStore';
import { CodeLaunchBranding } from './CodeLaunchBranding';
import {
  buildAgentConversationContext,
  useSurfaceAgentSelection,
} from '@/lib/agents/surface-agent-context';
import {
  mapNativeMessagesToStreamMessages,
  useEmbeddedAgentSession,
  useEmbeddedAgentSessionStore,
  useNativeAgentStore,
} from '@/lib/agents';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ACIComputerUseBar } from '@/capsules/browser/ACIComputerUseSidecar';

const CONTENT_WIDTH = 760;
const CODE_MODEL_NAMES: Record<string, string> = {
  codex: 'Codex CLI',
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  'kimi-cli': 'Kimi CLI',
};

const CODE_CHAT_MODEL_FALLBACKS: Record<string, string> = {
  codex: 'kimi/kimi-for-coding',
  'claude-code': 'kimi/kimi-for-coding',
  'gemini-cli': 'kimi/kimi-for-coding',
  'kimi-cli': 'kimi/kimi-for-coding',
};

function resolveCodeChatModel(modelId: string): string {
  return CODE_CHAT_MODEL_FALLBACKS[modelId] ?? modelId;
}

type ActionGroupId = 'scaffold' | 'refactor' | 'debug' | 'optimize' | 'explore';

interface ActionGroup {
  id: ActionGroupId;
  label: string;
  accent: string;
  icon: React.ComponentType<any>;
  templates: Array<{ label: string; prompt: string }>;
}

const CODE_ACTION_GROUPS: ActionGroup[] = [
  {
    id: 'scaffold',
    label: 'Scaffold',
    accent: '#6B9A7B',
    icon: Sparkle,
    templates: [
      {
        label: 'New component',
        prompt:
          'Create a production-ready UI component for this workspace. Include typed props, accessibility, tests to add, and the files you plan to touch.',
      },
      {
        label: 'Route shell',
        prompt:
          'Scaffold a new route or view in this codebase. Outline the files to add, wiring required, and the safest implementation order before editing.',
      },
      {
        label: 'API surface',
        prompt:
          'Design the API contract and implementation plan for a new endpoint or integration. Include validation, failure paths, and observability notes.',
      },
    ],
  },
  {
    id: 'refactor',
    label: 'Refactor',
    accent: '#D97757',
    icon: Stack,
    templates: [
      {
        label: 'Split component',
        prompt:
          'Refactor the current area into smaller, testable units without changing behavior. Call out the seams first, then propose the exact file edits.',
      },
      {
        label: 'Reduce duplication',
        prompt:
          'Find duplicated UI or logic in the current workflow and consolidate it into a shared abstraction with minimal regression risk.',
      },
      {
        label: 'State cleanup',
        prompt:
          'Audit the local state in this feature, simplify it, and remove unnecessary coupling while preserving the current user flow.',
      },
    ],
  },
  {
    id: 'debug',
    label: 'Debug',
    accent: '#C96554',
    icon: Bug,
    templates: [
      {
        label: 'UI regression',
        prompt:
          'Investigate a UI regression in this area. Trace the likely cause, list the files involved, and propose the smallest safe fix.',
      },
      {
        label: 'Runtime error',
        prompt:
          'Debug a runtime error in this code path. Identify the failing assumption, defensive fix, and verification steps before changing code.',
      },
      {
        label: 'Layout conflict',
        prompt:
          'Find and fix the layout collision affecting this view. Prioritize deterministic sizing and minimal side effects across breakpoints.',
      },
    ],
  },
  {
    id: 'optimize',
    label: 'Optimize',
    accent: '#D4A15A',
    icon: Lightning,
    templates: [
      {
        label: 'Render pass',
        prompt:
          'Review this UI path for avoidable renders and expensive layout work. Recommend the highest-leverage optimization with proof.',
      },
      {
        label: 'Bundle trim',
        prompt:
          'Look for heavy imports or duplicate UI primitives in this feature and suggest a targeted bundle-size reduction plan.',
      },
      {
        label: 'Workflow speed',
        prompt:
          'Identify the slowest part of this interaction flow and propose a user-visible performance improvement without hiding state.',
      },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    accent: '#579BD9',
    icon: Sparkle,
    templates: [
      {
        label: 'Implementation plan',
        prompt:
          'Survey the relevant files for this request and return a concise implementation plan with risks, dependencies, and test impact.',
      },
      {
        label: 'Spec check',
        prompt:
          'Cross-check the current UI against the governing specs and acceptance tests. List any mismatches before making edits.',
      },
      {
        label: 'Safer alternative',
        prompt:
          'Propose a safer implementation approach for this task if the obvious fix risks regressions. Be explicit about the tradeoff.',
      },
    ],
  },
];

const utilityControlStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(14, 17, 20, 0.2)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

const codeMenuTheme = {
  menuBg: '#332D27',
  menuBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  hoverBg: 'rgba(255,255,255,0.05)',
};

const codeOverlaySurfaceStyle: React.CSSProperties = {
  borderRadius: 12,
  border: `1px solid ${codeMenuTheme.menuBorder}`,
  background: codeMenuTheme.menuBg,
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
};

const codeOverlayHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: '8px 12px 10px',
  borderBottom: `1px solid ${codeMenuTheme.menuBorder}`,
};

const codeOverlayLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: codeMenuTheme.accent,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export function CodeCanvas({ isPreviewCollapsed: _isPreviewCollapsed }: any) {
  const openDrawer = useDrawerStore((state) => state.openDrawer);
  const setConsoleTab = useDrawerStore((state) => state.setConsoleTab);
  const embeddedAgentSession = useEmbeddedAgentSession('code');
  const codeAgentModeEnabled = embeddedAgentSession.isEmbedded && embeddedAgentSession.descriptor.sessionMode === 'agent';
  const clearEmbeddedAgentSession = useEmbeddedAgentSessionStore(
    (state) => state.clearSurfaceSession,
  );
  const setActiveNativeSession = useNativeAgentStore(
    (state) => state.setActiveSession,
  );
  const fetchNativeMessages = useNativeAgentStore((state) => state.fetchMessages);
  const fetchNativeCanvases = useNativeAgentStore(
    (state) => state.fetchSessionCanvases,
  );
  const nativeMessages = useNativeAgentStore((state) =>
    embeddedAgentSession.sessionId
      ? state.messages[embeddedAgentSession.sessionId] || []
      : [],
  );
  const embeddedCanvasIds = useNativeAgentStore((state) =>
    embeddedAgentSession.sessionId
      ? state.sessionCanvases[embeddedAgentSession.sessionId] || []
      : [],
  );

  const workspaces = useCodeModeStore((state) => state.workspaces);
  const sessions = useCodeModeStore((state) => state.sessions);
  const activeWorkspaceId = useCodeModeStore((state) => state.activeWorkspaceId);
  const activeSessionId = useCodeModeStore((state) => state.activeSessionId);
  const setActiveWorkspace = useCodeModeStore((state) => state.setActiveWorkspace);
  const setActiveSession = useCodeModeStore((state) => state.setActiveSession);

  const stateShape = useMemo(
    () => ({ workspaces, sessions, activeWorkspaceId, activeSessionId }),
    [activeSessionId, activeWorkspaceId, sessions, workspaces],
  );
  const activeWorkspace = useMemo(() => getActiveWorkspace(stateShape), [stateShape]);
  const activeSession = useMemo(() => getActiveSession(stateShape), [stateShape]);
  const workspaceSessions = useMemo(
    () => getSessionsForWorkspace(stateShape, activeWorkspaceId),
    [activeWorkspaceId, stateShape],
  );

  const [selectedModel, setSelectedModel] = useState('codex');
  const [selectedModelDisplayName, setSelectedModelDisplayName] = useState(CODE_MODEL_NAMES.codex);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [activeActionId, setActiveActionId] = useState<ActionGroupId | null>(null);
  const [composerSeed, setComposerSeed] = useState('');
  const [composerVersion, setComposerVersion] = useState(0);
  const [sessionTranscripts, setSessionTranscripts] = useState<Record<string, StreamChatMessage[]>>(
    {},
  );

  const activeAction = CODE_ACTION_GROUPS.find((group) => group.id === activeActionId) ?? null;
  const embeddedStreamMessages = useMemo(
    () => mapNativeMessagesToStreamMessages(nativeMessages),
    [nativeMessages],
  );
  const isEmbeddedAgentSession = embeddedAgentSession.isEmbedded;
  const cachedMessages = isEmbeddedAgentSession
    ? embeddedStreamMessages
    : sessionTranscripts[activeSessionId] ?? [];
  const effectiveCanvasKey = embeddedAgentSession.sessionId ?? activeSessionId;

  useEffect(() => {
    if (!embeddedAgentSession.sessionId || !isEmbeddedAgentSession) {
      return;
    }

    setActiveNativeSession(embeddedAgentSession.sessionId);
    void fetchNativeMessages(embeddedAgentSession.sessionId);
    void fetchNativeCanvases(embeddedAgentSession.sessionId);
  }, [
    embeddedAgentSession.sessionId,
    fetchNativeCanvases,
    fetchNativeMessages,
    isEmbeddedAgentSession,
    setActiveNativeSession,
  ]);

  useEffect(() => {
    if (cachedMessages.length > 0) {
      setWorkspaceReady(true);
    }
  }, [cachedMessages.length]);

  useEffect(() => {
    if (!isEmbeddedAgentSession && cachedMessages.length === 0) {
      setWorkspaceReady(false);
    }
  }, [activeSessionId, activeWorkspaceId, cachedMessages.length, isEmbeddedAgentSession]);

  const applyComposerSeed = (prompt: string, options?: { closeAction?: boolean }) => {
    setComposerSeed(prompt);
    setComposerVersion((current) => current + 1);
    if (options?.closeAction) {
      setActiveActionId(null);
    }
  };

  const confirmWorkspace = (workspaceId?: string) => {
    if (workspaceId) {
      setActiveWorkspace(workspaceId);
    }
    setWorkspaceReady(true);
    setShowSessionPicker(false);
    setShowWorkspacePicker(false);
  };

  const handleSessionSelect = (sessionId: string) => {
    setActiveSession(sessionId);
    setShowSessionPicker(false);
  };

  const handleOpenConsole = () => {
    setConsoleTab('terminal');
    openDrawer('console', { tab: 'terminal', minHeight: 320 });
  };

  // Stabilize onMessagesChange callback to prevent infinite loops in rust-stream-adapter
  const handleMessagesChange = useCallback((messages: StreamChatMessage[]) => {
    if (isEmbeddedAgentSession) {
      return;
    }
    setSessionTranscripts((prev) => {
      if (prev[activeSessionId] === messages) {
        return prev;
      }
      return { ...prev, [activeSessionId]: messages };
    });
  }, [isEmbeddedAgentSession, activeSessionId]);

  return (
    <CodeSessionSurface
      key={effectiveCanvasKey}
      activeAction={activeAction}
      activeSession={activeSession}
      activeWorkspace={activeWorkspace}
      composerSeed={composerSeed}
      composerVersion={composerVersion}
      embeddedAgentSession={embeddedAgentSession}
      embeddedCanvasCount={embeddedCanvasIds.length}
      isEmbeddedAgentSession={isEmbeddedAgentSession}
      initialMessages={cachedMessages}
      onMessagesChange={handleMessagesChange}
      onDismissEmbeddedAgentSession={() => clearEmbeddedAgentSession('code')}
      onOpenConsole={handleOpenConsole}
      onSelectModel={(selection: any) => {
        setSelectedModel(selection.modelId);
        setSelectedModelDisplayName(
          selection.modelName || CODE_MODEL_NAMES[selection.modelId] || selection.modelId,
        );
      }}
      onPreviewTemplate={(prompt) => applyComposerSeed(prompt)}
      onSelectTemplate={(prompt) => applyComposerSeed(prompt, { closeAction: true })}
      onSetActiveSession={handleSessionSelect}
      onToggleAction={(nextActionId) =>
        setActiveActionId((current) => (current === nextActionId ? null : nextActionId))
      }
      onToggleSessionPicker={() => {
        setShowWorkspacePicker(false);
        setShowSessionPicker((current) => !current);
      }}
      onToggleWorkspacePicker={() => {
        setShowSessionPicker(false);
        setShowWorkspacePicker((current) => !current);
      }}
      selectedModel={selectedModel}
      selectedModelDisplayName={selectedModelDisplayName}
      showSessionPicker={showSessionPicker}
      showWorkspacePicker={showWorkspacePicker}
      workspaceReady={workspaceReady}
      workspaceSessions={workspaceSessions}
      workspaces={workspaces}
      activeSessionId={activeSessionId}
      activeWorkspaceId={activeWorkspaceId}
      onConfirmWorkspace={confirmWorkspace}
    />
  );
}

interface CodeSessionSurfaceProps {
  activeAction: ActionGroup | null;
  activeSession: ReturnType<typeof getActiveSession>;
  activeWorkspace: ReturnType<typeof getActiveWorkspace>;
  composerSeed: string;
  composerVersion: number;
  embeddedAgentSession: ReturnType<typeof useEmbeddedAgentSession>;
  embeddedCanvasCount: number;
  isEmbeddedAgentSession: boolean;
  initialMessages: StreamChatMessage[];
  onMessagesChange: (messages: StreamChatMessage[]) => void;
  onDismissEmbeddedAgentSession: () => void;
  onOpenConsole: () => void;
  onSelectModel: (selection: any) => void;
  onPreviewTemplate: (prompt: string) => void;
  onSelectTemplate: (prompt: string) => void;
  onSetActiveSession: (sessionId: string) => void;
  onToggleAction: (id: ActionGroupId) => void;
  onToggleSessionPicker: () => void;
  onToggleWorkspacePicker: () => void;
  selectedModel: string;
  selectedModelDisplayName: string;
  showSessionPicker: boolean;
  showWorkspacePicker: boolean;
  workspaceReady: boolean;
  workspaceSessions: ReturnType<typeof getSessionsForWorkspace>;
  workspaces: ReturnType<typeof useCodeModeStore.getState>['workspaces'];
  activeSessionId: string;
  activeWorkspaceId: string;
  onConfirmWorkspace: (workspaceId?: string) => void;
}

function CodeSessionSurface({
  activeAction,
  activeSession,
  activeWorkspace,
  composerSeed,
  composerVersion,
  embeddedAgentSession,
  embeddedCanvasCount,
  isEmbeddedAgentSession,
  initialMessages,
  onMessagesChange,
  onDismissEmbeddedAgentSession,
  onOpenConsole,
  onSelectModel,
  onPreviewTemplate,
  onSelectTemplate,
  onSetActiveSession,
  onToggleAction,
  onToggleSessionPicker,
  onToggleWorkspacePicker,
  selectedModel,
  selectedModelDisplayName,
  showSessionPicker,
  showWorkspacePicker,
  workspaceReady,
  workspaceSessions,
  workspaces,
  activeSessionId,
  activeWorkspaceId,
  onConfirmWorkspace,
}: CodeSessionSurfaceProps) {
  const { agentModeEnabled, selectedAgentId, selectedAgent } =
    useSurfaceAgentSelection('code');
  const [agentModePulse, setAgentModePulse] = useState(0);
  const prevAgentModeEnabledRef = useRef(agentModeEnabled);
  if (prevAgentModeEnabledRef.current !== agentModeEnabled) {
    prevAgentModeEnabledRef.current = agentModeEnabled;
    if (agentModeEnabled) setAgentModePulse((p) => p + 1);
  }
  const setActiveNativeSession = useNativeAgentStore(
    (state) => state.setActiveSession,
  );
  const createNativeSession = useNativeAgentStore((state) => state.createSession);
  const setSurfaceSession = useNativeAgentStore((state) => state.setSurfaceSession);
  const sendNativeMessageStream = useNativeAgentStore(
    (state) => state.sendMessageStream,
  );
  const abortNativeGeneration = useNativeAgentStore(
    (state) => state.abortGeneration,
  );
  const nativeStreaming = useNativeAgentStore((state) => ({
    isStreaming: state.streamingBySession[embeddedAgentSession.sessionId ?? '']?.isStreaming ?? false,
  }));
  const embeddedNativeMessages = useNativeAgentStore((state) =>
    embeddedAgentSession.sessionId
      ? state.messages[embeddedAgentSession.sessionId] || []
      : [],
  );
  const {
    messages,
    isLoading,
    submitMessage,
    regenerate,
    stop,
  } = useRustStreamAdapter({
    initialMessages,
    onMessagesChange,
    onError: (error) => console.error('[CodeCanvas] stream error', error),
  });

  const effectiveModelId = resolveCodeChatModel(selectedModel);
  const embeddedMessages = useMemo(
    () => mapNativeMessagesToStreamMessages(embeddedNativeMessages),
    [embeddedNativeMessages],
  );
  const displayMessages = isEmbeddedAgentSession ? embeddedMessages : messages;
  const isProcessing = isEmbeddedAgentSession
    ? nativeStreaming.isStreaming
    : isLoading;
  const effectiveWorkspaceReady = isEmbeddedAgentSession || workspaceReady;
  const hasMessages = displayMessages.length > 0;
  const embeddedAgentStrip = isEmbeddedAgentSession ? (
    <AgentContextStrip
      surface="code"
      sessionName={embeddedAgentSession.session?.name || 'Agent Session'}
      sessionDescription={embeddedAgentSession.session?.description}
      agentName={embeddedAgentSession.descriptor.agentName || selectedAgent?.name || undefined}
      statusLabel={
        embeddedAgentSession.session?.metadata?.allternit_local_draft === true
          ? 'Local Draft'
          : embeddedAgentSession.session?.isActive
            ? 'Live'
            : 'Paused'
      }
      messageCount={embeddedAgentSession.session?.messageCount ?? displayMessages.length}
      workspaceScope={embeddedAgentSession.descriptor.workspaceScope}
      canvasCount={embeddedCanvasCount}
      tags={embeddedAgentSession.session?.tags}
      localDraft={embeddedAgentSession.session?.metadata?.allternit_local_draft === true}
      toolsEnabled={embeddedAgentSession.descriptor.agentFeatures?.tools === true}
      automationEnabled={embeddedAgentSession.descriptor.agentFeatures?.automation === true}
      onDismiss={onDismissEmbeddedAgentSession}
    />
  ) : null;

  const handleSend = useCallback(async (text: string) => {
    const draft = text.trim();
    if (!draft) {
      return;
    }

    if (!effectiveWorkspaceReady && !isEmbeddedAgentSession) {
      if (!showWorkspacePicker) {
        onToggleWorkspacePicker();
      }
      return;
    }

    if (!isEmbeddedAgentSession && agentModeEnabled && !selectedAgentId) {
      console.warn('[CodeCanvas] Agent mode is enabled but no agent is selected');
      return;
    }

    // If a session is already embedded, route through it
    if (isEmbeddedAgentSession && embeddedAgentSession.sessionId) {
      setActiveNativeSession(embeddedAgentSession.sessionId);
      await sendNativeMessageStream(embeddedAgentSession.sessionId, draft);
      return;
    }

    // Agent mode ON, agent selected, no session yet — create a real gizzi session
    if (agentModeEnabled && selectedAgentId) {
      try {
        const session = await createNativeSession(
          draft.slice(0, 64) || 'Code Agent Session',
          undefined,
          {
            originSurface: 'code',
            sessionMode: 'agent',
            agentId: selectedAgent?.id,
            agentName: selectedAgent?.name,
            runtimeModel: selectedAgent?.model,
            agentFeatures: { workspace: true, tools: true, automation: true },
          },
        );
        setSurfaceSession('code', session.id);
        setActiveNativeSession(session.id);
        await sendNativeMessageStream(session.id, draft);
        return;
      } catch (err) {
        console.error('[CodeCanvas] Failed to create code agent session:', err);
        return;
      }
    }

    try {
      useRunnerStore.setState({ draft });
      useRunnerStore.getState().submit();
    } catch (error) {
      console.warn('[CodeCanvas] runner submit failed', error);
    }

    const chatId = activeSession?.session_id ?? activeSessionId;
    const agentContext = buildAgentConversationContext({
      agentModeEnabled,
      agentId: selectedAgentId,
      agent: selectedAgent,
      chatId,
    });

    await submitMessage({
      chatId,
      message: draft,
      modelId: effectiveModelId,
      ...agentContext,
    });
  }, [
    activeSession?.session_id,
    activeSessionId,
    agentModeEnabled,
    createNativeSession,
    embeddedAgentSession.sessionId,
    effectiveModelId,
    isEmbeddedAgentSession,
    showWorkspacePicker,
    onToggleWorkspacePicker,
    sendNativeMessageStream,
    selectedAgent,
    selectedAgentId,
    setActiveNativeSession,
    setSurfaceSession,
    submitMessage,
    effectiveWorkspaceReady,
  ]);

  const handleRegenerate = useCallback(() => {
    const lastUserMessage = [...displayMessages]
      .reverse()
      .find((message) => message.role === 'user' && typeof message.content === 'string');

    if (!lastUserMessage || typeof lastUserMessage.content !== 'string') {
      return;
    }

    if (isEmbeddedAgentSession && embeddedAgentSession.sessionId) {
      setActiveNativeSession(embeddedAgentSession.sessionId);
      void sendNativeMessageStream(
        embeddedAgentSession.sessionId,
        lastUserMessage.content,
      );
      return;
    }

    const chatId = activeSession?.session_id ?? activeSessionId;
    const agentContext = buildAgentConversationContext({
      agentModeEnabled,
      agentId: selectedAgentId,
      agent: selectedAgent,
      chatId,
    });

    void regenerate(lastUserMessage.content, {
      chatId,
      modelId: effectiveModelId,
      ...agentContext,
    });
  }, [
    activeSession?.session_id,
    activeSessionId,
    agentModeEnabled,
    displayMessages,
    embeddedAgentSession.sessionId,
    effectiveModelId,
    isEmbeddedAgentSession,
    regenerate,
    sendNativeMessageStream,
    selectedAgent,
    selectedAgentId,
    setActiveNativeSession,
  ]);

  const handleStop = useCallback(() => {
    if (isEmbeddedAgentSession && embeddedAgentSession.sessionId) {
      void abortNativeGeneration(embeddedAgentSession.sessionId);
      return;
    }

    stop();
  }, [
    abortNativeGeneration,
    embeddedAgentSession.sessionId,
    isEmbeddedAgentSession,
    stop,
  ]);

  if (hasMessages) {
    return (
      <ConversationStage
        activeAction={activeAction}
        activeSession={activeSession}
        activeWorkspace={activeWorkspace}
        agentContextStrip={embeddedAgentStrip}
        composerSeed={composerSeed}
        composerVersion={composerVersion}
        isEmbeddedAgentSession={isEmbeddedAgentSession}
        isProcessing={isProcessing}
        messages={displayMessages}
        onOpenConsole={onOpenConsole}
        onRegenerate={handleRegenerate}
        onSelectModel={onSelectModel}
        onPreviewTemplate={onPreviewTemplate}
        onSelectTemplate={onSelectTemplate}
        onSend={handleSend}
        onSetActiveSession={onSetActiveSession}
        onStop={handleStop}
        onToggleAction={onToggleAction}
        onToggleSessionPicker={onToggleSessionPicker}
        onToggleWorkspacePicker={onToggleWorkspacePicker}
        selectedModel={selectedModel}
        selectedModelDisplayName={selectedModelDisplayName}
        showSessionPicker={showSessionPicker}
        showWorkspacePicker={showWorkspacePicker}
        workspaceReady={effectiveWorkspaceReady}
        workspaceSessions={workspaceSessions}
        workspaces={workspaces}
        activeSessionId={activeSessionId}
        activeWorkspaceId={activeWorkspaceId}
        onConfirmWorkspace={onConfirmWorkspace}
      />
    );
  }

  return (
    <LaunchpadStage
      activeAction={activeAction}
      activeWorkspace={activeWorkspace}
      agentContextStrip={embeddedAgentStrip}
      composerSeed={composerSeed}
      composerVersion={composerVersion}
      isEmbeddedAgentSession={isEmbeddedAgentSession}
      isProcessing={isProcessing}
      onOpenConsole={onOpenConsole}
      onSelectModel={onSelectModel}
      onPreviewTemplate={onPreviewTemplate}
      onSelectTemplate={onSelectTemplate}
      onSend={handleSend}
      onSetActiveSession={onSetActiveSession}
      onToggleAction={onToggleAction}
      onToggleSessionPicker={onToggleSessionPicker}
      onToggleWorkspacePicker={onToggleWorkspacePicker}
      selectedModel={selectedModel}
      selectedModelDisplayName={selectedModelDisplayName}
      showSessionPicker={showSessionPicker}
      showWorkspacePicker={showWorkspacePicker}
      workspaceReady={effectiveWorkspaceReady}
      workspaceSessions={workspaceSessions}
      workspaces={workspaces}
      activeSessionId={activeSessionId}
      activeWorkspaceId={activeWorkspaceId}
      agentModeEnabled={agentModeEnabled}
      agentModePulse={agentModePulse}
      selectedAgentName={selectedAgent?.name ?? null}
      onConfirmWorkspace={onConfirmWorkspace}
    />
  );
}

function LaunchpadStage({
  activeAction,
  activeWorkspace,
  agentContextStrip,
  composerSeed,
  composerVersion,
  isEmbeddedAgentSession,
  isProcessing,
  onOpenConsole,
  onSelectModel,
  onPreviewTemplate,
  onSelectTemplate,
  onSend,
  onSetActiveSession,
  onToggleAction,
  onToggleSessionPicker,
  onToggleWorkspacePicker,
  selectedModel,
  selectedModelDisplayName,
  showSessionPicker,
  showWorkspacePicker,
  workspaceReady,
  workspaceSessions,
  workspaces,
  activeSessionId,
  activeWorkspaceId,
  agentModeEnabled,
  agentModePulse,
  selectedAgentName,
  onConfirmWorkspace,
}: {
  activeAction: ActionGroup | null;
  activeWorkspace: ReturnType<typeof getActiveWorkspace>;
  agentContextStrip?: React.ReactNode;
  composerSeed: string;
  composerVersion: number;
  isEmbeddedAgentSession: boolean;
  isProcessing: boolean;
  onOpenConsole: () => void;
  onSelectModel: (selection: any) => void;
  onPreviewTemplate: (prompt: string) => void;
  onSelectTemplate: (prompt: string) => void;
  onSend: (text: string) => void;
  onSetActiveSession: (sessionId: string) => void;
  onToggleAction: (id: ActionGroupId) => void;
  onToggleSessionPicker: () => void;
  onToggleWorkspacePicker: () => void;
  selectedModel: string;
  selectedModelDisplayName: string;
  showSessionPicker: boolean;
  showWorkspacePicker: boolean;
  workspaceReady: boolean;
  workspaceSessions: ReturnType<typeof getSessionsForWorkspace>;
  workspaces: ReturnType<typeof useCodeModeStore.getState>['workspaces'];
  activeSessionId: string;
  activeWorkspaceId: string;
  agentModeEnabled: boolean;
  agentModePulse: number;
  selectedAgentName: string | null;
  onConfirmWorkspace: (workspaceId?: string) => void;
}) {
  const [brandingAttention, setBrandingAttention] = useState<GizziAttention | null>(null);

  return (
    <div style={{ padding: '120px 24px 60px', minHeight: '100%', boxSizing: 'border-box' }}>
      {agentContextStrip ? (
        <div style={{ width: '100%', textAlign: 'left', marginBottom: 18 }}>
          {agentContextStrip}
        </div>
      ) : null}
      <CodeLaunchBranding
        workspaceReady={workspaceReady}
        attention={brandingAttention}
        agentModeEnabled={agentModeEnabled}
        agentModePulse={agentModePulse}
        selectedAgentName={selectedAgentName}
      />

      <div style={{ width: '100%', marginTop: 28 }}>
        {/* CodeActionPills removed per annotation - pills no longer necessary */}
        <div data-testid="code-shared-composer" style={{ marginTop: 14 }}>
          <ChatComposer
            key={`code-launchpad-composer-${composerVersion}`}
            onSend={onSend}
            isLoading={isProcessing}
            onStop={() => undefined}
            selectedModel={selectedModel}
            selectedModelDisplayName={selectedModelDisplayName}
            onSelectModel={onSelectModel}
            placeholder={
              workspaceReady
                ? 'Describe what you want to build or modify...'
                : 'Choose a workspace folder to unlock the session...'
            }
            showTopActions={false}
            inputValue={composerSeed}
            variant="large"
            onAttentionChange={setBrandingAttention}
            agentModeSurface="code"
            bottomDockContent={
              <CompactUtilityBar
                activeWorkspace={activeWorkspace}
                activeWorkspaceId={activeWorkspaceId}
                onConfirmWorkspace={onConfirmWorkspace}
                onOpenConsole={onOpenConsole}
                workspaceReady={workspaceReady}
                workspaces={workspaces}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}

function ConversationStage({
  activeAction,
  activeSession,
  activeWorkspace,
  agentContextStrip,
  composerSeed,
  composerVersion,
  isEmbeddedAgentSession,
  isProcessing,
  messages,
  onOpenConsole,
  onRegenerate,
  onSelectModel,
  onPreviewTemplate,
  onSelectTemplate,
  onSend,
  onSetActiveSession,
  onStop,
  onToggleAction,
  onToggleSessionPicker,
  onToggleWorkspacePicker,
  selectedModel,
  selectedModelDisplayName,
  showSessionPicker,
  showWorkspacePicker,
  workspaceReady,
  workspaceSessions,
  workspaces,
  activeSessionId,
  activeWorkspaceId,
  onConfirmWorkspace,
}: {
  activeAction: ActionGroup | null;
  activeSession: ReturnType<typeof getActiveSession>;
  activeWorkspace: ReturnType<typeof getActiveWorkspace>;
  agentContextStrip?: React.ReactNode;
  composerSeed: string;
  composerVersion: number;
  isEmbeddedAgentSession: boolean;
  isProcessing: boolean;
  messages: StreamChatMessage[];
  onOpenConsole: () => void;
  onRegenerate: () => void;
  onSelectModel: (selection: any) => void;
  onPreviewTemplate: (prompt: string) => void;
  onSelectTemplate: (prompt: string) => void;
  onSend: (text: string) => void;
  onSetActiveSession: (sessionId: string) => void;
  onStop: () => void;
  onToggleAction: (id: ActionGroupId) => void;
  onToggleSessionPicker: () => void;
  onToggleWorkspacePicker: () => void;
  selectedModel: string;
  selectedModelDisplayName: string;
  showSessionPicker: boolean;
  showWorkspacePicker: boolean;
  workspaceReady: boolean;
  workspaceSessions: ReturnType<typeof getSessionsForWorkspace>;
  workspaces: ReturnType<typeof useCodeModeStore.getState>['workspaces'];
  activeSessionId: string;
  activeWorkspaceId: string;
  onConfirmWorkspace: (workspaceId?: string) => void;
}) {
  const workspaceBranch = activeWorkspace?.repo_status?.branch ?? 'workspace';

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden',
      // Background now handled at CodeRoot level for full-screen effect
    }}>
      <Conversation style={{ minHeight: 0 }}>
        <ConversationContent>
          <div
            style={{
              width: '100%',
              maxWidth: CONTENT_WIDTH,
              margin: '0 auto',
              padding: '34px 20px 40px',
              boxSizing: 'border-box',
              minHeight: 0,
            }}
          >
            {agentContextStrip}
            {messages.map((message, index) => (
              <StreamingChatComposer
                key={message.id}
                message={message}
                isLoading={isProcessing && index === messages.length - 1}
                isLast={index === messages.length - 1}
                onRegenerate={onRegenerate}
              />
            ))}
          </div>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Bottom Input Dock - Standardized with Cowork mode */}
      <div
        style={{
          padding: '0 20px 18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          background: 'transparent',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          flexShrink: 0,
          zIndex: 40,
        }}
      >
        <div style={{ width: '100%', maxWidth: CONTENT_WIDTH, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              padding: '10px 2px 0',
              fontSize: 11,
              color: 'var(--text-tertiary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderRadius: 999,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                <CodeIcon size={12} weight="bold" />
                {workspaceBranch}
              </span>
            </div>
            {activeSession?.pending_approvals_count ? (
              <span>{`${activeSession.pending_approvals_count} approval${activeSession.pending_approvals_count === 1 ? '' : 's'} pending`}</span>
            ) : null}
          </div>

          <div data-testid="code-shared-composer" style={{ marginTop: 8 }}>
            <ACIComputerUseBar suppressInBrowserMode />
            <ChatComposer
              key={`code-conversation-composer-${composerVersion}`}
              onSend={onSend}
              isLoading={isProcessing}
              onStop={onStop}
              selectedModel={selectedModel}
              selectedModelDisplayName={selectedModelDisplayName}
              onSelectModel={onSelectModel}
              placeholder="Reply..."
              showTopActions={false}
              inputValue={composerSeed}
              agentModeSurface="code"
            />
          </div>

          <ComposerUtilityBar
            activeWorkspace={activeWorkspace}
            activeWorkspaceId={activeWorkspaceId}
            activeSessionId={activeSessionId}
            onConfirmWorkspace={onConfirmWorkspace}
            onOpenConsole={onOpenConsole}
            onSetActiveSession={onSetActiveSession}
            onToggleSessionPicker={onToggleSessionPicker}
            onToggleWorkspacePicker={onToggleWorkspacePicker}
            showSessionPicker={showSessionPicker}
            showWorkspacePicker={showWorkspacePicker}
            workspaceReady={workspaceReady}
            workspaceSessions={workspaceSessions}
            workspaces={workspaces}
            activeSession={activeSession}
          />
        </div>
      </div>
    </div>
  );
}

function ComposerUtilityBar({
  activeSession,
  activeWorkspace,
  activeWorkspaceId,
  activeSessionId,
  onConfirmWorkspace,
  onOpenConsole,
  onSetActiveSession,
  onToggleSessionPicker,
  onToggleWorkspacePicker,
  showSessionPicker,
  showWorkspacePicker,
  workspaceReady,
  workspaceSessions,
  workspaces,
}: {
  activeSession: ReturnType<typeof getActiveSession>;
  activeWorkspace: ReturnType<typeof getActiveWorkspace>;
  activeWorkspaceId: string;
  activeSessionId: string;
  onConfirmWorkspace: (workspaceId?: string) => void;
  onOpenConsole: () => void;
  onSetActiveSession: (sessionId: string) => void;
  onToggleSessionPicker: () => void;
  onToggleWorkspacePicker: () => void;
  showSessionPicker: boolean;
  showWorkspacePicker: boolean;
  workspaceReady: boolean;
  workspaceSessions: ReturnType<typeof getSessionsForWorkspace>;
  workspaces: ReturnType<typeof useCodeModeStore.getState>['workspaces'];
}) {
  return (
    <div
      style={{
        marginTop: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label="Code session selector"
            data-testid="code-session-selector"
            onClick={onToggleSessionPicker}
            style={{ ...utilityControlStyle, minWidth: 240, justifyContent: 'space-between' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <CodeIcon size={14} weight="bold" />
              <span
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  minWidth: 0,
                  lineHeight: 1.15,
                }}
              >
                <span
                  style={{
                    maxWidth: 170,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-primary)',
                  }}
                >
                  {activeSession?.title ?? 'Select session'}
                </span>
                {activeSession ? (
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {activeSession.mode} / {activeSession.state}
                  </span>
                ) : null}
              </span>
            </span>
            <CaretDown size={12} />
          </button>

          {showSessionPicker ? (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 120 }} onClick={onToggleSessionPicker} />
              <div style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 12px)', zIndex: 121 }}>
                <SessionPickerPopover
                  activeSessionId={activeSessionId}
                  sessions={workspaceSessions}
                  onSelect={onSetActiveSession}
                />
              </div>
            </>
          ) : null}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            data-testid="code-folder-button"
            onClick={onToggleWorkspacePicker}
            style={utilityControlStyle}
          >
            <FolderSimple size={14} weight="bold" />
            {workspaceReady ? activeWorkspace?.display_name ?? 'Workspace' : 'Select folder'}
            <CaretDown size={12} />
          </button>

          {showWorkspacePicker ? (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 120 }} onClick={onToggleWorkspacePicker} />
              <div style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 12px)', zIndex: 121 }}>
                <WorkspacePickerPopover
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  onSelect={onConfirmWorkspace}
                />
              </div>
            </>
          ) : null}
        </div>

        <button
          type="button"
          data-testid="code-console-button"
          onClick={onOpenConsole}
          style={utilityControlStyle}
        >
          <TerminalWindow size={14} />
          Terminal
        </button>
      </div>

      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right' }}>
        {workspaceReady ? activeWorkspace?.root_path : 'Workspace required before execution'}
      </span>
    </div>
  );
}

/** Compact utility bar for bottom dock - simplified version without session selector stub */
function CompactUtilityBar({
  activeWorkspace,
  activeWorkspaceId,
  onConfirmWorkspace,
  onOpenConsole,
  workspaceReady,
  workspaces,
}: {
  activeWorkspace: ReturnType<typeof getActiveWorkspace>;
  activeWorkspaceId: string;
  onConfirmWorkspace: (workspaceId?: string) => void;
  onOpenConsole: () => void;
  workspaceReady: boolean;
  workspaces: ReturnType<typeof useCodeModeStore.getState>['workspaces'];
}) {
  const [open, setOpen] = useState(false);
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Workspace picker - using Popover for proper portal rendering */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="code-folder-button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <FolderSimple size={14} weight="bold" />
            {workspaceReady ? activeWorkspace?.display_name ?? 'Workspace' : 'Select folder'}
            <CaretDown size={12} />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="start" 
          sideOffset={8}
          style={{
            width: 320,
            padding: 0,
            background: '#332D27',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ padding: 8 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '8px 12px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#D4956A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Workspace
              </div>
              <div style={{ fontSize: 11, color: '#6B6B6B' }}>{workspaces.length} repos</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6 }}>
              {workspaces.map((workspace) => (
                <button
                  key={workspace.workspace_id}
                  type="button"
                  onClick={() => {
                    onConfirmWorkspace(workspace.workspace_id);
                    setOpen(false);
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: workspace.workspace_id === activeWorkspaceId
                      ? 'rgba(255,255,255,0.05)'
                      : 'transparent',
                    color: '#ECECEC',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (workspace.workspace_id !== activeWorkspaceId) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (workspace.workspace_id !== activeWorkspaceId) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{workspace.display_name}</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: '#9B9B9B', lineHeight: 1.5 }}>
                    {workspace.root_path}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Terminal button (opens terminal in console drawer) */}
      <button
        type="button"
        data-testid="code-console-button"
        onClick={onOpenConsole}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <TerminalWindow size={14} />
        Terminal
      </button>
    </div>
  );
}

function CodeActionPills({
  activeAction,
  align,
  onPreviewTemplate,
  onSelectTemplate,
  onToggleAction,
}: {
  activeAction: ActionGroup | null;
  align: 'left' | 'center';
  onPreviewTemplate: (prompt: string) => void;
  onSelectTemplate: (prompt: string) => void;
  onToggleAction: (id: ActionGroupId) => void;
}) {
  return (
    <div style={{ marginTop: 12, position: 'relative' }}>
      <div
        data-testid="code-action-strip"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
        }}
      >
        {CODE_ACTION_GROUPS.map((group) => {
          const Icon = group.icon;
          const isActive = activeAction?.id === group.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onToggleAction(group.id)}
              onMouseEnter={() => onPreviewTemplate(group.templates[0]?.prompt ?? '')}
              onFocus={() => onPreviewTemplate(group.templates[0]?.prompt ?? '')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 999,
                border: isActive
                  ? `1px solid ${group.accent}55`
                  : '1px solid rgba(255, 255, 255, 0.08)',
                background: isActive ? `${group.accent}18` : 'rgba(14, 17, 20, 0.16)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Icon size={14} style={{ color: group.accent }} />
              {group.label}
            </button>
          );
        })}
      </div>

      {activeAction && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            ...codeOverlaySurfaceStyle,
          }}
        >
          <div
            style={{
              ...codeOverlayHeaderStyle,
              margin: '-12px -12px 10px',
            }}
          >
            <div style={{ ...codeOverlayLabelStyle, color: activeAction.accent }}>
              {activeAction.label}
            </div>
            <button
              type="button"
              onClick={() => onToggleAction(activeAction.id)}
              style={{ border: 'none', background: 'transparent', color: codeMenuTheme.textMuted, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
            >
              Close
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 8,
            }}
          >
            {activeAction.templates.map((template) => (
              <button
                key={template.label}
                type="button"
                onFocus={() => onPreviewTemplate(template.prompt)}
                onClick={() => onSelectTemplate(template.prompt)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: codeMenuTheme.textPrimary,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'transparent';
                }}
                onMouseEnter={(event) => {
                  onPreviewTemplate(template.prompt);
                  event.currentTarget.style.background = codeMenuTheme.hoverBg;
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{template.label}</div>
                <div
                  style={{
                    fontSize: 11,
                    lineHeight: 1.45,
                    color: codeMenuTheme.textMuted,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {template.prompt}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionPickerPopover({
  activeSessionId,
  onSelect,
  sessions,
}: {
  activeSessionId: string;
  onSelect: (sessionId: string) => void;
  sessions: ReturnType<typeof getSessionsForWorkspace>;
}) {
  return (
    <div data-testid="code-session-popover" style={{ ...codeOverlaySurfaceStyle, width: 336, padding: 8 }}>
      <div style={codeOverlayHeaderStyle}>
        <div style={codeOverlayLabelStyle}>Session</div>
        <div style={{ fontSize: 11, color: codeMenuTheme.textMuted }}>{sessions.length} active</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6 }}>
        {sessions.map((session) => {
          const isActive = session.session_id === activeSessionId;
          return (
            <button
              key={session.session_id}
              type="button"
              onClick={() => onSelect(session.session_id)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: isActive ? codeMenuTheme.hoverBg : 'transparent',
                color: codeMenuTheme.textPrimary,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(event) => {
                if (!isActive) {
                  event.currentTarget.style.background = codeMenuTheme.hoverBg;
                }
              }}
              onMouseLeave={(event) => {
                if (!isActive) {
                  event.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{session.title}</div>
                <div style={{ fontSize: 10, color: isActive ? codeMenuTheme.accent : codeMenuTheme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {session.mode}
                </div>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: codeMenuTheme.textMuted, lineHeight: 1.45 }}>
                {session.state}
                {session.branch ? ` / ${session.branch}` : ''}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkspacePickerPopover({
  workspaces,
  activeWorkspaceId,
  onSelect,
}: {
  workspaces: ReturnType<typeof useCodeModeStore.getState>['workspaces'];
  activeWorkspaceId: string;
  onSelect: (workspaceId: string) => void;
}) {
  return (
    <div
      data-testid="code-workspace-picker"
      style={{
        ...codeOverlaySurfaceStyle,
        width: 320,
        padding: 8,
      }}
    >
      <div style={codeOverlayHeaderStyle}>
        <div style={codeOverlayLabelStyle}>Workspace</div>
        <div style={{ fontSize: 11, color: codeMenuTheme.textMuted }}>{workspaces.length} repos</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6 }}>
        {workspaces.map((workspace) => (
          <button
            key={workspace.workspace_id}
            type="button"
            onClick={() => onSelect(workspace.workspace_id)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: workspace.workspace_id === activeWorkspaceId
                ? codeMenuTheme.hoverBg
                : 'transparent',
              color: codeMenuTheme.textPrimary,
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(event) => {
              if (workspace.workspace_id !== activeWorkspaceId) {
                event.currentTarget.style.background = codeMenuTheme.hoverBg;
              }
            }}
            onMouseLeave={(event) => {
              if (workspace.workspace_id !== activeWorkspaceId) {
                event.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700 }}>{workspace.display_name}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: codeMenuTheme.textMuted, lineHeight: 1.5 }}>
              {workspace.root_path}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
