/**
 * CoworkRoot.tsx
 * Claude-style Cowork Mode: Chat-first layout with inline work blocks + right rail
 * 
 * Architecture:
 * - Same base chat surface as normal Chat mode (no custom backgrounds)
 * - Center: Chat transcript with inline work blocks (Command, File, Observation, etc.)
 * - Right rail: Progress checklist + files touched + context + session stats
 * - Viewport (screenshots) appear inline as expandable cards, not permanent left pane
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { getAgentSessionDescriptor } from '@/lib/agents';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsInLineVertical,
  Clock,
  FolderOpen,
  Sparkle,
  Wrench,
  X,
} from '@phosphor-icons/react';

// Chat components
import { ChatComposer } from '../chat/ChatComposer';
import { CoworkTranscript } from './CoworkTranscript';

// Attachment components
import { useDropTarget, type FileWithData } from '@/components/GlobalDropzone';
import { AttachmentPreview, AttachmentPreviewModal, type AttachmentPreviewItem } from '@/components/chat/AttachmentPreview';

// AI streaming (same as Chat mode)
import { useRustStreamAdapter } from '@/lib/ai/rust-stream-adapter';

// Cowork-specific components
import { useCoworkStore } from './CoworkStore';
import { useTaskStore } from './useTaskStore';
import { useTeamBridge } from './useTeamBridge';
import { CoworkRightRail } from './CoworkRightRail';
import { CoworkLaunchpad } from './CoworkLaunchpad';
import { CoworkProjectView } from './CoworkProjectView';
import { PermissionModal } from './PermissionModal';
import { QuestionModal } from './QuestionModal';
import { sessionLifecycleApi } from '@/lib/agents/native-agent-api';

// Providers (matching ChatRoot structure)
import { ChatIdProvider } from '@/providers/chat-id-provider';
import { DataStreamProvider } from '@/providers/data-stream-provider';
import { MessageTreeProvider } from '@/providers/message-tree-provider';
import { ChatInputProvider } from '@/providers/chat-input-provider';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import { ChatModelsProvider } from '@/providers/chat-models-provider';
import { ModelSelectionProvider } from '@/providers/model-selection-provider';
import { useModelSelection } from '@/providers/model-selection-provider';
import { AgentContextStrip } from '@/components/agents/AgentContextStrip';
import {
  buildAgentConversationContext,
  useSurfaceAgentSelection,
} from '@/lib/agents/surface-agent-context';
import {
  getOpenClawWorkspacePathFromAgent,
  mapNativeMessagesToStreamMessages,
} from '@/lib/agents';
import { useCoworkSessionStore } from './CoworkSessionStore';
import { AgentModeBackdrop } from '../chat/agentModeSurfaceTheme';
import { useModeCanvasBridge } from '@/hooks/useModeCanvasBridge';
import { ACIComputerUseBar } from '@/capsules/browser/ACIComputerUseSidecar';
import { usePermissionGuide } from '@/lib/usePermissionGuide';

// Theme (matching ChatView)
const THEME = {
  bg: '#2B2520',
  bgGradient: 'linear-gradient(to top, #2B2520 60%, transparent)',
  textPrimary: '#ECECEC',
  textSecondary: 'var(--ui-text-secondary)',
  textMuted: 'var(--ui-text-muted)',
  accent: 'var(--accent-primary)',
  borderSubtle: 'var(--ui-border-muted)',
};

const MAX_COWORK_TASK_TITLE_LENGTH = 64;

function buildCoworkTaskTitleFromMessage(message: string): string {
  const normalized = message.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return 'New Task';
  }
  if (normalized.length <= MAX_COWORK_TASK_TITLE_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_COWORK_TASK_TITLE_LENGTH - 3)}...`;
}

// ============================================================================
// Error Fallback
// ============================================================================

function CoworkErrorFallback() {
  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      color: 'var(--ui-text-primary)'
    }}>
      <h2 style={{ fontFamily: "'Allternit Serif', Georgia, ui-serif, Cambria, 'Times New Roman', Times, serif", marginBottom: 12 }}>Cowork Error</h2>
      <p style={{ color: 'var(--ui-text-muted)', marginBottom: 24 }}>The collaborative workspace encountered an error.</p>
      <button 
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 20px',
          background: 'var(--surface-hover)',
          border: '1px solid #444',
          borderRadius: 8,
          color: 'white',
          cursor: 'pointer'
        }}
      >
        Reload
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CoworkRoot() {
  return (
    <ErrorBoundary fallback={<CoworkErrorFallback />}>
      <CoworkRootContent />
    </ErrorBoundary>
  );
}

function CoworkRootContent() {
  const {
    activeProjectId,
  } = useCoworkStore();
  
  const [showRail, setShowRail] = useState(true);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  // Cowork-owned session ID, local to this mount — null means show launchpad.
  // Intentionally NOT read from any store on mount so navigating to Cowork
  // always lands on the launchpad fresh, regardless of persisted state.
  const [coworkSessionId, setCoworkSessionId] = useState<string | null>(null);
  
  // Dropped files state
  const [droppedFiles, setDroppedFiles] = useState<AttachmentPreviewItem[]>([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<AttachmentPreviewItem | null>(null);
  
  // Connect mode tabs to canvas opening (Phase 4)
  useModeCanvasBridge({ surface: 'cowork' });

  // Wire team bridge when active task has a workspaceId
  const activeTask = useTaskStore((state) =>
    state.tasks.find((t) => t.id === state.activeTaskId)
  );
  useTeamBridge(activeTask?.workspaceId);

  // ViewHost unmounts CoworkRoot when the user switches to another mode.
  // On each mount (fresh navigation TO Cowork), reset persisted project state so
  // the launchpad is always shown rather than auto-resuming the last project.
  useEffect(() => {
    useCoworkStore.getState().setActiveProject(null);
    return () => {
      useCoworkStore.getState().setActiveProject(null);
    };
  }, []);
  
  // Handle dropped files from global dropzone
  const handleDroppedFiles = useCallback(async (files: FileWithData[]) => {
    const extToType = (filename: string): AttachmentPreviewItem['type'] => {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
      if (['pdf'].includes(ext)) return 'document';
      if (['docx', 'doc', 'txt', 'md'].includes(ext)) return 'document';
      if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go'].includes(ext)) return 'code';
      if (['json'].includes(ext)) return 'json';
      if (['csv', 'xlsx', 'xls'].includes(ext)) return 'spreadsheet';
      return 'other';
    };
    
    const newFiles: AttachmentPreviewItem[] = files.map(({ file, dataUrl, extractedText }) => ({
      id: `cowork-drop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: extToType(file.name),
      dataUrl,
      size: file.size,
      extractedText,
    }));
    
    setDroppedFiles(prev => [...prev, ...newFiles]);
  }, []);
  
  // Register as drop target for cowork
  useDropTarget('cowork', handleDroppedFiles);
  
  const handlePreview = useCallback((item: AttachmentPreviewItem) => {
    setPreviewItem(item);
    setPreviewModalOpen(true);
  }, []);
  const embeddedSessionId = useCoworkSessionStore((s) => s.activeSessionId);
  const embeddedSession = useCoworkSessionStore((s) =>
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
  const coworkAgentModeEnabled = isEmbeddedAgentSession && embeddedDescriptor.sessionMode === 'agent';

  // If there's an active project, show CoworkProjectView instead
  if (activeProjectId && !isEmbeddedAgentSession) {
    return <CoworkProjectView />;
  }
  
  // Start a new cowork session via gizzi runtime, using Cowork's own session store.
  const handleStartCowork = useCallback(async (task: string) => {
    try {
      const sessionId = await useCoworkSessionStore.getState().createSession({
        name: task.slice(0, 64) || 'New Cowork Session',
        sessionMode: 'regular',
      });
      useCoworkSessionStore.getState().setActiveSession(sessionId);
      setCoworkSessionId(sessionId);
      setInitialMessage(task);
    } catch (err) {
      console.error('[CoworkRoot] Failed to create cowork session:', err);
    }
  }, []);

  // Show launchpad whenever no session has been started in this mount lifecycle.
  // Ignores persisted `session` so navigating to Cowork always lands on the launchpad.
  if (!coworkSessionId && !embeddedAgentSession?.isEmbedded) {
    return (
      <ModelSelectionProvider>
        <CoworkLaunchpad 
          onStartChat={handleStartCowork}
          onResumeThread={() => {}}
        />
      </ModelSelectionProvider>
    );
  }
  
  // Active session: Chat-first layout with right rail
  // Uses SAME background tokens as regular Chat mode
  return (
    <DataStreamProvider>
      <ChatIdProvider
        chatId={coworkSessionId || embeddedAgentSession?.sessionId || 'cowork-embedded'}
        isPersisted={Boolean(coworkSessionId || embeddedAgentSession?.sessionId)}
        source="local"
      >
        <MessageTreeProvider>
          <ChatInputProvider>
            <PromptInputProvider>
              <ChatModelsProvider>
                <ModelSelectionProvider>
                  <div style={{ position: 'relative', height: '100%', isolation: 'isolate' }}>
                    <AgentModeBackdrop
                      active={coworkAgentModeEnabled}
                      surface="cowork"
                      dataTestId="agent-mode-cowork-backdrop"
                    />
                    <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
                      <div
                        className="coworkShell"
                        data-rail-collapsed={!showRail ? 'true' : 'false'}
                      >
                        {/* Main chat area - Claude-style narrow column */}
                        <div className="coworkCenter">
                          {/* Dropped Files Attachment Preview */}
                          {droppedFiles.length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: 16,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              zIndex: 100,
                              maxWidth: '90%',
                              background: 'var(--surface-floating)',
                              backdropFilter: 'blur(10px)',
                              borderRadius: 16,
                              border: '1px solid var(--border-default)',
                              boxShadow: 'var(--shadow-lg)',
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px 0',
                                borderBottom: '1px solid var(--ui-border-muted)',
                              }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: 'var(--accent-cowork)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                }}>
                                  Attached Files ({droppedFiles.length})
                                </span>
                                <button
                                  onClick={() => setDroppedFiles([])}
                                  style={{
                                    fontSize: 10,
                                    color: 'rgba(245,240,232,0.5)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px 6px',
                                  }}
                                >
                                  Clear all
                                </button>
                              </div>
                              <AttachmentPreview
                                attachments={droppedFiles}
                                onRemove={(id) => setDroppedFiles(prev => prev.filter(f => f.id !== id))}
                                onPreview={handlePreview}
                                variant="detailed"
                                maxHeight={160}
                              />
                            </div>
                          )}
                          
                          {/* Preview Modal */}
                          <AttachmentPreviewModal
                            item={previewItem}
                            isOpen={previewModalOpen}
                            onClose={() => setPreviewModalOpen(false)}
                          />
                          
                          {/* Cowork Chat - Transcript + Composer integrated */}
                          <CoworkChat
                            sessionId={coworkSessionId || embeddedAgentSession?.sessionId || 'cowork-embedded'}
                            initialMessage={initialMessage}
                            onInitialMessageSent={() => setInitialMessage(null)}
                          />

                          {/* Permission + Question gate modals — float above transcript.
                            Only meaningful when using a native gizzi-code session (embedded agent),
                            but harmless to render for legacy CoworkStore sessions (empty pending lists). */}
                          {(embeddedAgentSession?.sessionId) && (
                            <div className="coworkGateOverlay">
                              <PermissionModal sessionId={embeddedAgentSession?.sessionId || ''} />
                              <QuestionModal sessionId={embeddedAgentSession?.sessionId || ''} />
                            </div>
                          )}

                          {/* Slider handle for right rail - always visible when rail is collapsed */}
                          {!showRail && (
                            <button
                              onClick={() => setShowRail(true)}
                              className="coworkRailHandle"
                              title="Show activity panel"
                            >
                              <div className="coworkRailHandleLine" />
                            </button>
                          )}
                        </div>
                        
                        {/* Right rail - progress, files, context */}
                        {showRail && (
                          <>
                            <button
                              onClick={() => setShowRail(false)}
                              className="coworkRailSlider"
                              title="Hide activity panel"
                            >
                              <div className="coworkRailSliderLine" />
                            </button>
                            <aside className="coworkRail">
                              {embeddedAgentSession?.isEmbedded ? (
                                <EmbeddedCoworkAgentRail />
                              ) : (
                                <CoworkRightRail />
                              )}
                            </aside>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </ModelSelectionProvider>
              </ChatModelsProvider>
            </PromptInputProvider>
          </ChatInputProvider>
        </MessageTreeProvider>
      </ChatIdProvider>
    </DataStreamProvider>
  );
}

// ============================================================================
// CSS Styles - Layout only, no background changes
// ============================================================================

const coworkStyles = `
.coworkShell {
  display: grid;
  grid-template-columns: 1fr auto clamp(220px, 20vw, 260px);
  height: 100%;
  width: 100%;
  /* NO background - inherits from app shell */
}

.coworkShell[data-rail-collapsed="true"] {
  grid-template-columns: 1fr;
}

.coworkCenter {
  min-width: 0;
  height: 100%;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

/* Permission / question gate — floats above transcript near the bottom */
.coworkGateOverlay {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  width: min(480px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 50;
  pointer-events: auto;
}

/* Slider handle - visible when rail is shown */
.coworkRailSlider {
  width: 6px;
  height: 100%;
  background: transparent;
  border: none;
  cursor: col-resize;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 50;
}

.coworkRailSlider:hover {
  background: var(--border-subtle, var(--ui-border-default));
}

.coworkRailSliderLine {
  width: 3px;
  height: 40px;
  background: var(--accent-primary);
  border-radius: 2px;
  opacity: 0.35;
  transition: opacity 0.15s;
}

.coworkRailSlider:hover .coworkRailSliderLine {
  opacity: 1;
}

/* Handle - visible when rail is collapsed */
.coworkRailHandle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 60px;
  background: transparent;
  border: none;
  border-left: 2px solid var(--border-subtle, var(--ui-border-default));
  cursor: pointer;
  padding: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
}

.coworkRailHandle:hover {
  border-left-color: var(--text-muted, #6B6B6B);
}

.coworkRailHandleLine {
  width: 3px;
  height: 20px;
  background: var(--accent-primary);
  border-radius: 2px;
  opacity: 0.35;
  transition: opacity 0.15s;
}

.coworkRailHandle:hover .coworkRailHandleLine {
  opacity: 1;
}

.coworkRail {
  min-width: 0;
  height: 100%;
  overflow: auto;
  background: var(--shell-panel-bg);
  border-left: 1px solid var(--border-subtle);
}

.coworkChatContainer {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Responsive: hide rail on small screens */
@media (max-width: 768px) {
  .coworkShell {
    grid-template-columns: 1fr;
  }
  
  .coworkRail,
  .coworkRailSlider {
    display: none;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'cowork-root-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = coworkStyles;
    document.head.appendChild(styleEl);
  }
}

// ============================================================================
// CoworkChat - Integrated transcript + composer for Cowork mode
// Uses useRustStreamAdapter just like Chat mode for real AI responses
// ============================================================================

interface CoworkChatProps {
  sessionId: string;
  initialMessage?: string | null;
  onInitialMessageSent?: () => void;
}

interface CoworkComposeEventDetail {
  text?: string;
  send?: boolean;
}

function CoworkChat({ sessionId, initialMessage, onInitialMessageSent }: CoworkChatProps) {
  const { selection: modelSelection, selectModel, startSelection } = useModelSelection();
  const { agentModeEnabled, selectedAgentId, selectedAgent } =
    useSurfaceAgentSelection('cowork');
  const embeddedSessionId = useCoworkSessionStore((s) => s.activeSessionId);
  const embeddedSession = useCoworkSessionStore((s) =>
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
  const createNativeSession = useCoworkSessionStore((state) => state.createSession);
  const setActiveNativeSession = useCoworkSessionStore((state) => state.setActiveSession);
  const sendNativeMessageStream = useCoworkSessionStore((state) => state.sendMessageStream);
  const fetchNativeMessages = useCoworkSessionStore((state) => state.fetchMessages);
  const abortNativeGeneration = useCoworkSessionStore((state) => state.abortGeneration);
  const nativeStreaming = useCoworkSessionStore((state) => ({
    isStreaming: embeddedAgentSession?.sessionId 
      ? state.streamingBySession[embeddedAgentSession.sessionId]?.isStreaming ?? false 
      : false,
  }));
  const nativeMessages = useCoworkSessionStore((state) =>
    embeddedAgentSession?.sessionId
      ? state.sessions.find(s => s.id === embeddedAgentSession.sessionId)?.messages || []
      : [],
  );
  const activeTaskId = useCoworkStore((state) => state.activeTaskId);
  const activeProjectId = useCoworkStore((state) => state.activeProjectId);
  const createTask = useCoworkStore((state) => state.createTask);
  // Canvases not yet implemented in new store - stub for compatibility
  const embeddedCanvasIds: string[] = [];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSentInitialMessage = useRef(false);
  const [composerInputValue, setComposerInputValue] = useState('');
  
  const selectedModel = modelSelection?.profileId ?? 'claude-cli/claude-sonnet-4-6';
  const runtimeModelId = modelSelection?.modelId;
  
  // Use the SAME streaming adapter as Chat mode
  const {
    messages,
    isLoading,
    submitMessage,
    regenerate,
    stop,
  } = useRustStreamAdapter({
    onError: (error) => console.error("Cowork chat error:", error),
  });

  useEffect(() => {
    if (!embeddedAgentSession?.sessionId || !embeddedAgentSession?.isEmbedded) {
      return;
    }

    setActiveNativeSession(embeddedAgentSession?.sessionId);
    void fetchNativeMessages(embeddedAgentSession?.sessionId);
  }, [
    embeddedAgentSession?.isEmbedded,
    embeddedAgentSession?.sessionId,
    fetchNativeMessages,
    setActiveNativeSession,
  ]);

  const displayMessages = embeddedAgentSession?.isEmbedded
    ? mapNativeMessagesToStreamMessages(nativeMessages)
    : messages;
  const displayIsLoading = embeddedAgentSession?.isEmbedded
    ? nativeStreaming.isStreaming
    : isLoading;

  const ensureTaskForMessage = useCallback((message: string) => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage || activeTaskId) {
      return;
    }
    const taskMode: 'task' | 'agent' = agentModeEnabled ? 'agent' : 'task';
    createTask(
      buildCoworkTaskTitleFromMessage(normalizedMessage),
      taskMode,
      activeProjectId || undefined,
    );
  }, [activeProjectId, activeTaskId, agentModeEnabled, createTask]);

  const ensureEmbeddedSession = useCallback(async () => {
    if (embeddedAgentSession?.sessionId && embeddedAgentSession?.isEmbedded) {
      setActiveNativeSession(embeddedAgentSession?.sessionId);
      return embeddedAgentSession?.sessionId;
    }

    if (!agentModeEnabled || !selectedAgentId) {
      return null;
    }

    const sessionId = await createNativeSession({
      name: 'Cowork Agent Session',
      sessionMode: 'agent',
      agentId: selectedAgent?.id,
      agentName: selectedAgent?.name,
      metadata: {
        originSurface: 'cowork',
        workspaceScope: getOpenClawWorkspacePathFromAgent(selectedAgent) ?? undefined,
        runtimeModel: selectedAgent?.model,
        agentFeatures: { workspace: true, tools: true, automation: true },
      },
    });

    setActiveNativeSession(sessionId);
    return sessionId;
  }, [
    agentModeEnabled,
    createNativeSession,
    embeddedAgentSession?.isEmbedded,
    embeddedAgentSession?.sessionId,
    selectedAgent,
    selectedAgentId,
    setActiveNativeSession,
  ]);
  
  // Send initial message from launchpad on mount
  useEffect(() => {
    if (initialMessage && !hasSentInitialMessage.current) {
      const normalizedInitialMessage = initialMessage.trim();
      if (!normalizedInitialMessage) {
        onInitialMessageSent?.();
        return;
      }
      hasSentInitialMessage.current = true;
      ensureTaskForMessage(normalizedInitialMessage);
      if (agentModeEnabled && selectedAgentId) {
        void ensureEmbeddedSession()
          .then((nativeSessionId) => {
            if (!nativeSessionId) {
              return;
            }

            return sendNativeMessageStream(nativeSessionId, { text: normalizedInitialMessage });
          })
          .finally(() => {
            onInitialMessageSent?.();
          });
        return;
      }

      const agentContext = buildAgentConversationContext({
        agentModeEnabled,
        agentId: selectedAgentId,
        agent: selectedAgent,
        chatId: sessionId,
      });
      submitMessage({
        chatId: sessionId,
        message: normalizedInitialMessage,
        modelId: selectedModel,
        runtimeModelId,
        ...agentContext,
      }).then(() => {
        onInitialMessageSent?.();
      });
    }
  }, [
    agentModeEnabled,
    initialMessage,
    onInitialMessageSent,
    runtimeModelId,
    selectedAgent,
    selectedAgentId,
    selectedModel,
    ensureTaskForMessage,
    sendNativeMessageStream,
    sessionId,
    submitMessage,
    ensureEmbeddedSession,
  ]);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, displayIsLoading]);

  const handleSend = useCallback(async (text: string) => {
    const normalizedText = text.trim();
    if (!normalizedText) return;
    setComposerInputValue('');

    ensureTaskForMessage(normalizedText);

    if (agentModeEnabled && !selectedAgentId) {
      console.warn('[CoworkRoot] Agent mode is enabled but no agent is selected');
      return;
    }

    if (agentModeEnabled && selectedAgentId) {
      const nativeSessionId = await ensureEmbeddedSession();
      if (nativeSessionId) {
        await sendNativeMessageStream(nativeSessionId, { text: normalizedText });
        return;
      }
    }

    const agentContext = buildAgentConversationContext({
      agentModeEnabled,
      agentId: selectedAgentId,
      agent: selectedAgent,
      chatId: sessionId,
    });
    
    await submitMessage({
      chatId: sessionId,
      message: normalizedText,
      modelId: selectedModel,
      runtimeModelId,
      ...agentContext,
    });
  }, [
    agentModeEnabled,
    ensureTaskForMessage,
    runtimeModelId,
    selectedAgent,
    selectedAgentId,
    selectedModel,
    sendNativeMessageStream,
    sessionId,
    submitMessage,
    ensureEmbeddedSession,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onComposeRequest = (event: Event) => {
      const detail = (event as CustomEvent<CoworkComposeEventDetail>).detail;
      const text = detail?.text?.trim();
      if (!text) return;

      if (detail?.send) {
        setComposerInputValue('');
        void handleSend(text);
        return;
      }

      setComposerInputValue(text);
    };

    window.addEventListener('allternit:cowork-compose', onComposeRequest as EventListener);
    return () => {
      window.removeEventListener('allternit:cowork-compose', onComposeRequest as EventListener);
    };
  }, [handleSend]);
  
  const handleRegenerate = useCallback(() => {
    const lastUserMsg = [...displayMessages].reverse().find((m) => m.role === "user");
    if (lastUserMsg && typeof lastUserMsg.content === "string") {
      if (embeddedAgentSession?.isEmbedded && embeddedAgentSession?.sessionId) {
        setActiveNativeSession(embeddedAgentSession?.sessionId);
        void sendNativeMessageStream(embeddedAgentSession?.sessionId, { text: lastUserMsg.content });
        return;
      }

      const agentContext = buildAgentConversationContext({
        agentModeEnabled,
        agentId: selectedAgentId,
        agent: selectedAgent,
        chatId: sessionId,
      });
      regenerate(lastUserMsg.content, {
        chatId: sessionId,
        modelId: selectedModel,
        runtimeModelId,
        ...agentContext,
      });
    }
  }, [
    agentModeEnabled,
    displayMessages,
    embeddedAgentSession?.isEmbedded,
    embeddedAgentSession?.sessionId,
    regenerate,
    runtimeModelId,
    selectedAgent,
    selectedAgentId,
    selectedModel,
    sendNativeMessageStream,
    sessionId,
    setActiveNativeSession,
  ]);

  const embeddedAgentDescriptor = embeddedAgentSession?.descriptor;
  const _embeddedSession = embeddedAgentSession?.session as any;
  const embeddedAgentStrip = embeddedAgentSession?.isEmbedded ? (
    <AgentContextStrip
      surface="cowork"
      sessionName={_embeddedSession?.name || 'Cowork Agent Session'}
      sessionDescription={_embeddedSession?.description}
      agentName={embeddedAgentDescriptor?.agentName || selectedAgent?.name || undefined}
      statusLabel={
        _embeddedSession?.metadata?.allternit_local_draft === true
          ? 'Local Draft'
          : _embeddedSession?.isActive
            ? 'Live'
            : 'Paused'
      }
      messageCount={_embeddedSession?.messageCount ?? displayMessages.length}
      workspaceScope={embeddedAgentDescriptor?.workspaceScope}
      canvasCount={embeddedCanvasIds.length}
      tags={_embeddedSession?.tags}
      localDraft={_embeddedSession?.metadata?.allternit_local_draft === true}
      toolsEnabled={embeddedAgentDescriptor?.agentFeatures?.tools === true}
      automationEnabled={embeddedAgentDescriptor?.agentFeatures?.automation === true}
      onDismiss={() => setActiveNativeSession(null)}
    />
  ) : null;
  
  const permissions = usePermissionGuide();
  const showPermWarning = permissions.isSupported && permissions.anyDenied &&
    embeddedAgentDescriptor?.agentFeatures?.automation === true;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: embeddedAgentSession?.isEmbedded
        ? 'radial-gradient(circle at top right, rgba(167,139,250,0.08), transparent 34%), linear-gradient(180deg, var(--surface-hover) 0%, rgba(0,0,0,0) 18%)'
        : 'transparent',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: embeddedAgentSession?.isEmbedded
        ? 'inset 0 0 0 1px rgba(167,139,250,0.08), inset 0 24px 120px rgba(167,139,250,0.04)'
        : 'none',
    }}>
      {/* Desktop Automation Permission Warning */}
      {showPermWarning && (
        <div style={{
          padding: '8px 16px', background: 'var(--status-warning-bg)',
          borderBottom: '1px solid rgba(245,158,11,0.25)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 12,
          color: 'var(--status-warning)', flexShrink: 0
        }}>
          <span>⚠️ Desktop automation requires system permissions</span>
          <button
            onClick={() => {
              if (permissions.accessibility === 'denied') {
                permissions.presentGuide('accessibility');
              } else {
                permissions.presentGuide('screen-recording');
              }
            }}
            style={{
              padding: '3px 10px', borderRadius: 4, border: '1px solid #fbbf24',
              background: 'transparent', color: 'var(--status-warning)', fontSize: 11,
              fontWeight: 600, cursor: 'pointer'
            }}
          >
            Grant Permissions
          </button>
        </div>
      )}

      {/* Message List */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{
          width: '100%',
          maxWidth: '760px',
          padding: '24px 20px 180px 20px',
          boxSizing: 'border-box',
        }}>
          {embeddedAgentStrip}
          <CoworkTranscript
            messages={displayMessages}
            isLoading={displayIsLoading}
            onRegenerate={handleRegenerate}
            sessionId={embeddedAgentSession?.sessionId ?? undefined}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Bottom Input - Full width like Chat mode */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'transparent',
        pointerEvents: 'none',
        paddingBottom: '12px',
        zIndex: 40,
      }}>
        <div style={{
          width: '100%',
          pointerEvents: 'auto',
        }}>
          <ACIComputerUseBar suppressInBrowserMode />
          <ChatComposer
            onSend={handleSend}
            isLoading={displayIsLoading}
            onStop={
              embeddedAgentSession?.isEmbedded
                ? () => void abortNativeGeneration(embeddedAgentSession?.sessionId ?? '')
                : stop
            }
            selectedModel={selectedModel}
            selectedModelDisplayName={modelSelection?.modelName || modelSelection?.modelId}
            onOpenModelPicker={startSelection}
            onSelectModel={selectModel}
            inputValue={composerInputValue}
            placeholder="Reply..."
            showTopActions={false}
            agentModeSurface="cowork"
          />
        </div>
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: THEME.textMuted,
          textAlign: 'center',
          pointerEvents: 'auto',
        }}>
          Allternit is AI and can make mistakes. Please double-check responses.
        </div>
      </div>
    </div>
  );
}

function EmbeddedCoworkAgentRail() {
  const embeddedSessionId = useCoworkSessionStore((s) => s.activeSessionId);
  const embeddedSession = useCoworkSessionStore((s) =>
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
  const descriptor = embeddedAgentSession?.descriptor;
  const _embeddedSession = embeddedAgentSession?.session as any;
  const sessionId = embeddedAgentSession?.sessionId;

  const [lifecycleLoading, setLifecycleLoading] = React.useState<string | null>(null);

  const handleRevert = React.useCallback(async () => {
    if (!sessionId) return;
    const messages = (_embeddedSession as any)?.messages as Array<{ id: string; role: string }> | undefined;
    const lastAssistantMsg = messages?.slice().reverse().find((m) => m.role === 'assistant');
    if (!lastAssistantMsg) return;
    setLifecycleLoading('revert');
    try {
      await sessionLifecycleApi.revertSession(sessionId, lastAssistantMsg.id);
    } catch (e) {
      console.error('[CoworkRoot] Revert failed:', e);
    } finally {
      setLifecycleLoading(null);
    }
  }, [sessionId, _embeddedSession]);

  const handleUnrevert = React.useCallback(async () => {
    if (!sessionId) return;
    setLifecycleLoading('unrevert');
    try {
      await sessionLifecycleApi.unrevertSession(sessionId);
    } catch (e) {
      console.error('[CoworkRoot] Unrevert failed:', e);
    } finally {
      setLifecycleLoading(null);
    }
  }, [sessionId]);

  const handleCompact = React.useCallback(async () => {
    if (!sessionId) return;
    setLifecycleLoading('compact');
    try {
      await sessionLifecycleApi.compactSession(sessionId);
    } catch (e) {
      console.error('[CoworkRoot] Compact failed:', e);
    } finally {
      setLifecycleLoading(null);
    }
  }, [sessionId]);

  const handleAbort = React.useCallback(async () => {
    if (!sessionId) return;
    setLifecycleLoading('abort');
    try {
      await sessionLifecycleApi.abortSession(sessionId);
    } catch (e) {
      console.error('[CoworkRoot] Abort failed:', e);
    } finally {
      setLifecycleLoading(null);
    }
  }, [sessionId]);

  return (
    <div
      style={{
        height: '100%',
        padding: '18px 18px 24px',
        display: 'grid',
        gap: 14,
        background: 'var(--surface-panel)',
        borderLeft: '1px solid var(--ui-border-muted)',
      }}
    >
      <div
        style={{
          borderRadius: 18,
          border: '1px solid var(--ui-border-default)',
          background: 'color-mix(in srgb, var(--accent-cowork) 10%, var(--surface-panel))',
          padding: 14,
          display: 'grid',
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-cowork)',
          }}
        >
          Cowork Agent Lane
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--ui-text-primary)',
          }}
        >
          {descriptor.agentName || 'Unbound session'}
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--ui-text-secondary)',
          }}
        >
          Keep the brief, files, tools, and automation context attached to this cowork thread while staying in the same working surface.
        </div>
      </div>
      <EmbeddedRailCard
        title="Session"
        icon={<Sparkle size={15} />}
        rows={[
          ['Mode', String((_embeddedSession as any)?.metadata?.allternit_local_draft === true ? 'Local Draft' : (_embeddedSession as any)?.isActive ? 'Live' : 'Paused')],
          ['Messages', String((_embeddedSession as any)?.messageCount ?? 0)],
          ['Agent', String(descriptor?.agentName || 'Unbound')],
        ]}
      />
      <EmbeddedRailCard
        title="Workspace"
        icon={<FolderOpen size={15} />}
        rows={[
          ['Scope', String(descriptor?.workspaceScope || 'Session scoped')],
          ['Tags', String(Array.isArray((_embeddedSession as any)?.tags) ? (_embeddedSession as any).tags.join(', ') : 'None')],
        ]}
      />
      <EmbeddedRailCard
        title="Controls"
        icon={<Clock size={15} />}
        rows={[
          ['Tools', String(descriptor?.agentFeatures?.tools ? 'Enabled' : 'Not configured')],
          ['Automation', String(descriptor?.agentFeatures?.automation ? 'Reserved' : 'Pending')],
          ['Routing', 'Native session stream'],
        ]}
      />
      {/* Session Lifecycle Actions */}
      {sessionId && (
        <div
          style={{
            borderRadius: 18,
            border: '1px solid var(--ui-border-default)',
            background: 'var(--surface-hover)',
            padding: 14,
            display: 'grid',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--accent-cowork)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <Wrench size={15} />
            Session Actions
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <LifecycleButton
              icon={<ArrowCounterClockwise size={13} />}
              label="Undo Last"
              onClick={handleRevert}
              loading={lifecycleLoading === 'revert'}
            />
            <LifecycleButton
              icon={<ArrowClockwise size={13} />}
              label="Redo"
              onClick={handleUnrevert}
              loading={lifecycleLoading === 'unrevert'}
            />
            <LifecycleButton
              icon={<ArrowsInLineVertical size={13} />}
              label="Compact"
              onClick={handleCompact}
              loading={lifecycleLoading === 'compact'}
            />
            <LifecycleButton
              icon={<X size={13} />}
              label="Abort"
              onClick={handleAbort}
              loading={lifecycleLoading === 'abort'}
              variant="danger"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LifecycleButton({
  icon,
  label,
  onClick,
  loading,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 8,
        border: `1px solid ${variant === 'danger' ? 'rgba(239,68,68,0.3)' : 'var(--ui-border-default)'}`,
        background: variant === 'danger' ? 'var(--status-error-bg)' : 'var(--surface-hover)',
        color: variant === 'danger' ? 'var(--status-error)' : 'var(--ui-text-primary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading ? (
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}

function EmbeddedRailCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Array<[string, string]>;
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: '1px solid var(--ui-border-default)',
        background: 'var(--surface-hover)',
        padding: 14,
        display: 'grid',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--accent-cowork)',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {icon}
        {title}
      </div>
      {rows.map(([label, value]) => (
        <div
          key={`${title}-${label}`}
          style={{
            display: 'grid',
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ui-text-muted)',
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.45,
              color: 'var(--ui-text-primary)',
              wordBreak: 'break-word',
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default CoworkRoot;
