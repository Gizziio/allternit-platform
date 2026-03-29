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
import {
  Clock,
  FolderOpen,
  SidebarSimple,
  Sparkle,
  Wrench,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

// Chat components
import { ChatComposer } from '../chat/ChatComposer';
import { CoworkTranscript } from './CoworkTranscript';

// Attachment components
import { useDropTarget, type FileWithData } from '@/components/GlobalDropzone';
import { AttachmentPreview, AttachmentPreviewModal, type AttachmentPreviewItem } from '@/components/chat/AttachmentPreview';

// AI streaming (same as Chat mode)
import { useRustStreamAdapter, type ChatMessage } from '@/lib/ai/rust-stream-adapter';

// Cowork-specific components
import { useCoworkStore } from './CoworkStore';
import { CoworkRightRail } from './CoworkRightRail';
import { CoworkLaunchpad } from './CoworkLaunchpad';
import { CoworkProjectView } from './CoworkProjectView';
import { PermissionModal } from './PermissionModal';
import { QuestionModal } from './QuestionModal';

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
  useEmbeddedAgentSession,
  useEmbeddedAgentSessionStore,
  useNativeAgentStore,
} from '@/lib/agents';
import { AgentModeBackdrop } from '../chat/agentModeSurfaceTheme';
import { useModeCanvasBridge } from '@/hooks/useModeCanvasBridge';
import { ACIComputerUseBar } from '@/capsules/browser/ACIComputerUseSidecar';

// Theme (matching ChatView)
const THEME = {
  bg: '#2B2520',
  bgGradient: 'linear-gradient(to top, #2B2520 60%, transparent)',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  borderSubtle: 'rgba(255,255,255,0.06)',
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
      color: '#ececec'
    }}>
      <h2 style={{ fontFamily: 'Georgia, serif', marginBottom: 12 }}>Cowork Error</h2>
      <p style={{ color: '#666', marginBottom: 24 }}>The collaborative workspace encountered an error.</p>
      <button 
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 20px',
          background: '#333',
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
  // FINGERPRINT: Verify this file is actually running
  console.log("COWORKROOT_CHATFIRST_FINGERPRINT");
  
  const {
    session,
    activeProjectId,
  } = useCoworkStore();
  
  const [showRail, setShowRail] = useState(true);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  
  // Dropped files state
  const [droppedFiles, setDroppedFiles] = useState<AttachmentPreviewItem[]>([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<AttachmentPreviewItem | null>(null);
  
  // Connect mode tabs to canvas opening (Phase 4)
  useModeCanvasBridge({ surface: 'cowork' });
  
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
  const embeddedAgentSession = useEmbeddedAgentSession('cowork');
  const coworkAgentModeEnabled = embeddedAgentSession.isEmbedded && embeddedAgentSession.descriptor.sessionMode === 'agent';

  // If there's an active project, show CoworkProjectView instead
  if (activeProjectId && !embeddedAgentSession.isEmbedded) {
    return <CoworkProjectView />;
  }
  
  // Start a new cowork session via gizzi runtime
  const handleStartCowork = useCallback(async (task: string) => {
    try {
      const session = await useNativeAgentStore.getState().createSession(
        task.slice(0, 64) || 'New Cowork Session',
        undefined,
        {
          sessionMode: 'regular',
          originSurface: 'cowork',
        },
      );
      useNativeAgentStore.getState().setSurfaceSession('cowork', session.id);
      void useNativeAgentStore.getState().sendMessageStream(session.id, task);
    } catch (err) {
      console.error('[CoworkRoot] Failed to create cowork session:', err);
    }
  }, []);
  
  // Show launchpad if no active session
  if (!session && !embeddedAgentSession.isEmbedded) {
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
        chatId={session?.id || embeddedAgentSession.sessionId || 'cowork-embedded'}
        isPersisted={Boolean(session || embeddedAgentSession.sessionId)}
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
                              background: 'rgba(43, 37, 32, 0.95)',
                              backdropFilter: 'blur(10px)',
                              borderRadius: 16,
                              border: '1px solid rgba(175, 82, 222, 0.3)',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                              }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: '#af52de',
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
                            sessionId={session?.id || embeddedAgentSession.sessionId || 'cowork-embedded'}
                            initialMessage={initialMessage}
                            onInitialMessageSent={() => setInitialMessage(null)}
                          />

                          {/* Permission + Question gate modals — float above transcript.
                            Only meaningful when using a native gizzi-code session (embedded agent),
                            but harmless to render for legacy CoworkStore sessions (empty pending lists). */}
                          {(embeddedAgentSession.sessionId || session?.id) && (
                            <div className="coworkGateOverlay">
                              <PermissionModal sessionId={embeddedAgentSession.sessionId || session!.id} />
                              <QuestionModal sessionId={embeddedAgentSession.sessionId || session!.id} />
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
                              {embeddedAgentSession.isEmbedded ? (
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
  width: 4px;
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
  background: var(--border-subtle, rgba(255,255,255,0.1));
}

.coworkRailSliderLine {
  width: 2px;
  height: 40px;
  background: var(--text-muted, #6B6B6B);
  border-radius: 1px;
  opacity: 0.3;
  transition: opacity 0.2s;
}

.coworkRailSlider:hover .coworkRailSliderLine {
  opacity: 0.8;
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
  border-left: 2px solid var(--border-subtle, rgba(255,255,255,0.1));
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
  width: 2px;
  height: 20px;
  background: var(--text-muted, #6B6B6B);
  border-radius: 1px;
  opacity: 0.3;
  transition: opacity 0.2s;
}

.coworkRailHandle:hover .coworkRailHandleLine {
  opacity: 0.8;
}

.coworkRail {
  min-width: 0;
  height: 100%;
  overflow: auto;
  /* NO background - inherits from app shell */
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
  const { selection: modelSelection, selectModel, startSelection, isSelecting, cancelSelection } = useModelSelection();
  const { agentModeEnabled, selectedAgentId, selectedAgent } =
    useSurfaceAgentSelection('cowork');
  const embeddedAgentSession = useEmbeddedAgentSession('cowork');
  const setEmbeddedAgentSession = useEmbeddedAgentSessionStore(
    (state) => state.setSurfaceSession,
  );
  const clearEmbeddedAgentSession = useEmbeddedAgentSessionStore(
    (state) => state.clearSurfaceSession,
  );
  const createNativeSession = useNativeAgentStore((state) => state.createSession);
  const setActiveNativeSession = useNativeAgentStore((state) => state.setActiveSession);
  const sendNativeMessageStream = useNativeAgentStore((state) => state.sendMessageStream);
  const fetchNativeMessages = useNativeAgentStore((state) => state.fetchMessages);
  const fetchNativeCanvases = useNativeAgentStore((state) => state.fetchSessionCanvases);
  const abortNativeGeneration = useNativeAgentStore((state) => state.abortGeneration);
  const nativeStreaming = useNativeAgentStore((state) => ({
    isStreaming: state.streamingBySession[embeddedAgentSession.sessionId ?? '']?.isStreaming ?? false,
  }));
  const nativeMessages = useNativeAgentStore((state) =>
    embeddedAgentSession.sessionId
      ? state.messages[embeddedAgentSession.sessionId] || []
      : [],
  );
  const activeTaskId = useCoworkStore((state) => state.activeTaskId);
  const activeProjectId = useCoworkStore((state) => state.activeProjectId);
  const createTask = useCoworkStore((state) => state.createTask);
  const bindCurrentSessionToTask = useCoworkStore((state) => state.bindCurrentSessionToTask);
  const embeddedCanvasIds = useNativeAgentStore((state) =>
    embeddedAgentSession.sessionId
      ? state.sessionCanvases[embeddedAgentSession.sessionId] || []
      : [],
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSentInitialMessage = useRef(false);
  const [composerInputValue, setComposerInputValue] = useState('');
  
  const selectedModel = modelSelection?.profileId ?? 'kimi/kimi-for-coding';
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
    if (!embeddedAgentSession.sessionId || !embeddedAgentSession.isEmbedded) {
      return;
    }

    setActiveNativeSession(embeddedAgentSession.sessionId);
    void fetchNativeMessages(embeddedAgentSession.sessionId);
    void fetchNativeCanvases(embeddedAgentSession.sessionId);
  }, [
    embeddedAgentSession.isEmbedded,
    embeddedAgentSession.sessionId,
    fetchNativeCanvases,
    fetchNativeMessages,
    setActiveNativeSession,
  ]);

  const displayMessages = embeddedAgentSession.isEmbedded
    ? mapNativeMessagesToStreamMessages(nativeMessages)
    : messages;
  const displayIsLoading = embeddedAgentSession.isEmbedded
    ? nativeStreaming.isStreaming
    : isLoading;

  const ensureTaskForMessage = useCallback((message: string) => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage || activeTaskId) {
      return;
    }
    const taskMode: 'task' | 'agent' = agentModeEnabled ? 'agent' : 'task';
    const createdTask = createTask(
      buildCoworkTaskTitleFromMessage(normalizedMessage),
      taskMode,
      activeProjectId || undefined,
    );
    bindCurrentSessionToTask(createdTask.id);
  }, [activeProjectId, activeTaskId, agentModeEnabled, bindCurrentSessionToTask, createTask]);

  const ensureEmbeddedSession = useCallback(async () => {
    if (embeddedAgentSession.sessionId && embeddedAgentSession.isEmbedded) {
      setActiveNativeSession(embeddedAgentSession.sessionId);
      return embeddedAgentSession.sessionId;
    }

    if (!agentModeEnabled || !selectedAgentId) {
      return null;
    }

    const session = await createNativeSession('Cowork Agent Session', undefined, {
      originSurface: 'cowork',
      sessionMode: 'agent',
      agentId: selectedAgent?.id,
      agentName: selectedAgent?.name,
      workspaceScope: getOpenClawWorkspacePathFromAgent(selectedAgent) ?? undefined,
      runtimeModel: selectedAgent?.model,
      agentFeatures: {
        workspace: true,
        tools: true,
        automation: true,
      },
    });

    setEmbeddedAgentSession('cowork', session.id);
    setActiveNativeSession(session.id);
    return session.id;
  }, [
    agentModeEnabled,
    createNativeSession,
    embeddedAgentSession.isEmbedded,
    embeddedAgentSession.sessionId,
    selectedAgent,
    selectedAgentId,
    setActiveNativeSession,
    setEmbeddedAgentSession,
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

            return sendNativeMessageStream(nativeSessionId, normalizedInitialMessage);
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
        await sendNativeMessageStream(nativeSessionId, normalizedText);
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

    window.addEventListener('a2r:cowork-compose', onComposeRequest as EventListener);
    return () => {
      window.removeEventListener('a2r:cowork-compose', onComposeRequest as EventListener);
    };
  }, [handleSend]);
  
  const handleRegenerate = useCallback(() => {
    const lastUserMsg = [...displayMessages].reverse().find((m) => m.role === "user");
    if (lastUserMsg && typeof lastUserMsg.content === "string") {
      if (embeddedAgentSession.isEmbedded && embeddedAgentSession.sessionId) {
        setActiveNativeSession(embeddedAgentSession.sessionId);
        void sendNativeMessageStream(embeddedAgentSession.sessionId, lastUserMsg.content);
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
    embeddedAgentSession.isEmbedded,
    embeddedAgentSession.sessionId,
    regenerate,
    runtimeModelId,
    selectedAgent,
    selectedAgentId,
    selectedModel,
    sendNativeMessageStream,
    sessionId,
    setActiveNativeSession,
  ]);

  const embeddedAgentDescriptor = embeddedAgentSession.descriptor;
  const embeddedAgentStrip = embeddedAgentSession.isEmbedded ? (
    <AgentContextStrip
      surface="cowork"
      sessionName={embeddedAgentSession.session?.name || 'Cowork Agent Session'}
      sessionDescription={embeddedAgentSession.session?.description}
      agentName={embeddedAgentDescriptor.agentName || selectedAgent?.name || undefined}
      statusLabel={
        embeddedAgentSession.session?.metadata?.a2r_local_draft === true
          ? 'Local Draft'
          : embeddedAgentSession.session?.isActive
            ? 'Live'
            : 'Paused'
      }
      messageCount={embeddedAgentSession.session?.messageCount ?? displayMessages.length}
      workspaceScope={embeddedAgentDescriptor.workspaceScope}
      canvasCount={embeddedCanvasIds.length}
      tags={embeddedAgentSession.session?.tags}
      localDraft={embeddedAgentSession.session?.metadata?.a2r_local_draft === true}
      toolsEnabled={embeddedAgentDescriptor.agentFeatures?.tools === true}
      automationEnabled={embeddedAgentDescriptor.agentFeatures?.automation === true}
      onDismiss={() => clearEmbeddedAgentSession('cowork')}
    />
  ) : null;
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: embeddedAgentSession.isEmbedded
        ? 'radial-gradient(circle at top right, rgba(167,139,250,0.08), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 18%)'
        : 'transparent',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: embeddedAgentSession.isEmbedded
        ? 'inset 0 0 0 1px rgba(167,139,250,0.08), inset 0 24px 120px rgba(167,139,250,0.04)'
        : 'none',
    }}>
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
            sessionId={embeddedAgentSession.sessionId ?? undefined}
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
              embeddedAgentSession.isEmbedded
                ? () => void abortNativeGeneration(embeddedAgentSession.sessionId || undefined)
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
          A2R is AI and can make mistakes. Please double-check responses.
        </div>
      </div>
    </div>
  );
}

function EmbeddedCoworkAgentRail() {
  const embeddedAgentSession = useEmbeddedAgentSession('cowork');
  const descriptor = embeddedAgentSession.descriptor;

  return (
    <div
      style={{
        height: '100%',
        padding: '18px 18px 24px',
        display: 'grid',
        gap: 14,
        background:
          'linear-gradient(180deg, rgba(38,33,48,0.72) 0%, rgba(24,22,28,0.88) 100%)',
        borderLeft: '1px solid rgba(167,139,250,0.1)',
      }}
    >
      <div
        style={{
          borderRadius: 18,
          border: '1px solid rgba(167,139,250,0.14)',
          background:
            'linear-gradient(135deg, rgba(167,139,250,0.16), rgba(255,255,255,0.02) 58%, rgba(0,0,0,0.1) 100%)',
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
            color: '#d4c5f9',
          }}
        >
          Cowork Agent Lane
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#f0ebfa',
          }}
        >
          {descriptor.agentName || 'Unbound session'}
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: '#b8aec9',
          }}
        >
          Keep the brief, files, tools, and automation context attached to this cowork thread while staying in the same working surface.
        </div>
      </div>
      <EmbeddedRailCard
        title="Session"
        icon={<Sparkle size={15} />}
        rows={[
          ['Mode', embeddedAgentSession.session?.metadata?.a2r_local_draft === true ? 'Local Draft' : embeddedAgentSession.session?.isActive ? 'Live' : 'Paused'],
          ['Messages', `${embeddedAgentSession.session?.messageCount ?? 0}`],
          ['Agent', descriptor.agentName || 'Unbound'],
        ]}
      />
      <EmbeddedRailCard
        title="Workspace"
        icon={<FolderOpen size={15} />}
        rows={[
          ['Scope', descriptor.workspaceScope || 'Session scoped'],
          ['Tags', embeddedAgentSession.session?.tags?.join(', ') || 'None'],
        ]}
      />
      <EmbeddedRailCard
        title="Controls"
        icon={<Clock size={15} />}
        rows={[
          ['Tools', descriptor.agentFeatures?.tools ? 'Enabled' : 'Not configured'],
          ['Automation', descriptor.agentFeatures?.automation ? 'Reserved' : 'Pending'],
          ['Routing', 'Native session stream'],
        ]}
      />
    </div>
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
        border: '1px solid rgba(167,139,250,0.14)',
        background: 'rgba(255,255,255,0.03)',
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
          color: '#d4c5f9',
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
              color: '#9b8db8',
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.45,
              color: '#f6eee7',
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
