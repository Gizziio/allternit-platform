/**
 * Tool Hooks System Tests
 * 
 * Tests for:
 * - Pre/post tool use hooks
 * - Confirmation flow
 * - Audit logging
 * - Tool routing decisions (allow/deny/confirm)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useToolHooksStore,
  createConfirmationHook,
  createAuditHook,
  type ToolContext,
  type ToolRoutingResult,
} from "./tool-hooks";

// Cleanup function to reset store state between tests
function cleanupStore() {
  const store = useToolHooksStore.getState();
  // Unregister all hooks
  Object.keys(store.preToolHooks).forEach(name => store.unregisterPreToolUse(name));
  Object.keys(store.postToolHooks).forEach(name => store.unregisterPostToolUse(name));
  // Resolve all pending confirmations to clean them up
  [...store.pendingConfirmations].forEach(c => {
    try { store.denyTool(c.toolCallId); } catch { /* ignore */ }
  });
}

describe("Tool Hooks Store", () => {
  afterEach(() => {
    cleanupStore();
  });

  describe("Hook Registration", () => {
    it("should register and unregister a pre-tool hook", () => {
      const store = useToolHooksStore.getState();
      const hook = vi.fn(async () => ({ decision: "allow" as const }));

      store.registerPreToolUse("test-hook", hook);
      
      // Verify by checking if hook is called during routing
      const context: ToolContext = {
        toolName: "test_tool",
        toolCallId: "call-reg-1",
        sessionId: "session-1",
        arguments: {},
        timestamp: new Date().toISOString(),
      };
      
      store.routeToolUse(context);
      expect(hook).toHaveBeenCalled();

      store.unregisterPreToolUse("test-hook");
      
      // Reset mock and verify it's not called after unregister
      hook.mockClear();
      store.routeToolUse(context);
      expect(hook).not.toHaveBeenCalled();
    });

    it("should register a post-tool hook", async () => {
      const store = useToolHooksStore.getState();
      const hook = vi.fn(async () => {});

      store.registerPostToolUse("audit-hook", hook);

      const context: ToolContext = {
        toolName: "test_tool",
        toolCallId: "call-reg-2",
        sessionId: "session-1",
        arguments: {},
        timestamp: new Date().toISOString(),
      };

      await store.executePostToolHooks(context, { result: "ok" }, undefined);
      expect(hook).toHaveBeenCalled();

      store.unregisterPostToolUse("audit-hook");
    });
  });

  describe("Tool Routing", () => {
    it("should allow tool execution when no hooks registered", async () => {
      const store = useToolHooksStore.getState();
      const context: ToolContext = {
        toolName: "test_tool",
        toolCallId: "call-route-1",
        sessionId: "session-1",
        arguments: {},
        timestamp: new Date().toISOString(),
      };

      const result = await store.routeToolUse(context);

      expect(result.decision).toBe("allow");
    });

    it("should deny tool when pre-hook returns deny", async () => {
      const store = useToolHooksStore.getState();
      const denyHook = vi.fn(async () => ({
        decision: "deny" as const,
        reason: "Test denial",
      }));

      store.registerPreToolUse("deny-hook", denyHook);

      const context: ToolContext = {
        toolName: "test_tool",
        toolCallId: "call-route-2",
        sessionId: "session-1",
        arguments: {},
        timestamp: new Date().toISOString(),
      };

      const result = await store.routeToolUse(context);

      expect(result.decision).toBe("deny");
      expect(result.reason).toBe("Test denial");

      store.unregisterPreToolUse("deny-hook");
    });

    it("should require confirmation when pre-hook returns confirm", async () => {
      const store = useToolHooksStore.getState();
      const uniqueSession = `session-${Date.now()}-${Math.random()}`;
      const confirmHook = vi.fn(async () => ({
        decision: "confirm" as const,
        reason: "Destructive operation",
      }));

      store.registerPreToolUse("confirm-hook", confirmHook);

      const context: ToolContext = {
        toolName: "delete_file",
        toolCallId: "call-route-3",
        sessionId: uniqueSession,
        arguments: { path: "/important.txt" },
        timestamp: new Date().toISOString(),
      };

      // Route should create a pending confirmation
      const routePromise = store.routeToolUse(context);
      
      // Give the store a tick to update state
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that confirmation was requested by looking at the store state
      const pending = store.getPendingConfirmationsForSession(uniqueSession);
      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(pending[pending.length - 1].toolName).toBe("delete_file");
      
      // Clean up
      store.denyTool("call-route-3");
      await routePromise;

      store.unregisterPreToolUse("confirm-hook");
    });

    it("should stop at first deny even if multiple hooks registered", async () => {
      const store = useToolHooksStore.getState();
      const uniqueSession = `session-deny-${Date.now()}`;
      const allowHook = vi.fn(async () => ({ decision: "allow" as const }));
      const denyHook = vi.fn(async () => ({
        decision: "deny" as const,
        reason: "Blocked",
      }));

      // Clean up any existing hooks first
      store.unregisterPreToolUse("allow-hook");
      store.unregisterPreToolUse("deny-hook");
      
      store.registerPreToolUse("allow-hook", allowHook);
      store.registerPreToolUse("deny-hook", denyHook);

      const context: ToolContext = {
        toolName: "test_tool",
        toolCallId: "call-route-4",
        sessionId: uniqueSession,
        arguments: {},
        timestamp: new Date().toISOString(),
      };

      const result = await store.routeToolUse(context);

      expect(result.decision).toBe("deny");
      expect(allowHook).toHaveBeenCalled();
      expect(denyHook).toHaveBeenCalled();

      store.unregisterPreToolUse("allow-hook");
      store.unregisterPreToolUse("deny-hook");
    });
  });

  describe("Confirmation Flow", () => {
    it("should add pending confirmation when requested", async () => {
      const store = useToolHooksStore.getState();
      const context: ToolContext = {
        toolName: "delete_file",
        toolCallId: "call-confirm-1",
        sessionId: "session-2",
        arguments: { path: "/test.txt" },
        timestamp: new Date().toISOString(),
      };

      const promise = store.requestConfirmation(context, "Are you sure?");

      const pending = store.getPendingConfirmationsForSession("session-2");
      expect(pending.length).toBeGreaterThanOrEqual(1);
      
      // Clean up
      store.denyTool("call-confirm-1");
      await promise;
    });

    it("should resolve confirmation with allow decision via confirmTool", async () => {
      const store = useToolHooksStore.getState();
      const context: ToolContext = {
        toolName: "delete_file",
        toolCallId: "call-confirm-2",
        sessionId: "session-1",
        arguments: { path: "/test.txt" },
        timestamp: new Date().toISOString(),
      };

      const promise = store.requestConfirmation(context, "Are you sure?");
      
      store.confirmTool("call-confirm-2");

      const result = await promise;
      expect(result.decision).toBe("allow");
    });

    it("should resolve confirmation with deny decision via denyTool", async () => {
      const store = useToolHooksStore.getState();
      const context: ToolContext = {
        toolName: "delete_file",
        toolCallId: "call-confirm-3",
        sessionId: "session-1",
        arguments: { path: "/test.txt" },
        timestamp: new Date().toISOString(),
      };

      const promise = store.requestConfirmation(context, "Are you sure?");
      
      store.denyTool("call-confirm-3");

      const result = await promise;
      expect(result.decision).toBe("deny");
    });
  });

  describe("Audit Logging", () => {
    it("should log a new tool execution", async () => {
      const store = useToolHooksStore.getState();
      const uniqueId = `test-${Date.now()}-${Math.random()}`;

      const id = store.logToolExecution({
        toolName: "read_file",
        sessionId: uniqueId,
        toolCallId: "call-log-1",
        arguments: { path: "/test.txt" },
        status: "pending",
        requestedAt: new Date().toISOString(),
      });

      expect(id).toBeDefined();
      // Wait a tick for Immer to update
      await new Promise(resolve => setTimeout(resolve, 10));
      // Re-fetch store state to get updated data
      const updatedStore = useToolHooksStore.getState();
      const execution = updatedStore.toolExecutions.find(e => e.sessionId === uniqueId);
      expect(execution).toBeDefined();
      expect(execution?.toolName).toBe("read_file");
    });

    it("should update an existing execution", () => {
      const store = useToolHooksStore.getState();

      const id = store.logToolExecution({
        toolName: "read_file",
        sessionId: "session-1",
        toolCallId: "call-log-2",
        arguments: { path: "/test.txt" },
        status: "executing",
        requestedAt: new Date().toISOString(),
      });

      store.updateToolExecution(id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        result: { content: "Hello" },
      });

      // Refresh store state to get updated data
      const updatedStore = useToolHooksStore.getState();
      const execution = updatedStore.toolExecutions.find((e) => e.id === id);
      expect(execution?.status).toBe("completed");
    });

    it("should get executions for a session", () => {
      const store = useToolHooksStore.getState();

      store.logToolExecution({
        toolName: "tool1",
        sessionId: "session-get-1",
        toolCallId: "call-log-3",
        arguments: {},
        status: "completed",
        requestedAt: new Date().toISOString(),
      });

      const sessionExecutions = store.getExecutionsForSession("session-get-1");
      expect(sessionExecutions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Query Functions", () => {
    it("should check if session has pending confirmations", async () => {
      const store = useToolHooksStore.getState();

      const context: ToolContext = {
        toolName: "tool1",
        toolCallId: "call-query-1",
        sessionId: "session-3",
        arguments: {},
        timestamp: new Date().toISOString(),
      };

      expect(store.hasPendingConfirmations("session-3")).toBe(false);

      store.requestConfirmation(context, "Confirm?");

      expect(store.hasPendingConfirmations("session-3")).toBe(true);

      // Clean up
      store.denyTool("call-query-1");
    });
  });
});

describe("Hook Factory Functions", () => {
  describe("createConfirmationHook", () => {
    it("should create a hook that requires confirmation for matching tools", () => {
      const shouldConfirm = (toolName: string) => toolName === "delete_file";
      const hook = createConfirmationHook(shouldConfirm);

      const dangerousContext: ToolContext = {
        toolName: "delete_file",
        toolCallId: "call-factory-1",
        sessionId: "session-1",
        arguments: { path: "/test.txt" },
        timestamp: new Date().toISOString(),
      };

      const safeContext: ToolContext = {
        toolName: "read_file",
        toolCallId: "call-factory-2",
        sessionId: "session-1",
        arguments: { path: "/test.txt" },
        timestamp: new Date().toISOString(),
      };

      const dangerousResult = hook(dangerousContext);
      expect(dangerousResult.decision).toBe("confirm");

      const safeResult = hook(safeContext);
      expect(safeResult.decision).toBe("allow");
    });
  });

  describe("createAuditHook", () => {
    it("should create a hook that updates existing execution records", () => {
      const store = useToolHooksStore.getState();
      
      // Create an execution record first
      const id = store.logToolExecution({
        toolName: "read_file",
        sessionId: "session-1",
        toolCallId: "call-audit-1",
        arguments: { path: "/test.txt" },
        status: "executing",
        requestedAt: new Date().toISOString(),
      });

      const hook = createAuditHook();

      const context: ToolContext = {
        toolName: "read_file",
        toolCallId: "call-audit-1",
        sessionId: "session-1",
        arguments: { path: "/test.txt" },
        timestamp: new Date().toISOString(),
      };

      hook(context, { content: "Hello" }, undefined);

      // The audit hook should have updated the existing record
      // Refresh store state to get updated data
      const updatedStore = useToolHooksStore.getState();
      const execution = updatedStore.toolExecutions.find((e) => e.id === id);
      expect(execution?.status).toBe("completed");
    });
  });
});
