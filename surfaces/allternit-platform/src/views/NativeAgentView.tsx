"use client";

/**
 * NativeAgentView - N20 Native OpenClaw Agent View (Reconstructed)
 *
 * A high-fidelity, split-pane component featuring:
 * - Left side: Chat interface with streaming support
 * - Right side: Canvas panel for tool visualization and content
 * - Session management with dropdown selector
 * - Allternit Native Milestone Progress (Protocol Layer)
 * - Full integration with ChatSessionStore
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";

// Store - Using ChatSessionStore for native agent view
import {
  useChatSessionStore,
  type ChatSession as NativeSession,
  type ModeSessionMessage as NativeMessage,
} from "@/views/chat/ChatSessionStore";

// Type aliases for backward compatibility
interface Canvas { id: string; sessionId: string; content: string; type: string; title?: string; }
interface SessionUpdateInput { name?: string; description?: string; metadata?: Record<string, unknown>; }
interface RuntimeExecutionModeStatus { mode: string; updatedAt: string; supportedModes: string[]; }
import type { Reply, TextReplyItem } from "@/lib/agents/replies-stream";
import { useWorkspace } from "@/agent-workspace/useWorkspace";
import { MilestoneProgress } from "@/components/AllternitNative/MilestoneProgress";
import { ToolCallVisualization } from "@/components/agents";

// UI Components
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

// Icons
import {
  Plus,
  Trash,
  Robot,
  User,
  CircleNotch,
  Copy,
  DownloadSimple,
  Sidebar,
  SidebarSimple,
  Layout,
  Code,
  FileText,
  Terminal,
  StackSimple,
  Sparkle,
  Chat,
  Wrench,
  Lightning,
} from '@phosphor-icons/react';
import { cn } from "@/lib/utils";
import { GATEWAY_BASE_URL } from "@/lib/agents/api-config";
import { SessionComposerRegion } from "@/components/session-composer";

// ============================================================================
// Local hook stubs for features not yet implemented in mode-session-store
// ============================================================================

function useActiveMessages() {
  return useChatSessionStore((s) => {
    const id = s.activeSessionId;
    return id ? (s.sessions.find(sess => sess.id === id)?.messages ?? []) : [];
  });
}

function useSessionCanvases(_sessionId: string): Canvas[] {
  return [];
}

function isLocalDraftSession(session: NativeSession | null): boolean {
  return !!(session && session.id.startsWith('local-'));
}

function useSessionStreamingState(sessionId: string) {
  const streamingState = useChatSessionStore((s) => s.streamingBySession?.[sessionId]);
  return { isStreaming: streamingState?.isStreaming ?? false };
}

function useConversationReplies(_sessionId?: string): import('@/types/replies-contract').ConversationReplyState | null {
  return null;
}

// ============================================================================
// Types & Helpers
// ============================================================================

interface NativeAgentViewProps {
  initialSessionId?: string;
  defaultLayout?: number[];
  bootstrapStrategy?: "auto" | "manual";
  onOpenRuntimeOps?: () => void;
}

type ViewMode = "split" | "chat-only" | "canvas-only";

function formatSessionTimestamp(value?: string): string {
  if (!value) return "Awaiting activity";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Awaiting activity";

  const elapsedMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Updated just now";
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Updated ${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `Updated ${elapsedDays}d ago`;

  return `Updated ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp))}`;
}

// ============================================================================
// Main Component
// ============================================================================

export function NativeAgentView({
  initialSessionId,
  defaultLayout = [50, 50],
  bootstrapStrategy = "auto",
  onOpenRuntimeOps,
}: NativeAgentViewProps) {
  const {
    updateSession = async () => {},
    deleteSession,
    setActiveSession,
    loadSessions,
  } = useChatSessionStore();
  
  // Derived state
  const activeSessionId = useChatSessionStore((s) => s.activeSessionId);
  const sessions = useChatSessionStore((s) => s.sessions);
  const isLoadingSessions = useChatSessionStore((s) => s.isLoading);
  const streamingState = useChatSessionStore((s) => activeSessionId ? s.streamingBySession[activeSessionId] : null);
  const isStreaming = streamingState?.isStreaming ?? false;
  const isSessionSyncConnected = useChatSessionStore((s) => s.isSyncConnected);
  const sessionSyncError = useChatSessionStore((s) => s.syncError);

  // Allternit Native Context Integration
  const { allternitNativeState } = useWorkspace(activeSessionId || "");
  const executionMode: RuntimeExecutionModeStatus | null = null;
  const isUpdatingSession = false;
  const isLoadingExecutionMode = false;
  
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hasFetchedSessions, setHasFetchedSessions] = useState(false);
  const hasAutoCreatedWelcomeSession = useRef(false);
  
  const activeSession = useMemo(() => 
    sessions.find((session) => session.id === activeSessionId) || null
  , [sessions, activeSessionId]);

  // Initialization
  useEffect(() => {
    if (bootstrapStrategy === "manual") {
      setHasFetchedSessions(true);
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        await loadSessions();
      } finally {
        if (isMounted) setHasFetchedSessions(true);
      }
    })();

    return () => { isMounted = false; };
  }, [bootstrapStrategy, loadSessions]);

  // Execution mode not implemented in new store - skipping
  useEffect(() => {
    // Placeholder for execution mode loading
  }, []);

  // Auto-select session
  useEffect(() => {
    if (!hasFetchedSessions || isLoadingSessions || activeSessionId) return;

    if (initialSessionId && sessions.some(s => s.id === initialSessionId)) {
      setActiveSession(initialSessionId);
      return;
    }

    if (sessions.length > 0) {
      setActiveSession(sessions[0].id);
      return;
    }

    if (bootstrapStrategy === "manual") return;

    if (!hasAutoCreatedWelcomeSession.current) {
      hasAutoCreatedWelcomeSession.current = true;
      void useChatSessionStore.getState().createSession({ name: "Welcome Session" });
    }
  }, [activeSessionId, hasFetchedSessions, initialSessionId, isLoadingSessions, sessions, setActiveSession, bootstrapStrategy]);

  const handleNewSession = useCallback(async () => {
    const newSessionId = await useChatSessionStore.getState().createSession({ name: "New Session" });
    if (newSessionId) setActiveSession(newSessionId);
  }, [setActiveSession]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (confirm("Delete this session?")) await deleteSession(sessionId);
  }, [deleteSession]);

  const toggleViewMode = useCallback(() => {
    const modes: ViewMode[] = ["split", "chat-only", "canvas-only"];
    const nextMode = modes[(modes.indexOf(viewMode) + 1) % modes.length];
    setViewMode(nextMode);
  }, [viewMode]);

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden bg-[color:var(--bg-primary)]">
        <WorkspaceHeader
          sessions={sessions}
          activeSession={activeSession}
          activeSessionId={activeSessionId}
          executionMode={executionMode}
          onSelectSession={setActiveSession}
          viewMode={viewMode}
          onToggleViewMode={toggleViewMode}
          isStreaming={isStreaming}
          isSessionSyncConnected={isSessionSyncConnected}
          sessionSyncError={sessionSyncError}
          onOpenRuntimeOps={onOpenRuntimeOps}
          allternitNativeState={allternitNativeState}
        />

        <div className="flex-1 min-h-0 overflow-hidden p-4 pt-0">
          <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
            <SessionWorkbenchRail
              sessions={sessions}
              activeSession={activeSession}
              activeSessionId={activeSessionId}
              onSelectSession={setActiveSession}
              onNewSession={handleNewSession}
              onUpdateSession={updateSession as (id: string, updates: SessionUpdateInput) => Promise<void>}
              onDeleteSession={handleDeleteSession}
              executionMode={executionMode}
              isLoadingSessions={isLoadingSessions}
              isUpdatingSession={isUpdatingSession}
              isLoadingExecutionMode={isLoadingExecutionMode}
              isSessionSyncConnected={isSessionSyncConnected}
              sessionSyncError={sessionSyncError}
              onOpenRuntimeOps={onOpenRuntimeOps}
            />

            <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-[28px] border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-elevated)] shadow-[var(--shadow-lg)] backdrop-blur-xl">
              {viewMode === "chat-only" && <ChatPanel sessionId={activeSessionId} />}
              {viewMode === "canvas-only" && <CanvasPanel sessionId={activeSessionId} />}
              {viewMode === "split" && (
                <div className="flex h-full min-h-0 w-full min-w-0">
                  <div className="min-h-0 min-w-0" style={{ flex: `${defaultLayout[0]} 1 0%` }}>
                    <ChatPanel sessionId={activeSessionId} />
                  </div>
                  <div className="w-px bg-[color:var(--border-subtle)]" />
                  <div className="min-h-0 min-w-0" style={{ flex: `${defaultLayout[1]} 1 0%` }}>
                    <CanvasPanel sessionId={activeSessionId} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// Header Component
// ============================================================================

interface WorkspaceHeaderProps {
  sessions: NativeSession[];
  activeSession: NativeSession | null;
  activeSessionId: string | null;
  executionMode: RuntimeExecutionModeStatus | null;
  onSelectSession: (id: string) => void;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  isStreaming: boolean;
  isSessionSyncConnected: boolean;
  sessionSyncError: string | null;
  onOpenRuntimeOps?: () => void;
  allternitNativeState: any | null; // Use real type from workspace
}

function WorkspaceHeader({
  activeSession,
  activeSessionId,
  executionMode,
  viewMode,
  onToggleViewMode,
  isStreaming,
  isSessionSyncConnected,
  onOpenRuntimeOps,
  allternitNativeState,
}: WorkspaceHeaderProps) {
  const messages = useActiveMessages();
  const canvases = useSessionCanvases(activeSessionId || "");
  const isLocalDraft = isLocalDraftSession(activeSession);

  const ViewModeIcon = { split: Layout, "chat-only": Sidebar, "canvas-only": SidebarSimple }[viewMode];

  return (
    <div className="relative overflow-hidden border-b border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-thick)] px-5 py-5 backdrop-blur-xl">
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[24px] border border-[color:rgba(217,119,87,0.18)] bg-[linear-gradient(135deg,rgba(217,119,87,0.16),rgba(176,141,110,0.08))] shadow-[0_10px_32px_rgba(42,31,22,0.14)]">
              <Robot className="h-5 w-5 text-[color:var(--accent-primary)]" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-5 bg-accent-primary/10 text-accent-primary border-accent-primary/20 text-[10px] uppercase tracking-wider">
                  Agent Workspace
                </Badge>
                {isStreaming && (
                  <Badge className="h-5 animate-pulse bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] uppercase">
                    Streaming
                  </Badge>
                )}
              </div>
              <h1 className="truncate text-lg font-bold text-[color:var(--text-primary)]">
                {activeSession?.name || "Initializing..."}
              </h1>
              <div className="flex items-center gap-3 text-xs text-[color:var(--text-tertiary)]">
                <span className="flex items-center gap-1"><Chat size={12} /> {messages.length} messages</span>
                <span className="flex items-center gap-1"><StackSimple size={12} /> {canvases.length} canvases</span>
                {isLocalDraft && <span className="text-amber-500 font-medium">● Local Draft</span>}
              </div>
            </div>
          </div>

          {/* Allternit Native Milestone Progress - The "Layer" */}
          {allternitNativeState && (
            <div className="flex-1 lg:max-w-xl mx-4">
              <MilestoneProgress state={allternitNativeState} />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onToggleViewMode} className="rounded-xl hover:bg-white/10">
              <ViewModeIcon size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onOpenRuntimeOps} className="rounded-xl hover:bg-white/10 text-accent-primary">
              <Lightning size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sidebar / Rail Component
// ============================================================================

interface SessionWorkbenchRailProps {
  sessions: NativeSession[];
  activeSession: NativeSession | null;
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onUpdateSession: (id: string, updates: SessionUpdateInput) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  executionMode: RuntimeExecutionModeStatus | null;
  isLoadingSessions: boolean;
  isUpdatingSession: boolean;
  isLoadingExecutionMode: boolean;
  isSessionSyncConnected: boolean;
  sessionSyncError: string | null;
  onOpenRuntimeOps?: () => void;
}

function SessionWorkbenchRail({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  isLoadingSessions,
}: SessionWorkbenchRailProps) {
  return (
    <div className="flex w-full flex-col gap-4 lg:w-64 lg:shrink-0">
      <Button 
        onClick={onNewSession}
        className="w-full justify-start gap-2 rounded-[20px] bg-accent-primary hover:bg-accent-primary/90 text-black font-bold h-12 shadow-lg"
      >
        <Plus size={16} />
        New Session
      </Button>

      <div className="flex-1 min-h-0 flex flex-col rounded-[28px] border border-white/5 bg-black/20 backdrop-blur-md overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Recent Threads</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingSessions && sessions.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <CircleNotch className="h-5 w-5 animate-spin text-white/20" />
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "w-full flex flex-col gap-1 p-3 rounded-2xl text-left transition-all group",
                    activeSessionId === session.id 
                      ? "bg-white/10 ring-1 ring-white/10 shadow-inner" 
                      : "hover:bg-white/5"
                  )}
                >
                  <span className={cn(
                    "text-sm font-medium truncate",
                    activeSessionId === session.id ? "text-white" : "text-white/60 group-hover:text-white/80"
                  )}>
                    {session.name || "Untitled Session"}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {formatSessionTimestamp(session.updatedAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ============================================================================
// Chat Panel Component
// ============================================================================

function ChatPanel({ sessionId }: { sessionId: string | null }) {
  const messages = useActiveMessages();
  const { isStreaming } = useSessionStreamingState(sessionId ?? '');
  const replyState = useConversationReplies(sessionId ?? undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");

  const sendMessageStream = useChatSessionStore((state) => state.sendMessageStream);
  const abortGeneration = useChatSessionStore((state) => state.abortGeneration);

  // Derive the currently-streaming reply for the live tail render.
  const lastReplyId = replyState?.orderedReplyIds[replyState.orderedReplyIds.length - 1];
  const streamingReply = lastReplyId ? replyState?.replies[lastReplyId] : null;
  const activeStreamingReply = streamingReply?.status === "streaming" ? streamingReply : null;

  // Use accumulated text length as scroll trigger instead of the raw buffer string.
  const streamingTextLength = activeStreamingReply
    ? (activeStreamingReply.items || [])
        .filter((i): i is TextReplyItem => i.kind === "text")
        .reduce((n: number, i: TextReplyItem) => n + i.content.length, 0)
    : 0;

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingTextLength, scrollToBottom]);

  const handleSubmit = useCallback(async () => {
    if (!sessionId || !inputValue.trim() || isStreaming) return;
    const content = inputValue.trim();
    setInputValue("");
    await sendMessageStream(sessionId, { text: content });
  }, [sessionId, inputValue, isStreaming, sendMessageStream]);

  return (
    <div className="flex h-full flex-col bg-transparent relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8 pb-32">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
              <div className="h-16 w-16 rounded-3xl bg-white/5 flex items-center justify-center">
                <Sparkle size={32} />
              </div>
              <h3 className="text-xl font-medium">How can I assist you?</h3>
              <p className="text-sm max-w-xs">Start a conversation or use the Allternit Native protocol to build your project.</p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {activeStreamingReply && (
            <StreamingReplyTail reply={activeStreamingReply} />
          )}
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-[color:var(--glass-bg-elevated)] via-[color:var(--glass-bg-elevated)] to-transparent pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          <SessionComposerRegion
            serverUrl={GATEWAY_BASE_URL}
            sessionID={sessionId ?? ""}
            isLoading={isStreaming}
            value={inputValue}
            onValueChange={setInputValue}
            onSubmit={handleSubmit}
            onStop={() => abortGeneration(sessionId ?? '')}
          />
        </div>
      </div>
    </div>
  );
}

// Renders the live streaming reply tail from canonical ConversationReplyState.
// Replaces the old streamBuffer synthetic ChatMessage.
function StreamingReplyTail({ reply }: { reply: Reply }) {
  const textItems = (reply.items || []).filter((i): i is TextReplyItem => i.kind === "text");
  const liveText = textItems.map((i) => i.content).join("");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-4 items-start"
    >
      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-accent-primary text-black">
        <Robot size={16} />
      </div>
      <div className="flex flex-col gap-2 max-w-[85%] items-start">
        <div className="px-4 py-3 rounded-3xl text-sm leading-relaxed bg-white/[0.03] border border-white/5 text-white/90">
          {liveText || (
            <span className="inline-block h-4 w-24 rounded bg-white/10 animate-pulse align-middle" />
          )}
          <span className="inline-block w-1 h-4 ml-1 bg-accent-primary animate-pulse align-middle" />
        </div>
        {(reply.items || []).some((i) => i.kind === "tool_call") && (
          <div className="space-y-1 w-full text-xs text-white/40 px-2">
            {(reply.items || [])
              .filter((i) => i.kind === "tool_call")
              .map((i) => (
                <div key={i.id} className="flex items-center gap-1.5">
                  <Wrench size={10} />
                  <span>{(i as import("@/lib/agents/replies-stream").ToolCallReplyItem).toolName}</span>
                  <span className="opacity-50">
                    {{queued: "queued", running: "running…", done: "done", error: "error"}[
                      (i as import("@/lib/agents/replies-stream").ToolCallReplyItem).state
                    ]}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ChatMessage({ message, isStreaming }: { message: NativeMessage; isStreaming?: boolean }) {
  const isAssistant = message.role === "assistant";
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-4",
        isAssistant ? "items-start" : "items-start flex-row-reverse"
      )}
    >
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1",
        isAssistant ? "bg-accent-primary text-black" : "bg-white/10 text-white/60"
      )}>
        {isAssistant ? <Robot size={16} /> : <User size={16} />}
      </div>
      
      <div className={cn(
        "flex flex-col gap-2 max-w-[85%]",
        isAssistant ? "items-start" : "items-end"
      )}>
        <div className={cn(
          "px-4 py-3 rounded-3xl text-sm leading-relaxed",
          isAssistant 
            ? "bg-white/[0.03] border border-white/5 text-white/90" 
            : "bg-accent-primary/10 border border-accent-primary/20 text-accent-primary"
        )}>
          {message.content}
          {isStreaming && <span className="inline-block w-1 h-4 ml-1 bg-accent-primary animate-pulse align-middle" />}
        </div>
        
        {(message as any).toolCalls && (message as any).toolCalls.length > 0 && (
          <div className="space-y-2 w-full">
            {(message as any).toolCalls.map((tc: any) => (
              <ToolCallVisualization key={tc.id} toolCalls={[tc]} />
            ))}
          </div>
        )}
        
        <span className="text-[10px] text-white/20 uppercase tracking-tighter px-2">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Canvas Panel Component
// ============================================================================

function CanvasPanel({ sessionId }: { sessionId: string | null }) {
  // Canvases not yet implemented in new store - stub for compatibility
  const canvases: string[] = [];
  const canvasMap: Record<string, Canvas> = {};
  const deleteCanvas = async (_id: string) => {};
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);

  useEffect(() => {
    if (canvases.length > 0 && !activeCanvasId) {
      setActiveCanvasId(canvases[canvases.length - 1]);
    }
  }, [canvases, activeCanvasId]);

  const activeCanvas = activeCanvasId ? canvasMap[activeCanvasId] : null;

  if (canvases.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-12 text-center">
        <div className="max-w-xs space-y-4 opacity-20">
          <StackSimple className="h-12 w-12 mx-auto" />
          <h3 className="text-lg font-medium">No Active Canvases</h3>
          <p className="text-xs">Canvases created by the agent for documents, code, or terminals will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-black/10">
      {/* Canvas Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-white/5 bg-white/5 overflow-x-auto no-scrollbar">
        {canvases.map((id) => {
          const canvas = canvasMap[id];
          const isActive = activeCanvasId === id;
          const Icon = canvas?.type === "terminal" ? Terminal : canvas?.type === "code" ? Code : FileText;
          
          return (
            <button
              key={id}
              onClick={() => setActiveCanvasId(id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap",
                isActive ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60 hover:bg-white/5"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {canvas?.title || "Untitled"}
            </button>
          );
        })}
      </div>

      {/* Canvas Content */}
      <div className="flex-1 min-h-0 relative group">
        {activeCanvas ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-white/20">{activeCanvas.type}</span>
                <Separator orientation="vertical" className="h-3 bg-white/10" />
                <span className="text-sm font-medium text-white/80">{activeCanvas.title}</span>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"><Copy className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"><DownloadSimple className="h-3.5 w-3.5" /></Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-400/10"
                  onClick={() => activeCanvasId && deleteCanvas(activeCanvasId)}
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 bg-black/20">
              <pre className="p-6 font-mono text-sm leading-relaxed text-white/70 overflow-x-auto">
                <code>{activeCanvas.content}</code>
              </pre>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <CircleNotch className="h-6 w-6 animate-spin text-white/10" />
          </div>
        )}
      </div>
    </div>
  );
}


export default NativeAgentView;
