import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("zustand/middleware", () => ({
  devtools: (fn: unknown) => fn,
  persist: (fn: unknown) => fn,
}));

import {
  useNativeAgentStore,
  isLocalDraftSession,
  selectActiveSession,
  selectActiveMessages,
  selectSessionCanvases,
  selectIsSessionStreaming,
  selectSessionSyncState,
  selectSessionStreamingError,
  type NativeSession,
  type ToolResult,
} from "./native-agent.store";
import {
  MockEventSource,
  mockFetch,
  MockReadableStream,
  encodeSSE,
  resetMocks,
  createMockSession,
  createMockBackendSession,
  createMockMessage,
  createMockTool,
  createMockCanvas,
} from "./native-agent.test.setup";

describe("Native Agent Store", () => {
  beforeEach(() => {
    resetMocks();
    useNativeAgentStore.setState({
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
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Session CRUD", () => {
    it("fetches wrapped session lists and stores normalized sessions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            createMockBackendSession({ id: "session-1", name: "Session 1" }),
            createMockBackendSession({ id: "session-2", name: "Session 2" }),
          ],
          count: 2,
        }),
      });

      await useNativeAgentStore.getState().fetchSessions();

      const state = useNativeAgentStore.getState();
      assert.equal(state.sessions.length, 2);
      assert.equal(state.sessions[0].name, "Session 1");
      assert.equal(state.sessions[1].name, "Session 2");
      assert.equal(state.isLoadingSessions, false);
      assert.equal(state.error, null);
      expect(mockFetch.mock.calls[0][0]).toContain("/agent-sessions");
    });

    it("creates a session from the real backend payload and fills derived fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "new-session",
          name: "New Session",
          description: "Description",
          created_at: "2024-01-01T00:00:00.000Z",
          message_count: 0,
          active: true,
        }),
      });

      const result = await useNativeAgentStore
        .getState()
        .createSession("New Session", "Description");

      assert.equal(result.id, "new-session");
      assert.equal(result.updatedAt, "2024-01-01T00:00:00.000Z");
      assert.equal(result.lastAccessedAt, "2024-01-01T00:00:00.000Z");
      assert.deepEqual(result.tags, []);
      assert.equal(
        useNativeAgentStore.getState().activeSessionId,
        "new-session",
      );
      expect(mockFetch.mock.calls[0][0]).toContain("/agent-sessions");

      const request = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
      assert.equal(request.name, "New Session");
      assert.equal(request.description, "Description");
    });

    it("persists origin-surface and agent metadata when creating a session", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockBackendSession({
            id: "chat-agent-session",
            name: "Research Session",
            metadata: {
              allternit_origin_surface: "chat",
              allternit_session_mode: "agent",
              allternit_agent_id: "agent-007",
              allternit_agent_name: "Research Operator",
            },
            tags: ["research"],
          }),
      });

      const result = await useNativeAgentStore.getState().createSession(
        "Research Session",
        "Investigate the brief",
        {
          originSurface: "chat",
          sessionMode: "agent",
          agentId: "agent-007",
          agentName: "Research Operator",
          tags: ["research"],
        },
      );

      const request = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
      assert.equal(request.agent_id, "agent-007");
      assert.equal(request.tags[0], "research");
      assert.equal(request.metadata.allternit_origin_surface, "chat");
      assert.equal(request.metadata.allternit_session_mode, "agent");
      assert.equal(request.metadata.allternit_agent_name, "Research Operator");
      assert.equal(result.metadata?.["allternit_origin_surface"], "chat");
    });

    it("throws error when agent services are unavailable", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(
        useNativeAgentStore.getState().createSession("Offline Session", "Draft work")
      ).rejects.toThrow("Failed to fetch");

      assert.equal(useNativeAgentStore.getState().error, "Failed to fetch");
    });

    it("throws error and does not create session when network fails", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(
        useNativeAgentStore.getState().createSession(
          "Offline Agent Session",
          "Draft operator work",
          {
            originSurface: "code",
            sessionMode: "agent",
            agentId: "agent-coder",
          },
        )
      ).rejects.toThrow("Failed to fetch");

      // No session should be created
      assert.equal(useNativeAgentStore.getState().sessions.length, 0);
    });

    it("patches session metadata against the real agent session route", async () => {
      useNativeAgentStore.setState({
        sessions: [createMockSession({ id: "session-1", name: "Old Name" })],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockBackendSession({
            id: "session-1",
            name: "Updated Name",
            description: "Updated Description",
            tags: ["priority", "gui"],
            active: false,
            metadata: { operator_note: "Review before dispatch" },
          }),
      });

      await useNativeAgentStore.getState().updateSession("session-1", {
        name: "Updated Name",
        description: "Updated Description",
        tags: ["priority", "gui"],
        isActive: false,
        metadata: { operator_note: "Review before dispatch" },
      });

      const state = useNativeAgentStore.getState();
      assert.equal(state.sessions[0].name, "Updated Name");
      assert.equal(state.sessions[0].description, "Updated Description");
      assert.deepEqual(state.sessions[0].tags, ["priority", "gui"]);
      assert.equal(state.sessions[0].isActive, false);
      assert.deepEqual(state.sessions[0].metadata, {
        operator_note: "Review before dispatch",
      });
      expect(mockFetch.mock.calls[0][0]).toContain("/agent-sessions/session-1");
      assert.equal(mockFetch.mock.calls[0][1]?.method, "PATCH");
    });

    it("calls backend to update sessions (no local draft fallback)", async () => {
      useNativeAgentStore.setState({
        sessions: [
          createMockSession({
            id: "session-1",
            name: "Session",
            metadata: {},
          }),
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockBackendSession({
            id: "session-1",
            name: "Session Updated",
            tags: ["review"],
          }),
      });

      await useNativeAgentStore.getState().updateSession("session-1", {
        name: "Session Updated",
        tags: ["review"],
      });

      const state = useNativeAgentStore.getState();
      assert.equal(state.sessions[0].name, "Session Updated");
      assert.deepEqual(state.sessions[0].tags, ["review"]);
      assert.equal(mockFetch.mock.calls.length, 1);
    });

    it("deletes a session and clears its related state", async () => {
      useNativeAgentStore.setState({
        sessions: [createMockSession({ id: "session-1" })],
        activeSessionId: "session-1",
        messages: { "session-1": [createMockMessage({ id: "msg-1" })] },
        sessionCanvases: { "session-1": ["canvas-1"] },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await useNativeAgentStore.getState().deleteSession("session-1");

      const state = useNativeAgentStore.getState();
      assert.equal(state.sessions.length, 0);
      assert.equal(state.activeSessionId, null);
      assert.equal(state.messages["session-1"], undefined);
      assert.equal(state.sessionCanvases["session-1"], undefined);
    });

    it("calls backend to delete sessions (no local draft fallback)", async () => {
      useNativeAgentStore.setState({
        sessions: [
          createMockSession({
            id: "session-1",
            metadata: {},
          }),
        ],
        activeSessionId: "session-1",
        messages: { "session-1": [createMockMessage({ id: "msg-1" })] },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await useNativeAgentStore.getState().deleteSession("session-1");

      const state = useNativeAgentStore.getState();
      assert.equal(state.sessions.length, 0);
      assert.equal(state.activeSessionId, null);
      assert.equal(state.messages["session-1"], undefined);
      assert.equal(mockFetch.mock.calls.length, 1);
    });

    it("sets the active session and loads server messages once", async () => {
      useNativeAgentStore.setState({
        sessions: [createMockSession({ id: "session-1" })],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [createMockMessage({ id: "msg-1" })],
      });

      useNativeAgentStore.getState().setActiveSession("session-1");
      await new Promise((resolve) => setTimeout(resolve, 0));

      const state = useNativeAgentStore.getState();
      assert.equal(state.activeSessionId, "session-1");
      assert.equal(state.messages["session-1"].length, 1);
      assert.equal(mockFetch.mock.calls.length, 1);
    });

    it("does not refetch messages when the same session is reselected", async () => {
      useNativeAgentStore.setState({
        sessions: [createMockSession({ id: "session-1" })],
        activeSessionId: "session-1",
      });

      useNativeAgentStore.getState().setActiveSession("session-1");
      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.equal(mockFetch.mock.calls.length, 0);
    });
  });

  describe("Messages", () => {
    it("fetches messages for a session", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          createMockMessage({ id: "msg-1", role: "user", content: "Hello" }),
          createMockMessage({ id: "msg-2", role: "assistant", content: "Hi" }),
        ],
      });

      await useNativeAgentStore.getState().fetchMessages("session-1");

      assert.equal(
        useNativeAgentStore.getState().messages["session-1"][1].content,
        "Hi",
      );
      expect(mockFetch.mock.calls[0][0]).toContain(
        "/agent-sessions/session-1/messages",
      );
    });

    it("sends a message with role/text and replaces the optimistic entry", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockMessage({ id: "msg-server", content: "Hello world" }),
      });

      await useNativeAgentStore
        .getState()
        .sendMessage("session-1", "Hello world");

      const state = useNativeAgentStore.getState();
      assert.equal(state.messages["session-1"].length, 1);
      assert.equal(state.messages["session-1"][0].id, "msg-server");
      expect(mockFetch.mock.calls[0][0]).toContain(
        "/agent-sessions/session-1/messages",
      );

      const request = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
      assert.equal(request.role, "user");
      assert.equal(request.text, "Hello world");
    });

    it("uses backend for messages (no local draft fallback)", async () => {
      useNativeAgentStore.setState({
        sessions: [
          createMockSession({
            id: "session-1",
            metadata: {},
          }),
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockMessage({ id: "msg-1", content: "Hello" }),
      });

      await useNativeAgentStore
        .getState()
        .sendMessage("session-1", "Hello");

      const state = useNativeAgentStore.getState();
      // Message is sent via API
      assert.equal(mockFetch.mock.calls.length, 1);
      expect(mockFetch.mock.calls[0][0]).toContain("/agent-sessions/session-1/messages");
    });

    it("rolls back the optimistic message when send fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Send failed"));

      await expect(
        useNativeAgentStore.getState().sendMessage("session-1", "Hello"),
      ).rejects.toThrow("Send failed");

      const state = useNativeAgentStore.getState();
      assert.equal(state.error, "Send failed");
      assert.deepEqual(state.messages["session-1"], []);
    });

    it("auto-titles the session from the first user message content", async () => {
      // Session starts with sentinel name "New Chat"
      useNativeAgentStore.setState({
        sessions: [createMockSession({ id: "session-1", name: "New Chat" })],
        messages: { "session-1": [] },
      });

      // First call: send message succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockMessage({ id: "msg-1", content: "Hello world" }),
      });
      // Second call: updateSession (PATCH) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "session-1",
          name: "Hello world",
          description: "",
          created_at: new Date().toISOString(),
          message_count: 1,
          active: true,
        }),
      });

      await useNativeAgentStore
        .getState()
        .sendMessage("session-1", "Hello world");

      // Give the .catch() micro-task a turn to settle
      await new Promise((r) => setTimeout(r, 0));

      // PATCH must have been called
      assert.equal(mockFetch.mock.calls.length, 2);
      expect(mockFetch.mock.calls[1][0]).toContain("/agent-sessions/session-1");
      assert.equal(mockFetch.mock.calls[1][1]?.method, "PATCH");
    });

    it("surfaces auto-title updateSession failure through store error state (no silent failure)", async () => {
      // Session starts with sentinel name "Untitled"
      useNativeAgentStore.setState({
        sessions: [createMockSession({ id: "session-1", name: "Untitled" })],
        messages: { "session-1": [] },
      });

      // First call: send message succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockMessage({ id: "msg-1", content: "Tell me about AI" }),
      });
      // Second call: updateSession fails
      mockFetch.mockRejectedValueOnce(new Error("Network error on title update"));

      await useNativeAgentStore
        .getState()
        .sendMessage("session-1", "Tell me about AI");

      // Give the .catch() micro-task a turn to settle
      await new Promise((r) => setTimeout(r, 0));

      // Error must be surfaced in store state — no silent swallow
      assert.equal(
        useNativeAgentStore.getState().error,
        "Network error on title update",
      );
    });

    it("does not auto-title on a second message (session already has a non-sentinel name)", async () => {
      // Session has already been titled
      useNativeAgentStore.setState({
        sessions: [createMockSession({ id: "session-1", name: "Existing Title" })],
        messages: {
          "session-1": [
            createMockMessage({ id: "prev", role: "user", content: "Previous message" }),
          ],
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockMessage({ id: "msg-2", content: "Second message" }),
      });

      await useNativeAgentStore
        .getState()
        .sendMessage("session-1", "Second message");

      // Only 1 fetch call — no updateSession PATCH
      assert.equal(mockFetch.mock.calls.length, 1);
    });
  });

  describe("Runtime Execution Mode", () => {
    it("fetches the shared runtime execution mode", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mode: "safe",
          updated_at: "2026-02-27T00:00:00.000Z",
          supported_modes: ["plan", "safe", "auto"],
        }),
      });

      await useNativeAgentStore.getState().fetchExecutionMode();

      const state = useNativeAgentStore.getState();
      assert.equal(state.executionMode?.mode, "safe");
      assert.equal(state.executionMode?.updatedAt, "2026-02-27T00:00:00.000Z");
      assert.deepEqual(state.executionMode?.supportedModes, [
        "plan",
        "safe",
        "auto",
      ]);
    });

    it("updates the shared runtime execution mode", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mode: "plan",
          updated_at: "2026-02-27T00:04:00.000Z",
          supported_modes: ["plan", "safe", "auto"],
        }),
      });

      await useNativeAgentStore.getState().setExecutionMode("plan");

      const state = useNativeAgentStore.getState();
      assert.equal(state.executionMode?.mode, "plan");
      assert.equal(state.isSavingExecutionMode, false);
      expect(mockFetch.mock.calls[0][0]).toContain("/runtime/execution-mode");
      assert.equal(mockFetch.mock.calls[0][1]?.method, "PUT");
    });
  });

  describe("Streaming Chat", () => {
    it("consumes the real agent-chat SSE event types", async () => {
      const stream = new MockReadableStream([
        encodeSSE({ type: "message_start", messageId: "assistant-1" }),
        encodeSSE({ type: "content_block_delta", delta: { text: "Hello" } }),
        encodeSSE({ type: "content_block_delta", delta: { text: " world" } }),
        encodeSSE({
          type: "tool_call_start",
          tool_id: "search",
          call_id: "call-1",
          args: { query: "docs" },
        }),
        encodeSSE({
          type: "tool_call_result",
          call_id: "call-1",
          result: { ok: true },
        }),
        encodeSSE({ type: "finish", finishReason: "stop" }),
      ]);

      const onEvent = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      await useNativeAgentStore
        .getState()
        .sendMessageStream("session-1", "Hi", onEvent);

      const messages = useNativeAgentStore.getState().messages["session-1"];
      assert.equal(messages[0].role, "user");
      assert.equal(messages[1].role, "assistant");
      assert.equal(messages[1].content, "Hello world");
      assert.equal(messages[1].toolCalls?.[0].name, "search");

      const toolMessage = messages.find((message) => message.role === "tool");
      assert.ok(toolMessage);
      assert.equal(toolMessage?.toolCallId, "call-1");
      expect(onEvent).toHaveBeenCalled();
    });

    it("handles explicit error events from the stream", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: new MockReadableStream([
          encodeSSE({ type: "error", error: "Stream failed" }),
        ]),
      });

      await useNativeAgentStore.getState().sendMessageStream("session-1", "Hi");

      const state = useNativeAgentStore.getState();
      assert.equal(state.error, "Stream failed");
      assert.equal(state.streamingBySession["session-1"]?.error, "Stream failed");
      assert.equal(state.streamingBySession["session-1"]?.isStreaming, false);
    });

    it("aborts the active stream and notifies the session abort endpoint", async () => {
      const abortController = new AbortController();
      const abortSpy = vi.spyOn(abortController, "abort");

      useNativeAgentStore.setState({
        activeSessionId: "session-1",
        streaming: {
          isStreaming: true,
          currentMessageId: "assistant-1",
          abortController,
          error: null,
          streamBuffer: "",
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await useNativeAgentStore.getState().abortGeneration();

      assert.equal(abortSpy.mock.calls.length, 1);
      assert.equal(
        useNativeAgentStore.getState().streamingBySession["session-1"]?.abortController,
        null,
      );
      expect(mockFetch.mock.calls[0][0]).toContain(
        "/agent-sessions/session-1/abort",
      );
    });
  });

  describe("Tools", () => {
    it("fetches native and mcp tools from the real response shape", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          native: [createMockTool({ id: "tool-1", name: "search" })],
          mcp: [createMockTool({ id: "tool-2", name: "filesystem.read_file" })],
          total: 2,
        }),
      });

      await useNativeAgentStore.getState().fetchTools();

      const state = useNativeAgentStore.getState();
      assert.equal(state.tools.length, 2);
      assert.equal(state.tools[1].name, "filesystem.read_file");
    });

    it("executes a tool against /api/v1/tools/execute", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          output: { found: true },
          error: null,
          execution_time_ms: 12,
        }),
      });

      const result = await useNativeAgentStore
        .getState()
        .executeTool("session-1", "search", { query: "docs" });

      expect(result).toEqual(
        expect.objectContaining<ToolResult>({
          result: { found: true },
          error: null,
        }),
      );

      const request = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
      assert.equal(request.tool_name, "search");
      assert.equal(request.session_id, "session-1");
      assert.deepEqual(request.parameters, { query: "docs" });
    });
  });

  describe("Canvas", () => {
    it("creates and stores local canvases", async () => {
      const result = await useNativeAgentStore
        .getState()
        .createCanvas("session-1", 'console.log("test")', "code", "typescript");

      const state = useNativeAgentStore.getState();
      assert.equal(state.canvases[result.id].content, 'console.log("test")');
      assert.deepEqual(state.sessionCanvases["session-1"], [result.id]);
    });

    it("updates and deletes local canvases", async () => {
      const canvas = createMockCanvas({
        id: "canvas-1",
        sessionId: "session-1",
        content: "old",
      });
      useNativeAgentStore.setState({
        canvases: { "canvas-1": canvas },
        sessionCanvases: { "session-1": ["canvas-1"] },
      });

      await useNativeAgentStore
        .getState()
        .updateCanvas("canvas-1", { content: "new" });
      assert.equal(
        useNativeAgentStore.getState().canvases["canvas-1"].content,
        "new",
      );

      await useNativeAgentStore.getState().deleteCanvas("canvas-1");

      const state = useNativeAgentStore.getState();
      assert.equal(state.canvases["canvas-1"], undefined);
      assert.deepEqual(state.sessionCanvases["session-1"], []);
    });

    it("initializes session canvas buckets without hitting the network", async () => {
      await useNativeAgentStore.getState().fetchSessionCanvases("session-1");

      assert.deepEqual(
        useNativeAgentStore.getState().sessionCanvases["session-1"],
        [],
      );
      assert.equal(mockFetch.mock.calls.length, 0);
    });
  });

  describe("Session Sync", () => {
    it("connects to the real session sync SSE endpoint and marks the connection live", async () => {
      const disconnect = useNativeAgentStore.getState().connectSessionSync();
      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.equal(MockEventSource.instances.length, 1);
      assert.equal(
        MockEventSource.instances[0].url.endsWith("/agent-sessions/sync"),
        true,
      );
      assert.equal(useNativeAgentStore.getState().isSessionSyncConnected, true);

      disconnect();
      assert.equal(useNativeAgentStore.getState().eventSource, null);
    });

    it("applies created and message_added session sync events into the store", async () => {
      useNativeAgentStore.setState({
        sessions: [
          createMockSession({
            id: "session-1",
            name: "Existing Session",
            messageCount: 1,
          }),
        ],
        activeSessionId: "session-1",
        messages: {
          "session-1": [
            createMockMessage({
              id: "msg-existing",
              content: "Existing message",
            }),
          ],
        },
      });

      useNativeAgentStore.getState().connectSessionSync();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const sessionSync = MockEventSource.instances[0];
      sessionSync.simulateMessage({
        type: "created",
        id: "session-2",
        name: "Second Session",
        description: "Arrived from another client",
        created_at: "2024-01-02T00:00:00.000Z",
        updated_at: "2024-01-02T00:00:00.000Z",
        last_accessed: "2024-01-02T00:00:00.000Z",
        message_count: 0,
        active: true,
        tags: ["shared"],
      });
      sessionSync.simulateMessage({
        type: "message_added",
        session_id: "session-1",
        id: "msg-sync",
        role: "assistant",
        content: "Synced response",
        timestamp: "2024-01-02T00:05:00.000Z",
      });

      const state = useNativeAgentStore.getState();
      assert.equal(state.sessions[0].id, "session-1");
      assert.equal(state.sessions[0].messageCount, 2);
      assert.equal(state.sessions[1].id, "session-2");
      assert.equal(state.messages["session-1"][1].content, "Synced response");
    });

    it("records session sync disconnects without clobbering the main error banner", async () => {
      useNativeAgentStore.getState().connectSessionSync();
      await new Promise((resolve) => setTimeout(resolve, 0));

      MockEventSource.instances[0].simulateError();

      const state = useNativeAgentStore.getState();
      assert.equal(state.isSessionSyncConnected, false);
      assert.equal(state.sessionSyncError, "Session sync disconnected");
      assert.equal(state.error, null);
    });
  });

  describe("UI actions and selectors", () => {
    it("clears errors and session message buckets", () => {
      useNativeAgentStore.setState({
        error: "Something failed",
        messages: {
          "session-1": [createMockMessage({ id: "msg-1" })],
          "session-2": [createMockMessage({ id: "msg-2" })],
        },
      });

      useNativeAgentStore.getState().clearError();
      useNativeAgentStore.getState().clearMessages("session-1");

      const state = useNativeAgentStore.getState();
      assert.equal(state.error, null);
      assert.equal(state.messages["session-1"], undefined);
      assert.equal(state.messages["session-2"].length, 1);
    });

    it("exposes selector helpers for the active session state", () => {
      const session: NativeSession = createMockSession({ id: "session-1" });
      const canvas = createMockCanvas({
        id: "canvas-1",
        sessionId: "session-1",
      });

      useNativeAgentStore.setState({
        sessions: [session],
        activeSessionId: "session-1",
        messages: { "session-1": [createMockMessage({ id: "msg-1" })] },
        canvases: { "canvas-1": canvas },
        sessionCanvases: { "session-1": ["canvas-1"] },
        streamingBySession: {
          "session-1": {
            isStreaming: true,
            currentMessageId: "assistant-1",
            abortController: null,
            error: "stream failed",
            streamBuffer: "",
          },
        },
        isSessionSyncConnected: true,
        sessionSyncError: null,
      });

      const state = useNativeAgentStore.getState();
      assert.equal(selectActiveSession(state)?.id, "session-1");
      assert.equal(selectActiveMessages(state).length, 1);
      assert.equal(selectSessionCanvases(state, "session-1").length, 1);
      assert.equal(selectIsSessionStreaming(state, "session-1"), true);
      assert.equal(selectSessionStreamingError(state, "session-1"), "stream failed");
      assert.deepEqual(selectSessionSyncState(state), {
        isConnected: true,
        error: null,
      });
    });
  });
});
