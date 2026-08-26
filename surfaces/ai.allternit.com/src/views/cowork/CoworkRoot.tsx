/* eslint-disable @typescript-eslint/ban-ts-comment, react-hooks/exhaustive-deps */
// @ts-nocheck
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
import { X, CaretDown } from '@phosphor-icons/react';

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
import { CoworkRightRail, parseTodosFromMessages } from './CoworkRightRail';
import { CoworkLaunchpad } from './CoworkLaunchpad';
import { CoworkProjectView } from './CoworkProjectView';
import { PermissionModal } from './PermissionModal';
import { QuestionModal } from './QuestionModal';
import { sessionLifecycleApi } from '@/lib/agents/native-agent-api';

// Providers (matching ChatRoot structure)
import { ChatIdProvider } from '@/providers/chat-id-provider';
import { DataStreamProvider } from '@/providers/data-stream-provider';
import { MessageTreeProvider } from '@/providers/message-tree-provider';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import { ModelSelectionProvider } from '@/providers/model-selection-provider';
import { useDefaultModelSelection } from '@/hooks/use-default-model-selection';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useModelSelection } from '@/providers/model-selection-provider';
import {
  buildAgentConversationContext,
  useSurfaceAgentSelection,
} from '@/lib/agents/surface-agent-context';
import {
  getOpenClawWorkspacePathFromAgent,
  mapNativeMessagesToStreamMessages,
} from '@/lib/agents';
import { useCoworkSessionStore, createCoworkSession } from './CoworkSessionStore';
import { useCoworkMode } from './CoworkModeTabs';
import { WorkflowPipeline, type CoworkAgent } from './components/WorkflowPipeline';
import { BrowserAgentWorkspace } from './components/BrowserAgentWorkspace';
import { ReactFlowProvider } from '@xyflow/react';
import { AgentCapabilitiesPanel } from './AgentCapabilitiesPanel';
import { ConnectorSettingsPanel } from './ConnectorSettingsPanel';
import { RoutinesPanel } from './RoutinesPanel';
import { LoopMonitor } from './LoopMonitor';
import { useApprovalGatePoller } from '@/lib/cowork/useApprovalGatePoller';
import { AgentModeBackdrop } from '../chat/agentModeSurfaceTheme';
import { CoworkAnimatedBackground } from './CoworkAnimatedBackground';
import { useModeCanvasBridge } from '@/hooks/useModeCanvasBridge';
import { ACIComputerUseBar } from '@/capsules/browser/ACIComputerUseSidecar';
import { usePermissionGuide } from '@/lib/usePermissionGuide';
import { usePlatformAuth } from '@/lib/platform-auth-client';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CoworkRoot');

// Theme tokens
const THEME = {
  textPrimary: 'var(--ui-text-primary)',
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
      <h2 style={{ fontFamily: 'var(--font-research)', marginBottom: 12 }}>Cowork Error</h2>
      <p style={{ color: 'var(--ui-text-muted)', marginBottom: 24 }}>The collaborative workspace encountered an error.</p>
      <button type="button" 
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 20px',
          background: 'var(--surface-hover)',
          border: '1px solid var(--border-subtle)',
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

  const defaultSelection = useDefaultModelSelection();
  const { isAgents, isWeb, isSync, isRoutines, isLoops } = useCoworkMode();
  const [coworkAgents, setCoworkAgents] = useState<CoworkAgent[]>([]);
  const [selectedWebAgent, setSelectedWebAgent] = useState<CoworkAgent | null>(null);

  const [showRail, setShowRail] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const [liveMessages, setLiveMessages] = useState<import('@/lib/ai/rust-stream-adapter').ChatMessage[]>([]);
  const [liveIsStreaming, setLiveIsStreaming] = useState(false);
  const handleLiveUpdate = useCallback((msgs: import('@/lib/ai/rust-stream-adapter').ChatMessage[], streaming: boolean) => {
    setLiveMessages(msgs);
    setLiveIsStreaming(streaming);
  }, []);

  // "Next: …" hint for the collapsed rail handle — mirrors Claude Code's status bar tip
  const nextPendingTodo = useMemo(() => {
    const todos = parseTodosFromMessages(liveMessages);
    const next = todos.find(t => t.status === 'in_progress') ?? todos.find(t => t.status === 'pending');
    return next?.content ?? null;
  }, [liveMessages]);
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

  // Poll ApprovalGate for background-service approval requests and feed into permission store.
  // Active when any cowork session is running; embeddedAgentSession check is deferred to pollerActive below.
  const pollerActive = Boolean(coworkSessionId);
  useApprovalGatePoller(pollerActive);

  // Clear project/task state when the user leaves cowork (mode switch).
  // We do NOT clear on mount so that clicking a project in the left rail
  // (which sets activeProjectId right before CoworkRoot mounts) works correctly.
  useEffect(() => {
    // Fetch real tasks from the backend database when the cowork panel mounts
    useCoworkStore.getState().fetchTasks();

    return () => {
      useCoworkStore.getState().setActiveProject(null);
      useCoworkStore.getState().setActiveTask(null);
    };
  }, []);

  // Save checkpoint to Prisma when the session is active and the component unmounts
  const coworkSessionIdRef = useRef(coworkSessionId);
  coworkSessionIdRef.current = coworkSessionId;
  useEffect(() => {
    return () => {
      const sid = coworkSessionIdRef.current;
      if (!sid) return;
      const messages = useCoworkSessionStore.getState().sessions.find((s) => s.id === sid)?.messages ?? [];
      const lastMsg = messages[messages.length - 1];
      const checkpoint = {
        savedAt: new Date().toISOString(),
        lastMessage: lastMsg ? String(lastMsg.content ?? '').slice(0, 200) : '',
        messageCount: messages.length,
      };
      fetch(`/api/v1/cowork/sessions/${sid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint, status: 'paused' }),
      }).catch(() => {});
    };
  }, []);

  // Auto-open the right rail when a cowork session becomes active so the
  // session panel is visible without needing a manual click.
  useEffect(() => {
    if (coworkSessionId) {
      setShowRail(true);
    }
  }, [coworkSessionId]);

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
  const { isLoaded: isAuthLoaded, isSignedIn } = usePlatformAuth();

  // Fetch personas and map to CoworkAgent format for WorkflowPipeline / BrowserAgentWorkspace
  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn) {
      setCoworkAgents([]);
      return;
    }

    fetch('/api/v1/cowork/personas')
      .then((r) => r.json())
      .then((data: { personas?: Array<{ id: string; name: string; description?: string; systemPrompt: string; tools?: string[] }> }) => {
        const agents: CoworkAgent[] = (data.personas ?? []).map((p) => ({
          agent_id: p.id,
          type: 'developer_agent',
          name: p.name,
          tools: p.tools ?? [],
          tasks: [],
        }));
        setCoworkAgents(agents);
        if (agents.length > 0 && !selectedWebAgent) {
          setSelectedWebAgent(agents[0]);
        }
      })
      .catch(() => {});
  }, [isAuthLoaded, isSignedIn]);

  const handleAgentTakeover = useCallback((agentId: string) => {
    const agent = coworkAgents.find((a) => a.agent_id === agentId) ?? null;
    setSelectedWebAgent(agent);
  }, [coworkAgents]);

  const handleAgentTakeoverFromBrowser = useCallback((sessionId: string) => {
    setSelectedWebAgent(coworkAgents.find((a) => a.agent_id === sessionId) ?? selectedWebAgent);
  }, [coworkAgents, selectedWebAgent]);

  const handleReleaseTakeover = useCallback((_sessionId: string) => {
    setSelectedWebAgent(coworkAgents[0] ?? null);
  }, [coworkAgents]);

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

  // Start a new cowork session via gizzi runtime, persists to Prisma + injects memory.
  // Declared before any early returns so hook count stays constant across renders.
  const handleStartCowork = useCallback(async (task: string) => {
    try {
      const sessionId = await createCoworkSession({
        name: task.slice(0, 64) || 'New Cowork Session',
        sessionMode: 'regular',
      });
      useCoworkSessionStore.getState().setActiveSession(sessionId);
      setCoworkSessionId(sessionId);
      setInitialMessage(task);
    } catch (err) {
      logger.error({ err: err }, 'Failed to create cowork session');
    }
  }, []);

  // If there's an active project, show CoworkProjectView instead.
  // Placed after all hooks so hook count is stable regardless of activeProjectId.
  if (activeProjectId && !isEmbeddedAgentSession) {
    return (
      <div style={{ position: 'relative', height: '100%', isolation: 'isolate' }}>
        <CoworkAnimatedBackground />
        <CoworkProjectView />
      </div>
    );
  }

  // Show launchpad whenever no session has been started in this mount lifecycle.
  // Ignores persisted `session` so navigating to Cowork always lands on the launchpad.
  if (!coworkSessionId && !embeddedAgentSession?.isEmbedded) {
    return (
      <div style={{ position: 'relative', height: '100%', isolation: 'isolate' }}>
        <CoworkAnimatedBackground />
        <ModelSelectionProvider defaultSelection={defaultSelection}>
          <CoworkLaunchpad
            onStartChat={handleStartCowork}
            onResumeThread={(newSessionId) => {
              setCoworkSessionId(newSessionId);
            }}
          />
        </ModelSelectionProvider>
      </div>
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
          <PromptInputProvider>
            <ModelSelectionProvider defaultSelection={defaultSelection}>
              <div style={{ position: 'relative', height: '100%', isolation: 'isolate' }}>
                    <CoworkAnimatedBackground />
                    <AgentModeBackdrop
                      active={coworkAgentModeEnabled}
                      surface="cowork"
                      dataTestId="agent-mode-cowork-backdrop"
                    />
                    <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
                      <div className="coworkShell">
                        {/* Main chat area — shrinks when rail is open */}
                        <div className="coworkCenter" style={{ paddingRight: 0 }}>
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
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'var(--accent-cowork)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                }}>
                                  Attached Files ({droppedFiles.length})
                                </span>
                                <button type="button"
                                  onClick={() => setDroppedFiles([])}
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--text-tertiary)',
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

                          {/* Mode-aware center content */}
                          {isAgents ? (
                            <ReactFlowProvider>
                              <WorkflowPipeline
                                agents={coworkAgents}
                                onTakeover={handleAgentTakeover}
                              />
                            </ReactFlowProvider>
                          ) : isWeb ? (
                            <BrowserAgentWorkspace
                              agent={selectedWebAgent}
                              sessionId={coworkSessionId || embeddedAgentSession?.sessionId || ''}
                              onBack={() => setSelectedWebAgent(null)}
                              onTakeover={handleAgentTakeoverFromBrowser}
                              onReleaseTakeover={handleReleaseTakeover}
                            />
                          ) : isRoutines ? (
                            <RoutinesPanel />
                          ) : isLoops ? (
                            <LoopMonitor />
                          ) : isSync ? (
                            <ConnectorSettingsPanel />
                          ) : (
                            <CoworkChat
                              sessionId={coworkSessionId || embeddedAgentSession?.sessionId || 'cowork-embedded'}
                              initialMessage={initialMessage}
                              onInitialMessageSent={() => setInitialMessage(null)}
                              onLiveUpdate={handleLiveUpdate}
                            />
                          )}

                          {/* Permission + Question gate modals — float above transcript */}
                          {(embeddedAgentSession?.sessionId) && !isAgents && !isWeb && (
                            <div className="coworkGateOverlay">
                              <PermissionModal sessionId={embeddedAgentSession?.sessionId || ''} />
                              <QuestionModal sessionId={embeddedAgentSession?.sessionId || ''} />
                            </div>
                          )}

                          {/* Panel rail — floats over the right edge, never shrinks the chat */}
                          {showRail && (
                            <aside className="coworkRailOverlay">
                              {isAgents ? (
                                <AgentCapabilitiesPanel variant="compact" />
                              ) : embeddedAgentSession?.isEmbedded && embeddedDescriptor?.sessionMode === 'agent' ? (
                                // Only full agent-mode sessions get the thread/lifecycle rail
                                <EmbeddedCoworkAgentRail onClose={() => setShowRail(false)} />
                              ) : (
                                // Regular cowork sessions: Progress / Working folder / Context
                                <CoworkRightRail
                                  onClose={() => setShowRail(false)}
                                  liveMessages={liveMessages}
                                  liveIsStreaming={liveIsStreaming}
                                />
                              )}
                            </aside>
                          )}

                          {/* Thin handle to re-open the rail when dismissed */}
                          {!showRail && (
                            <button type="button"
                              onClick={() => setShowRail(true)}
                              className="coworkRailHandle"
                              title={nextPendingTodo ? `Next: ${nextPendingTodo}` : 'Show session panel'}
                            >
                              {nextPendingTodo && (
                                <span style={{
                                  position: 'absolute',
                                  top: 8,
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: 'var(--accent-cowork, #c8a96e)',
                                  flexShrink: 0,
                                }} />
                              )}
                              <div className="coworkRailHandleLine" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
            </ModelSelectionProvider>
          </PromptInputProvider>
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
  display: flex;
  height: 100%;
  width: 100%;
  /* Inherit the same surface the WorkspaceBackground sits under */
  background: transparent;
}

.coworkCenter {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  /* Ensure the scrollable message list shows the workspace background */
  background: transparent;
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

/* Theme-aware rail — floating card anchored to the top-right of the canvas.
   ~25–30% of the height from the top (Claude Cowork style); collapses via
   the close icon in its header and re-opens from the thin edge handle. */
.coworkRailOverlay {
  position: absolute;
  top: 12px;
  right: 12px;
  height: 28%;
  min-height: 180px;
  width: 300px;
  z-index: 20;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--shell-panel-bg) 88%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--ui-border-muted);
  border-radius: 14px;
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(0,0,0,0.25));
  animation: coworkRailIn 0.18s ease-out;
}

@keyframes coworkRailIn {
  from { transform: translateY(-8px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

/* Thin tab on the right edge to re-open the rail */
.coworkRailHandle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 48px;
  background: color-mix(in srgb, var(--ui-text-primary) 4%, transparent);
  border: none;
  border-left: 1px solid var(--ui-border-muted);
  border-radius: 6px 0 0 6px;
  cursor: pointer;
  padding: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  /* needed for the todo dot */
  flex-direction: column;
  gap: 4px;
}

.coworkRailHandle:hover {
  background: color-mix(in srgb, var(--ui-text-primary) 8%, transparent);
}

.coworkRailHandleLine {
  width: 2px;
  height: 20px;
  background: var(--ui-border-muted);
  border-radius: 2px;
  transition: background 0.15s;
}

.coworkRailHandle:hover .coworkRailHandleLine {
  background: var(--accent-cowork);
}

@media (max-width: 768px) {
  .coworkRailOverlay { display: none; }
  .coworkRailHandle  { display: none; }
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
  onLiveUpdate?: (messages: import('@/lib/ai/rust-stream-adapter').ChatMessage[], isStreaming: boolean) => void;
}

interface CoworkComposeEventDetail {
  text?: string;
  send?: boolean;
}

function CoworkChat({ sessionId, initialMessage, onInitialMessageSent, onLiveUpdate }: CoworkChatProps) {
  const _defaultSelection = useDefaultModelSelection();
  const isMobile = useIsMobile();
  const { selection: modelSelection } = useModelSelection();
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
  const fetchNativeCanvases = useCoworkSessionStore((state) => state.fetchSessionCanvases);
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
  const _embeddedCanvasIds = useCoworkSessionStore((state) =>
    embeddedAgentSession?.sessionId
      ? state.sessionCanvases[embeddedAgentSession.sessionId] ?? []
      : [],
  );
  const activeTaskId = useCoworkStore((state) => state.activeTaskId);
  const activeProjectId = useCoworkStore((state) => state.activeProjectId);
  const activeTaskTitle = useCoworkStore((state) => state.tasks.find(t => t.id === state.activeTaskId)?.title ?? null);
  const createTask = useCoworkStore((state) => state.createTask);
  const setActiveTask = useCoworkStore((state) => state.setActiveTask);
  const bindSessionToTask = useCoworkStore((state) => state.bindSessionToTask);
  const activeTaskSessionId = useCoworkStore(
    (state) => state.tasks.find((t) => t.id === state.activeTaskId)?.sessionId ?? null,
  );
  const boundSessionStreaming = useCoworkSessionStore((state) =>
    activeTaskSessionId
      ? state.streamingBySession[activeTaskSessionId]?.isStreaming ?? false
      : false,
  );
  const boundSessionReplyCount = useCoworkSessionStore((state) =>
    activeTaskSessionId
      ? state.sessions
          .find((sess) => sess.id === activeTaskSessionId)
          ?.messages.filter((m) => m.role === 'assistant').length ?? 0
      : 0,
  );

  // Keep the bound task's status in sync with the runtime session lifecycle:
  // pending → in_progress while the runtime is streaming, → completed once an
  // assistant reply has landed. Without this, tasks stayed 'pending' forever
  // even after the runtime answered.
  useEffect(() => {
    if (!activeTaskId || !activeTaskSessionId) return;
    const task = useCoworkStore.getState().tasks.find((t) => t.id === activeTaskId);
    if (!task || task.status === 'archived') return;
    if (boundSessionStreaming && task.status !== 'in_progress') {
      useCoworkStore.getState().updateTaskStatus(activeTaskId, 'in_progress');
      return;
    }
    if (!boundSessionStreaming && boundSessionReplyCount > 0 && task.status !== 'completed') {
      useCoworkStore.getState().updateTaskStatus(activeTaskId, 'completed');
    }
  }, [activeTaskId, activeTaskSessionId, boundSessionStreaming, boundSessionReplyCount]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSentInitialMessage = useRef(false);
  const [composerInputValue, setComposerInputValue] = useState('');
  
  const selectedModel = modelSelection?.profileId ?? 'claude-cli/claude-sonnet-4-6';
  const runtimeModelId = modelSelection?.modelId;
  
  // Legacy adapter kept only for the regenerate fallback; all sends route
  // through CoworkSessionStore (mounted, persisted sessions).
  const {
    messages,
    isLoading,
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
    void fetchNativeCanvases(embeddedAgentSession?.sessionId);
  }, [
    fetchNativeCanvases,
    embeddedAgentSession?.isEmbedded,
    embeddedAgentSession?.sessionId,
    fetchNativeMessages,
    setActiveNativeSession,
  ]);

  const displayMessages = useMemo(
    () => embeddedAgentSession?.isEmbedded
      ? mapNativeMessagesToStreamMessages(nativeMessages)
      : messages,
    [embeddedAgentSession?.isEmbedded, nativeMessages, messages],
  );
  const displayIsLoading = embeddedAgentSession?.isEmbedded
    ? nativeStreaming.isStreaming
    : isLoading;

  const ensureTaskForMessage = useCallback((message: string) => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage || activeTaskId) {
      return;
    }
    const taskMode: 'task' | 'agent' = agentModeEnabled ? 'agent' : 'task';
    const task = createTask(
      buildCoworkTaskTitleFromMessage(normalizedMessage),
      taskMode,
      activeProjectId || undefined,
    );
    setActiveTask(task.id);
    if (sessionId) bindSessionToTask(task.id, sessionId);
  }, [activeProjectId, activeTaskId, agentModeEnabled, bindSessionToTask, createTask, sessionId, setActiveTask]);

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

      // If there's already an active embedded session (created by launchpad flow),
      // route through native message stream so replies land in CoworkSessionStore.
      if (embeddedAgentSession?.isEmbedded && embeddedAgentSession?.sessionId) {
        void sendNativeMessageStream(embeddedAgentSession.sessionId, {
          text: normalizedInitialMessage,
          modelId: runtimeModelId,
        }).finally(() => {
          onInitialMessageSent?.();
        });
        return;
      }

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

      // Same mounted-session path as handleSend: create a real cowork session,
      // bind it to the task, then stream through CoworkSessionStore.
      void (async () => {
        try {
          const nativeSessionId = await createNativeSession({
            name: normalizedInitialMessage.slice(0, 60) || 'Cowork Session',
            sessionMode: 'regular',
          });
          setActiveNativeSession(nativeSessionId);
          const boundTaskId = useCoworkStore.getState().activeTaskId;
          if (boundTaskId) bindSessionToTask(boundTaskId, nativeSessionId);
          await sendNativeMessageStream(nativeSessionId, {
            text: normalizedInitialMessage,
            modelId: runtimeModelId,
          });
        } finally {
          onInitialMessageSent?.();
        }
      })();
    }
  }, [
    agentModeEnabled,
    embeddedAgentSession,
    initialMessage,
    onInitialMessageSent,
    runtimeModelId,
    selectedAgent,
    selectedAgentId,
    ensureTaskForMessage,
    sendNativeMessageStream,
    createNativeSession,
    setActiveNativeSession,
    bindSessionToTask,
    ensureEmbeddedSession,
  ]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, displayIsLoading]);

  // Broadcast live message state to sibling components (right rail)
  useEffect(() => {
    onLiveUpdate?.(displayMessages, displayIsLoading);
  }, [displayMessages, displayIsLoading, onLiveUpdate]);

  const handleSend = useCallback(async (text: string) => {
    const normalizedText = text.trim();
    if (!normalizedText) return;
    setComposerInputValue('');

    ensureTaskForMessage(normalizedText);

    // If there's already an active embedded session (e.g., resumed from launchpad),
    // route through native message stream so replies appear in CoworkSessionStore
    // (which is what displayMessages reads when isEmbedded=true).
    if (embeddedAgentSession?.isEmbedded && embeddedAgentSession?.sessionId) {
      await sendNativeMessageStream(embeddedAgentSession.sessionId, {
        text: normalizedText,
        modelId: runtimeModelId,
      });
      return;
    }

    if (agentModeEnabled && !selectedAgentId) {
      logger.warn('Agent mode is enabled but no agent is selected');
      return;
    }

    if (agentModeEnabled && selectedAgentId) {
      const nativeSessionId = await ensureEmbeddedSession();
      if (nativeSessionId) {
        await sendNativeMessageStream(nativeSessionId, { text: normalizedText });
        return;
      }
    }

    // Agent Off: route through a REAL mounted CoworkSessionStore session
    // (same pattern as chat/code modes) instead of the detached
    // useRustStreamAdapter path. This makes the session persisted/mountable,
    // and lets the task-status sync observe streaming + replies.
    const nativeSessionId = await createNativeSession({
      name: normalizedText.slice(0, 60) || 'Cowork Session',
      sessionMode: 'regular',
    });
    setActiveNativeSession(nativeSessionId);
    const boundTaskId = useCoworkStore.getState().activeTaskId;
    if (boundTaskId) bindSessionToTask(boundTaskId, nativeSessionId);
    await sendNativeMessageStream(nativeSessionId, {
      text: normalizedText,
      modelId: runtimeModelId,
    });
  }, [
    agentModeEnabled,
    embeddedAgentSession,
    ensureTaskForMessage,
    runtimeModelId,
    selectedAgentId,
    sendNativeMessageStream,
    createNativeSession,
    setActiveNativeSession,
    bindSessionToTask,
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
  const permissions = usePermissionGuide();
  const showPermWarning = permissions.isSupported && permissions.anyDenied &&
    embeddedAgentDescriptor?.agentFeatures?.automation === true;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'transparent',
      position: 'relative',
      overflow: 'hidden',
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
          <button type="button"
            onClick={() => {
              if (permissions.accessibility === 'denied') {
                permissions.presentGuide('accessibility');
              } else {
                permissions.presentGuide('screen-recording');
              }
            }}
            style={{
              padding: '3px 10px', borderRadius: 4, border: '1px solid var(--status-warning)',
              background: 'transparent', color: 'var(--status-warning)', fontSize: 12,
              fontWeight: 600, cursor: 'pointer'
            }}
          >
            Grant Permissions
          </button>
        </div>
      )}

      {/* Task title bar — shows active task name like reference UI */}
      {activeTaskTitle && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 20px', flexShrink: 0,
          borderBottom: '1px solid rgba(210,185,148,0.08)',
        }}>
          <button
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '4px 10px', borderRadius: 8,
              color: 'rgba(210,185,148,0.85)', fontSize: 14, fontWeight: 600,
              maxWidth: 480, overflow: 'hidden',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(210,185,148,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeTaskTitle}
            </span>
            <CaretDown size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
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
          <CoworkTranscript
            messages={displayMessages}
            isLoading={displayIsLoading}
            onRegenerate={handleRegenerate}
            sessionId={embeddedAgentSession?.sessionId ?? undefined}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Bottom Input - Same centered width/padding as Chat mode so switching feels seamless */}
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
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: 40,
      }}>
        <div style={{
          width: '100%',
          maxWidth: '760px',
          padding: isMobile ? '0 8px' : '0 20px',
          boxSizing: 'border-box',
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
            inputValue={composerInputValue}
            placeholder="Write a message…"
            showTopActions={false}
            showModeToggle={false}
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

function EmbeddedCoworkAgentRail({ onClose }: { onClose: () => void }) {
  const session = useCoworkSessionStore((s) =>
    s.activeSessionId ? s.sessions.find((sess) => sess.id === s.activeSessionId) ?? null : null,
  );
  const sessionId = session?.id ?? null;
  const messages = (session as any)?.messages ?? [];
  const sessionName = (session as any)?.name || 'Cowork Session';

  const [lifecycleLoading, setLifecycleLoading] = React.useState<string | null>(null);

  const handleRevert = React.useCallback(async () => {
    if (!sessionId) return;
    const lastAssistantMsg = [...messages].reverse().find((m: any) => m.role === 'assistant');
    if (!lastAssistantMsg) return;
    setLifecycleLoading('revert');
    try { await sessionLifecycleApi.revertSession(sessionId, lastAssistantMsg.id); }
    catch (e) { logger.error({ err: e }, 'Revert failed'); }
    finally { setLifecycleLoading(null); }
  }, [sessionId, messages]);

  const handleCompact = React.useCallback(async () => {
    if (!sessionId) return;
    setLifecycleLoading('compact');
    try { await sessionLifecycleApi.compactSession(sessionId); }
    catch (e) { logger.error({ err: e }, 'Compact failed'); }
    finally { setLifecycleLoading(null); }
  }, [sessionId]);

  const handleAbort = React.useCallback(async () => {
    if (!sessionId) return;
    setLifecycleLoading('abort');
    try { await sessionLifecycleApi.abortSession(sessionId); }
    catch (e) { logger.error({ err: e }, 'Abort failed'); }
    finally { setLifecycleLoading(null); }
  }, [sessionId]);

  const S = {
    header: {
      padding: '12px 16px 11px',
      borderBottom: '1px solid var(--ui-border-muted)',
      flexShrink: 0,
    } as React.CSSProperties,
    sectionLabel: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--ui-text-muted)',
      marginBottom: 8,
    } as React.CSSProperties,
    msgRow: (_role: string) => ({
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      marginBottom: 8,
    } as React.CSSProperties),
    msgBubble: (role: string) => ({
      flex: 1,
      minWidth: 0,
      background: role === 'user' ? 'var(--surface-hover)' : 'transparent',
      border: `1px solid var(--ui-border-muted)`,
      borderRadius: 8,
      padding: '6px 10px',
    } as React.CSSProperties),
    msgRole: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      marginBottom: 2,
    } as React.CSSProperties,
    msgText: {
      fontSize: 12,
      lineHeight: 1.5,
      color: 'var(--ui-text-secondary)',
      wordBreak: 'break-word',
    } as React.CSSProperties,
    actionBtn: (danger = false) => ({
      flex: 1,
      padding: '6px 0',
      border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : 'var(--ui-border-muted)'}`,
      borderRadius: 7,
      background: 'transparent',
      color: danger ? 'var(--status-error, #ef4444)' : 'var(--ui-text-secondary)',
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'background 0.12s, color 0.12s',
      textAlign: 'center',
    } as React.CSSProperties),
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--shell-panel-bg)', color: 'var(--ui-text-primary)' }}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sessionName.length > 28 ? sessionName.slice(0, 28) + '…' : sessionName}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>
              {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
            </span>
            <button type="button"
              onClick={onClose}
              title="Close panel"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ui-text-muted)', padding: '3px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Thread ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px' }}>
        <div style={S.sectionLabel}>Thread</div>
        {messages.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ui-text-muted)', fontStyle: 'italic' }}>
            Waiting for first message…
          </div>
        ) : (
          messages.slice(-16).map((msg: any) => {
            const isUser = msg.role === 'user';
            const text = String(msg.content ?? '');
            const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;
            return (
              <div key={msg.id} style={S.msgRow(msg.role)}>
                <div style={S.msgBubble(msg.role)}>
                  <div style={{ ...S.msgRole, color: isUser ? 'var(--accent-cowork)' : 'var(--ui-text-muted)' }}>
                    {isUser ? 'You' : 'Agent'}
                  </div>
                  <div style={S.msgText}>{preview}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Actions ── */}
      {sessionId && (
        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--ui-border-muted)', flexShrink: 0 }}>
          <div style={{ ...S.sectionLabel, marginBottom: 8 }}>Actions</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button"
              style={S.actionBtn()}
              disabled={!!lifecycleLoading}
              onClick={handleRevert}
              title="Undo last assistant turn"
            >
              {lifecycleLoading === 'revert' ? '…' : 'Undo'}
            </button>
            <button type="button"
              style={S.actionBtn()}
              disabled={!!lifecycleLoading}
              onClick={handleCompact}
              title="Compact conversation history"
            >
              {lifecycleLoading === 'compact' ? '…' : 'Compact'}
            </button>
            <button type="button"
              style={S.actionBtn(true)}
              disabled={!!lifecycleLoading}
              onClick={handleAbort}
              title="Abort the running session"
            >
              {lifecycleLoading === 'abort' ? '…' : 'Abort'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoworkRoot;
