/**
 * N20 Native Agent API Client
 *
 * This module provides the API client layer that maps frontend data models
 * to the Rust backend API endpoints. It handles:
 * - URL construction for agent API routes
 * - Request/response transformation between frontend and backend formats
 * - Error handling and type safety
 *
 * Backend API Base: /api/v1/agent-sessions for native agent session state,
 * /api/v1/tools for tool execution, and /api for chat streaming
 *
 * @module native-agent-api
 * @version 1.0.0
 */

// ============================================================================
// API Configuration
// ============================================================================

const API_V1_BASE = "/api/v1";
const AGENT_SESSION_API_BASE = `${API_V1_BASE}/agent-sessions`;
const TOOLS_API_BASE = API_V1_BASE;
const RUNTIME_API_BASE = API_V1_BASE;
const APP_API_BASE = "";

// ============================================================================
// Types - Backend API Response Shapes
// ============================================================================

/** Agent context passed through to the backend with each message */
export interface AgentContext {
  agentId?: string;
  systemPrompt?: string;
  identityContext?: {
    trustTiers?: string[];
    agentName?: string;
  };
  governanceContext?: {
    workspaceFiles?: string[];
  };
  [key: string]: unknown;
}

/** Backend Session Response */
export interface BackendSession {
  id: string;
  name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  last_accessed?: string;
  message_count: number;
  active?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface BackendMessage {
  id: string;
  role: string;
  content: string;
  thinking?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface BackendSessionSnapshot {
  id: string;
  name?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
  last_accessed: string;
  message_count: number;
  active: boolean;
  tags: string[];
  metadata?: Record<string, unknown>;
}

interface BackendSessionPayload {
  id: string;
  name?: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  last_accessed?: string;
  message_count?: number;
  active?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface BackendSessionListResponse {
  sessions: BackendSession[];
  count: number;
}

export interface CreateNativeAgentSessionRequest {
  name?: string;
  description?: string;
  agentId?: string;
  agentName?: string;
  model?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  /** Origin surface (chat, cowork, code, browser) */
  origin_surface?: "chat" | "cowork" | "code" | "browser";
  /** Session mode (regular or agent) */
  session_mode?: "regular" | "agent";
  /** Project identifier */
  project_id?: string;
  /** Workspace scope path */
  workspace_scope?: string;
  /** Agent-specific features */
  agent_features?: {
    workspace?: boolean;
    tools?: boolean;
    automation?: boolean;
  };
}

export interface SessionCreatedEvent extends BackendSessionSnapshot {
  type: "created";
}

export interface SessionUpdatedEvent {
  type: "updated";
  session_id: string;
  name?: string | null;
  description?: string | null;
  active?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SessionDeletedEvent {
  type: "deleted";
  session_id: string;
}

export interface SessionMessageAddedEvent extends BackendMessage {
  type: "message_added";
  session_id: string;
}

export interface SessionStatusChangedEvent {
  type: "status_changed";
  session_id: string;
  active: boolean;
}

export interface SessionPartUpdatedEvent {
  type: "part_updated";
  session_id: string;
  message_id: string;
  part: Record<string, unknown>;
}

export interface SessionPartDeltaEvent {
  type: "part_delta";
  session_id: string;
  message_id: string;
  part_id: string;
  field: string;
  delta: string;
}

export interface SessionPartRemovedEvent {
  type: "part_removed";
  session_id: string;
  message_id: string;
  part_id: string;
}

export interface SessionPermissionAskedEvent {
  type: "permission_asked";
  request_id: string;
  session_id: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: { messageID: string; callID: string };
}

export interface SessionPermissionRepliedEvent {
  type: "permission_replied";
  request_id: string;
  session_id?: string;
  reply?: string;
}

export interface SessionQuestionAskedEvent {
  type: "question_asked";
  request_id: string;
  session_id: string;
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description: string }>;
    custom?: boolean;
    multiple?: boolean;
  }>;
}

export interface SessionQuestionRepliedEvent {
  type: "question_replied";
  request_id: string;
  session_id?: string;
}

export type SessionSyncEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | SessionDeletedEvent
  | SessionMessageAddedEvent
  | SessionStatusChangedEvent
  | SessionPartUpdatedEvent
  | SessionPartDeltaEvent
  | SessionPartRemovedEvent
  | SessionPermissionAskedEvent
  | SessionPermissionRepliedEvent
  | SessionQuestionAskedEvent
  | SessionQuestionRepliedEvent;

export type RuntimeExecutionMode = "plan" | "safe" | "auto";

export interface BackendRuntimeExecutionMode {
  mode: RuntimeExecutionMode;
  updated_at: string;
  supported_modes: RuntimeExecutionMode[];
}

/** Backend Message (from SSE stream) */
export interface BackendChatChunk {
  chunk: string;
  chunk_type: "text" | "tool_call" | "tool_result" | "error" | "done";
  session_id: string;
}

/** Backend Tool Definition */
export interface BackendTool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Backend Tool Execution Result */
export interface BackendToolResult {
  tool_id: string;
  result: unknown;
  success: boolean;
  error?: string;
  execution_time_ms: number;
}

/** Backend Canvas Response */
export interface BackendCanvas {
  id: string;
  session_id: string;
  components: unknown[];
  layout: unknown;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Error Handling
// ============================================================================

export class NativeAgentApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NativeAgentApiError";
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Unknown error", code: "UNKNOWN" }));
    throw new NativeAgentApiError(
      errorData.error || `HTTP ${response.status}`,
      response.status,
      errorData.code,
      errorData.details,
    );
  }
  return response.json();
}

function normalizeSessionPayload(
  payload: BackendSessionPayload,
): BackendSession {
  const updatedAt = payload.updated_at ?? payload.created_at;

  return {
    id: payload.id,
    name: payload.name,
    description: payload.description,
    created_at: payload.created_at,
    updated_at: updatedAt,
    last_accessed: payload.last_accessed ?? updatedAt,
    message_count: payload.message_count ?? 0,
    active: payload.active ?? true,
    tags: payload.tags ?? [],
    metadata: payload.metadata,
  };
}

// ============================================================================
// Session API
// ============================================================================

export const sessionApi = {
  /**
   * List all sessions
   * GET /api/v1/agent-sessions
   */
  async listSessions(): Promise<BackendSession[]> {
    const response = await fetch(AGENT_SESSION_API_BASE);
    const data = await handleResponse<BackendSessionListResponse>(response);
    return data.sessions.map(normalizeSessionPayload);
  },

  /**
   * Get a specific session
   * GET /api/v1/agent-sessions/:id
   */
  async getSession(sessionId: string): Promise<BackendSession> {
    const response = await fetch(
      `${AGENT_SESSION_API_BASE}/${encodeURIComponent(sessionId)}`,
    );
    const data = await handleResponse<BackendSessionPayload>(response);
    return normalizeSessionPayload(data);
  },

  /**
   * Create a new session
   * POST /api/v1/agent-sessions
   */
  async createSession(
    options: CreateNativeAgentSessionRequest = {},
  ): Promise<BackendSession> {
    const response = await fetch(AGENT_SESSION_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: options.name || "New Session",
        description: options.description,
        agent_id: options.agentId,
        agent_name: options.agentName,
        model: options.model,
        tags: options.tags,
        metadata: options.metadata,
        // Agent session metadata fields
        origin_surface: options.origin_surface,
        session_mode: options.session_mode,
        project_id: options.project_id,
        workspace_scope: options.workspace_scope,
        agent_features: options.agent_features,
      }),
    });
    const data = await handleResponse<BackendSessionPayload>(response);
    return normalizeSessionPayload(data);
  },

  /**
   * Update a session
   */
  async updateSession(
    sessionId: string,
    updates: {
      name?: string;
      description?: string;
      active?: boolean;
      tags?: string[];
      metadata?: Record<string, unknown>;
      origin_surface?: "chat" | "cowork" | "code" | "browser";
      session_mode?: "regular" | "agent";
      project_id?: string;
      workspace_scope?: string;
      agent_features?: {
        workspace?: boolean;
        tools?: boolean;
        automation?: boolean;
      };
    },
  ): Promise<BackendSession> {
    const response = await fetch(
      `${AGENT_SESSION_API_BASE}/${encodeURIComponent(sessionId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
          active: updates.active,
          tags: updates.tags,
          metadata: updates.metadata,
          // Agent session metadata fields
          origin_surface: updates.origin_surface,
          session_mode: updates.session_mode,
          project_id: updates.project_id,
          workspace_scope: updates.workspace_scope,
          agent_features: updates.agent_features,
        }),
      },
    );
    const data = await handleResponse<BackendSessionPayload>(response);
    return normalizeSessionPayload(data);
  },

  /**
   * Delete a session
   * DELETE /api/v1/agent-sessions/:id
   */
  async deleteSession(sessionId: string): Promise<void> {
    const url = `${AGENT_SESSION_API_BASE}/${encodeURIComponent(sessionId)}`;
    console.log('[NativeAgentApi] DELETE request to:', url);
    const response = await fetch(
      url,
      {
        method: "DELETE",
      },
    );
    console.log('[NativeAgentApi] DELETE response status:', response.status, response.statusText);
    if (!response.ok) {
      console.error('[NativeAgentApi] DELETE failed, throwing error');
      await handleResponse(response);
    }
  },

  /**
   * List all messages for a session.
   * GET /api/v1/agent-sessions/:id/messages
   */
  async listMessages(sessionId: string): Promise<BackendMessage[]> {
    const response = await fetch(
      `${AGENT_SESSION_API_BASE}/${encodeURIComponent(sessionId)}/messages`,
    );
    return handleResponse<BackendMessage[]>(response);
  },

  /**
   * Append a message to a session.
   * POST /api/v1/agent-sessions/:id/messages
   */
  async sendMessage(
    sessionId: string,
    message: { text: string; role?: string },
  ): Promise<BackendMessage> {
    const response = await fetch(
      `${AGENT_SESSION_API_BASE}/${encodeURIComponent(sessionId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      },
    );
    return handleResponse<BackendMessage>(response);
  },

  /**
   * Open the session sync SSE channel.
   * GET /api/v1/agent-sessions/sync
   */
  createSyncSource(): EventSource {
    return new EventSource(`${AGENT_SESSION_API_BASE}/sync`);
  },
};

// ============================================================================
// Runtime API
// ============================================================================

export const runtimeApi = {
  async getExecutionMode(): Promise<BackendRuntimeExecutionMode> {
    const response = await fetch(`${RUNTIME_API_BASE}/runtime/execution-mode`);
    return handleResponse<BackendRuntimeExecutionMode>(response);
  },

  async setExecutionMode(
    mode: RuntimeExecutionMode,
  ): Promise<BackendRuntimeExecutionMode> {
    const response = await fetch(`${RUNTIME_API_BASE}/runtime/execution-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    return handleResponse<BackendRuntimeExecutionMode>(response);
  },
};

// ============================================================================
// Chat API
// ============================================================================

export interface ChatStreamCallbacks {
  onChunk?: (chunk: BackendChatChunk) => void;
  onThinkingChunk?: (text: string) => void;
  onToolCall?: (tool: {
    toolCallId: string;
    toolName: string;
    input?: Record<string, unknown>;
  }) => void;
  onToolResult?: (tool: {
    toolCallId: string;
    toolName: string;
    result?: unknown;
  }) => void;
  onToolError?: (tool: {
    toolCallId: string;
    toolName?: string;
    error: string;
  }) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

export const chatApi = {
  /**
   * Stream chat responses
   * POST /api/agent-chat
   */
  async streamChat(
    sessionId: string,
    message: string,
    modelId: string | undefined,
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal,
    agentContext?: AgentContext,
  ): Promise<void> {
    const response = await fetch(`${APP_API_BASE}/api/agent-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: sessionId, message, runtimeModelId: modelId, ...(agentContext ?? {}) }),
      signal,
    });

    if (!response.ok) {
      throw new NativeAgentApiError(
        `Chat stream failed: ${response.statusText}`,
        response.status,
      );
    }

    if (!response.body) {
      throw new NativeAgentApiError("No response body", 500);
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
          if (data === "[DONE]") {
            callbacks.onDone?.();
            continue;
          }

          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;

            const tryParseChunkPayload = (value: unknown): unknown => {
              if (typeof value !== "string") return value;
              const trimmed = value.trim();
              if (!trimmed) return value;
              try {
                return JSON.parse(trimmed);
              } catch {
                return value;
              }
            };

            // BackendChatChunk format: { chunk, chunk_type, session_id }
            if (typeof parsed.chunk_type === "string") {
              const chunk = parsed as unknown as BackendChatChunk;
              callbacks.onChunk?.(chunk);
              if (chunk.chunk_type === "tool_call") {
                const payload = tryParseChunkPayload(chunk.chunk) as
                  | {
                      toolCallId?: string;
                      toolName?: string;
                      input?: Record<string, unknown>;
                      args?: Record<string, unknown>;
                    }
                  | string;
                if (typeof payload === "object" && payload) {
                  callbacks.onToolCall?.({
                    toolCallId:
                      payload.toolCallId ??
                      `${payload.toolName ?? "tool"}-${Date.now()}`,
                    toolName: payload.toolName ?? "Tool",
                    input: payload.input ?? payload.args,
                  });
                }
              } else if (chunk.chunk_type === "tool_result") {
                const payload = tryParseChunkPayload(chunk.chunk) as
                  | {
                      toolCallId?: string;
                      toolName?: string;
                      result?: unknown;
                      output?: unknown;
                    }
                  | string;
                if (typeof payload === "object" && payload) {
                  callbacks.onToolResult?.({
                    toolCallId:
                      payload.toolCallId ??
                      `${payload.toolName ?? "tool"}-${Date.now()}`,
                    toolName: payload.toolName ?? "Tool",
                    result: payload.result ?? payload.output,
                  });
                }
              }
              if (chunk.chunk_type === "done") callbacks.onDone?.();
              continue;
            }

            // Gizzi/Anthropic SSE format: { type, delta: { type, text } }
            if (parsed.type === "content_block_delta") {
              const delta = parsed.delta as Record<string, unknown> | undefined;
              const deltaType = delta?.type as string | undefined;
              if (deltaType === "thinking_delta" && delta?.thinking) {
                callbacks.onThinkingChunk?.(delta.thinking as string);
              } else if (delta?.text) {
                callbacks.onChunk?.({ chunk: delta.text as string, chunk_type: "text", session_id: "" });
              }
            } else if (parsed.type === "content_block_start") {
              const contentBlock = parsed.content_block as
                | {
                    type?: string;
                    id?: string;
                    name?: string;
                    input?: Record<string, unknown>;
                  }
                | undefined;
              if (contentBlock?.type === "tool_use" && contentBlock.id) {
                callbacks.onToolCall?.({
                  toolCallId: contentBlock.id,
                  toolName: contentBlock.name ?? "Tool",
                  input: contentBlock.input,
                });
              }
            } else if (parsed.type === "tool_result") {
              callbacks.onToolResult?.({
                toolCallId: String(parsed.toolCallId ?? ""),
                toolName: String(parsed.toolName ?? "Tool"),
                result: parsed.result,
              });
            } else if (parsed.type === "tool_error") {
              callbacks.onToolError?.({
                toolCallId: String(parsed.toolCallId ?? ""),
                toolName:
                  typeof parsed.toolName === "string" ? parsed.toolName : undefined,
                error: String(parsed.error ?? "Tool execution failed"),
              });
            } else if (parsed.type === "finish" || parsed.type === "message_stop") {
              callbacks.onDone?.();
            } else if (parsed.type === "error") {
              callbacks.onError?.(new Error((parsed.error as string) ?? "Stream error"));
            }
          } catch (parseError) {
            console.error("Failed to parse SSE chunk:", data);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  /**
   * Abort ongoing generation
   * POST /api/v1/agent-sessions/:id/abort
   */
  async abortGeneration(sessionId: string): Promise<void> {
    const response = await fetch(
      `${AGENT_SESSION_API_BASE}/${encodeURIComponent(sessionId)}/abort`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    if (!response.ok) {
      await handleResponse(response);
    }
  },

  /**
   * Inject a message by appending it to the session message log.
   * POST /api/v1/agent-sessions/:id/messages
   */
  async injectMessage(
    sessionId: string,
    message: string,
    role: string = "system",
  ): Promise<void> {
    const response = await fetch(
      `${AGENT_SESSION_API_BASE}/${encodeURIComponent(sessionId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message, role }),
      },
    );
    if (!response.ok) {
      await handleResponse(response);
    }
  },
};

// ============================================================================
// Tools API
// ============================================================================

export const toolsApi = {
  /**
   * List all available tools
   * GET /api/v1/tools
   */
  async listTools(): Promise<BackendTool[]> {
    const response = await fetch(`${TOOLS_API_BASE}/tools`);
    const data = await handleResponse<{
      native?: BackendTool[];
      mcp?: BackendTool[];
    }>(response);
    return [...(data.native ?? []), ...(data.mcp ?? [])];
  },

  /**
   * Execute a tool
   * POST /api/v1/tools/execute
   */
  async executeTool(
    sessionId: string,
    toolId: string,
    args: Record<string, unknown>,
  ): Promise<BackendToolResult> {
    const response = await fetch(`${TOOLS_API_BASE}/tools/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: toolId,
        parameters: args,
        session_id: sessionId,
      }),
    });

    const data = await handleResponse<{
      success: boolean;
      output?: unknown;
      error?: string;
      execution_time_ms: number;
    }>(response);

    return {
      tool_id: toolId,
      result: data.output,
      success: data.success,
      error: data.error,
      execution_time_ms: data.execution_time_ms,
    };
  },

  /**
   * Execute a tool and report the terminal result through callbacks.
   * The backend currently exposes a single-shot execution endpoint rather than
   * a dedicated tool streaming route.
   */
  async streamToolExecution(
    sessionId: string,
    toolId: string,
    args: Record<string, unknown>,
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      if (signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      const result = await toolsApi.executeTool(sessionId, toolId, args);
      callbacks.onChunk?.({
        chunk: JSON.stringify(result.result ?? null),
        chunk_type: result.success ? "tool_result" : "error",
        session_id: sessionId,
      });
      callbacks.onDone?.();
    } catch (error) {
      callbacks.onError?.(
        error instanceof Error ? error : new Error("Tool execution failed"),
      );
      throw error;
    }
  },
};

// ============================================================================
// Canvas API
// ============================================================================

export interface CanvasOperation {
  operation: string;
  component?: unknown;
  position?: unknown;
}

export const canvasApi = {
  /**
   * Canvas is currently managed client-side. No backend canvas API is exposed
   * for this GUI surface yet.
   */
  async createCanvas(
    _sessionId: string,
    _layout?: Record<string, unknown>,
  ): Promise<BackendCanvas> {
    throw new NativeAgentApiError(
      "Canvas operations are local-only in the current GUI; no backend canvas endpoint is exposed.",
      501,
    );
  },

  /**
   * Canvas is currently managed client-side.
   */
  async getCanvas(_canvasId: string): Promise<BackendCanvas> {
    throw new NativeAgentApiError(
      "Canvas operations are local-only in the current GUI; no backend canvas endpoint is exposed.",
      501,
    );
  },

  /**
   * Canvas is currently managed client-side.
   */
  async canvasOperation(
    _canvasId: string,
    _operation: CanvasOperation,
  ): Promise<{ success: boolean; canvas_id: string; operation: string }> {
    throw new NativeAgentApiError(
      "Canvas operations are local-only in the current GUI; no backend canvas endpoint is exposed.",
      501,
    );
  },

  /**
   * Canvas is currently managed client-side.
   */
  async deleteCanvas(_canvasId: string): Promise<void> {
    throw new NativeAgentApiError(
      "Canvas operations are local-only in the current GUI; no backend canvas endpoint is exposed.",
      501,
    );
  },
};

// ============================================================================
// Session Lifecycle API (Revert / Compact / Undo / Redo)
// ============================================================================

export const sessionLifecycleApi = {
  async revertSession(sessionId: string, messageId: string): Promise<BackendSession> {
    const response = await fetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });
    if (!response.ok) await handleResponse(response);
    return response.json();
  },

  async unrevertSession(sessionId: string): Promise<BackendSession> {
    const response = await fetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/unrevert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) await handleResponse(response);
    return response.json();
  },

  async compactSession(sessionId: string, modelId?: string): Promise<void> {
    const response = await fetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/compact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId }),
    });
    if (!response.ok) await handleResponse(response);
  },

  async abortSession(sessionId: string): Promise<void> {
    const response = await fetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/abort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) await handleResponse(response);
  },
};

// ============================================================================
// Permissions API
// ============================================================================

export const permissionsApi = {
  async replyPermission(
    requestID: string,
    reply: "once" | "always" | "reject",
    message?: string,
  ): Promise<void> {
    const response = await fetch(
      `/api/v1/permissions/${encodeURIComponent(requestID)}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply, message }),
      },
    );
    if (!response.ok) {
      await handleResponse(response);
    }
  },
};

// ============================================================================
// Questions API
// ============================================================================

export const questionsApi = {
  async replyQuestion(
    requestID: string,
    answers: Array<{ questionIndex: number; answer: string | string[] }>,
  ): Promise<void> {
    const response = await fetch(
      `/api/v1/questions/${encodeURIComponent(requestID)}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      },
    );
    if (!response.ok) {
      await handleResponse(response);
    }
  },

  async rejectQuestion(requestID: string): Promise<void> {
    const response = await fetch(
      `/api/v1/questions/${encodeURIComponent(requestID)}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    if (!response.ok) {
      await handleResponse(response);
    }
  },
};

// ============================================================================
// Combined Export
// ============================================================================

export const nativeAgentApi = {
  sessions: sessionApi,
  chat: chatApi,
  runtime: runtimeApi,
  tools: toolsApi,
  canvas: canvasApi,
  permissions: permissionsApi,
  questions: questionsApi,
};

export default nativeAgentApi;
