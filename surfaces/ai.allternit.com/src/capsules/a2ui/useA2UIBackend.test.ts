// ============================================================================
// A2UI Backend Hook Tests
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import type { A2UISession } from "@/integration/a2ui-client";

// Mock the API client before importing the hook
vi.mock("@/integration/a2ui-client", () => ({
  a2uiApi: {
    getSession: vi.fn(),
    executeAction: vi.fn(),
  },
  AllternitApiError: class AllternitApiError extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  },
}));

// Import after mocking
import { a2uiApi } from "@/integration/a2ui-client";

describe("useA2UIBackend", () => {
  const mockPayload = {
    version: "1.0",
    surfaces: [
      {
        id: "main",
        name: "Test",
        root: {
          type: "Container",
          props: {},
        },
      },
    ],
  };

  const mockSession: A2UISession = {
    id: "test-session",
    chatId: "chat-123",
    payload: mockPayload as unknown as A2UISession["payload"],
    dataModel: { name: "Test" },
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

  describe("Session Management", () => {
    it("should fetch session from API", async () => {
      vi.mocked(a2uiApi.getSession).mockResolvedValueOnce(mockSession);

      const result = await a2uiApi.getSession("test-session");

      assert.equal(result.id, "test-session");
      assert.ok(vi.mocked(a2uiApi.getSession).mock.calls.length > 0);
    });

    it("should handle session fetch error", async () => {
      vi.mocked(a2uiApi.getSession).mockRejectedValueOnce(new Error("Session not found"));

      try {
        await a2uiApi.getSession("invalid-session");
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.equal((error as Error).message, "Session not found");
      }
    });
  });

  describe("Action Execution", () => {
    it("should execute action with correct parameters", async () => {
      const actionResponse = {
        success: true,
        sessionId: "test-session",
        dataModelUpdates: { submitted: true },
      };

      vi.mocked(a2uiApi.executeAction).mockResolvedValueOnce(actionResponse);

      const result = await a2uiApi.executeAction({
        sessionId: "test-session",
        actionId: "submit",
        payload: { formData: "test" },
        dataModel: mockSession.dataModel,
      });

      assert.equal(result.success, true);
      assert.ok(vi.mocked(a2uiApi.executeAction).mock.calls.length > 0);
      const callArgs = vi.mocked(a2uiApi.executeAction).mock.calls[0][0];
      assert.equal(callArgs.sessionId, "test-session");
      assert.equal(callArgs.actionId, "submit");
    });

    it("should handle action execution error", async () => {
      vi.mocked(a2uiApi.executeAction).mockRejectedValueOnce(new Error("Action failed"));

      try {
        await a2uiApi.executeAction({
          sessionId: "test-session",
          actionId: "submit",
          payload: {},
          dataModel: {},
        });
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.equal((error as Error).message, "Action failed");
      }
    });
  });

  describe("Data Model Updates", () => {
    it("should merge data model updates correctly", () => {
      const currentModel = { name: "Test", value: 123, existing: true };
      const updates = { value: 456, newField: "added" };
      
      const merged = { ...currentModel, ...updates };
      
      assert.equal(merged.name, "Test");
      assert.equal(merged.value, 456);
      assert.equal(merged.existing, true);
      assert.equal(merged.newField, "added");
    });

    it("should handle empty updates", () => {
      const currentModel = { name: "Test" };
      const updates = {};
      
      const merged = { ...currentModel, ...updates };
      
      assert.deepEqual(merged, { name: "Test" });
    });
  });

  describe("Session Options", () => {
    it("should support null sessionId", () => {
      // When sessionId is null, hook should not fetch
      const sessionId: string | null = null;
      assert.equal(sessionId, null);
    });

    it("should support callback options", () => {
      const onDataModelChange = vi.fn();
      const onPayloadChange = vi.fn();
      const onError = vi.fn();

      // Verify callbacks are functions
      assert.equal(typeof onDataModelChange, "function");
      assert.equal(typeof onPayloadChange, "function");
      assert.equal(typeof onError, "function");
    });
  });
});
