/**
 * N20 Native OpenClaw Agent Store (V2 - API Layer Integrated)
 *
 * Zustand store for native agent sessions with proper API layer integration.
 * This version uses `native-agent-api.ts` for all backend communication,
 * ensuring proper field mapping and type safety.
 *
 * Key improvements over V1:
 * - Uses nativeAgentApi layer for all API calls
 * - Proper field transformation (name ↔ title, parameters ↔ arguments)
 * - Better error handling with typed errors
 * - SSE stream mapping from backend to frontend format
 *
 * @module native-agent-store-v2
 * @version 2.0.0
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { API_BASE_URL } from "./api-config";
import {
  nativeAgentApi,
  type BackendMessage,
  type BackendRuntimeExecutionMode,
  type BackendSession,
  type BackendSessionSnapshot,
  type CreateNativeAgentSessionRequest,
  type RuntimeExecutionMode,
  type SessionMessageAddedEvent,
  type SessionPartDeltaEvent,
  type SessionPartRemovedEvent,
  type SessionPartUpdatedEvent,
  type SessionPermissionAskedEvent,
  type SessionQuestionAskedEvent,
  type SessionQuestionRepliedEvent,
  type SessionSyncEvent,
  type SessionUpdatedEvent,
} from "./native-agent-api";
import {
  buildAgentSessionMetadata,
  type AgentSessionDescriptor,
} from "./session-metadata";
import {
  executeTool as executeLocalTool,
  isToolRegistered as isLocalToolRegistered,
} from "./tools";
import {
  useToolHooksStore,
  createConfirmationHook,
} from "./tools/tool-hooks";
import { useToolRegistryStore } from "./tool-registry.store";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";

const APP_API_BASE = API_BASE_URL.replace(/\/api\/v1$/i, "");

// ============================================================================
// Auto-title utility
// ============================================================================

/**
 * Derives a concise session title from the user's first message.
 * Strips common markdown syntax, collapses whitespace, and truncates at a
 * word boundary to ≤ maxLength characters (default 50).
 */
function deriveSessionTitle(content: string, maxLength = 50): string {
  const stripped = content
    .replace(/^#{1,6}\s+/gm, "")           // headings
    .replace(/\*{1,2}(.+?)\*{1,2}/g, "$1") // bold / italic
    .replace(/`{1,3}[^`]*`{1,3}/g, "")     // inline + fenced code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links / images
    .replace(/>\s*/gm, "")                 // blockquotes
    .replace(/[-*+]\s+/gm, "")             // list markers
    .replace(/\s+/g, " ")                  // collapse whitespace
    .trim();

  if (!stripped) return "";
  if (stripped.length <= maxLength) return stripped;

  const truncated = stripped.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > maxLength * 0.6 ? lastSpace : maxLength;
  return truncated.slice(0, cut) + "…";
}

/** Default names that should be replaced by auto-title. */
const AUTO_TITLE_SENTINELS = new Set(["New Chat", "Untitled", ""]);

// ============================================================================
// Types
// ============================================================================

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface NativeMessage {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface NativeSession {
  id: string;
  name?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  messageCount: number;
  isActive: boolean;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface SessionUpdateInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateSessionInput extends AgentSessionDescriptor {
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface RuntimeExecutionModeStatus {
  mode: RuntimeExecutionMode;
  updatedAt: string;
  supportedModes: RuntimeExecutionMode[];
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  isEnabled: boolean;
  category?: string;
}

export interface Canvas {
  id: string;
  sessionId: string;
  content: string;
  type:
    | "code"
    | "markdown"
    | "json"
    | "text"
    | "document"
    | "diagram"
    | "visualization"
    | "terminal";
  title?: string;
  language?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface PendingPermissionRequest {
  requestId: string;
  sessionId: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: { messageID: string; callID: string };
}

export interface PendingQuestionRequest {
  requestId: string;
  sessionId: string;
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description: string }>;
    custom?: boolean;
    multiple?: boolean;
  }>;
}

export type StreamEventType =
  | "message_start"
  | "message_delta"
  | "message_complete"
  | "tool_call"
  | "tool_result"
  | "tool_error"
  | "canvas_update"
  | "error"
  | "done";

export interface StreamEvent {
  type: StreamEventType;
  sessionId?: string;
  messageId?: string;
  delta?: {
    content?: string;
    reasoning?: string;
  };
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  canvas?: Canvas;
  error?: string;
  timestamp: string;
}

export interface StreamingState {
  isStreaming: boolean;
  currentMessageId: string | null;
  abortController: AbortController | null;
  error: string | null;
  streamBuffer: string;
}

const LOCAL_DRAFT_SESSION_FLAG = "a2r_local_draft";

function isNetworkRequestError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /failed to fetch|networkerror|load failed|err_connection_refused/i.test(
    error.message,
  );
}

export function isLocalDraftSession(
  session?: Pick<NativeSession, "metadata"> | null,
): boolean {
  return session?.metadata?.[LOCAL_DRAFT_SESSION_FLAG] === true;
}

// ============================================================================
// Backend to Frontend Transformers
// ============================================================================

function transformBackendSession(backend: BackendSession): NativeSession {
  const updatedAt = backend.updated_at || backend.created_at;

  return {
    id: backend.id,
    name: backend.name,
    description: backend.description,
    createdAt: backend.created_at,
    updatedAt,
    lastAccessedAt: backend.last_accessed || updatedAt,
    messageCount: backend.message_count,
    isActive: backend.active ?? true,
    tags: backend.tags || [],
    metadata: backend.metadata,
  };
}

function transformSessionSnapshot(
  snapshot: BackendSessionSnapshot,
): NativeSession {
  return {
    id: snapshot.id,
    name: snapshot.name ?? undefined,
    description: snapshot.description ?? undefined,
    createdAt: snapshot.created_at,
    updatedAt: snapshot.updated_at,
    lastAccessedAt: snapshot.last_accessed,
    messageCount: snapshot.message_count,
    isActive: snapshot.active,
    tags: snapshot.tags,
    metadata: snapshot.metadata,
  };
}

function transformBackendMessage(backend: BackendMessage): NativeMessage {
  return {
    id: backend.id,
    role: backend.role as MessageRole,
    content: backend.content,
    thinking: backend.thinking,
    timestamp: backend.timestamp,
    metadata: backend.metadata,
  };
}

function transformExecutionMode(
  backend: BackendRuntimeExecutionMode,
): RuntimeExecutionModeStatus {
  return {
    mode: backend.mode,
    updatedAt: backend.updated_at,
    supportedModes: backend.supported_modes,
  };
}

function sortSessions(sessions: NativeSession[]): NativeSession[] {
  return [...sessions].sort((left, right) => {
    const leftTimestamp = Date.parse(
      left.lastAccessedAt || left.updatedAt || left.createdAt,
    );
    const rightTimestamp = Date.parse(
      right.lastAccessedAt || right.updatedAt || right.createdAt,
    );

    if (Number.isNaN(leftTimestamp) || Number.isNaN(rightTimestamp)) {
      return right.id.localeCompare(left.id);
    }

    return rightTimestamp - leftTimestamp;
  });
}

function upsertSession(
  sessions: NativeSession[],
  nextSession: NativeSession,
): NativeSession[] {
  const existingIndex = sessions.findIndex(
    (session) => session.id === nextSession.id,
  );
  if (existingIndex === -1) {
    return sortSessions([nextSession, ...sessions]);
  }

  const nextSessions = [...sessions];
  nextSessions[existingIndex] = nextSession;
  return sortSessions(nextSessions);
}

function appendUniqueMessage(
  messages: NativeMessage[],
  nextMessage: NativeMessage,
): NativeMessage[] {
  const existingIndex = messages.findIndex((m) => m.id === nextMessage.id);

  if (existingIndex !== -1) {
    // Message already exists — update content only when the new version has
    // real content (not a gizzi stub placeholder).
    const hasRealContent =
      nextMessage.content &&
      nextMessage.content !== "[No text content]";
    if (!hasRealContent) return messages;
    const updated = [...messages];
    updated[existingIndex] = {
      ...messages[existingIndex],
      content: nextMessage.content,
      metadata: nextMessage.metadata,
    };
    return updated;
  }

  // New message — skip empty gizzi stubs. sendMessageStream will add the real
  // content once the model responds.
  if (nextMessage.content === "[No text content]") return messages;

  return [...messages, nextMessage];
}

function applySessionUpdate(
  session: NativeSession,
  event: SessionUpdatedEvent,
): NativeSession {
  return {
    ...session,
    name: event.name === undefined ? session.name : (event.name ?? undefined),
    description:
      event.description === undefined
        ? session.description
        : (event.description ?? undefined),
    isActive: event.active ?? session.isActive,
    tags: event.tags ?? session.tags,
    metadata: event.metadata ?? session.metadata,
    updatedAt: new Date().toISOString(),
  };
}

function applyMessageAdded(
  state: NativeAgentState & NativeAgentActions,
  event: SessionMessageAddedEvent,
): Partial<NativeAgentState> {
  const nextMessage = transformBackendMessage(event);
  const existingMessages = state.messages[event.session_id] || [];
  const isAlreadyPresent = existingMessages.some((m) => m.id === nextMessage.id);

  // Increment unread count only for sessions the user is not currently viewing
  const isBackground = state.activeSessionId !== event.session_id;
  const currentUnread = state.unreadCounts[event.session_id] ?? 0;

  // When the final assistant message arrives with real content, clear the
  // streaming flag set by part_delta (in case sendMessageStream didn't clear it).
  const isRealAssistantContent =
    nextMessage.role === "assistant" &&
    nextMessage.content &&
    nextMessage.content !== "[No text content]";
  const streamingClear: Partial<NativeAgentState> = isRealAssistantContent
    ? {
        streamingBySession: {
          ...state.streamingBySession,
          [event.session_id]: {
            ...(state.streamingBySession[event.session_id] ?? {}),
            isStreaming: false,
          } as StreamingState,
        },
      }
    : {};

  return {
    sessions: sortSessions(
      state.sessions.map((session) =>
        session.id === event.session_id
          ? {
              ...session,
              messageCount: isAlreadyPresent
                ? session.messageCount
                : session.messageCount + 1,
              updatedAt: event.timestamp,
              lastAccessedAt: event.timestamp,
            }
          : session,
      ),
    ),
    messages: {
      ...state.messages,
      [event.session_id]: appendUniqueMessage(existingMessages, nextMessage),
    },
    unreadCounts: isBackground && !isAlreadyPresent
      ? { ...state.unreadCounts, [event.session_id]: currentUnread + 1 }
      : state.unreadCounts,
    ...streamingClear,
  };
}

function applySessionSyncEvent(
  state: NativeAgentState & NativeAgentActions,
  event: SessionSyncEvent,
): Partial<NativeAgentState> {
  switch (event.type) {
    case "created": {
      const newSession = transformSessionSnapshot(event);
      const createdSurface = newSession.metadata?.surface as AgentModeSurface | undefined;
      return {
        sessions: upsertSession(state.sessions, newSession),
        sessionIdBySurface: createdSurface
          ? { ...state.sessionIdBySurface, [createdSurface]: newSession.id }
          : state.sessionIdBySurface,
      };
    }

    case "updated":
      return {
        sessions: sortSessions(
          state.sessions.map((session) =>
            session.id === event.session_id
              ? applySessionUpdate(session, event)
              : session,
          ),
        ),
      };

    case "deleted": {
      const nextMessages = { ...state.messages };
      delete nextMessages[event.session_id];

      const nextSessionCanvases = { ...state.sessionCanvases };
      const deletedCanvasIds = new Set(
        nextSessionCanvases[event.session_id] || [],
      );
      delete nextSessionCanvases[event.session_id];

      const nextCanvases = { ...state.canvases };
      for (const canvasId of deletedCanvasIds) {
        delete nextCanvases[canvasId];
      }

      return {
        sessions: state.sessions.filter(
          (session) => session.id !== event.session_id,
        ),
        activeSessionId:
          state.activeSessionId === event.session_id
            ? null
            : state.activeSessionId,
        messages: nextMessages,
        sessionCanvases: nextSessionCanvases,
        canvases: nextCanvases,
      };
    }

    case "message_added":
      return applyMessageAdded(state, event);

    case "part_updated": {
      const e = event as SessionPartUpdatedEvent;
      const partId = e.part.id as string | undefined;
      if (!partId) return {};
      const sessionParts = state.parts[e.session_id] ?? {};
      const msgParts = sessionParts[e.message_id] ?? [];
      const idx = msgParts.findIndex((p) => p.id === partId);
      const nextParts = idx >= 0
        ? [...msgParts.slice(0, idx), e.part, ...msgParts.slice(idx + 1)]
        : [...msgParts, e.part];
      return {
        parts: {
          ...state.parts,
          [e.session_id]: { ...sessionParts, [e.message_id]: nextParts },
        },
      };
    }

    case "part_delta": {
      const e = event as SessionPartDeltaEvent;
      const sessionParts = state.parts[e.session_id] ?? {};
      const msgParts = sessionParts[e.message_id] ?? [];
      const idx = msgParts.findIndex((p) => p.id === e.part_id);

      // Build updated parts — create the part if we haven't seen it yet
      let nextParts: typeof msgParts;
      if (idx < 0) {
        nextParts = [...msgParts, { id: e.part_id, [e.field]: e.delta } as (typeof msgParts)[number]];
      } else {
        const existing = msgParts[idx];
        const currentField = existing[e.field];
        const nextPart = {
          ...existing,
          [e.field]: typeof currentField === "string" ? currentField + e.delta : e.delta,
        };
        nextParts = [...msgParts.slice(0, idx), nextPart, ...msgParts.slice(idx + 1)];
      }

      const partsUpdate = {
        parts: {
          ...state.parts,
          [e.session_id]: { ...sessionParts, [e.message_id]: nextParts },
        },
      };

      // For text fields: also stream into state.messages so the UI updates
      // token-by-token (matching Claude Code desktop streaming behaviour).
      if ((e.field === "text" || e.field === "content") && e.delta) {
        const sessionMessages = state.messages[e.session_id] ?? [];
        const msgIdx = sessionMessages.findIndex((m) => m.id === e.message_id);

        let nextMessages: NativeMessage[];
        if (msgIdx >= 0) {
          const updated = [...sessionMessages];
          updated[msgIdx] = {
            ...sessionMessages[msgIdx],
            content: (sessionMessages[msgIdx].content ?? "") + e.delta,
          };
          nextMessages = updated;
        } else {
          // First delta for this message — create the assistant message stub
          nextMessages = [
            ...sessionMessages,
            {
              id: e.message_id,
              role: "assistant" as const,
              content: e.delta,
              timestamp: new Date().toISOString(),
            },
          ];
        }

        // Record the gizzi message ID in streaming state so sendMessageStream can
        // find the SSE-created message rather than creating a duplicate.
        const existingStreaming = state.streamingBySession[e.session_id];
        const streamingUpdate: Partial<NativeAgentState> = {
          streamingBySession: {
            ...state.streamingBySession,
            [e.session_id]: {
              isStreaming: true,
              currentMessageId: e.message_id,
              abortController: existingStreaming?.abortController ?? null,
              error: null,
              streamBuffer: existingStreaming?.streamBuffer ?? "",
              ...(existingStreaming ?? {}),
              currentMessageId: e.message_id,
            } as StreamingState,
          },
        };

        return {
          ...partsUpdate,
          messages: { ...state.messages, [e.session_id]: nextMessages },
          ...streamingUpdate,
        };
      }

      return partsUpdate;
    }

    case "part_removed": {
      const e = event as SessionPartRemovedEvent;
      const sessionParts = state.parts[e.session_id] ?? {};
      const msgParts = sessionParts[e.message_id] ?? [];
      const nextParts = msgParts.filter((p) => p.id !== e.part_id);
      return {
        parts: {
          ...state.parts,
          [e.session_id]: { ...sessionParts, [e.message_id]: nextParts },
        },
      };
    }

    case "permission_asked": {
      const e = event as SessionPermissionAskedEvent;
      return {
        pendingPermissions: {
          ...state.pendingPermissions,
          [e.request_id]: {
            requestId: e.request_id,
            sessionId: e.session_id,
            permission: e.permission,
            patterns: e.patterns,
            metadata: e.metadata,
            always: e.always,
            tool: e.tool,
          },
        },
      };
    }

    case "permission_replied": {
      const nextPermissions = { ...state.pendingPermissions };
      delete nextPermissions[event.request_id];
      return { pendingPermissions: nextPermissions };
    }

    case "question_asked": {
      const e = event as SessionQuestionAskedEvent;
      return {
        pendingQuestions: {
          ...state.pendingQuestions,
          [e.request_id]: {
            requestId: e.request_id,
            sessionId: e.session_id,
            questions: e.questions,
          },
        },
      };
    }

    case "question_replied": {
      const e = event as SessionQuestionRepliedEvent;
      const next = { ...state.pendingQuestions };
      delete next[e.request_id];
      return { pendingQuestions: next };
    }

    case "status_changed":
      return {
        sessions: state.sessions.map((session) =>
          session.id === event.session_id
            ? {
                ...session,
                isActive: event.active,
                updatedAt: new Date().toISOString(),
              }
            : session,
        ),
      };

    default:
      return {};
  }
}

// ============================================================================
// Store State & Actions
// ============================================================================

interface NativeAgentState {
  // Data
  sessions: NativeSession[];
  activeSessionId: string | null;
  messages: Record<string, NativeMessage[]>; // keyed by sessionId
  tools: Tool[];
  canvases: Record<string, Canvas>; // keyed by canvasId
  sessionCanvases: Record<string, string[]>; // sessionId -> canvasIds
  executionMode: RuntimeExecutionModeStatus | null;

  // Per-session streaming state (keyed by sessionId)
  streamingBySession: Record<string, StreamingState>;

  // Unread message counts for non-active sessions
  unreadCounts: Record<string, number>;

  // Part state: parts[sessionId][messageId] = Part[]
  parts: Record<string, Record<string, Record<string, unknown>[]>>;

  // Pending permission/question requests keyed by requestId
  pendingPermissions: Record<string, PendingPermissionRequest>;
  pendingQuestions: Record<string, PendingQuestionRequest>;

  // Surface-to-session mapping (replaces EmbeddedAgentSessionStore)
  sessionIdBySurface: Record<AgentModeSurface, string | null>;

  // UI State
  isLoadingSessions: boolean;
  isUpdatingSession: boolean;
  isLoadingMessages: boolean;
  isLoadingTools: boolean;
  isExecutingTool: boolean;
  isLoadingExecutionMode: boolean;
  isSavingExecutionMode: boolean;
  error: string | null;
  isSessionSyncConnected: boolean;
  sessionSyncError: string | null;

  // EventSource for SSE
  eventSource: EventSource | null;
}

interface NativeAgentActions {
  // Session CRUD
  fetchSessions: () => Promise<void>;
  createSession: (
    name?: string,
    description?: string,
    options?: CreateSessionInput,
  ) => Promise<NativeSession>;
  updateSession: (
    sessionId: string,
    updates: SessionUpdateInput,
  ) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  setActiveSession: (sessionId: string | null) => void;

  // Surface session mapping (replaces EmbeddedAgentSessionStore)
  setSurfaceSession: (surface: AgentModeSurface, sessionId: string | null) => void;
  clearSurfaceSession: (surface: AgentModeSurface) => void;
  clearAllSurfaceSessions: () => void;

  // Runtime execution mode
  fetchExecutionMode: () => Promise<void>;
  setExecutionMode: (mode: RuntimeExecutionMode) => Promise<void>;

  // Messages
  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (
    sessionId: string,
    content: string,
    role?: MessageRole,
  ) => Promise<void>;

  // Streaming chat
  sendMessageStream: (
    sessionId: string,
    content: string,
    onEvent?: (event: StreamEvent) => void,
  ) => Promise<void>;
  abortGeneration: (sessionId?: string) => Promise<void>;

  // Tools
  fetchTools: () => Promise<void>;
  executeTool: (
    sessionId: string,
    toolName: string,
    parameters: Record<string, unknown>,
  ) => Promise<ToolResult>;

  // Canvas
  createCanvas: (
    sessionId: string,
    content:
      | string
      | {
          type: Canvas["type"];
          title?: string;
          content?: string;
          language?: string;
        },
    type?: Canvas["type"],
    language?: string,
  ) => Promise<Canvas>;
  updateCanvas: (
    canvasId: string,
    updates: Partial<Omit<Canvas, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteCanvas: (canvasId: string) => Promise<void>;
  fetchSessionCanvases: (sessionId: string) => Promise<void>;

  // Event handling
  connectSessionSync: () => () => void;
  disconnectSessionSync: () => void;
  connectStream: (
    sessionId: string,
    onEvent?: (event: StreamEvent) => void,
  ) => () => void;
  disconnectStream: () => void;

  // Unread
  markSessionRead: (sessionId: string) => void;

  // Permissions
  replyPermission: (
    requestId: string,
    reply: "once" | "always" | "reject",
    message?: string,
  ) => Promise<void>;

  // Questions
  replyQuestion: (
    requestId: string,
    answers: Array<{ questionIndex: number; answer: string | string[] }>,
  ) => Promise<void>;
  rejectQuestion: (requestId: string) => Promise<void>;

  // UI actions
  clearError: () => void;
  clearMessages: (sessionId: string) => void;
  resetStreaming: (sessionId?: string) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useNativeAgentStore = create<
  NativeAgentState & NativeAgentActions
>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        sessions: [],
        activeSessionId: null,
        messages: {},
        tools: [],
        canvases: {},
        sessionCanvases: {},
        executionMode: null,
        streamingBySession: {},
        unreadCounts: {},
        sessionIdBySurface: { chat: null, cowork: null, code: null, browser: null },
        parts: {},
        pendingPermissions: {},
        pendingQuestions: {},
        isLoadingSessions: false,
        isUpdatingSession: false,
        isLoadingMessages: false,
        isLoadingTools: false,
        isExecutingTool: false,
        isLoadingExecutionMode: false,
        isSavingExecutionMode: false,
        error: null,
        isSessionSyncConnected: false,
        sessionSyncError: null,
        eventSource: null,

        // ----------------------------------------------------------------------
        // Session CRUD
        // ----------------------------------------------------------------------

        fetchSessions: async () => {
          // Guard against recursive calls
          const state = get();
          if (state.isLoadingSessions) return;
          
          set({ isLoadingSessions: true, error: null });
          try {
            const backendSessions =
              await nativeAgentApi.sessions.listSessions();
            const sessions = sortSessions(
              backendSessions.map(transformBackendSession),
            );
            // Do NOT rebuild sessionIdBySurface here. It is managed exclusively
            // by setSurfaceSession / clearSurfaceSession (user-driven actions) and
            // is persisted to localStorage. Rebuilding from session metadata would
            // undo explicit clears (e.g. "New Chat") on every fetch.
            set({ sessions, isLoadingSessions: false });
          } catch (err) {
            const errorMsg =
              isNetworkRequestError(err)
                ? "Agent services are unreachable right now. Cached sessions and local drafts stay available until sync returns."
                : err instanceof Error
                  ? err.message
                  : "Failed to fetch sessions";
            set((state) => ({
              error: errorMsg,
              isLoadingSessions: false,
              sessions: sortSessions(state.sessions),
            }));
          }
        },

        createSession: async (name, description, options = {}) => {
          set({ error: null });
          const request: CreateNativeAgentSessionRequest = {
            name,
            description,
            agentId: options.agentId,
            agentName: options.agentName,
            model: options.runtimeModel,
            tags: options.tags,
            // Send agent session fields directly for proper backend persistence
            origin_surface: options.originSurface,
            session_mode: options.sessionMode,
            project_id: options.projectId,
            workspace_scope: options.workspaceScope,
            agent_features: options.agentFeatures,
            // Also include in metadata for backwards compatibility
            metadata: buildAgentSessionMetadata({
              originSurface: options.originSurface,
              sessionMode: options.sessionMode,
              agentId: options.agentId,
              agentName: options.agentName,
              projectId: options.projectId,
              workspaceScope: options.workspaceScope,
              runtimeModel: options.runtimeModel,
              agentFeatures: options.agentFeatures,
              metadata: options.metadata,
            }),
          };

          try {
            const backendSession =
              await nativeAgentApi.sessions.createSession(request);
            const session = transformBackendSession(backendSession);
            const surface = options.originSurface as AgentModeSurface | undefined;
            set((state) => ({
              sessions: upsertSession(state.sessions, session),
              activeSessionId: session.id,
              sessionIdBySurface: surface
                ? { ...state.sessionIdBySurface, [surface]: session.id }
                : state.sessionIdBySurface,
            }));
            return session;
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "Failed to create session";
            set({ error: errorMsg });
            throw err;
          }
        },

        updateSession: async (sessionId, updates) => {
          set({ error: null, isUpdatingSession: true });
          try {
            const backendSession = await nativeAgentApi.sessions.updateSession(
              sessionId,
              {
                name: updates.name,
                description: updates.description,
                active: updates.isActive,
                tags: updates.tags,
                metadata: updates.metadata,
                // Send agent session fields directly for proper backend persistence
                origin_surface: (updates.metadata?.['a2r_origin_surface'] as any) || undefined,
                session_mode: (updates.metadata?.['a2r_session_mode'] as any) || undefined,
                project_id: (updates.metadata?.['a2r_project_id'] as any) || undefined,
                workspace_scope: (updates.metadata?.['a2r_workspace_scope'] as any) || undefined,
                agent_features: (updates.metadata?.['a2r_agent_features'] as any) || undefined,
              },
            );
            const updated = transformBackendSession(backendSession);
            set((state) => ({
              sessions: upsertSession(state.sessions, updated),
              isUpdatingSession: false,
            }));
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "Failed to update session";
            set({ error: errorMsg, isUpdatingSession: false });
            throw err;
          }
        },

        deleteSession: async (sessionId) => {
          console.log('[NativeAgentStore] deleteSession called:', sessionId);
          set({ error: null });
          try {
            await nativeAgentApi.sessions.deleteSession(sessionId);
            console.log('[NativeAgentStore] API delete successful:', sessionId);
            set((state) => {
              const newMessages = { ...state.messages };
              delete newMessages[sessionId];
              const newSessionCanvases = { ...state.sessionCanvases };
              delete newSessionCanvases[sessionId];

              return {
                sessions: state.sessions.filter((s) => s.id !== sessionId),
                messages: newMessages,
                sessionCanvases: newSessionCanvases,
                activeSessionId:
                  state.activeSessionId === sessionId
                    ? null
                    : state.activeSessionId,
              };
            });
            console.log('[NativeAgentStore] State updated after delete:', sessionId);
          } catch (err) {
            console.error('[NativeAgentStore] Delete failed:', sessionId, err);
            const errorMsg =
              err instanceof Error ? err.message : "Failed to delete session";
            set({ error: errorMsg });
            throw err;
          }
        },

        setActiveSession: (sessionId) => {
          if (get().activeSessionId === sessionId) {
            return;
          }

          set((state) => ({
            activeSessionId: sessionId,
            unreadCounts: sessionId
              ? { ...state.unreadCounts, [sessionId]: 0 }
              : state.unreadCounts,
          }));
          if (sessionId) {
            void get().fetchMessages(sessionId);
            void get().fetchSessionCanvases(sessionId);
          }
        },

        setSurfaceSession: (surface, sessionId) =>
          set((state) => ({
            sessionIdBySurface: { ...state.sessionIdBySurface, [surface]: sessionId },
          })),

        clearSurfaceSession: (surface) =>
          set((state) => ({
            sessionIdBySurface: { ...state.sessionIdBySurface, [surface]: null },
          })),

        clearAllSurfaceSessions: () =>
          set({ sessionIdBySurface: { chat: null, cowork: null, code: null, browser: null } }),

        fetchExecutionMode: async () => {
          set({ error: null, isLoadingExecutionMode: true });
          try {
            const executionMode = transformExecutionMode(
              await nativeAgentApi.runtime.getExecutionMode(),
            );
            set({
              executionMode,
              isLoadingExecutionMode: false,
            });
          } catch (err) {
            set({
              executionMode: null,
              isLoadingExecutionMode: false,
            });
          }
        },

        setExecutionMode: async (mode) => {
          set({ error: null, isSavingExecutionMode: true });
          try {
            const executionMode = transformExecutionMode(
              await nativeAgentApi.runtime.setExecutionMode(mode),
            );
            set({
              executionMode,
              isSavingExecutionMode: false,
            });
          } catch (err) {
            const errorMsg =
              err instanceof Error
                ? err.message
                : "Failed to update execution mode";
            set({
              error: errorMsg,
              isSavingExecutionMode: false,
            });
            throw err;
          }
        },

        // ----------------------------------------------------------------------
        // Messages
        // ----------------------------------------------------------------------

        fetchMessages: async (sessionId) => {
          set({ isLoadingMessages: true, error: null });
          try {
            const backendMessages =
              await nativeAgentApi.sessions.listMessages(sessionId);

            set((state) => {
              const existingMsgs = state.messages[sessionId] ?? [];

              // Gizzi's /messages endpoint stores assistant messages with parts:[]
              // (no text content) because it doesn't capture the streaming response
              // body. Any message marked "[No text content]" is a stale server stub.
              // If the server data would drop messages that we have real content for
              // in-memory (e.g. sent via sendMessageStream), keep the in-memory version.
              // Don't overwrite in-memory messages when a stream is actively writing
              // to this session. The stream will provide the authoritative content.
              if (state.streamingBySession[sessionId]?.isStreaming && existingMsgs.length > 0) {
                return { isLoadingMessages: false };
              }

              const validMessages = backendMessages.filter(
                (m) => m.content !== "[No text content]"
              );

              // Backend returned nothing but we have optimistic in-memory messages
              // (e.g. a new session where the message was just sent). Keep in-memory.
              if (backendMessages.length === 0 && existingMsgs.length > 0) {
                return { isLoadingMessages: false };
              }

              if (validMessages.length < backendMessages.length && existingMsgs.length > 0) {
                // Some messages were filtered (gizzi stubs). Keep in-memory version
                // because it has the real streamed content.
                return { isLoadingMessages: false };
              }

              // Merge thinking content from in-memory messages — the backend doesn't
              // persist reasoning/thinking blocks, so we preserve them from the
              // live-stream in-memory state by ID.
              const existingById = new Map(existingMsgs.map((m) => [m.id, m]));
              return {
                messages: {
                  ...state.messages,
                  [sessionId]: validMessages.map((m) => {
                    const transformed = transformBackendMessage(m);
                    const existing = existingById.get(transformed.id);
                    return existing?.thinking
                      ? { ...transformed, thinking: existing.thinking }
                      : transformed;
                  }),
                },
                isLoadingMessages: false,
              };
            });
          } catch (err) {
            set({ isLoadingMessages: false });
            // Don't re-throw - let the caller handle errors gracefully
          }
        },

        sendMessage: async (sessionId, content, role = "user") => {
          set({ error: null });

          // Auto-title: capture state before adding this message.
          const isFirstUserMessage =
            role === "user" &&
            !(get().messages[sessionId]?.some((m) => m.role === "user"));
          const sessionBeforeSend = get().sessions.find(
            (s) => s.id === sessionId,
          );
          const needsAutoTitle =
            isFirstUserMessage &&
            AUTO_TITLE_SENTINELS.has(sessionBeforeSend?.name ?? "");

          const optimisticMessage: NativeMessage = {
            id: `temp-${Date.now()}`,
            role,
            content,
            timestamp: new Date().toISOString(),
          };

          try {
            // Optimistically add message to UI
            set((state) => ({
              messages: {
                ...state.messages,
                [sessionId]: [
                  ...(state.messages[sessionId] || []),
                  optimisticMessage,
                ],
              },
            }));

            const message = transformBackendMessage(
              await nativeAgentApi.sessions.sendMessage(sessionId, {
                role,
                text: content,
              }),
            );

            // Replace optimistic message with actual
            set((state) => ({
              messages: {
                ...state.messages,
                [sessionId]: state.messages[sessionId].map((m) =>
                  m.id === optimisticMessage.id ? message : m,
                ),
              },
            }));

            // Auto-title after first successful user message
            if (needsAutoTitle) {
              const title = deriveSessionTitle(content);
              if (title) {
                get()
                  .updateSession(sessionId, { name: title })
                  .catch((err) => {
                    set({
                      error:
                        err instanceof Error
                          ? err.message
                          : "Failed to auto-title session",
                    });
                  });
              }
            }
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "Failed to send message";
            set((state) => ({
              error: errorMsg,
              messages: {
                ...state.messages,
                [sessionId]: (state.messages[sessionId] || []).filter(
                  (message) => message.id !== optimisticMessage.id,
                ),
              },
            }));
            throw err;
          }
        },

        // ----------------------------------------------------------------------
        // Streaming Chat
        // ----------------------------------------------------------------------

        sendMessageStream: async (sessionId, content, onEvent) => {
          const sessionStreaming = get().streamingBySession[sessionId];
          if (sessionStreaming?.isStreaming) {
            throw new Error("Already streaming");
          }

          // Auto-title: capture state before adding this message.
          const isFirstUserMessage = !(
            get().messages[sessionId]?.some((m) => m.role === "user")
          );
          const sessionBeforeStream = get().sessions.find(
            (s) => s.id === sessionId,
          );
          const needsAutoTitle =
            isFirstUserMessage &&
            AUTO_TITLE_SENTINELS.has(sessionBeforeStream?.name ?? "");

          const abortController = new AbortController();
          set((state) => ({
            error: null,
            streamingBySession: {
              ...state.streamingBySession,
              [sessionId]: {
                isStreaming: true,
                currentMessageId: null,
                abortController,
                error: null,
                streamBuffer: "",
              },
            },
          }));

          // Add user message
          const userMessage: NativeMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content,
            timestamp: new Date().toISOString(),
          };

          set((state) => ({
            messages: {
              ...state.messages,
              [sessionId]: [...(state.messages[sessionId] || []), userMessage],
            },
          }));

          // Auto-title after adding user message
          if (needsAutoTitle) {
            const title = deriveSessionTitle(content);
            if (title) {
              get()
                .updateSession(sessionId, { name: title })
                .catch((err) => {
                  set({
                    error:
                      err instanceof Error
                        ? err.message
                        : "Failed to auto-title session",
                  });
                });
            }
          }

          let assistantMessageId: string | null = null;
          const assistantParts: string[] = [];
          const thinkingParts: string[] = [];

          try {
            const response = await fetch(`/api/agent-chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId: sessionId, message: content }),
              signal: abortController.signal,
            });

            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`,
              );
            }

            if (!response.body) {
              throw new Error("No response body");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Gizzi returns a single JSON object (not SSE). Detect and handle it:
                // format: {"data":{"info":{...},"parts":[{type:"text",text:"..."}]}}
                const trimmed = buffer.trimStart();
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                  try {
                    const gizziPayload = JSON.parse(buffer.trim()) as {
                      data?: { info?: unknown; parts?: Array<{ type?: string; text?: string }> };
                      info?: unknown;
                      parts?: Array<{ type?: string; text?: string }>;
                    };
                    const inner = gizziPayload?.data ?? gizziPayload;
                    if (inner && Array.isArray((inner as any).parts)) {
                      const parts = (inner as any).parts as Array<{ type?: string; text?: string }>;
                      const textContent = parts
                        .filter((p) => p.type === "text" && typeof p.text === "string")
                        .map((p) => p.text as string)
                        .join("");

                      // Check for gizzi-level error (e.g. ECONNRESET from the model API)
                      const gizziError = (inner as any)?.info?.error?.message as string | undefined;

                      if (textContent) {
                        // Prefer the message ID that SSE part_delta events already created
                        // (stored in streamingBySession.currentMessageId). This avoids
                        // creating a duplicate assistant message alongside the streamed one.
                        const sseMessageId = get().streamingBySession[sessionId]?.currentMessageId;
                        if (!assistantMessageId) {
                          if (sseMessageId) {
                            // SSE already streamed this message — update it with final content
                            assistantMessageId = sseMessageId;
                            set((state) => ({
                              messages: {
                                ...state.messages,
                                [sessionId]: state.messages[sessionId].map((m) =>
                                  m.id === sseMessageId ? { ...m, content: textContent } : m,
                                ),
                              },
                            }));
                          } else {
                            // SSE didn't deliver any deltas (fallback) — create message now
                            const newMessage: NativeMessage = {
                              id: `assistant-${Date.now()}`,
                              role: "assistant",
                              content: textContent,
                              timestamp: new Date().toISOString(),
                            };
                            assistantMessageId = newMessage.id;
                            set((state) => ({
                              messages: {
                                ...state.messages,
                                [sessionId]: [...(state.messages[sessionId] || []), newMessage],
                              },
                            }));
                          }
                        } else {
                          set((state) => ({
                            messages: {
                              ...state.messages,
                              [sessionId]: state.messages[sessionId].map((m) =>
                                m.id === assistantMessageId ? { ...m, content: textContent } : m,
                              ),
                            },
                          }));
                        }
                        buffer = "";
                      } else if (!textContent && gizziError) {
                        // Gizzi got an error from the model (e.g. connection reset).
                        // Surface it as an error message so the user knows what happened.
                        const errorMessage: NativeMessage = {
                          id: `error-${Date.now()}`,
                          role: "assistant",
                          content: `⚠️ ${gizziError}`,
                          timestamp: new Date().toISOString(),
                        };
                        set((state) => ({
                          error: gizziError,
                          messages: {
                            ...state.messages,
                            [sessionId]: [...(state.messages[sessionId] || []), errorMessage],
                          },
                          streamingBySession: {
                            ...state.streamingBySession,
                            [sessionId]: {
                              ...(state.streamingBySession[sessionId] ?? {}),
                              isStreaming: false,
                              error: gizziError,
                            } as StreamingState,
                          },
                        }));
                        buffer = "";
                      }
                    }
                  } catch {
                    // Not valid JSON yet — wait for more chunks
                  }
                }

                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                  if (!line.trim() || !line.startsWith("data: ")) continue;

                  const data = line.slice(6);
                  if (data === "[DONE]") continue;

                  try {
                    const rawEvent = JSON.parse(data) as {
                      type?: string;
                      messageId?: string;
                      delta?: {
                        text?: string;
                        content?: string;
                        thinking?: string;
                        type?: string;
                      };
                      tool_id?: string;
                      call_id?: string;
                      args?: Record<string, unknown>;
                      result?: unknown;
                      error?: string;
                      finishReason?: string;
                    };
                    const timestamp = new Date().toISOString();

                    const ensureAssistantMessage = () => {
                      if (!assistantMessageId) {
                        const newMessage: NativeMessage = {
                          id: rawEvent.messageId || `assistant-${Date.now()}`,
                          role: "assistant",
                          content: "",
                          timestamp,
                        };
                        assistantMessageId = newMessage.id;
                        set((state) => ({
                          messages: {
                            ...state.messages,
                            [sessionId]: [
                              ...(state.messages[sessionId] || []),
                              newMessage,
                            ],
                          },
                          streamingBySession: {
                            ...state.streamingBySession,
                            [sessionId]: {
                              ...(state.streamingBySession[sessionId] ?? {}),
                              currentMessageId: newMessage.id,
                            } as StreamingState,
                          },
                        }));
                      }
                    };

                    switch (rawEvent.type) {
                      case "message_start": {
                        ensureAssistantMessage();
                        onEvent?.({
                          type: "message_start",
                          sessionId,
                          messageId: assistantMessageId || undefined,
                          timestamp,
                        });
                        break;
                      }

                      case "content_block_delta": {
                        const deltaType = rawEvent.delta?.type;
                        const thinkingDelta = deltaType === "thinking_delta" ? rawEvent.delta?.thinking : undefined;
                        const textDelta = thinkingDelta
                          ? undefined
                          : (rawEvent.delta?.text || rawEvent.delta?.content);

                        if (thinkingDelta) {
                          ensureAssistantMessage();
                          thinkingParts.push(thinkingDelta);
                          const fullThinking = thinkingParts.join("");
                          set((state) => ({
                            messages: {
                              ...state.messages,
                              [sessionId]: state.messages[sessionId].map((m) =>
                                m.id === assistantMessageId
                                  ? { ...m, thinking: fullThinking }
                                  : m,
                              ),
                            },
                          }));
                        } else if (textDelta) {
                          ensureAssistantMessage();
                          assistantParts.push(textDelta);
                          const fullContent = assistantParts.join("");
                          onEvent?.({
                            type: "message_delta",
                            sessionId,
                            messageId: assistantMessageId || undefined,
                            delta: { content: textDelta },
                            timestamp,
                          });
                          set((state) => ({
                            messages: {
                              ...state.messages,
                              [sessionId]: state.messages[sessionId].map((m) =>
                                m.id === assistantMessageId
                                  ? { ...m, content: fullContent }
                                  : m,
                              ),
                            },
                            streamingBySession: {
                              ...state.streamingBySession,
                              [sessionId]: {
                                ...(state.streamingBySession[sessionId] ?? {}),
                                streamBuffer: fullContent,
                              } as StreamingState,
                            },
                          }));
                        }
                        break;
                      }

                      case "tool_call_start": {
                        ensureAssistantMessage();
                        const toolCall: ToolCall = {
                          id: rawEvent.call_id || `tool-${Date.now()}`,
                          name: rawEvent.tool_id || "tool",
                          arguments: rawEvent.args || {},
                        };
                        onEvent?.({
                          type: "tool_call",
                          sessionId,
                          toolCall,
                          timestamp,
                        });
                        if (assistantMessageId) {
                          set((state) => ({
                            messages: {
                              ...state.messages,
                              [sessionId]: state.messages[sessionId].map((m) =>
                                m.id === assistantMessageId
                                  ? {
                                      ...m,
                                      toolCalls: [
                                        ...(m.toolCalls || []),
                                        toolCall,
                                      ],
                                    }
                                  : m,
                              ),
                            },
                          }));
                        }
                        break;
                      }

                      case "tool_call_result": {
                        const toolResult: ToolResult = {
                          toolCallId: rawEvent.call_id || `tool-${Date.now()}`,
                          result: rawEvent.result,
                          error: rawEvent.error,
                        };
                        onEvent?.({
                          type: "tool_result",
                          sessionId,
                          toolResult,
                          timestamp,
                        });
                        if (rawEvent.result !== undefined || rawEvent.error) {
                          const toolResultMsg: NativeMessage = {
                            id: `tool-result-${Date.now()}`,
                            role: "tool",
                            content: JSON.stringify(
                              rawEvent.result ?? rawEvent.error ?? "",
                            ),
                            timestamp,
                            toolCallId: toolResult.toolCallId,
                          };
                          set((state) => ({
                            messages: {
                              ...state.messages,
                              [sessionId]: [
                                ...(state.messages[sessionId] || []),
                                toolResultMsg,
                              ],
                            },
                          }));
                        }
                        break;
                      }

                      case "finish": {
                        onEvent?.({
                          type: "done",
                          sessionId,
                          timestamp,
                        });
                        set((state) => ({
                          streamingBySession: {
                            ...state.streamingBySession,
                            [sessionId]: {
                              ...(state.streamingBySession[sessionId] ?? {}),
                              isStreaming: false,
                              currentMessageId: null,
                            } as StreamingState,
                          },
                        }));
                        break;
                      }

                      case "error": {
                        onEvent?.({
                          type: "error",
                          sessionId,
                          error: rawEvent.error || "Stream error",
                          timestamp,
                        });
                        set((state) => ({
                          error: rawEvent.error || "Stream error",
                          streamingBySession: {
                            ...state.streamingBySession,
                            [sessionId]: {
                              ...(state.streamingBySession[sessionId] ?? {}),
                              error: rawEvent.error || "Stream error",
                              isStreaming: false,
                            } as StreamingState,
                          },
                        }));
                        break;
                      }
                    }
                  } catch (parseError) {
                    console.error("Failed to parse SSE chunk:", data);
                  }
                }
              }
            } finally {
              reader.releaseLock();
            }

            set((state) => ({
              streamingBySession: {
                ...state.streamingBySession,
                [sessionId]: {
                  ...(state.streamingBySession[sessionId] ?? {}),
                  isStreaming: false,
                  currentMessageId: null,
                } as StreamingState,
              },
            }));
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
              // User aborted - not an error
              set((state) => ({
                streamingBySession: {
                  ...state.streamingBySession,
                  [sessionId]: {
                    ...(state.streamingBySession[sessionId] ?? {}),
                    isStreaming: false,
                  } as StreamingState,
                },
              }));
            } else {
              const errorMsg =
                err instanceof Error ? err.message : "Stream failed";
              set((state) => ({
                error: errorMsg,
                streamingBySession: {
                  ...state.streamingBySession,
                  [sessionId]: {
                    ...(state.streamingBySession[sessionId] ?? {}),
                    error: errorMsg,
                    isStreaming: false,
                  } as StreamingState,
                },
              }));
            }
          }
        },

        abortGeneration: async (sessionId) => {
          const targetSessionId = sessionId || get().activeSessionId;

          if (targetSessionId) {
            const sessionStream = get().streamingBySession[targetSessionId];
            if (sessionStream?.abortController) {
              sessionStream.abortController.abort();
            }
            set((state) => ({
              streamingBySession: {
                ...state.streamingBySession,
                [targetSessionId]: {
                  ...(state.streamingBySession[targetSessionId] ?? {}),
                  isStreaming: false,
                  abortController: null,
                } as StreamingState,
              },
            }));
          }

          // Notify server
          if (targetSessionId) {
            try {
              await nativeAgentApi.chat.abortGeneration(targetSessionId);
            } catch (err) {
              console.warn("Failed to abort on server:", err);
            }
          }
        },

        resetStreaming: (sessionId) => {
          if (sessionId) {
            const sessionStream = get().streamingBySession[sessionId];
            if (sessionStream?.abortController) {
              sessionStream.abortController.abort();
            }
            set((state) => ({
              streamingBySession: {
                ...state.streamingBySession,
                [sessionId]: {
                  isStreaming: false,
                  currentMessageId: null,
                  abortController: null,
                  error: null,
                  streamBuffer: "",
                },
              },
            }));
          } else {
            const { streamingBySession } = get();
            for (const stream of Object.values(streamingBySession)) {
              stream.abortController?.abort();
            }
            set({ streamingBySession: {} });
          }
        },

        // ----------------------------------------------------------------------
        // Tools
        // ----------------------------------------------------------------------

        fetchTools: async () => {
          set({ isLoadingTools: true, error: null });
          try {
            const backendTools = await nativeAgentApi.tools.listTools();
            const combinedTools = backendTools.map((tool) => ({
              id: String(tool.id || tool.name || "tool"),
              name: String(tool.name || tool.id || "tool"),
              description: String(tool.description || ""),
              parameters: tool.parameters || {},
              isEnabled: true,
              category: undefined,
            }));

            set({ tools: combinedTools, isLoadingTools: false });
          } catch (err) {
            set({ isLoadingTools: false });
          }
        },

        executeTool: async (sessionId, toolName, parameters) => {
          const toolCallId = `tool-${Date.now()}`;
          set({ isExecutingTool: true, error: null });
          
          try {
            // Create tool context
            const context = {
              toolName,
              toolCallId,
              sessionId,
              arguments: parameters,
              timestamp: new Date().toISOString(),
            };

            // Check tool registry for confirmation requirement
            const toolRegistry = useToolRegistryStore.getState();
            const tool = toolRegistry.tools[toolName];
            const sessionConfig = toolRegistry.sessionConfigs[sessionId];
            const requiresConfirmation = sessionConfig
              ? sessionConfig.requireConfirmationFor.includes(toolName)
              : tool?.requiresConfirmation;

            // Register confirmation hook if needed
            if (requiresConfirmation) {
              const hooksStore = useToolHooksStore.getState();
              const confirmationHook = createConfirmationHook(
                (name) => name === toolName
              );
              hooksStore.registerPreToolUse(`confirm-${toolName}`, confirmationHook);
            }

            // Route through tool hooks
            const hooksStore = useToolHooksStore.getState();
            const routingResult = await hooksStore.routeToolUse(context);

            if (routingResult.decision === "deny") {
              const error = routingResult.reason || "Tool execution denied";
              hooksStore.logToolExecution({
                toolName,
                sessionId,
                toolCallId,
                arguments: parameters,
                status: "denied",
                requestedAt: context.timestamp,
                error,
              });
              set({ isExecutingTool: false });
              return { toolCallId, result: null, error };
            }

            // Use modified args if provided
            const finalArgs = routingResult.modifiedArgs || parameters;

            // Log execution start
            hooksStore.logToolExecution({
              toolName,
              sessionId,
              toolCallId,
              arguments: finalArgs,
              status: "executing",
              requestedAt: context.timestamp,
              confirmedAt: routingResult.decision === "allow" ? new Date().toISOString() : undefined,
            });

            // Execute the tool
            let result: { result: unknown; error?: string };

            if (isLocalToolRegistered(toolName)) {
              result = await executeLocalTool(
                toolName,
                { sessionId, toolCallId },
                finalArgs
              );
            } else {
              result = await nativeAgentApi.tools.executeTool(
                sessionId,
                toolName,
                finalArgs,
              );
            }

            // Execute post-tool hooks
            await hooksStore.executePostToolHooks(context, result.result, result.error);

            // Update execution log
            hooksStore.updateToolExecution(toolCallId, {
              status: result.error ? "failed" : "completed",
              completedAt: new Date().toISOString(),
              result: result.result,
              error: result.error,
            });

            set({ isExecutingTool: false });
            return {
              toolCallId,
              result: result.result,
              error: result.error,
            };
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "Tool execution failed";
            set({ error: errorMsg, isExecutingTool: false });
            throw err;
          }
        },

        // ----------------------------------------------------------------------
        // Canvas
        // ----------------------------------------------------------------------

        createCanvas: async (sessionId, contentOrOptions, type?, language?) => {
          set({ error: null });
          try {
            // Handle both signatures:
            // 1. createCanvas(sessionId, content, type, language)
            // 2. createCanvas(sessionId, { type, title, content, language })
            let content: string;
            let canvasType: Canvas["type"];
            let canvasLanguage: string | undefined;
            let title: string | undefined;

            if (typeof contentOrOptions === "string") {
              content = contentOrOptions;
              canvasType = type!;
              canvasLanguage = language;
            } else {
              content = contentOrOptions.content ?? "";
              canvasType = contentOrOptions.type;
              canvasLanguage = contentOrOptions.language;
              title = contentOrOptions.title;
            }

            const finalCanvas: Canvas = {
              id: `canvas-${Date.now()}`,
              sessionId,
              content,
              type: canvasType,
              title,
              language: canvasLanguage,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              metadata: {},
            };
            set((state) => ({
              canvases: { ...state.canvases, [finalCanvas.id]: finalCanvas },
              sessionCanvases: {
                ...state.sessionCanvases,
                [sessionId]: [
                  ...(state.sessionCanvases[sessionId] || []),
                  finalCanvas.id,
                ],
              },
            }));
            return finalCanvas;
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "Failed to create canvas";
            set({ error: errorMsg });
            throw err;
          }
        },

        updateCanvas: async (canvasId, updates) => {
          set({ error: null });
          try {
            set((state) => ({
              canvases: {
                ...state.canvases,
                [canvasId]: {
                  ...state.canvases[canvasId],
                  ...updates,
                  updatedAt: new Date().toISOString(),
                },
              },
            }));
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "Failed to update canvas";
            set({ error: errorMsg });
            throw err;
          }
        },

        deleteCanvas: async (canvasId) => {
          set({ error: null });
          try {
            set((state) => {
              const newCanvases = { ...state.canvases };
              const canvas = newCanvases[canvasId];
              delete newCanvases[canvasId];

              // Remove from session canvases
              const newSessionCanvases = { ...state.sessionCanvases };
              if (canvas?.sessionId) {
                newSessionCanvases[canvas.sessionId] = (
                  newSessionCanvases[canvas.sessionId] || []
                ).filter((id) => id !== canvasId);
              }

              return {
                canvases: newCanvases,
                sessionCanvases: newSessionCanvases,
              };
            });
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "Failed to delete canvas";
            set({ error: errorMsg });
            throw err;
          }
        },

        fetchSessionCanvases: async (sessionId) => {
          try {
            set((state) => ({
              sessionCanvases: {
                ...state.sessionCanvases,
                [sessionId]: state.sessionCanvases[sessionId] || [],
              },
            }));
          } catch (err) {
            console.warn("Failed to fetch canvases:", err);
          }
        },

        // ----------------------------------------------------------------------
        // Event Handling (SSE via EventSource)
        // ----------------------------------------------------------------------

        connectSessionSync: () => {
          get().disconnectSessionSync();

          let cancelled = false;
          let retryDelay = 1000; // ms — grows to max 30s
          const MAX_RETRY_DELAY = 30_000;

          function connect() {
            if (cancelled) return;

            const eventSource = nativeAgentApi.sessions.createSyncSource();

            eventSource.onopen = () => {
              retryDelay = 1000; // reset on successful connection
              set({
                eventSource,
                isSessionSyncConnected: true,
                sessionSyncError: null,
              });
              // Refresh sessions when SSE connects — ensures we have a current
              // snapshot even if the initial fetchSessions() fired before gizzi
              // was ready (common in Electron where the app loads in parallel
              // with the backend startup).
              void get().fetchSessions().catch(() => {});
            };

            eventSource.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data) as SessionSyncEvent;
                set((state) => applySessionSyncEvent(state, data));
              } catch {
                // Ignore unparseable frames — do not drop the connection
              }
            };

            eventSource.onerror = () => {
              eventSource.close();
              set({
                eventSource: null,
                isSessionSyncConnected: false,
                sessionSyncError: "Session sync disconnected — retrying…",
              });
              if (!cancelled) {
                setTimeout(() => {
                  retryDelay = Math.min(retryDelay * 1.5, MAX_RETRY_DELAY);
                  connect();
                }, retryDelay);
              }
            };

            set({
              eventSource,
              isSessionSyncConnected: false,
              sessionSyncError: null,
            });
          }

          connect();

          return () => {
            cancelled = true;
            get().disconnectSessionSync();
          };
        },

        disconnectSessionSync: () => {
          const { eventSource } = get();
          if (eventSource) {
            eventSource.close();
          }

          set({
            eventSource: null,
            isSessionSyncConnected: false,
          });
        },

        connectStream: (_sessionId, _onEvent) => {
          console.warn(
            "[NativeAgentStore] connectStream is deprecated, use connectSessionSync or sendMessageStream instead",
          );
          return get().connectSessionSync();
        },

        disconnectStream: () => {
          get().disconnectSessionSync();
        },

        // ----------------------------------------------------------------------
        // UI Actions
        // ----------------------------------------------------------------------

        markSessionRead: (sessionId) => {
          set((state) => ({
            unreadCounts: { ...state.unreadCounts, [sessionId]: 0 },
          }));
        },

        replyPermission: async (requestId, reply, message) => {
          await nativeAgentApi.permissions.replyPermission(requestId, reply, message);
          set((state) => {
            const next = { ...state.pendingPermissions };
            delete next[requestId];
            return { pendingPermissions: next };
          });
        },

        replyQuestion: async (requestId, answers) => {
          await nativeAgentApi.questions.replyQuestion(requestId, answers);
          set((state) => {
            const next = { ...state.pendingQuestions };
            delete next[requestId];
            return { pendingQuestions: next };
          });
        },

        rejectQuestion: async (requestId) => {
          await nativeAgentApi.questions.rejectQuestion(requestId);
          set((state) => {
            const next = { ...state.pendingQuestions };
            delete next[requestId];
            return { pendingQuestions: next };
          });
        },

        clearError: () => set({ error: null }),

        clearMessages: (sessionId) => {
          set((state) => {
            const newMessages = { ...state.messages };
            delete newMessages[sessionId];
            return { messages: newMessages };
          });
        },
      }),
      {
        name: "native-agent-storage-v2",
        partialize: (state) => ({
          sessions: state.sessions,
          activeSessionId: state.activeSessionId,
          messages: state.messages,
          canvases: state.canvases,
          sessionCanvases: state.sessionCanvases,
          unreadCounts: state.unreadCounts,
          sessionIdBySurface: state.sessionIdBySurface,
        }),
      },
    ),
    { name: "native-agent-store-v2" },
  ),
);

// ============================================================================
// Selectors
// ============================================================================

export const selectActiveSession = (
  state: NativeAgentState & NativeAgentActions,
): NativeSession | null => {
  const { sessions, activeSessionId } = state;
  return sessions.find((s) => s.id === activeSessionId) || null;
};

export const selectActiveMessages = (
  state: NativeAgentState & NativeAgentActions,
): NativeMessage[] => {
  const { messages, activeSessionId } = state;
  return activeSessionId ? messages[activeSessionId] || [] : [];
};

export const selectSessionCanvases = (
  state: NativeAgentState & NativeAgentActions,
  sessionId: string,
): Canvas[] => {
  const { canvases, sessionCanvases } = state;
  const canvasIds = sessionCanvases[sessionId] || [];
  return canvasIds.map((id) => canvases[id]).filter(Boolean);
};

export const selectIsSessionStreaming = (
  state: NativeAgentState & NativeAgentActions,
  sessionId: string,
): boolean => {
  return state.streamingBySession[sessionId]?.isStreaming ?? false;
};

export const selectSessionStreamingError = (
  state: NativeAgentState & NativeAgentActions,
  sessionId: string,
): string | null => {
  return state.streamingBySession[sessionId]?.error ?? null;
};

export const selectSessionSyncState = (
  state: NativeAgentState & NativeAgentActions,
): { isConnected: boolean; error: string | null } => ({
  isConnected: state.isSessionSyncConnected,
  error: state.sessionSyncError,
});

export const selectExecutionModeState = (
  state: NativeAgentState & NativeAgentActions,
): {
  executionMode: RuntimeExecutionModeStatus | null;
  isLoading: boolean;
  isSaving: boolean;
} => ({
  executionMode: state.executionMode,
  isLoading: state.isLoadingExecutionMode,
  isSaving: state.isSavingExecutionMode,
});

// ============================================================================
// Hooks
// ============================================================================

export function useActiveSession(): NativeSession | null {
  return useNativeAgentStore(selectActiveSession);
}

export function useActiveMessages(): NativeMessage[] {
  return useNativeAgentStore(selectActiveMessages);
}

export function useSessionCanvases(sessionId: string): Canvas[] {
  return useNativeAgentStore((state) =>
    selectSessionCanvases(state, sessionId),
  );
}

export function useSessionStreamingState(sessionId: string): {
  isStreaming: boolean;
  error: string | null;
  buffer: string;
} {
  return useNativeAgentStore((state) => {
    const s = state.streamingBySession[sessionId];
    return {
      isStreaming: s?.isStreaming ?? false,
      error: s?.error ?? null,
      buffer: s?.streamBuffer ?? "",
    };
  });
}

export function useSessionSyncState(): {
  isConnected: boolean;
  error: string | null;
} {
  return useNativeAgentStore(selectSessionSyncState);
}

export function useExecutionModeState(): {
  executionMode: RuntimeExecutionModeStatus | null;
  isLoading: boolean;
  isSaving: boolean;
} {
  return useNativeAgentStore(selectExecutionModeState);
}

export default useNativeAgentStore;
