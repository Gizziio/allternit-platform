"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  Sparkle,
  Bug,
  Stack,
  Lightning,
  FolderSimple,
  ChartBar,
} from '@phosphor-icons/react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { AgentContextStrip } from '@/components/agents/AgentContextStrip';
import type { GizziAttention } from '@/components/ai-elements/GizziMascot';
import { StreamingChatComposer } from '@/components/chat/StreamingChatComposer';
import { ChatComposer, type ChatAttachment } from '../chat/ChatComposer';
import {
  useRustStreamAdapter,
  type ChatMessage as StreamChatMessage,
} from '@/lib/ai/rust-stream-adapter';
import { useDrawerStore } from '../../drawers/drawer.store';
import {
  getActiveSession,
  getActiveWorkspace,
  getSessionsForWorkspace,
  useCodeModeStore,
  type CodeSessionMode,
} from './CodeModeStore';
import { CodeLaunchBranding } from './CodeLaunchBranding';
import { CodeWorkspaceBar } from './CodeWorkspaceBar';
import { CodeBottomStatusBar } from './CodeBottomStatusBar';
import { CodeUsageDashboard } from './CodeUsageDashboard';
import {
  buildAgentConversationContext,
  useSurfaceAgentSelection,
} from '@/lib/agents/surface-agent-context';
import {
  mapNativeMessagesToStreamMessages,
  getAgentSessionDescriptor,
  getAgentSessionStatusLabel,
} from '@/lib/agents';
import { useCodeSessionStore, createCodeSession, type CodeSession } from './CodeSessionStore';
import { ACIComputerUseBar } from '@/capsules/browser/ACIComputerUseSidecar';
import { useModeCanvasBridge } from '@/hooks/useModeCanvasBridge';
import { useDropTarget, type FileWithData } from '@/components/GlobalDropzone';
import { AttachmentPreview, AttachmentPreviewModal, type AttachmentPreviewItem } from '@/components/chat/AttachmentPreview';
import {
  ComposerPermissionInfoBar,
  ComposerQuestionBar,
} from '../chat/ChatComposerEnhancements';
import { usePendingPermissions, usePendingQuestions } from '@/lib/agents';
import { useRuntimeExecutionMode } from '@/hooks/useRuntimeExecutionMode';
import { useDefaultModelSelection } from '@/hooks/use-default-model-selection';
import { SessionTodoDock, useSessionComposerState } from '@/components/session-composer';
import { gizziBaseUrl } from '@/lib/agents/api-config';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CodeCanvas');

const CONTENT_WIDTH = 760;
const CODE_MODEL_NAMES: Record<string, string> = {
  codex: 'Codex CLI',
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  'kimi-cli': 'Kimi CLI',
};

const CODE_CHAT_MODEL_FALLBACKS: Record<string, string> = {
  codex: 'codex-cli/codex-mini-latest',
  'claude-code': 'claude-cli/claude-sonnet-4-6',
  'kimi-cli': 'kimi/kimi-k2',
};

function resolveCodeChatModel(modelId: string): string {
  return CODE_CHAT_MODEL_FALLBACKS[modelId] ?? modelId;
}

type ActionGroupId = 'scaffold' | 'refactor' | 'debug' | 'optimize' | 'explore';

interface ActionGroup {
  id: ActionGroupId;
  label: string;
  accent: string;
  icon: PhosphorIcon;
  templates: Array<{ label: string; prompt: string }>;
}

interface CodeCanvasProps {
  isPreviewCollapsed: boolean;
}

interface CodeModelSelection {
  modelId: string;
  modelName?: string;
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

const pillControlStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(255, 255, 255, 0.03)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const codeMenuTheme = {
  menuBg: 'var(--surface-floating)',
  menuBorder: 'var(--ui-border-muted)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--ui-text-secondary)',
  textMuted: 'var(--ui-text-muted)',
  accent: 'var(--accent-primary)',
  hoverBg: 'var(--surface-hover)',
};

export function CodeCanvas({ isPreviewCollapsed: _isPreviewCollapsed }: CodeCanvasProps) {
  const openDrawer = useDrawerStore((state) => state.openDrawer);
  const setConsoleTab = useDrawerStore((state) => state.setConsoleTab);
  const embeddedSessionId = useCodeSessionStore((s) => s.activeSessionId);
  const embeddedSession = useCodeSessionStore((s) =>
    s.activeSessionId ? s.sessions.find((sess) => sess.id === s.activeSessionId) ?? null : null,
  );
  const embeddedDescriptor = useMemo(
    () => getAgentSessionDescriptor(embeddedSession?.metadata),
    [embeddedSession?.metadata],
  );
  const isEmbeddedAgentSession = Boolean(embeddedSessionId && embeddedSession);
  const embeddedAgentSession = useMemo(
    () => ({
      sessionId: embeddedSessionId,
      session: embeddedSession,
      descriptor: embeddedDescriptor,
      isEmbedded: isEmbeddedAgentSession,
    }),
    [embeddedSessionId, embeddedSession, embeddedDescriptor, isEmbeddedAgentSession],
  );
  const setActiveCodeSession = useCodeSessionStore(
    (state) => state.setActiveSession,
  );
  const fetchCodeMessages = useCodeSessionStore((state) => state.fetchMessages);
  const fetchCodeCanvases = useCodeSessionStore(
    (state) => state.fetchSessionCanvases,
  );
  const codeMessages = useCodeSessionStore((state) =>
    embeddedAgentSession?.sessionId
      ? state.sessions.find(s => s.id === embeddedAgentSession.sessionId)?.messages || []
      : [],
  );
  const embeddedCanvasIds = useCodeSessionStore((state) =>
    embeddedAgentSession?.sessionId
      ? state.sessionCanvases[embeddedAgentSession.sessionId] ?? []
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

  const [selectedModel, setSelectedModel] = useState('claude-code');
  const [selectedModelDisplayName, setSelectedModelDisplayName] = useState(CODE_MODEL_NAMES['claude-code']);
  const userPickedModelRef = useRef(false);
  const backendDefaultModel = useDefaultModelSelection();
  // Unified brain: code mode follows the platform's configured default model
  // (same brain as chat/cowork/design) until the user explicitly picks a
  // different model in this surface.
  useEffect(() => {
    if (userPickedModelRef.current || !backendDefaultModel?.providerId) return;
    const raw = backendDefaultModel.modelId
      ? `${backendDefaultModel.providerId}/${backendDefaultModel.modelId}`
      : backendDefaultModel.providerId;
    setSelectedModel(raw);
    setSelectedModelDisplayName(backendDefaultModel.modelName || raw);
  }, [backendDefaultModel]);
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
    () => mapNativeMessagesToStreamMessages(codeMessages),
    [codeMessages],
  );
  /* isEmbeddedAgentSession already computed above */
  const cachedMessages = isEmbeddedAgentSession
    ? embeddedStreamMessages
    : sessionTranscripts[activeSessionId] ?? [];
  const effectiveCanvasKey = embeddedAgentSession?.sessionId ?? activeSessionId;

  useEffect(() => {
    if (!embeddedAgentSession?.sessionId || !isEmbeddedAgentSession) {
      return;
    }

    setActiveCodeSession(embeddedAgentSession?.sessionId);
    if (embeddedAgentSession?.sessionId) {
      void fetchCodeMessages(embeddedAgentSession.sessionId);
      void fetchCodeCanvases(embeddedAgentSession.sessionId);
    }
  }, [
    embeddedAgentSession?.sessionId,
    fetchCodeCanvases,
    fetchCodeMessages,
    isEmbeddedAgentSession,
    setActiveCodeSession,
  ]);

  useEffect(() => {
    if (cachedMessages.length > 0) {
      setWorkspaceReady(true);
    }
  }, [cachedMessages.length]);

  // Auto-confirm the active workspace. The launchpad composer stays locked
  // ("Choose a workspace folder to unlock the session...") until a workspace is
  // confirmed — but a default workspace always exists, so requiring a manual
  // folder pick before the first message made fresh sessions impossible to
  // start. Like Claude Code/Codex defaulting to the current directory, unlock
  // whenever a workspace is selected; only stay locked when none exists.
  useEffect(() => {
    if (isEmbeddedAgentSession || cachedMessages.length > 0) {
      return;
    }
    setWorkspaceReady(Boolean(activeWorkspaceId));
  }, [activeWorkspaceId, cachedMessages.length, isEmbeddedAgentSession]);

  const applyComposerSeed = (prompt: string, options?: { closeAction?: boolean }): void => {
    setComposerSeed(prompt);
    setComposerVersion((current) => current + 1);
    if (options?.closeAction) {
      setActiveActionId(null);
    }
  };

  const confirmWorkspace = (workspaceId?: string): void => {
    if (workspaceId) {
      setActiveWorkspace(workspaceId);
    }
    setWorkspaceReady(true);
    setShowSessionPicker(false);
    setShowWorkspacePicker(false);
  };

  const handleSessionSelect = (sessionId: string): void => {
    setActiveSession(sessionId);
    setShowSessionPicker(false);
  };

  const handleOpenConsole = (): void => {
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

  // Harness routing: connect mode selection to canvas/sidecar opening (parity with Chat/Cowork)
  useModeCanvasBridge({ surface: 'code' });

  // File attachments (drag-and-drop parity with Cowork)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [previewItem, setPreviewItem] = useState<AttachmentPreviewItem | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const extToAttachmentType = useCallback((filename: string): ChatAttachment['type'] => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'document';
    if (['docx', 'doc', 'txt', 'md'].includes(ext)) return 'document';
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go'].includes(ext)) return 'code';
    if (['json'].includes(ext)) return 'json';
    if (['csv', 'xlsx', 'xls'].includes(ext)) return 'spreadsheet';
    return 'other';
  }, []);

  const handleAddAttachment = useCallback((file: FileWithData) => {
    const attachment: ChatAttachment = {
      id: `code-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.file.name,
      dataUrl: file.dataUrl,
      type: extToAttachmentType(file.file.name),
    };
    setAttachments((prev) => [...prev, attachment]);
  }, [extToAttachmentType]);

  const handleAddChatAttachment = useCallback((attachment: ChatAttachment) => {
    setAttachments((prev) => [...prev, attachment]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleDroppedFiles = useCallback((files: FileWithData[]) => {
    files.forEach(handleAddAttachment);
  }, [handleAddAttachment]);

  useDropTarget('code', handleDroppedFiles);

  const attachmentPreviewItems = useMemo<AttachmentPreviewItem[]>(() =>
    attachments.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as AttachmentPreviewItem['type'],
      dataUrl: a.dataUrl,
      size: 0,
    })),
  [attachments]);

  const handlePreviewAttachment = useCallback((item: AttachmentPreviewItem) => {
    setPreviewItem(item);
    setPreviewModalOpen(true);
  }, []);

  // Tool permission / question gates (parity with Chat/Cowork)
  const activeComposerSessionId = embeddedAgentSession?.sessionId ?? null;
  const pendingPermissions = usePendingPermissions(activeComposerSessionId || '__inactive__');
  const pendingQuestions = usePendingQuestions(activeComposerSessionId || '__inactive__');
  const { executionMode } = useRuntimeExecutionMode();
  const brainMode = executionMode?.mode === 'plan' ? 'plan' : 'build';

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
      onDismissEmbeddedAgentSession={() => setActiveCodeSession(null)}
      onOpenConsole={handleOpenConsole}
      onSelectModel={(selection: { modelId: string; modelName?: string }) => {
        userPickedModelRef.current = true;
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
      attachments={attachments}
      onAddChatAttachment={handleAddChatAttachment}
      onRemoveAttachment={handleRemoveAttachment}
      attachmentPreviewItems={attachmentPreviewItems}
      onPreviewAttachment={handlePreviewAttachment}
      previewItem={previewItem}
      previewModalOpen={previewModalOpen}
      onClosePreviewModal={() => setPreviewModalOpen(false)}
      pendingPermissions={pendingPermissions}
      pendingQuestions={pendingQuestions}
      brainMode={brainMode}
    />
  );
}

interface CodeSessionSurfaceProps {
  activeAction: ActionGroup | null;
  activeSession: ReturnType<typeof getActiveSession>;
  activeWorkspace: ReturnType<typeof getActiveWorkspace>;
  composerSeed: string;
  composerVersion: number;
  embeddedAgentSession: { sessionId: string | null; session: CodeSession | null; descriptor: import('@/lib/agents/session-metadata').AgentSessionDescriptor; isEmbedded: boolean };
  embeddedCanvasCount: number;
  isEmbeddedAgentSession: boolean;
  initialMessages: StreamChatMessage[];
  onMessagesChange: (messages: StreamChatMessage[]) => void;
  onDismissEmbeddedAgentSession: () => void;
  onOpenConsole: () => void;
  onSelectModel: (selection: CodeModelSelection) => void;
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
  attachments: ChatAttachment[];
  onAddChatAttachment: (attachment: ChatAttachment) => void;
  onRemoveAttachment: (id: string) => void;
  attachmentPreviewItems: AttachmentPreviewItem[];
  onPreviewAttachment: (item: AttachmentPreviewItem) => void;
  previewItem: AttachmentPreviewItem | null;
  previewModalOpen: boolean;
  onClosePreviewModal: () => void;
  pendingPermissions: import('@/lib/agents').PendingPermissionRequest[];
  pendingQuestions: import('@/lib/agents').PendingQuestionRequest[];
  brainMode: 'plan' | 'build';
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
  attachments,
  onAddChatAttachment,
  onRemoveAttachment,
  attachmentPreviewItems,
  onPreviewAttachment,
  previewItem,
  previewModalOpen,
  onClosePreviewModal,
  pendingPermissions,
  pendingQuestions,
  brainMode,
}: CodeSessionSurfaceProps) {
  const { agentModeEnabled, selectedAgentId, selectedAgent } =
    useSurfaceAgentSelection('code');
  // Tracks the gizzi ses_* ID for regular (non-agent) chat within this surface instance
  const [regularChatSessionId, setRegularChatSessionId] = useState<string | null>(null);
  const regularChatSessionCreating = useRef(false);
  // Worktree preference chosen before a session exists yet; once a session is
  // active, its metadata.isolation is the source of truth instead.
  const [pendingWorktree, setPendingWorktree] = useState(false);
  const [agentModePulse, setAgentModePulse] = useState(0);
  const prevAgentModeEnabledRef = useRef(agentModeEnabled);
  if (prevAgentModeEnabledRef.current !== agentModeEnabled) {
    prevAgentModeEnabledRef.current = agentModeEnabled;
    setAgentModePulse((p) => p + 1);
  }
  const setActiveCodeSession = useCodeSessionStore(
    (state) => state.setActiveSession,
  );
  const sendCodeMessageStream = useCodeSessionStore(
    (state) => state.sendMessageStream,
  );
  const abortCodeGeneration = useCodeSessionStore(
    (state) => state.abortGeneration,
  );
  const codeStreaming = useCodeSessionStore((state) => ({
    isStreaming: embeddedAgentSession?.sessionId 
      ? (state.streamingBySession[embeddedAgentSession.sessionId]?.isStreaming ?? false)
      : false,
  }));
  const embeddedCodeMessages = useCodeSessionStore((state) =>
    embeddedAgentSession?.sessionId
      ? state.sessions.find(s => s.id === embeddedAgentSession.sessionId)?.messages || []
      : [],
  );
  const {
    messages,
    isLoading,
    regenerate,
    stop,
  } = useRustStreamAdapter({
    initialMessages,
    onMessagesChange,
    onError: (error) => logger.error({ err: error }, '[CodeCanvas] stream error'),
  });

  const effectiveModelId = resolveCodeChatModel(selectedModel);
  const embeddedMessages = useMemo(
    () => mapNativeMessagesToStreamMessages(embeddedCodeMessages),
    [embeddedCodeMessages],
  );
  const displayMessages = isEmbeddedAgentSession ? embeddedMessages : messages;
  const isProcessing = isEmbeddedAgentSession
    ? codeStreaming.isStreaming
    : isLoading;
  const effectiveWorkspaceReady = isEmbeddedAgentSession || workspaceReady;
  const hasMessages = displayMessages.length > 0;
  const layoutMode = activeWorkspace?.layoutMode ?? 'thread';
  const sessionMode = activeSession?.mode ?? 'DEFAULT';
  const handleSessionModeChange = useCallback(
    (mode: CodeSessionMode) => {
      if (activeSessionId) {
        useCodeModeStore.getState().setSessionMode(activeSessionId, mode);
      }
    },
    [activeSessionId],
  );
  const handleToggleLayoutMode = useCallback(() => {
    if (!activeWorkspaceId) return;
    useCodeModeStore.getState().setWorkspaceLayoutMode(
      activeWorkspaceId,
      layoutMode === 'thread' ? 'canvas' : 'thread',
    );
  }, [activeWorkspaceId, layoutMode]);
  const codeSession = embeddedAgentSession?.session as CodeSession | null | undefined;
  const worktreeEnabled = isEmbeddedAgentSession
    ? codeSession?.metadata?.isolation === 'worktree'
    : pendingWorktree;
  const handleToggleWorktree = useCallback(() => {
    if (isEmbeddedAgentSession && embeddedAgentSession?.sessionId) {
      const nextIsolation = codeSession?.metadata?.isolation === 'worktree' ? 'none' : 'worktree';
      void useCodeSessionStore.getState().updateSession(embeddedAgentSession.sessionId, {
        metadata: { ...codeSession?.metadata, isolation: nextIsolation },
      });
      return;
    }
    setPendingWorktree((prev) => !prev);
  }, [isEmbeddedAgentSession, embeddedAgentSession?.sessionId, codeSession]);
  const handleOpenFolder = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker();
        const path = dirHandle?.name ?? '';
        if (path) {
          logger.info({ path }, '[CodeCanvas] Opened folder');
        }
      } else {
        logger.warn('[CodeCanvas] showDirectoryPicker is not supported in this environment');
      }
    } catch {
      // User cancelled or picker unavailable.
    }
  }, []);
  const handleRefreshWorkspace = useCallback(() => {
    // Reserved for refreshing repo status / workspace metadata.
  }, []);
  const handleSwitchBranch = useCallback((_branch: string) => {
    // Reserved for git branch switching once a backend action is available.
  }, []);
  // Only sessions actually bound to an agent (agent metadata present) get the
  // context strip — a plain code session must not render the agent card.
  const hasAgentBinding = Boolean(
    embeddedAgentSession.descriptor?.agentId || embeddedAgentSession.descriptor?.agentName,
  );
  const embeddedAgentStrip = isEmbeddedAgentSession && hasAgentBinding ? (
    <AgentContextStrip
      surface="code"
      sessionName={codeSession?.name || 'Agent Session'}
      sessionDescription={codeSession?.description}
      agentName={embeddedAgentSession?.descriptor?.agentName || selectedAgent?.name || undefined}
      harnessMode={selectedAgent?.harness?.mode}
      statusLabel={getAgentSessionStatusLabel(codeSession)}
      messageCount={codeSession?.messageCount ?? displayMessages.length}
      workspaceScope={embeddedAgentSession?.descriptor?.workspaceScope}
      canvasCount={embeddedCanvasCount}
      tags={codeSession?.tags}
      toolsEnabled={embeddedAgentSession?.descriptor?.agentFeatures?.tools === true}
      automationEnabled={embeddedAgentSession?.descriptor?.agentFeatures?.automation === true}
      onDismiss={onDismissEmbeddedAgentSession}
    />
  ) : null;

  const handleSend = useCallback(async (text: string): Promise<void> => {
    const draft = text.trim();
    if (!draft) {
      return;
    }

    if (!isEmbeddedAgentSession && agentModeEnabled && !selectedAgentId) {
      logger.warn('Agent mode is enabled but no agent is selected');
      return;
    }

    // Embedded session — route directly through CodeSessionStore
    if (isEmbeddedAgentSession && embeddedAgentSession?.sessionId) {
      setActiveCodeSession(embeddedAgentSession.sessionId);
      await sendCodeMessageStream(embeddedAgentSession.sessionId, { text: draft });
      return;
    }

    // Agent mode ON, agent selected, no session yet — create a real gizzi session
    if (agentModeEnabled && selectedAgentId) {
      try {
        const sessionId = await createCodeSession({
          name: draft.slice(0, 64) || 'Code Agent Session',
          sessionMode: 'agent',
          agentId: selectedAgent?.id,
          agentName: selectedAgent?.name,
          workspaceId: activeWorkspaceId,
          isolation: pendingWorktree ? 'worktree' : 'none',
          metadata: {
            runtimeModel: selectedAgent?.model,
            agentFeatures: { workspace: true, tools: true, automation: true },
          },
        });
        setActiveCodeSession(sessionId);
        await sendCodeMessageStream(sessionId, { text: draft });
        return;
      } catch (err) {
        logger.error({ err: err }, 'Failed to create code agent session');
        return;
      }
    }

    // Regular chat — unified through CodeSessionStore (same path as agent mode)
    let sessionId = regularChatSessionId;
    if (!sessionId && !regularChatSessionCreating.current) {
      regularChatSessionCreating.current = true;
      try {
        sessionId = await createCodeSession({
          name: 'Code Session',
          workspaceId: activeWorkspaceId,
          isolation: pendingWorktree ? 'worktree' : 'none',
        });
        setRegularChatSessionId(sessionId);
      } catch (err) {
        logger.warn({ err: err }, 'Session creation failed');
      } finally {
        regularChatSessionCreating.current = false;
      }
    }

    if (!sessionId) {
      return;
    }

    setActiveCodeSession(sessionId);
    await sendCodeMessageStream(sessionId, {
      text: draft,
      modelId: effectiveModelId,
    });
  }, [
    agentModeEnabled,
    activeWorkspaceId,
    embeddedAgentSession?.sessionId,
    effectiveModelId,
    isEmbeddedAgentSession,
    pendingWorktree,
    regularChatSessionId,
    sendCodeMessageStream,
    selectedAgent,
    selectedAgentId,
    setActiveCodeSession,
  ]);

  const handleRegenerate = useCallback((): void => {
    const lastUserMessage = [...displayMessages]
      .reverse()
      .find((message) => message.role === 'user' && typeof message.content === 'string');

    if (!lastUserMessage || typeof lastUserMessage.content !== 'string') {
      return;
    }

    if (isEmbeddedAgentSession && embeddedAgentSession?.sessionId) {
      setActiveCodeSession(embeddedAgentSession?.sessionId);
      if (embeddedAgentSession?.sessionId) {
        void sendCodeMessageStream(
          embeddedAgentSession?.sessionId,
          { text: lastUserMessage.content },
        );
        return;
      }
    }

    const chatId = regularChatSessionId ?? `code-temp-${Date.now()}`;
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
    agentModeEnabled,
    displayMessages,
    embeddedAgentSession?.sessionId,
    effectiveModelId,
    isEmbeddedAgentSession,
    regenerate,
    regularChatSessionId,
    sendCodeMessageStream,
    selectedAgent,
    selectedAgentId,
    setActiveCodeSession,
  ]);

  const handleStop = useCallback((): void => {
    if (isEmbeddedAgentSession && embeddedAgentSession?.sessionId) {
      void abortCodeGeneration(embeddedAgentSession?.sessionId);
      return;
    }

    stop();
  }, [
    abortCodeGeneration,
    embeddedAgentSession?.sessionId,
    isEmbeddedAgentSession,
    stop,
  ]);

  const composerTopInfoBar = pendingPermissions[0]
    ? <ComposerPermissionInfoBar request={pendingPermissions[0]} />
    : null;
  const composerQuestionBar = pendingQuestions[0]
    ? <ComposerQuestionBar request={pendingQuestions[0]} />
    : null;
  const bottomDockContent = (
    <CodeBottomStatusBar
      sessionMode={sessionMode}
      onSessionModeChange={handleSessionModeChange}
      selectedModelDisplayName={selectedModelDisplayName || selectedModel || 'Model'}
      onAddAttachment={onAddChatAttachment}
      metadata={
        <CodeComposerMetadata
          workspacePath={activeWorkspace?.root_path}
          branch={activeWorkspace?.repo_status?.branch}
          workspaceName={activeWorkspace?.display_name}
        />
      }
    />
  );

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
        agentModeEnabled={agentModeEnabled}
        agentModePulse={agentModePulse}
        selectedAgentName={selectedAgent?.name ?? null}
        onConfirmWorkspace={onConfirmWorkspace}
        attachments={attachments}
        onRemoveAttachment={onRemoveAttachment}
        onAddChatAttachment={onAddChatAttachment}
        attachmentPreviewItems={attachmentPreviewItems}
        onPreviewAttachment={onPreviewAttachment}
        previewItem={previewItem}
        previewModalOpen={previewModalOpen}
        onClosePreviewModal={onClosePreviewModal}
        composerTopInfoBar={composerTopInfoBar}
        composerQuestionBar={composerQuestionBar}
        bottomDockContent={bottomDockContent}
        onOpenFolder={handleOpenFolder}
        onRefreshWorkspace={handleRefreshWorkspace}
        onToggleWorktree={handleToggleWorktree}
        worktreeEnabled={worktreeEnabled}
        onSwitchBranch={handleSwitchBranch}
      />
    );
  }

  return (
    <LaunchpadStage
      activeWorkspace={activeWorkspace}
      activeSession={activeSession}
      agentContextStrip={embeddedAgentStrip}
      composerSeed={composerSeed}
      composerVersion={composerVersion}
      isEmbeddedAgentSession={isEmbeddedAgentSession}
      isProcessing={isProcessing}
      onOpenConsole={onOpenConsole}
      onSelectModel={onSelectModel}
      onSend={handleSend}
      onSetActiveSession={onSetActiveSession}
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
      attachments={attachments}
      onRemoveAttachment={onRemoveAttachment}
      onAddChatAttachment={onAddChatAttachment}
      attachmentPreviewItems={attachmentPreviewItems}
      onPreviewAttachment={onPreviewAttachment}
      previewItem={previewItem}
      previewModalOpen={previewModalOpen}
      onClosePreviewModal={onClosePreviewModal}
      composerTopInfoBar={composerTopInfoBar}
      composerQuestionBar={composerQuestionBar}
      bottomDockContent={bottomDockContent}
      onOpenFolder={handleOpenFolder}
      onRefreshWorkspace={handleRefreshWorkspace}
      onToggleWorktree={handleToggleWorktree}
      worktreeEnabled={worktreeEnabled}
      onSwitchBranch={handleSwitchBranch}
    />
  );
}

function LaunchpadStage({
  activeWorkspace,
  activeSession,
  agentContextStrip,
  composerSeed,
  composerVersion,
  isEmbeddedAgentSession,
  isProcessing,
  onOpenConsole,
  onSelectModel,
  onSend,
  onSetActiveSession,
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
  attachments,
  onRemoveAttachment,
  onAddChatAttachment,
  attachmentPreviewItems,
  onPreviewAttachment,
  previewItem,
  previewModalOpen,
  onClosePreviewModal,
  composerTopInfoBar,
  composerQuestionBar,
  bottomDockContent,
  onOpenFolder,
  onRefreshWorkspace,
  onToggleWorktree,
  worktreeEnabled,
  onSwitchBranch,
}: {
  activeWorkspace: ReturnType<typeof getActiveWorkspace>;
  activeSession: ReturnType<typeof getActiveSession>;
  agentContextStrip?: React.ReactNode;
  composerSeed: string;
  composerVersion: number;
  isEmbeddedAgentSession: boolean;
  isProcessing: boolean;
  onOpenConsole: () => void;
  onSelectModel: (selection: CodeModelSelection) => void;
  onSend: (text: string) => void;
  onSetActiveSession: (sessionId: string) => void;
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
  attachments: ChatAttachment[];
  onRemoveAttachment: (id: string) => void;
  onAddChatAttachment: (attachment: ChatAttachment) => void;
  attachmentPreviewItems: AttachmentPreviewItem[];
  onPreviewAttachment: (item: AttachmentPreviewItem) => void;
  previewItem: AttachmentPreviewItem | null;
  previewModalOpen: boolean;
  onClosePreviewModal: () => void;
  composerTopInfoBar: React.ReactNode;
  composerQuestionBar: React.ReactNode;
  bottomDockContent: React.ReactNode;
  onOpenFolder?: () => void;
  onRefreshWorkspace?: () => void;
  onToggleWorktree?: () => void;
  worktreeEnabled: boolean;
  onSwitchBranch?: (branch: string) => void;
}) {
  const [brandingAttention, setBrandingAttention] = useState<GizziAttention | null>(null);
  const [showUsage, setShowUsage] = useState(true);
  const [greetingIndex, setGreetingIndex] = useState(0);

  const greetings = useMemo(
    () => [
      "What's up next?",
      'Ready to ship something?',
      'What are we building today?',
      'Pick a task and let\'s run it.',
      'Need a hand with the codebase?',
    ],
    [],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setGreetingIndex((i) => (i + 1) % greetings.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [greetings.length]);

  return (
    <div
      data-testid="code-canvas-shell"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '32px 32px 40px',
        boxSizing: 'border-box',
        overflow: 'auto',
        minHeight: 0,
      }}
    >
      {agentContextStrip ? (
        <div style={{ width: '100%', textAlign: 'left', marginBottom: 18 }}>
          {agentContextStrip}
        </div>
      ) : null}

      {/* Top command-center header */}
      <div style={{ width: '100%', maxWidth: 720, margin: '0 auto', paddingTop: 24 }}>
        <div
          data-testid="code-launchpad-greeting"
          style={{
            fontSize: 28,
            lineHeight: 1.2,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-research)',
            minHeight: '1.2em',
          }}
        >
          {greetings[greetingIndex]}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          Run a command or describe a task to start coding.
        </div>
        {showUsage ? (
          <div style={{ marginTop: 24 }}>
            <CodeUsageDashboard onClose={() => setShowUsage(false)} />
          </div>
        ) : (
          <button
            type="button"
            data-testid="code-show-usage"
            onClick={() => setShowUsage(true)}
            style={{
              ...pillControlStyle,
              marginTop: 24,
              width: 'fit-content',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <ChartBar size={14} />
            Show usage
          </button>
        )}
      </div>

      {/* Spacer pushes composer to the bottom */}
      <div style={{ flex: 1, minHeight: 40 }} />

      {/* Bottom command input area */}
      <div className="w-full max-w-[600px] lg:max-w-[760px] mx-auto">
        {/* Top deck sits behind the composer card, full composer width */}
        <div
          data-testid="code-top-deck"
          style={{
            position: 'relative',
            zIndex: 1,
            marginBottom: -12,
            padding: '0 0 16px',
          }}
        >
          <CodeWorkspaceBar
            activeWorkspace={activeWorkspace}
            worktreeEnabled={worktreeEnabled}
            activeWorkspaceId={activeWorkspaceId}
            workspaces={workspaces}
            workspaceReady={workspaceReady}
            onConfirmWorkspace={onConfirmWorkspace}
            onOpenFolder={onOpenFolder}
            onRefresh={onRefreshWorkspace}
            onToggleWorktree={onToggleWorktree}
            onSwitchBranch={onSwitchBranch}
          />
        </div>
        <div data-testid="code-shared-composer" style={{ position: 'relative', zIndex: 2 }}>
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
                ? 'Run a command or describe a task...'
                : 'Choose a workspace folder to unlock the session...'
            }
            showTopActions={false}
            inputValue={composerSeed}
            variant="large"
            compact
            onAttentionChange={setBrandingAttention}
            agentModeSurface="code"
            attachments={attachments}
            onRemoveAttachment={onRemoveAttachment}
            onAddAttachment={onAddChatAttachment}
            topInfoBarContent={composerTopInfoBar}
            questionBarContent={composerQuestionBar}
            bottomDockContent={bottomDockContent}
            showModeToggle={false}
          />

          {/* Real Gizzi mascot as a bottom-right companion in code mode */}
          <div
            style={{
              position: 'absolute',
              right: -48,
              bottom: -8,
              pointerEvents: 'auto',
              zIndex: 100,
            }}
          >
            <CodeLaunchBranding
              workspaceReady={workspaceReady}
              attention={brandingAttention}
              agentModeEnabled={agentModeEnabled}
              agentModePulse={agentModePulse}
              selectedAgentName={selectedAgentName}
              variant="companion"
            />
          </div>
        </div>
      </div>
      <AttachmentPreviewModal
        item={previewItem}
        isOpen={previewModalOpen}
        onClose={onClosePreviewModal}
      />
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
  agentModeEnabled,
  agentModePulse,
  selectedAgentName,
  onConfirmWorkspace,
  attachments,
  onRemoveAttachment,
  onAddChatAttachment,
  attachmentPreviewItems,
  onPreviewAttachment,
  previewItem,
  previewModalOpen,
  onClosePreviewModal,
  composerTopInfoBar,
  composerQuestionBar,
  bottomDockContent,
  onOpenFolder,
  onRefreshWorkspace,
  onToggleWorktree,
  worktreeEnabled,
  onSwitchBranch,
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
  onSelectModel: (selection: CodeModelSelection) => void;
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
  agentModeEnabled: boolean;
  agentModePulse: number;
  selectedAgentName: string | null;
  onConfirmWorkspace: (workspaceId?: string) => void;
  attachments: ChatAttachment[];
  onRemoveAttachment: (id: string) => void;
  onAddChatAttachment: (attachment: ChatAttachment) => void;
  attachmentPreviewItems: AttachmentPreviewItem[];
  onPreviewAttachment: (item: AttachmentPreviewItem) => void;
  previewItem: AttachmentPreviewItem | null;
  previewModalOpen: boolean;
  onClosePreviewModal: () => void;
  composerTopInfoBar: React.ReactNode;
  composerQuestionBar: React.ReactNode;
  bottomDockContent: React.ReactNode;
  onOpenFolder?: () => void;
  onRefreshWorkspace?: () => void;
  onToggleWorktree?: () => void;
  worktreeEnabled: boolean;
  onSwitchBranch?: (branch: string) => void;
}) {
  const codeSessions = useCodeSessionStore((s) => s.sessions ?? []);
  const activeCodeSessionId = useCodeSessionStore((s) => s.activeSessionId);
  const activeCodeSession = useMemo(
    () => codeSessions.find((s) => s.id === activeCodeSessionId) ?? null,
    [activeCodeSessionId, codeSessions],
  );
  const {
    todos,
    allTodosDone,
    todosVisible,
    dismissTodos,
  } = useSessionComposerState(gizziBaseUrl(), activeCodeSessionId ?? '__inactive__');
  const sessionDisplayName = activeCodeSession?.name ?? activeSession?.title ?? 'Code Session';
  const [brandingAttention, setBrandingAttention] = useState<GizziAttention | null>(null);
  return (
    <div data-testid="code-canvas-shell" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden',
      // Background now handled at CodeRoot level for full-screen effect
    }}>
      {/* Session header: session name + workspace tag */}
      <div
        data-testid="code-session-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={sessionDisplayName}
          >
            {sessionDisplayName}
          </span>
          <select
            aria-label="Session"
            data-testid="code-session-header-selector"
            value={activeSessionId}
            onChange={(e) => onSetActiveSession(e.target.value)}
            style={{
              maxWidth: 200,
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.03)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {workspaceSessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {session.title}
              </option>
            ))}
          </select>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 999,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.03)',
            color: 'var(--text-secondary)',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <FolderSimple size={12} />
          {activeWorkspace?.display_name ?? 'Workspace'}
        </span>
      </div>
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
          {todosVisible && (
            <div
              data-testid="code-session-todos"
              style={{ position: 'relative', zIndex: 1, marginBottom: 8 }}
            >
              <SessionTodoDock
                todos={todos}
                allDone={allTodosDone}
                onDismiss={dismissTodos}
              />
            </div>
          )}
          <div data-testid="code-shared-composer" style={{ position: 'relative', zIndex: 2, marginTop: 8 }}>
            <ACIComputerUseBar suppressInBrowserMode />
            {attachmentPreviewItems.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <AttachmentPreview
                  attachments={attachmentPreviewItems}
                  onRemove={onRemoveAttachment}
                  onPreview={onPreviewAttachment}
                  variant="compact"
                  maxHeight={120}
                />
              </div>
            )}
            <ChatComposer
              key={`code-conversation-composer-${composerVersion}`}
              onSend={onSend}
              isLoading={isProcessing}
              onStop={onStop}
              selectedModel={selectedModel}
              selectedModelDisplayName={selectedModelDisplayName}
              onSelectModel={onSelectModel}
              placeholder="Reply…"
              showTopActions={false}
              inputValue={composerSeed}
              compact
              agentModeSurface="code"
              attachments={attachments}
              onRemoveAttachment={onRemoveAttachment}
              onAddAttachment={onAddChatAttachment}
              topInfoBarContent={composerTopInfoBar}
              questionBarContent={composerQuestionBar}
              bottomDockContent={bottomDockContent}
              showModeToggle={false}
              onAttentionChange={setBrandingAttention}
            />

            {/* Real Gizzi mascot as a bottom-right companion in code mode */}
            <div
              style={{
                position: 'absolute',
                right: -48,
                bottom: -8,
                pointerEvents: 'auto',
                zIndex: 100,
              }}
            >
              <CodeLaunchBranding
                workspaceReady={workspaceReady}
                attention={brandingAttention}
                agentModeEnabled={agentModeEnabled}
                agentModePulse={agentModePulse}
                selectedAgentName={selectedAgentName}
                variant="companion"
              />
            </div>
          </div>
        </div>
      </div>
      <AttachmentPreviewModal
        item={previewItem}
        isOpen={previewModalOpen}
        onClose={onClosePreviewModal}
      />
    </div>
  );
}


function CodeComposerMetadata({
  workspacePath,
  branch,
  workspaceName,
}: {
  workspacePath?: string;
  branch?: string;
  workspaceName?: string;
}) {
  const items: string[] = [];
  if (workspaceName) items.push(workspaceName);
  if (workspacePath) items.push(workspacePath);
  if (branch) items.push(branch);

  if (items.length === 0) return null;

  return (
    <div
      data-testid="code-composer-metadata"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(255, 255, 255, 0.03)',
        color: 'var(--ui-text-muted)',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
      title={items.join(' · ')}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span style={{ opacity: 0.4 }}>·</span>}
          <span
            style={{
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
