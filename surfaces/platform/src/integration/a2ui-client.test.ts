// ============================================================================
// A2UI API Client Tests
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import type { A2UIPayload } from "@/capsules/a2ui/a2ui.types";

// Mock localStorage BEFORE any imports
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock the API client module with factory function
vi.mock('./api-client', async () => {
  return {
    api: {
      baseUrl: 'http://localhost:8013/api/v1',
      token: null,
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    A2RApiError: class MockA2RApiError extends Error {
      status: number;
      constructor(message: string, status = 500) {
        super(message);
        this.status = status;
      }
    },
    gatewayUrl: () => 'http://localhost:8013/api/v1',
  };
});

// Import modules after mocking
import { api } from './api-client';
import { a2uiApi, type A2UISession } from "./a2ui-client";

describe("A2UI API Client", () => {
  const mockPayload: A2UIPayload = {
    version: "1.0",
    surfaces: [
      {
        id: "main",
        name: "Test Surface",
        root: {
          type: "Text",
          props: { content: "Hello World" },
        },
      },
    ],
  };

  const mockSession: A2UISession = {
    id: "test-session-123",
    chatId: "chat-456",
    payload: mockPayload,
    dataModel: {},
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createSession", () => {
    it("should create a new A2UI session", async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSession);

      const result = await a2uiApi.createSession("chat-456", mockPayload);

      assert.equal(result.id, mockSession.id);
      assert.equal(result.chatId, mockSession.chatId);
      assert.deepEqual(result.payload, mockPayload);
      assert.ok((api.post as ReturnType<typeof vi.fn>).mock.calls[0][0].includes('/api/v1/a2ui/sessions'));
    });

    it("should include optional parameters", async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...mockSession,
        messageId: "msg-789",
        agentId: "agent-abc",
      });

      await a2uiApi.createSession("chat-456", mockPayload, {
        messageId: "msg-789",
        agentId: "agent-abc",
        source: "test",
      });

      const callArgs = (api.post as ReturnType<typeof vi.fn>).mock.calls[0][1];
      assert.equal(callArgs.message_id, "msg-789");
      assert.equal(callArgs.agent_id, "agent-abc");
      assert.equal(callArgs.source, "test");
    });
  });

  describe("getSession", () => {
    it("should fetch a session by ID", async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSession);

      const result = await a2uiApi.getSession("test-session-123");

      assert.equal(result.id, "test-session-123");
      assert.ok((api.get as ReturnType<typeof vi.fn>).mock.calls[0][0].includes("/test-session-123"));
    });
  });

  describe("listSessions", () => {
    it("should list sessions for a chat", async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ sessions: [mockSession] });

      const result = await a2uiApi.listSessions("chat-456");

      assert.equal(result.sessions.length, 1);
      assert.equal(result.sessions[0].id, mockSession.id);
      assert.ok((api.get as ReturnType<typeof vi.fn>).mock.calls[0][0].includes("chat_id=chat-456"));
    });
  });

  describe("updateDataModel", () => {
    it("should update session data model", async () => {
      const updatedModel = { name: "Test", value: 123 };
      (api.patch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...mockSession,
        dataModel: updatedModel,
      });

      const result = await a2uiApi.updateDataModel("test-session-123", updatedModel);

      assert.deepEqual(result.dataModel, updatedModel);
      const callArgs = (api.patch as ReturnType<typeof vi.fn>).mock.calls[0][1];
      assert.deepEqual(callArgs.data_model, updatedModel);
    });
  });

  describe("executeAction", () => {
    it("should execute an action", async () => {
      const actionResponse = {
        success: true,
        sessionId: "test-session-123",
        message: "Action completed",
        dataModelUpdates: { updated: true },
      };

      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(actionResponse);

      const result = await a2uiApi.executeAction({
        sessionId: "test-session-123",
        actionId: "submit",
        payload: { formData: "test" },
        dataModel: { existing: "data" },
      });

      assert.equal(result.success, true);
      assert.equal(result.message, "Action completed");
      assert.deepEqual(result.dataModelUpdates, { updated: true });
    });
  });

  describe("deleteSession", () => {
    it("should delete a session", async () => {
      (api.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true });

      await a2uiApi.deleteSession("test-session-123");

      assert.ok((api.delete as ReturnType<typeof vi.fn>).mock.calls[0][0].includes("/test-session-123"));
    });
  });

  describe("Capsule Registry", () => {
    const mockCapsule = {
      id: "capsule-123",
      name: "Test Capsule",
      description: "A test capsule",
      version: "1.0.0",
      status: "active",
    };

    it("should list capsules", async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ capsules: [mockCapsule] });

      const result = await a2uiApi.listCapsules();

      assert.equal(result.capsules.length, 1);
      assert.equal(result.capsules[0].id, mockCapsule.id);
    });

    it("should get a capsule by ID", async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCapsule);

      const result = await a2uiApi.getCapsule("capsule-123");

      assert.equal(result.id, "capsule-123");
    });

    it("should install a capsule", async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCapsule);

      const result = await a2uiApi.installCapsule({
        id: "capsule-123",
        name: "Test Capsule",
        version: "1.0.0",
        entry: { type: "a2ui", src: "test" },
      });

      assert.equal(result.id, "capsule-123");
    });

    it("should launch a capsule", async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        sessionId: "new-session-456",
        capsuleId: "capsule-123",
        payload: mockPayload,
      });

      const result = await a2uiApi.launchCapsule("capsule-123", { chat_id: "chat-789" });

      assert.ok(result);
      assert.equal((result as unknown as { sessionId: string }).sessionId, "new-session-456");
      assert.equal((result as unknown as { capsuleId: string }).capsuleId, "capsule-123");
    });
  });

  describe("A2UI Generation", () => {
    it("should request A2UI generation", async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        sessionId: "generated-session-789",
        payload: mockPayload,
        dataModel: {},
      });

      const result = await a2uiApi.requestA2UIGeneration("chat-456", "Create a form");

      assert.equal(result.sessionId, "generated-session-789");
      assert.deepEqual(result.payload, mockPayload);
    });
  });
});
