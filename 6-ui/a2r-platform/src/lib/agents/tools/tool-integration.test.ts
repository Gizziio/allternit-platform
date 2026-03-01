/**
 * Tool Integration Tests
 * 
 * Tests the complete flow:
 * Agent calls tool → Pre-hooks run → Confirmation (if needed) → 
 * Tool execution → Post-hooks run → Result returned
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useToolHooksStore,
  createConfirmationHook,
  createAuditHook,
  type ToolContext,
} from "./tool-hooks";
import {
  registerTool,
  executeTool,
  unregisterTool,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./index";

describe("Tool Execution Integration Flow", () => {
  // Track executions for verification
  const executionLog: Array<{
    phase: string;
    toolName: string;
    toolCallId: string;
    timestamp: number;
    data?: unknown;
  }> = [];

  beforeEach(() => {
    executionLog.length = 0;
    
    // Clean up registered tools
    const allTools = [
      "test_read_file",
      "test_write_file", 
      "test_delete_file",
      "test_search_code",
    ];
    allTools.forEach((name) => {
      try {
        unregisterTool(name);
      } catch {
        // Ignore if not registered
      }
    });

    // Clean up hooks
    const store = useToolHooksStore.getState();
    Object.keys(store.preToolHooks).forEach((key) => {
      store.unregisterPreToolUse(key);
    });
    Object.keys(store.postToolHooks).forEach((key) => {
      store.unregisterPostToolUse(key);
    });
  });

  describe("Simple Tool Execution (No Confirmation)", () => {
    it("should execute read_file tool without confirmation", async () => {
      const store = useToolHooksStore.getState();
      
      // Register a test read tool
      const readToolDef: ToolDefinition = {
        name: "test_read_file",
        description: "Read a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
      };

      const readHandler = vi.fn(async (ctx: ToolExecutionContext, params: Record<string, unknown>) => {
        executionLog.push({
          phase: "execute",
          toolName: "test_read_file",
          toolCallId: ctx.toolCallId,
          timestamp: Date.now(),
          data: params,
        });
        return { content: "File content" };
      });

      registerTool(readToolDef, readHandler);

      // Register audit hook
      const auditHook = vi.fn(async (context: ToolContext, result: unknown) => {
        executionLog.push({
          phase: "post-hook",
          toolName: context.toolName,
          toolCallId: context.toolCallId,
          timestamp: Date.now(),
          data: result,
        });
      });
      store.registerPostToolUse("audit", auditHook);

      // Execute the tool
      const context: ToolExecutionContext = {
        sessionId: "session-1",
        toolCallId: "call-read-1",
        timestamp: Date.now(),
      };

      // Route through hooks first
      const routingContext: ToolContext = {
        toolName: "test_read_file",
        toolCallId: "call-read-1",
        sessionId: "session-1",
        arguments: { path: "/test.txt" },
        timestamp: new Date().toISOString(),
      };

      const routingResult = await store.routeToolUse(routingContext);
      expect(routingResult.decision).toBe("allow");

      // Execute the tool
      const result = await executeTool("test_read_file", context, { path: "/test.txt" });

      // Verify execution
      expect(result).toEqual({ content: "File content" });
      expect(readHandler).toHaveBeenCalledWith(context, { path: "/test.txt" });

      // Run post-hooks
      await store.executePostToolHooks(routingContext, result, undefined);

      // Verify audit hook was called
      expect(auditHook).toHaveBeenCalled();

      // Verify execution log
      const executeEntry = executionLog.find((e) => e.phase === "execute");
      expect(executeEntry).toBeDefined();
      expect(executeEntry?.toolName).toBe("test_read_file");

      const postHookEntry = executionLog.find((e) => e.phase === "post-hook");
      expect(postHookEntry).toBeDefined();
    });
  });

  describe("Tool Execution with Confirmation", () => {
    it("should require confirmation for write_file tool", async () => {
      const store = useToolHooksStore.getState();
      
      // Register write tool
      const writeToolDef: ToolDefinition = {
        name: "test_write_file",
        description: "Write a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
          required: ["path", "content"],
        },
      };

      const writeHandler = vi.fn(async (ctx: ToolExecutionContext, params: Record<string, unknown>) => {
        executionLog.push({
          phase: "execute",
          toolName: "test_write_file",
          toolCallId: ctx.toolCallId,
          timestamp: Date.now(),
          data: params,
        });
        return { success: true, bytesWritten: (params.content as string).length };
      });

      registerTool(writeToolDef, writeHandler);

      // Test the confirmation hook directly
      const shouldConfirm = (toolName: string) => 
        toolName === "test_write_file" || toolName === "test_delete_file";
      const confirmHook = createConfirmationHook(shouldConfirm);
      
      // Test that write_file requires confirmation
      const writeContext: ToolContext = {
        toolName: "test_write_file",
        toolCallId: "call-write-1",
        sessionId: "session-1",
        arguments: { path: "/test.txt", content: "Hello World" },
        timestamp: new Date().toISOString(),
      };

      const hookResult = confirmHook(writeContext);
      expect(hookResult.decision).toBe("confirm");

      // Test that read_file does not require confirmation
      const readContext: ToolContext = {
        toolName: "test_read_file",
        toolCallId: "call-read-1",
        sessionId: "session-1",
        arguments: { path: "/test.txt" },
        timestamp: new Date().toISOString(),
      };

      const readHookResult = confirmHook(readContext);
      expect(readHookResult.decision).toBe("allow");

      // Execute the tool directly
      const context: ToolExecutionContext = {
        sessionId: "session-1",
        toolCallId: "call-write-1",
        timestamp: Date.now(),
      };

      const result = await executeTool("test_write_file", context, {
        path: "/test.txt",
        content: "Hello World",
      });

      expect(result).toEqual({ success: true, bytesWritten: 11 });
      expect(writeHandler).toHaveBeenCalled();
    });

    it("should deny tool execution when confirmation hook denies", async () => {
      const store = useToolHooksStore.getState();
      
      // Register delete tool
      const deleteToolDef: ToolDefinition = {
        name: "test_delete_file",
        description: "Delete a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
      };

      const deleteHandler = vi.fn(async () => ({ success: true }));
      registerTool(deleteToolDef, deleteHandler);

      // Register a hook that denies
      const denyHook = vi.fn(async () => ({
        decision: "deny" as const,
        reason: "Delete operations not allowed",
      }));
      store.registerPreToolUse("deny-delete", denyHook);

      // Attempt to delete
      const routingContext: ToolContext = {
        toolName: "test_delete_file",
        toolCallId: "call-delete-1",
        sessionId: "session-1",
        arguments: { path: "/important.txt" },
        timestamp: new Date().toISOString(),
      };

      const routingResult = await store.routeToolUse(routingContext);
      
      // Should be denied
      expect(routingResult.decision).toBe("deny");
      expect(routingResult.reason).toBe("Delete operations not allowed");

      // Handler should NOT be called
      expect(deleteHandler).not.toHaveBeenCalled();

      store.unregisterPreToolUse("deny-delete");
    });
  });

  describe("Tool Execution with Audit Logging", () => {
    it("should log all tool executions to audit trail", async () => {
      const store = useToolHooksStore.getState();
      const auditLog: ToolContext[] = [];
      
      // Register audit hook
      const auditHook = vi.fn(async (context: ToolContext) => {
        auditLog.push(context);
        
        // Also log to store
        store.logToolExecution({
          toolName: context.toolName,
          sessionId: context.sessionId,
          toolCallId: context.toolCallId,
          arguments: context.arguments,
          status: "completed",
          requestedAt: context.timestamp,
          completedAt: new Date().toISOString(),
        });
      });
      store.registerPostToolUse("audit-log", auditHook);

      // Register a tool
      const toolDef: ToolDefinition = {
        name: "test_search_code",
        description: "Search code",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      };

      const handler = vi.fn(async () => ({
        results: [{ file: "/test.ts", line: 10, content: "function test()" }],
      }));

      registerTool(toolDef, handler);

      // Execute tool multiple times
      for (let i = 0; i < 3; i++) {
        const context: ToolExecutionContext = {
          sessionId: "session-audit",
          toolCallId: `call-audit-${i}`,
          timestamp: Date.now(),
        };

        const routingContext: ToolContext = {
          toolName: "test_search_code",
          toolCallId: `call-audit-${i}`,
          sessionId: "session-audit",
          arguments: { query: "function" },
          timestamp: new Date().toISOString(),
        };

        // Route (allow all)
        const routeResult = await store.routeToolUse(routingContext);
        expect(routeResult.decision).toBe("allow");

        // Execute
        await executeTool("test_search_code", context, { query: "function" });

        // Post-hooks
        await store.executePostToolHooks(routingContext, { results: [] }, undefined);
      }

      // Verify audit log
      expect(auditLog.length).toBe(3);
      expect(auditLog.every((ctx) => ctx.toolName === "test_search_code")).toBe(true);

      // Verify store executions
      const executions = store.getExecutionsForSession("session-audit");
      expect(executions.length).toBeGreaterThanOrEqual(3);

      store.unregisterPostToolUse("audit-log");
    });
  });

  describe("Error Handling in Tool Chain", () => {
    it("should handle errors in pre-hooks gracefully", async () => {
      const store = useToolHooksStore.getState();
      
      // Register a hook that throws
      const failingHook = vi.fn(async () => {
        throw new Error("Hook failed");
      });
      store.registerPreToolUse("failing-hook", failingHook);

      // Register a working hook after
      const workingHook = vi.fn(async () => ({ decision: "allow" as const }));
      store.registerPreToolUse("working-hook", workingHook);

      const routingContext: ToolContext = {
        toolName: "test_tool",
        toolCallId: "call-error-1",
        sessionId: "session-1",
        arguments: {},
        timestamp: new Date().toISOString(),
      };

      // Should continue to next hook even if one fails
      const result = await store.routeToolUse(routingContext);
      expect(result.decision).toBe("allow");
      expect(failingHook).toHaveBeenCalled();
      expect(workingHook).toHaveBeenCalled();

      store.unregisterPreToolUse("failing-hook");
      store.unregisterPreToolUse("working-hook");
    });

    it("should handle tool execution errors", async () => {
      const store = useToolHooksStore.getState();
      
      // Register a tool that returns an error (instead of throwing)
      const toolDef: ToolDefinition = {
        name: "test_failing_tool",
        description: "A tool that fails",
        parameters: { type: "object", properties: {} },
      };

      const failingHandler = vi.fn(async () => {
        return { result: null, error: "Tool execution failed" };
      });

      registerTool(toolDef, failingHandler);

      // Register error logging hook
      const errorLog: Array<{ error?: string }> = [];
      const errorHook = vi.fn(async (context: ToolContext, result: unknown, error?: string) => {
        errorLog.push({ error });
      });
      store.registerPostToolUse("error-log", errorHook);

      const context: ToolExecutionContext = {
        sessionId: "session-1",
        toolCallId: "call-error-2",
        timestamp: Date.now(),
      };

      // Execute returns error object
      const result = await executeTool("test_failing_tool", context, {});
      expect(result.error).toBe("Tool execution failed");
      expect(result.result).toBeNull();

      // Post-hook should be called
      const routingContext: ToolContext = {
        toolName: "test_failing_tool",
        toolCallId: "call-error-2",
        sessionId: "session-1",
        arguments: {},
        timestamp: new Date().toISOString(),
      };
      await store.executePostToolHooks(routingContext, null, "Tool execution failed");

      expect(errorHook).toHaveBeenCalled();

      store.unregisterPostToolUse("error-log");
    });
  });

  describe("Concurrent Tool Execution", () => {
    it("should handle multiple concurrent tool executions", async () => {
      const store = useToolHooksStore.getState();
      
      // Register a slow tool
      const toolDef: ToolDefinition = {
        name: "test_slow_tool",
        description: "A slow tool",
        parameters: { type: "object", properties: {} },
      };

      const slowHandler = vi.fn(async (ctx: ToolExecutionContext) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { result: ctx.toolCallId };
      });

      registerTool(toolDef, slowHandler);

      // Execute multiple tools concurrently
      const promises = Array.from({ length: 5 }, (_, i) => {
        const context: ToolExecutionContext = {
          sessionId: "session-concurrent",
          toolCallId: `call-concurrent-${i}`,
          timestamp: Date.now(),
        };
        return executeTool("test_slow_tool", context, {});
      });

      const results = await Promise.all(promises);

      // Verify all completed
      expect(results.length).toBe(5);
      results.forEach((result, i) => {
        expect(result).toEqual({ result: `call-concurrent-${i}` });
      });

      expect(slowHandler).toHaveBeenCalledTimes(5);
    });
  });

  describe("Session Isolation", () => {
    it("should isolate pending confirmations by session", async () => {
      const store = useToolHooksStore.getState();
      
      // Register confirmation hook
      const shouldConfirm = () => true;
      const confirmHook = createConfirmationHook(shouldConfirm);
      store.registerPreToolUse("always-confirm", confirmHook);

      // Create pending confirmations in different sessions
      const context1: ToolContext = {
        toolName: "test_tool",
        toolCallId: "call-session-1",
        sessionId: "session-a",
        arguments: {},
        timestamp: new Date().toISOString(),
      };

      const context2: ToolContext = {
        toolName: "test_tool",
        toolCallId: "call-session-2",
        sessionId: "session-b",
        arguments: {},
        timestamp: new Date().toISOString(),
      };

      store.requestConfirmation(context1, "Confirm for session A");
      store.requestConfirmation(context2, "Confirm for session B");

      // Verify isolation
      expect(store.hasPendingConfirmations("session-a")).toBe(true);
      expect(store.hasPendingConfirmations("session-b")).toBe(true);

      const sessionAConfirmations = store.getPendingConfirmationsForSession("session-a");
      expect(sessionAConfirmations.length).toBe(1);
      expect(sessionAConfirmations[0].sessionId).toBe("session-a");

      // Clean up
      store.denyTool("call-session-1");
      store.denyTool("call-session-2");

      store.unregisterPreToolUse("always-confirm");
    });
  });
});
