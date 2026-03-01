"use client";

/**
 * NativeAgentView - N20 Native OpenClaw Agent View
 *
 * A split-pane component featuring:
 * - Left side: Chat interface with streaming support
 * - Right side: Canvas panel for tool visualization and content
 * - Session management with dropdown selector
 * - Full integration with native-agent.store
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Store
import {
  useNativeAgentStore,
  useActiveSession,
  useActiveMessages,
  useStreamingState,
  useSessionSyncState,
  useSessionCanvases,
  isLocalDraftSession,
  type NativeMessage,
  type NativeSession,
  type RuntimeExecutionModeStatus,
  type SessionUpdateInput,
  type ToolCall,
  type Canvas,
} from "@/lib/agents";
import {
  ToolCallVisualization,
  useToolCallAccent,
  ToolConfirmation,
  ToolQuestionDisplay,
} from "@/components/agents";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Icons
import {
  Send,
  Plus,
  Trash2,
  Square,
  Bot,
  User,
  Loader2,
  Copy,
  Download,
  PanelLeft,
  PanelRight,
  Layout,
  Code,
  FileText,
  Image,
  Terminal,
  Radio,
  Activity,
  Clock3,
  Layers3,
  Type,
  FileJson,
  Check,
  X,
  AlertCircle,
  Sparkles,
  MessageSquare,
  ChevronDown,
  Wrench,
  ArrowUpRight,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface NativeAgentViewProps {
  initialSessionId?: string;
  defaultLayout?: number[];
  bootstrapStrategy?: "auto" | "manual";
  syncSessions?: boolean;
  onOpenRuntimeOps?: () => void;
}

type ViewMode = "split" | "chat-only" | "canvas-only";

function formatSessionTimestamp(value?: string): string {
  if (!value) {
    return "Awaiting activity";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "Awaiting activity";
  }

  const elapsedMinutes = Math.max(
    0,
    Math.round((Date.now() - timestamp) / 60000),
  );
  if (elapsedMinutes < 1) {
    return "Updated just now";
  }

  if (elapsedMinutes < 60) {
    return `Updated ${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `Updated ${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) {
    return `Updated ${elapsedDays}d ago`;
  }

  return `Updated ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp))}`;
}

function formatSessionDate(value?: string): string {
  if (!value) {
    return "No timestamp available";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "No timestamp available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatExecutionModeLabel(
  mode?: RuntimeExecutionModeStatus["mode"],
): string {
  if (!mode) {
    return "Unavailable";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function getExecutionModeDescription(
  mode?: RuntimeExecutionModeStatus["mode"],
): string {
  switch (mode) {
    case "plan":
      return "Dry-run tool work and inspect the plan before anything executes.";
    case "safe":
      return "Execute with guarded defaults so risky work stays reviewable.";
    case "auto":
      return "Execute directly when the runtime and rails permit it.";
    default:
      return "Runtime execution mode is unavailable.";
  }
}

function formatAgentWorkspaceError(error: string): string {
  if (error === "Failed to fetch") {
    return "Agent services are unreachable right now. The workspace is still available locally, but live session data could not be loaded.";
  }

  return error;
}

function getOperatorNote(metadata?: Record<string, unknown>): string {
  return typeof metadata?.operator_note === "string"
    ? metadata.operator_note
    : "";
}

// ============================================================================
// Main Component
// ============================================================================

export function NativeAgentView({
  initialSessionId,
  defaultLayout = [50, 50],
  bootstrapStrategy = "auto",
  syncSessions = true,
  onOpenRuntimeOps,
}: NativeAgentViewProps) {
  const {
    sessions,
    activeSessionId,
    createSession,
    updateSession = async () => {},
    deleteSession,
    setActiveSession,
    fetchSessions,
    executionMode = null,
    fetchExecutionMode = async () => {},
    connectSessionSync = () => () => {},
    isLoadingSessions = false,
    isUpdatingSession = false,
    isLoadingExecutionMode = false,
  } = useNativeAgentStore();

  const { isStreaming } = useStreamingState();
  const { isConnected: isSessionSyncConnected, error: sessionSyncError } =
    useSessionSyncState();
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hasFetchedSessions, setHasFetchedSessions] = useState(false);
  const hasAutoCreatedWelcomeSession = useRef(false);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) || null;

  // Initialize sessions on mount unless the host is manually seeding store state.
  useEffect(() => {
    if (bootstrapStrategy === "manual") {
      setHasFetchedSessions(true);
      return;
    }

    let isMounted = true;

    void (async () => {
      try {
        await fetchSessions();
      } finally {
        if (isMounted) {
          setHasFetchedSessions(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [bootstrapStrategy, fetchSessions]);

  useEffect(() => {
    if (!syncSessions) {
      return;
    }

    return connectSessionSync();
  }, [connectSessionSync, syncSessions]);

  useEffect(() => {
    void fetchExecutionMode().catch(() => {});
  }, [fetchExecutionMode]);

  // Initialize with the requested session or the first available session after
  // the real session list has been loaded.
  useEffect(() => {
    if (!hasFetchedSessions || isLoadingSessions || activeSessionId) {
      return;
    }

    if (
      initialSessionId &&
      sessions.some((session) => session.id === initialSessionId)
    ) {
      setActiveSession(initialSessionId);
      return;
    }

    if (sessions.length > 0) {
      setActiveSession(sessions[0].id);
      return;
    }

    if (bootstrapStrategy === "manual") {
      return;
    }

    if (!hasAutoCreatedWelcomeSession.current) {
      hasAutoCreatedWelcomeSession.current = true;
      void createSession("Welcome Session");
    }
  }, [
    activeSessionId,
    createSession,
    hasFetchedSessions,
    initialSessionId,
    isLoadingSessions,
    sessions,
    setActiveSession,
    bootstrapStrategy,
  ]);

  // Handle creating a new session
  const handleNewSession = useCallback(async () => {
    const newSession = await createSession();
    if (newSession?.id) {
      setActiveSession(newSession.id);
    }
  }, [createSession, setActiveSession]);

  // Handle session deletion
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (confirm("Are you sure you want to delete this session?")) {
        await deleteSession(sessionId);
      }
    },
    [deleteSession],
  );

  const handleUpdateSession = useCallback(
    async (sessionId: string, updates: SessionUpdateInput) => {
      await updateSession(sessionId, updates);
    },
    [updateSession],
  );

  // Toggle view modes
  const toggleViewMode = useCallback(() => {
    const modes: ViewMode[] = ["split", "chat-only", "canvas-only"];
    const currentIndex = modes.indexOf(viewMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setViewMode(nextMode);
  }, [viewMode]);

  return (
    <TooltipProvider>
      <div
        className="flex h-full flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--bg-primary)",
          backgroundImage:
            "radial-gradient(circle at top left, rgba(217,119,87,0.16), transparent 28%), radial-gradient(circle at top right, rgba(176,141,110,0.12), transparent 30%), var(--bg-grid), var(--bg-gradient)",
          backgroundSize: "auto, auto, 32px 32px, cover",
        }}
      >
        {/* Header */}
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
        />

        {/* Error Banner */}
        <ErrorBanner />

        {/* Main Content */}
        <div className="flex-1 min-h-0 overflow-hidden p-4 pt-0">
          <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
            <SessionWorkbenchRail
              sessions={sessions}
              activeSession={activeSession}
              activeSessionId={activeSessionId}
              onSelectSession={setActiveSession}
              onNewSession={handleNewSession}
              onUpdateSession={handleUpdateSession}
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
              {viewMode === "chat-only" && (
                <ChatPanel sessionId={activeSessionId} />
              )}
              {viewMode === "canvas-only" && (
                <CanvasPanel sessionId={activeSessionId} />
              )}
              {viewMode === "split" && (
                <div className="flex h-full min-h-0 w-full min-w-0">
                  <div
                    className="min-h-0 min-w-0"
                    style={{ flex: `${defaultLayout[0]} 1 0%` }}
                  >
                    <ChatPanel sessionId={activeSessionId} />
                  </div>
                  <div className="w-px bg-[color:var(--border-subtle)]" />
                  <div
                    className="min-h-0 min-w-0"
                    style={{ flex: `${defaultLayout[1]} 1 0%` }}
                  >
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
}

function WorkspaceHeader({
  sessions,
  activeSession,
  activeSessionId,
  executionMode,
  onSelectSession,
  viewMode,
  onToggleViewMode,
  isStreaming,
  isSessionSyncConnected,
  sessionSyncError,
  onOpenRuntimeOps,
}: WorkspaceHeaderProps) {
  const messages = useActiveMessages();
  const activeCanvases = useSessionCanvases(activeSessionId || "");
  const messageCount = messages.length;
  const isLocalDraft = isLocalDraftSession(activeSession);

  const ViewModeIcon = {
    split: Layout,
    "chat-only": PanelLeft,
    "canvas-only": PanelRight,
  }[viewMode];

  return (
    <div className="relative overflow-hidden border-b border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-thick)] px-5 py-5 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(217,119,87,0.22),transparent_60%),radial-gradient(circle_at_top_right,rgba(176,141,110,0.18),transparent_56%)] opacity-90" />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[24px] border border-[color:rgba(217,119,87,0.18)] bg-[linear-gradient(135deg,rgba(217,119,87,0.16),rgba(176,141,110,0.08))] shadow-[0_10px_32px_rgba(42,31,22,0.14)]">
            <Bot className="h-5 w-5 text-[color:var(--accent-primary)]" />
          </div>
          <div className="min-w-0 space-y-2">
            <div>
              <div className="mb-2 inline-flex items-center rounded-full border border-[color:rgba(217,119,87,0.14)] bg-[linear-gradient(135deg,rgba(217,119,87,0.1),rgba(176,141,110,0.08))] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                Agent Workspace
              </div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                Agent Sessions
              </p>
              <h1 className="truncate text-lg font-semibold text-[color:var(--text-primary)]">
                {activeSession?.name || "Session workspace"}
              </h1>
              <p className="truncate text-sm text-[color:var(--text-secondary)]">
                {activeSession?.description ||
                  (isLocalDraft
                    ? "Local draft session with briefs, notes, messages, and canvases that stay on this device until runtime reconnects."
                    : "Durable agent session threads with synced state, streaming chat, and local canvases.")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)]">
              {isLocalDraft ? (
                <Badge
                  variant="secondary"
                  className="rounded-full border border-[color:rgba(217,119,87,0.18)] bg-[linear-gradient(135deg,rgba(217,119,87,0.12),rgba(176,141,110,0.08))] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-primary)]"
                >
                  Local Draft
                </Badge>
              ) : null}
              <Badge
                variant="secondary"
                className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]"
              >
                {messageCount} messages
              </Badge>
              <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] px-3 py-1">
                <Clock3 className="h-3.5 w-3.5" />
                <span>
                  {formatSessionTimestamp(
                    activeSession?.lastAccessedAt || activeSession?.updatedAt,
                  )}
                </span>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] px-3 py-1">
                <Layers3 className="h-3.5 w-3.5" />
                <span>{sessions.length} sessions</span>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] px-3 py-1">
                <Check className="h-3.5 w-3.5" />
                <span>
                  {executionMode
                    ? `Shared ${formatExecutionModeLabel(executionMode.mode)}`
                    : "Mode in Runtime Ops"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Badge
              variant="secondary"
              className={`gap-1 rounded-full border px-3 py-1 text-xs ${
                isSessionSyncConnected
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                  : sessionSyncError
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                    : "border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]"
              }`}
            >
              <Radio
                className={`h-3 w-3 ${isSessionSyncConnected ? "animate-pulse" : ""}`}
              />
              {isSessionSyncConnected
                ? "Session sync live"
                : sessionSyncError || "Session sync idle"}
            </Badge>
            {isStreaming && (
              <Badge
                variant="secondary"
                className="gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 animate-pulse"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Streaming...
              </Badge>
            )}

            {onOpenRuntimeOps ? (
              <Button
                variant="ghost"
                onClick={onOpenRuntimeOps}
                className="h-9 rounded-2xl border border-[color:rgba(217,119,87,0.18)] bg-[linear-gradient(135deg,rgba(217,119,87,0.12),rgba(176,141,110,0.08))] px-3 text-xs font-medium text-[color:var(--text-primary)] shadow-[var(--shadow-xs)]"
              >
                Runtime Ops
              </Button>
            ) : null}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] shadow-[var(--shadow-xs)]"
                  onClick={onToggleViewMode}
                >
                  <ViewModeIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View: {viewMode}</TooltipContent>
            </Tooltip>
          </div>

          <div className="lg:hidden">
            <Select
              value={activeSessionId || ""}
              onValueChange={onSelectSession}
            >
              <SelectTrigger className="h-10 w-full rounded-2xl border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] text-xs shadow-[var(--shadow-xs)]">
                <SelectValue placeholder="Select session..." />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem
                    key={session.id}
                    value={session.id}
                    className="text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3 w-3" />
                      <span className="truncate">
                        {session.name || "Unnamed Session"}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeroMetricCard
            label="Sessions"
            value={sessions.length}
            detail="Live directory"
          />
          <HeroMetricCard
            label="Messages"
            value={messageCount}
            detail="Active thread"
          />
          <HeroMetricCard
            label="Canvases"
            value={activeCanvases.length}
            detail={activeSession ? "Attached to session" : "Select a session"}
          />
          <HeroMetricCard
            label="Shared Mode"
            value={
              executionMode
                ? formatExecutionModeLabel(executionMode.mode)
                : isLocalDraft
                  ? "Local Draft"
                  : "Runtime Ops"
            }
            detail={
              executionMode
                ? "Global runtime posture"
                : isLocalDraft
                  ? "Working locally until the runtime reconnects"
                  : "Open Runtime Ops to inspect or set"
            }
          />
        </div>
      </div>
    </div>
  );
}

function HeroMetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[color:var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3 shadow-[var(--shadow-xs)] backdrop-blur-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
        {value}
      </div>
      <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
        {detail}
      </div>
    </div>
  );
}

interface SessionWorkbenchRailProps {
  sessions: NativeSession[];
  activeSession: NativeSession | null;
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onUpdateSession: (
    sessionId: string,
    updates: SessionUpdateInput,
  ) => Promise<void>;
  onDeleteSession: (id: string) => void;
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
  activeSession,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onUpdateSession,
  onDeleteSession,
  executionMode,
  isLoadingSessions,
  isUpdatingSession,
  isLoadingExecutionMode,
  isSessionSyncConnected,
  sessionSyncError,
  onOpenRuntimeOps,
}: SessionWorkbenchRailProps) {
  const totalMessages = sessions.reduce(
    (sum, session) => sum + session.messageCount,
    0,
  );

  return (
    <aside className="flex max-h-full w-full shrink-0 flex-col overflow-hidden rounded-[28px] border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-elevated)] shadow-[var(--shadow-lg)] backdrop-blur-xl lg:w-96">
      <div className="relative overflow-hidden border-b border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-thick)] px-5 py-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(217,119,87,0.18),transparent_58%),radial-gradient(circle_at_top_right,rgba(176,141,110,0.14),transparent_56%)] opacity-90" />
        <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
              Conversations
            </p>
            <h2 className="text-base font-semibold text-[color:var(--text-primary)]">
              Agent Sessions
            </h2>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Durable operator threads with local drafts when agent services are offline.
            </p>
          </div>
          <Button
            size="icon"
            className="h-10 w-10 rounded-[20px] border border-[color:rgba(217,119,87,0.18)] bg-[linear-gradient(135deg,rgba(217,119,87,0.14),rgba(176,141,110,0.08))] text-[color:var(--text-primary)] shadow-[var(--shadow-sm)] hover:opacity-90"
            onClick={onNewSession}
            aria-label="New Session"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-3 shadow-[var(--shadow-xs)]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
              <Layers3 className="h-3.5 w-3.5" />
              Sessions
            </div>
            <div className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
              {sessions.length}
            </div>
          </div>
          <div className="rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-3 shadow-[var(--shadow-xs)]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
              <Activity className="h-3.5 w-3.5" />
              Messages
            </div>
            <div className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
              {totalMessages}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-3 shadow-[var(--shadow-xs)]">
          <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-primary)]">
            <Radio
              className={`h-4 w-4 ${isSessionSyncConnected ? "text-emerald-600 animate-pulse" : "text-[color:var(--text-tertiary)]"}`}
            />
            {isSessionSyncConnected
              ? "Live sync connected"
              : sessionSyncError || "Waiting for session sync"}
          </div>
          <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
            Changes from other clients flow into this rail without reloading the
            workbench.
          </p>
        </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          <SharedAgentModeCard
            executionMode={executionMode}
            isLoading={isLoadingExecutionMode}
            onOpenRuntimeOps={onOpenRuntimeOps}
          />

          <ActiveSessionEditor
            activeSession={activeSession}
            isSaving={isUpdatingSession}
            onSave={onUpdateSession}
          />

          {isLoadingSessions && sessions.length === 0 ? (
            <div className="rounded-[24px] border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-4 text-sm text-[color:var(--text-secondary)]">
              Loading sessions…
            </div>
          ) : null}

          {!isLoadingSessions && sessions.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]">
                <Sparkles className="h-5 w-5 text-[color:var(--accent-primary)]" />
              </div>
              <div className="text-sm font-medium text-[color:var(--text-primary)]">
                No active sessions yet
              </div>
              <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                Create a working session to start a durable agent conversation.
              </p>
              <Button
                type="button"
                onClick={onNewSession}
                className="mt-4 rounded-[18px] bg-[color:var(--accent-primary)] px-4 text-[color:var(--text-inverse)] hover:opacity-90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Session
              </Button>
            </div>
          ) : null}

          <div className="px-1 pt-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
            Session Directory
          </div>

          {sessions.map((session) => (
            <SessionRailCard
              key={session.id}
              session={session}
              isSelected={session.id === activeSessionId}
              onSelect={() => onSelectSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

interface SharedAgentModeCardProps {
  executionMode: RuntimeExecutionModeStatus | null;
  isLoading: boolean;
  onOpenRuntimeOps?: () => void;
}

function SharedAgentModeCard({
  executionMode,
  isLoading,
  onOpenRuntimeOps,
}: SharedAgentModeCardProps) {
  const activeMode = executionMode?.mode;
  const activeModeLabel = activeMode
    ? formatExecutionModeLabel(activeMode)
    : "Runtime Offline";
  const activeModeTone = activeMode ?? "unavailable";

  return (
    <section className="rounded-[24px] border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-4 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
            Global Runtime Switch
          </p>
          <h3 className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
            Agent Mode
          </h3>
        </div>
        <div className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
          {isLoading ? "Loading" : activeModeLabel}
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-primary)]">
          {activeModeLabel}
        </div>
        <div className="mt-1 text-[11px] text-[color:var(--text-secondary)]">
          {activeModeTone === "plan"
            ? "Plan-first runtime posture"
            : activeModeTone === "safe"
              ? "Guarded runtime posture"
              : activeModeTone === "auto"
                ? "Direct runtime posture"
                : "Runtime services are disconnected"}
        </div>
      </div>

      <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
        {activeMode
          ? getExecutionModeDescription(activeMode)
          : "Global agent mode lives in Runtime Ops. Open that surface to inspect or change the current runtime posture."}
      </p>

      <p className="mt-3 text-[11px] text-[color:var(--text-tertiary)]">
        Runtime Ops owns this shared switch so session work stays focused on
        briefs, notes, messages, and canvases.
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[color:var(--text-tertiary)]">
        <span>
          {executionMode?.updatedAt
            ? `Runtime updated ${formatSessionDate(executionMode.updatedAt)}`
            : "Runtime mode has not been reported yet."}
        </span>
        {onOpenRuntimeOps ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onOpenRuntimeOps}
            className="h-8 rounded-[16px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-3 text-[11px] text-[color:var(--text-primary)]"
            aria-label="Open Runtime Ops"
          >
            Runtime Ops
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </section>
  );
}

interface ActiveSessionEditorProps {
  activeSession: NativeSession | null;
  isSaving: boolean;
  onSave: (sessionId: string, updates: SessionUpdateInput) => Promise<void>;
}

function ActiveSessionEditor({
  activeSession,
  isSaving,
  onSave,
}: ActiveSessionEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!activeSession) {
      setName("");
      setDescription("");
      setTagsInput("");
      setOperatorNote("");
      setIsActive(true);
      return;
    }

    setName(activeSession.name ?? "");
    setDescription(activeSession.description ?? "");
    setTagsInput(activeSession.tags.join(", "));
    setOperatorNote(getOperatorNote(activeSession.metadata));
    setIsActive(activeSession.isActive);
  }, [activeSession]);

  if (!activeSession) {
    return (
      <section className="rounded-[24px] border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-4 text-sm text-[color:var(--text-secondary)]">
        Select an agent session from the conversations directory to edit its working brief, tags, and operator notes.
      </section>
    );
  }

  const isLocalDraft = isLocalDraftSession(activeSession);

  const normalizedName = name.trim();
  const normalizedDescription = description.trim();
  const normalizedTags = tagsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const normalizedNote = operatorNote.trim();
  const currentNote = getOperatorNote(activeSession.metadata);

  const hasChanges =
    normalizedName !== (activeSession.name ?? "") ||
    normalizedDescription !== (activeSession.description ?? "") ||
    normalizedTags.join("|") !== activeSession.tags.join("|") ||
    normalizedNote !== currentNote ||
    isActive !== activeSession.isActive;

  const handleReset = () => {
    setName(activeSession.name ?? "");
    setDescription(activeSession.description ?? "");
    setTagsInput(activeSession.tags.join(", "));
    setOperatorNote(currentNote);
    setIsActive(activeSession.isActive);
  };

  const handleSave = async () => {
    if (!hasChanges) {
      return;
    }

    const metadataChanged = normalizedNote !== currentNote;

    await onSave(activeSession.id, {
      name: normalizedName,
      description: normalizedDescription,
      isActive,
      tags: normalizedTags,
      metadata: metadataChanged
        ? { operator_note: normalizedNote || null }
        : undefined,
    });
  };

  return (
    <section className="rounded-[24px] border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-4 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
            Active Session
          </p>
          <h3 className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
            Session Brief
          </h3>
        </div>
        <div className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
          {activeSession.name || "Unnamed"}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {isLocalDraft ? (
          <div className="rounded-[20px] border border-[color:rgba(217,119,87,0.18)] bg-[linear-gradient(135deg,rgba(217,119,87,0.08),rgba(176,141,110,0.04))] px-3 py-3 text-xs text-[color:var(--text-secondary)]">
            This session is a local draft. Brief changes, notes, and canvases stay on
            this device until agent services reconnect.
          </div>
        ) : null}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
            Name
          </label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Session name"
            aria-label="Session name"
            className="h-11 rounded-[18px] border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this session responsible for?"
            aria-label="Session description"
            className="min-h-[88px] rounded-[18px] border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
            Tags
          </label>
          <Input
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="priority, runtime, review"
            aria-label="Session tags"
            className="h-11 rounded-[18px] border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
            Operator Note
          </label>
          <Textarea
            value={operatorNote}
            onChange={(event) => setOperatorNote(event.target.value)}
            placeholder="Optional note stored with the session metadata."
            aria-label="Operator note"
            className="min-h-[74px] rounded-[18px] border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]"
          />
        </div>

        <div className="flex items-center justify-between rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-3 py-3">
          <div>
            <div className="text-sm font-medium text-[color:var(--text-primary)]">
              Keep session active
            </div>
            <div className="text-xs text-[color:var(--text-secondary)]">
              Toggle whether this thread should remain writable and visible as
              an active runtime lane.
            </div>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            aria-label="Session active toggle"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[color:var(--text-tertiary)]">
          <span>
            {activeSession.isActive
              ? "Session currently live"
              : "Session currently paused"}
          </span>
          <span>{formatSessionDate(activeSession.updatedAt)}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!hasChanges || isSaving}
            className="rounded-[18px] bg-[color:var(--accent-primary)] px-4 text-[color:var(--text-inverse)] hover:opacity-90"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Save Session
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
            className="rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]"
          >
            Reset
          </Button>
        </div>
      </div>
    </section>
  );
}

interface SessionRailCardProps {
  session: NativeSession;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SessionRailCard({
  session,
  isSelected,
  onSelect,
  onDelete,
}: SessionRailCardProps) {
  const isLocalDraft = isLocalDraftSession(session);

  return (
    <div
      className={`group w-full rounded-[24px] border p-4 text-left transition-all ${
        isSelected
          ? "border-[color:rgba(217,119,87,0.44)] bg-[linear-gradient(135deg,rgba(217,119,87,0.16),rgba(255,255,255,0.04))] shadow-[0_16px_32px_rgba(42,31,22,0.14)]"
          : "border-[color:var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[var(--shadow-xs)] hover:border-[color:rgba(217,119,87,0.28)] hover:bg-[color:var(--bg-elevated)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border ${
                isSelected
                  ? "border-[color:rgba(217,119,87,0.28)] bg-[linear-gradient(135deg,rgba(217,119,87,0.18),rgba(176,141,110,0.08))]"
                  : "border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]"
              }`}
            >
              <Bot className="h-4 w-4 text-[color:var(--accent-primary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                  {session.name || "Unnamed Session"}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] ${
                    session.isActive
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                      : "border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]"
                  }`}
                >
                  {session.isActive ? "Live" : "Paused"}
                </span>
                <span className="rounded-full border border-[color:rgba(217,119,87,0.14)] bg-[linear-gradient(135deg,rgba(217,119,87,0.08),rgba(176,141,110,0.05))] px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">
                  {isLocalDraft ? "Local Draft" : "Agent Session"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-[color:var(--text-secondary)]">
                {session.description ||
                  (isLocalDraft
                    ? "Local draft workspace for notes, canvases, and operator setup while runtime services are offline."
                    : "No session description. Use this slot for a focused runtime thread.")}
              </p>
            </div>
          </div>
          {getOperatorNote(session.metadata) ? (
            <p className="mt-2 line-clamp-1 text-[11px] text-[color:var(--text-tertiary)]">
              {getOperatorNote(session.metadata)}
            </p>
          ) : null}
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-2xl border border-transparent text-[color:var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100 hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-700"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete session ${session.name || session.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="mt-3 w-full text-left"
      >
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--text-secondary)]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-2.5 py-1">
            <MessageSquare className="h-3 w-3" />
            {session.messageCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-2.5 py-1">
            <Clock3 className="h-3 w-3" />
            {formatSessionTimestamp(
              session.lastAccessedAt || session.updatedAt,
            ).replace("Updated ", "")}
          </span>
        </div>

        {session.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {session.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between text-[11px] text-[color:var(--text-tertiary)]">
          <span>
            {isLocalDraft
              ? "Local draft"
              : session.isActive
                ? "Session ready"
                : "Session paused"}
          </span>
          <span>{formatSessionDate(session.updatedAt)}</span>
        </div>
      </button>
    </div>
  );
}

// ============================================================================
// Error Banner
// ============================================================================

function ErrorBanner() {
  const { error, clearError } = useNativeAgentStore();

  if (!error) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="border-b border-red-400/30 bg-red-400/10"
      >
        <div className="flex items-center gap-2 px-5 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="flex-1">{formatAgentWorkspaceError(error)}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
            aria-label="Close error"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Chat Panel
// ============================================================================

interface ChatPanelProps {
  sessionId: string | null;
}

function ChatPanel({ sessionId }: ChatPanelProps) {
  const { sendMessageStream, abortGeneration } = useNativeAgentStore();
  const activeSession = useActiveSession();
  const messages = useActiveMessages();
  const { isStreaming } = useStreamingState();
  const isLocalDraft = isLocalDraftSession(activeSession);
  const accentColor = useToolCallAccent("chat") || "#D4956A";

  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || !sessionId || isStreaming) return;

    const content = input.trim();
    setInput("");

    try {
      await sendMessageStream(sessionId, content);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  }, [input, sessionId, isStreaming, sendMessageStream]);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col bg-transparent relative">
      {/* Tool Confirmation Overlay */}
      <ToolConfirmation sessionId={sessionId} accentColor={accentColor!} />

      {/* Messages Area */}
      <ScrollArea ref={scrollRef} className="flex-1 px-5 py-4">
        {messages.length === 0 ? (
          <EmptyChatState isLocalDraft={isLocalDraft} />
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} accentColor={accentColor!} isStreaming={isStreaming} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Pending Questions - Floating above input */}
      <div className="absolute bottom-[180px] left-6 right-6 z-50">
        <ToolQuestionDisplay sessionId={sessionId} accentColor={accentColor!} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-4 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {isLocalDraft ? (
            <div className="rounded-[18px] border border-[color:rgba(217,119,87,0.18)] bg-[linear-gradient(135deg,rgba(217,119,87,0.08),rgba(176,141,110,0.04))] px-3 py-2 text-xs text-[color:var(--text-secondary)]">
              Local draft mode is active. Messages stay in this workspace until the
              agent runtime reconnects.
            </div>
          ) : null}
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isStreaming}
              className="min-h-[88px] resize-none rounded-[24px] border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] pr-12 text-[color:var(--text-primary)] shadow-[var(--shadow-sm)]"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              {isStreaming ? (
                <Button
                  size="icon"
                  variant="destructive"
                  className="rounded-2xl"
                  onClick={() => void abortGeneration()}
                  aria-label="Stop generation"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="rounded-2xl bg-[color:var(--accent-primary)] text-[color:var(--text-inverse)] hover:opacity-90"
                  onClick={() => void handleSend()}
                  disabled={!input.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isLocalDraft
                ? "Press Enter to add to the local draft, Shift+Enter for new line"
                : "Press Enter to send, Shift+Enter for new line"}
            </span>
            {isStreaming && (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Message Item
// ============================================================================

interface MessageItemProps {
  message: NativeMessage;
}

interface MessageItemProps {
  message: NativeMessage;
  accentColor?: string;
  isStreaming?: boolean;
}

function MessageItem({ message, accentColor = "#D4956A", isStreaming = false }: MessageItemProps) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  if (isTool) {
    return <ToolResultItem message={message} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border ${
          isUser
            ? "border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)] text-[color:var(--text-inverse)]"
            : "border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--accent-primary)]"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div
        className={`flex-1 ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}
      >
        <div
          className={`max-w-[85%] rounded-[24px] px-4 py-3 shadow-[var(--shadow-sm)] ${
            isUser
              ? "bg-[color:var(--accent-primary)] text-[color:var(--text-inverse)]"
              : "border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] text-[color:var(--text-primary)]"
          }`}
        >
          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
        </div>

        {/* Enhanced Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full mt-2 pl-11">
            <ToolCallVisualization
              toolCalls={message.toolCalls}
              isLoading={isStreaming}
              accentColor={accentColor}
            />
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground px-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Tool Call Item
// ============================================================================

interface ToolCallItemProps {
  toolCall: ToolCall;
}

function ToolCallItem({ toolCall }: ToolCallItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-3 text-sm text-[color:var(--text-secondary)] shadow-[var(--shadow-xs)]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full"
      >
        <Wrench className="h-4 w-4" />
        <span className="font-medium flex-1 text-left">{toolCall.name}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 space-y-2"
        >
          <div>
            <div className="text-xs font-medium mb-1 opacity-70">
              Arguments:
            </div>
            <pre className="max-h-32 overflow-auto rounded-2xl bg-[color:var(--bg-secondary)] p-3 text-xs">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// Tool Result Item
// ============================================================================

interface ToolResultItemProps {
  message: NativeMessage;
}

function ToolResultItem({ message }: ToolResultItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 pl-11"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
        <Check className="w-4 h-4" />
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 w-full"
          >
            <span className="font-medium flex-1 text-left">Tool Result</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-2"
            >
              <pre className="max-h-40 overflow-auto rounded-2xl bg-white/50 p-3 text-xs text-emerald-950">
                {message.content}
              </pre>
            </motion.div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground px-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Empty Chat State
// ============================================================================

function EmptyChatState({ isLocalDraft }: { isLocalDraft: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-[var(--shadow-sm)]">
        <Sparkles className="h-8 w-8 text-[color:var(--accent-primary)]" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {isLocalDraft ? "Local Draft Session Ready" : "Welcome to Agent Sessions"}
      </h3>
      <p className="mb-6 max-w-sm text-sm text-[color:var(--text-secondary)]">
        {isLocalDraft
          ? "This session is running locally because agent services are offline. You can still shape the brief, keep notes, and stage canvases from the shared conversations lane."
          : "Start a conversation in the N20 workspace. Messages, operator notes, and canvases stay attached to the active agent session and remain reachable from the shared conversations lane."}
      </p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-3 text-left shadow-[var(--shadow-xs)]">
          <Wrench className="mb-2 h-4 w-4 text-[color:var(--accent-primary)]" />
          <div className="font-medium">Tool Calls</div>
          <div className="text-[color:var(--text-secondary)]">
            Visualize agent actions
          </div>
        </div>
        <div className="rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-base)] p-3 text-left shadow-[var(--shadow-xs)]">
          <Layout className="mb-2 h-4 w-4 text-[color:var(--accent-primary)]" />
          <div className="font-medium">Split View</div>
          <div className="text-[color:var(--text-secondary)]">
            Chat + Canvas side by side
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Canvas Panel
// ============================================================================

interface CanvasPanelProps {
  sessionId: string | null;
}

function CanvasPanel({ sessionId }: CanvasPanelProps) {
  const { createCanvas } = useNativeAgentStore();
  const canvases = useSessionCanvases(sessionId || "");

  // Create new canvas content
  const handleCreateCanvas = useCallback(
    async (type: Canvas["type"]) => {
      if (!sessionId) return;

      const titles: Record<Canvas["type"], string> = {
        code: "New Code",
        document: "New Document",
        diagram: "New Diagram",
        visualization: "New Visualization",
        terminal: "New Terminal",
        text: "New Text",
        markdown: "New Markdown",
        json: "New JSON",
      };

      await createCanvas(sessionId, {
        type,
        title: titles[type],
      });
    },
    [sessionId, createCanvas],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[color:var(--glass-bg-base)]">
      {/* Canvas Header */}
      <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-thick)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Layout className="h-4 w-4 text-[color:var(--text-tertiary)]" />
          <span className="text-sm font-medium text-[color:var(--text-primary)]">
            Canvas
          </span>
          <Badge
            variant="secondary"
            className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-xs text-[color:var(--text-secondary)]"
          >
            {canvases.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void handleCreateCanvas("code")}
              >
                <Code className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Code</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void handleCreateCanvas("document")}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Document</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void handleCreateCanvas("terminal")}
              >
                <Terminal className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Terminal</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Canvas Content */}
      {canvases.length === 0 ? (
        <EmptyCanvasState onCreate={handleCreateCanvas} />
      ) : (
        <CanvasList canvases={canvases} />
      )}
    </div>
  );
}

// ============================================================================
// Canvas List
// ============================================================================

interface CanvasListProps {
  canvases: Canvas[];
}

function CanvasList({ canvases }: CanvasListProps) {
  const { deleteCanvas } = useNativeAgentStore();
  const [selectedId, setSelectedId] = useState<string | null>(
    canvases[0]?.id ?? null,
  );

  useEffect(() => {
    if (canvases.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !canvases.some((canvas) => canvas.id === selectedId)) {
      setSelectedId(canvases[0].id);
    }
  }, [canvases, selectedId]);

  const selectedCanvas = canvases.find((c) => c.id === selectedId);

  return (
    <div className="flex-1 flex">
      {/* Canvas List Sidebar */}
      <div className="w-48 overflow-y-auto border-r border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-thick)]">
        {canvases.map((canvas) => (
          <CanvasListItem
            key={canvas.id}
            canvas={canvas}
            isSelected={canvas.id === selectedId}
            onClick={() => setSelectedId(canvas.id)}
            onDelete={() => void deleteCanvas(canvas.id)}
          />
        ))}
      </div>

      {/* Canvas Viewer */}
      <div className="flex-1 overflow-hidden">
        {selectedCanvas ? (
          <CanvasViewer canvas={selectedCanvas} />
        ) : (
          <div className="flex h-full items-center justify-center text-[color:var(--text-secondary)]">
            Select a canvas item to view
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Canvas List Item
// ============================================================================

interface CanvasListItemProps {
  canvas: Canvas;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function CanvasListItem({
  canvas,
  isSelected,
  onClick,
  onDelete,
}: CanvasListItemProps) {
  const typeIcons: Record<Canvas["type"], typeof Code> = {
    code: Code,
    document: FileText,
    diagram: Layout,
    visualization: Image,
    terminal: Terminal,
    text: Type,
    markdown: FileText,
    json: FileJson,
  };

  const TypeIcon = typeIcons[canvas.type];

  return (
    <div
      className={`group flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${
        isSelected
          ? "border-r-2 border-[color:var(--accent-primary)] bg-[color:var(--bg-hover)]"
          : "hover:bg-[color:var(--bg-hover)]"
      }`}
      onClick={onClick}
    >
      <TypeIcon className="h-4 w-4 shrink-0 text-[color:var(--text-tertiary)]" />
      <span className="flex-1 truncate">{canvas.title || "Untitled"}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  );
}

// ============================================================================
// Canvas Viewer
// ============================================================================

interface CanvasViewerProps {
  canvas: Canvas;
}

function CanvasViewer({ canvas }: CanvasViewerProps) {
  const { updateCanvas } = useNativeAgentStore();

  const handleDownload = () => {
    const content = canvas.content || "";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${canvas.title || "canvas"}.${getFileExtension(canvas.type)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] bg-[color:var(--glass-bg-thick)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {canvas.title || "Untitled"}
          </span>
          <Badge variant="outline" className="text-xs">
            {canvas.type}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  navigator.clipboard.writeText(canvas.content || "")
                }
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {canvas.type === "terminal" ? (
          <div className="min-h-[200px] rounded-[24px] bg-[#1f170f] p-4 font-mono text-sm text-[#e8d9c8] shadow-[var(--shadow-md)]">
            {canvas.content || <span className="text-green-600">$ _</span>}
          </div>
        ) : (
          <Textarea
            value={canvas.content || ""}
            onChange={(e) =>
              void updateCanvas(canvas.id, { content: e.target.value })
            }
            className="min-h-[300px] resize-none rounded-[24px] border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] font-mono text-sm shadow-[var(--shadow-sm)]"
            placeholder={`Enter ${canvas.type} content...`}
          />
        )}
      </div>
    </div>
  );
}

function getFileExtension(type: Canvas["type"]): string {
  switch (type) {
    case "code":
      return "txt";
    case "document":
      return "md";
    case "diagram":
      return "svg";
    case "visualization":
      return "json";
    case "terminal":
      return "sh";
    default:
      return "txt";
  }
}

// ============================================================================
// Empty Canvas State
// ============================================================================

interface EmptyCanvasStateProps {
  onCreate: (type: Canvas["type"]) => void;
}

function EmptyCanvasState({ onCreate }: EmptyCanvasStateProps) {
  return (
    <div className="relative z-10 flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]">
        <Layout className="h-6 w-6 text-[color:var(--accent-primary)]" />
      </div>
      <h3 className="text-sm font-medium mb-1">Canvas is empty</h3>
      <p className="mb-4 text-xs text-[color:var(--text-secondary)]">
        Create content or wait for the agent to generate artifacts
      </p>
      <div className="relative z-20 flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto relative z-20"
          data-testid="native-agent-create-code-canvas"
          onClick={() => void onCreate("code")}
        >
          <Code className="h-3 w-3 mr-1" />
          Code
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto relative z-20"
          data-testid="native-agent-create-document-canvas"
          onClick={() => void onCreate("document")}
        >
          <FileText className="h-3 w-3 mr-1" />
          Doc
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto relative z-20"
          data-testid="native-agent-create-terminal-canvas"
          onClick={() => void onCreate("terminal")}
        >
          <Terminal className="h-3 w-3 mr-1" />
          Terminal
        </Button>
      </div>
    </div>
  );
}

export default NativeAgentView;
