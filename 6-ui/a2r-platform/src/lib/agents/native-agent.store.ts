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

const APP_API_BASE = API_BASE_URL.replace(/\/api\/v1$/i, "");

// ============================================================================
// Types
// ============================================================================

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface NativeMessage {
  id: string;
  role: MessageRole;
  content: string;
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
const LOCAL_DRAFT_SESSION_SOURCE = "local-draft";

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

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function isLocalDraftSession(
  session?: Pick<NativeSession, "metadata"> | null,
): boolean {
  return session?.metadata?.[LOCAL_DRAFT_SESSION_FLAG] === true;
}

function buildLocalDraftSession(
  name?: string,
  description?: string,
  options: Pick<CreateSessionInput, "metadata" | "tags"> = {},
): NativeSession {
  const now = new Date().toISOString();

  return {
    id: `local-session-${Date.now()}`,
    name: normalizeOptionalText(name) ?? "Agent Session",
    description: normalizeOptionalText(description),
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
    messageCount: 0,
    isActive: true,
    tags: options.tags ?? [],
    metadata: {
      ...(options.metadata ?? {}),
      [LOCAL_DRAFT_SESSION_FLAG]: true,
      sync_state: LOCAL_DRAFT_SESSION_SOURCE,
    },
  };
}

function applyLocalSessionUpdates(
  session: NativeSession,
  updates: SessionUpdateInput,
): NativeSession {
  const nextMetadata =
    updates.metadata === undefined
      ? session.metadata
      : {
          ...(session.metadata ?? {}),
          ...updates.metadata,
          [LOCAL_DRAFT_SESSION_FLAG]: true,
          sync_state: LOCAL_DRAFT_SESSION_SOURCE,
        };

  return {
    ...session,
    name:
      updates.name === undefined
        ? session.name
        : normalizeOptionalText(updates.name),
    description:
      updates.description === undefined
        ? session.description
        : normalizeOptionalText(updates.description),
    isActive: updates.isActive ?? session.isActive,
    tags: updates.tags ?? session.tags,
    metadata: nextMetadata,
    updatedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
  };
}

function appendLocalDraftMessages(
  session: NativeSession,
  existingMessages: NativeMessage[],
  content: string,
): { messages: NativeMessage[]; session: NativeSession } {
  const timestamp = new Date().toISOString();
  const userMessage: NativeMessage = {
    id: `local-user-${Date.now()}`,
    role: "user",
    content,
    timestamp,
  };
  const assistantMessage: NativeMessage = {
    id: `local-assistant-${Date.now() + 1}`,
    role: "assistant",
    content:
      "Agent services are offline, so this session is running as a local draft. You can keep the brief, notes, and canvases here until the runtime reconnects.",
    timestamp,
    metadata: {
      [LOCAL_DRAFT_SESSION_FLAG]: true,
    },
  };

  return {
    messages: [...existingMessages, userMessage, assistantMessage],
    session: {
      ...session,
      messageCount: existingMessages.length + 2,
      updatedAt: timestamp,
      lastAccessedAt: timestamp,
    },
  };
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
  if (messages.some((message) => message.id === nextMessage.id)) {
    return messages;
  }

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

  return {
    sessions: sortSessions(
      state.sessions.map((session) =>
        session.id === event.session_id
          ? {
              ...session,
              messageCount: existingMessages.some(
                (message) => message.id === nextMessage.id,
              )
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
  };
}

function applySessionSyncEvent(
  state: NativeAgentState & NativeAgentActions,
  event: SessionSyncEvent,
): Partial<NativeAgentState> {
  switch (event.type) {
    case "created":
      return {
        sessions: upsertSession(
          state.sessions,
          transformSessionSnapshot(event),
        ),
      };

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

  // Streaming state
  streaming: StreamingState;

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

  // UI actions
  clearError: () => void;
  clearMessages: (sessionId: string) => void;
  resetStreaming: () => void;
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
        streaming: {
          isStreaming: false,
          currentMessageId: null,
          abortController: null,
          error: null,
          streamBuffer: "",
        },
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
          set({ isLoadingSessions: true, error: null });
          try {
            const backendSessions =
              await nativeAgentApi.sessions.listSessions();
            const sessions = sortSessions(
              backendSessions.map(transformBackendSession),
            );
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
            set((state) => ({
              sessions: upsertSession(state.sessions, session),
              activeSessionId: session.id,
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
          set({ error: null });
          try {
            await nativeAgentApi.sessions.deleteSession(sessionId);
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
          } catch (err) {
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

          set({ activeSessionId: sessionId });
          if (sessionId) {
            void get().fetchMessages(sessionId);
            void get().fetchSessionCanvases(sessionId);
          }
        },

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

            set((state) => ({
              messages: {
                ...state.messages,
                [sessionId]: backendMessages.map(transformBackendMessage),
              },
              isLoadingMessages: false,
            }));
          } catch (err) {
            set({ isLoadingMessages: false });
            // Don't re-throw - let the caller handle errors gracefully
          }
        },

        sendMessage: async (sessionId, content, role = "user") => {
          set({ error: null });
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
          const { isStreaming } = get().streaming;
          if (isStreaming) {
            throw new Error("Already streaming");
          }

          set({
            error: null,
            streaming: {
              isStreaming: true,
              currentMessageId: null,
              abortController: new AbortController(),
              error: null,
              streamBuffer: "",
            },
          });

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

          const abortController = get().streaming.abortController;
          if (!abortController) throw new Error("No abort controller");

          let assistantMessageId: string | null = null;
          const assistantParts: string[] = [];

          try {
            const response = await fetch(`${APP_API_BASE}/api/agent-chat`, {
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
                          streaming: {
                            ...state.streaming,
                            currentMessageId: newMessage.id,
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
                        const textDelta =
                          rawEvent.delta?.text || rawEvent.delta?.content;
                        if (textDelta) {
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
                            streaming: {
                              ...state.streaming,
                              streamBuffer: fullContent,
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
                          streaming: {
                            ...state.streaming,
                            isStreaming: false,
                            currentMessageId: null,
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
                          streaming: {
                            ...state.streaming,
                            error: rawEvent.error || "Stream error",
                            isStreaming: false,
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
              streaming: {
                ...state.streaming,
                isStreaming: false,
                currentMessageId: null,
              },
            }));
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
              // User aborted - not an error
              set((state) => ({
                streaming: {
                  ...state.streaming,
                  isStreaming: false,
                },
              }));
            } else {
              const errorMsg =
                err instanceof Error ? err.message : "Stream failed";
              set((state) => ({
                error: errorMsg,
                streaming: {
                  ...state.streaming,
                  error: errorMsg,
                  isStreaming: false,
                },
              }));
            }
          }
        },

        abortGeneration: async (sessionId) => {
          const targetSessionId = sessionId || get().activeSessionId;

          // Abort local stream
          const { streaming } = get();
          if (streaming.abortController) {
            streaming.abortController.abort();
          }

          set((state) => ({
            streaming: {
              ...state.streaming,
              isStreaming: false,
              abortController: null,
            },
          }));

          // Notify server
          if (targetSessionId) {
            try {
              await nativeAgentApi.chat.abortGeneration(targetSessionId);
            } catch (err) {
              console.warn("Failed to abort on server:", err);
            }
          }
        },

        resetStreaming: () => {
          const { streaming } = get();
          if (streaming.abortController) {
            streaming.abortController.abort();
          }
          set({
            streaming: {
              isStreaming: false,
              currentMessageId: null,
              abortController: null,
              error: null,
              streamBuffer: "",
            },
          });
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

          const eventSource = nativeAgentApi.sessions.createSyncSource();

          eventSource.onopen = () => {
            set({
              eventSource,
              isSessionSyncConnected: true,
              sessionSyncError: null,
            });
          };

          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data) as SessionSyncEvent;
              set((state) => applySessionSyncEvent(state, data));
            } catch (error) {
              set({
                isSessionSyncConnected: false,
                sessionSyncError: "Failed to parse session sync payload",
              });
            }
          };

          eventSource.onerror = () => {
            set({
              isSessionSyncConnected: false,
              sessionSyncError: "Session sync disconnected",
            });
          };

          set({
            eventSource,
            isSessionSyncConnected: false,
            sessionSyncError: null,
          });

          return () => {
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

export const selectIsStreaming = (
  state: NativeAgentState & NativeAgentActions,
): boolean => {
  return state.streaming.isStreaming;
};

export const selectStreamingError = (
  state: NativeAgentState & NativeAgentActions,
): string | null => {
  return state.streaming.error;
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

export function useStreamingState(): {
  isStreaming: boolean;
  error: string | null;
  buffer: string;
} {
  return useNativeAgentStore((state) => ({
    isStreaming: state.streaming.isStreaming,
    error: state.streaming.error,
    buffer: state.streaming.streamBuffer,
  }));
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
