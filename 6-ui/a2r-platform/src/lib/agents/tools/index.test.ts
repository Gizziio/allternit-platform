/**
 * Tool Registry Tests
 * 
 * Tests for:
 * - Tool registration
 * - Tool execution
 * - Tool definition retrieval
 * - Handler management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerTool,
  executeTool,
  getToolDefinition,
  getAllToolDefinitions,
  isToolRegistered,
  unregisterTool,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./index";

describe("Tool Registration", () => {
  beforeEach(() => {
    // Clear all registered tools
    const allTools = getAllToolDefinitions();
    allTools.forEach((tool) => {
      unregisterTool(tool.name);
    });
  });

  it("should register a new tool", () => {
    const definition: ToolDefinition = {
      name: "test_tool",
      description: "A test tool",
      parameters: {
        type: "object",
        properties: {
          input: { type: "string" },
        },
        required: ["input"],
      },
    };

    const handler = vi.fn(async () => ({ result: "success" }));

    registerTool(definition, handler);

    expect(isToolRegistered("test_tool")).toBe(true);
    expect(getToolDefinition("test_tool")).toEqual(definition);
  });

  it("should throw when registering duplicate tool", () => {
    const definition: ToolDefinition = {
      name: "test_tool",
      description: "A test tool",
      parameters: { type: "object", properties: {} },
    };

    const handler = vi.fn(async () => ({ result: "success" }));

    registerTool(definition, handler);

    expect(() => registerTool(definition, handler)).toThrow(
      'Tool "test_tool" is already registered'
    );
  });

  it("should unregister a tool", () => {
    const definition: ToolDefinition = {
      name: "test_tool",
      description: "A test tool",
      parameters: { type: "object", properties: {} },
    };

    registerTool(definition, vi.fn());
    expect(isToolRegistered("test_tool")).toBe(true);

    unregisterTool("test_tool");

    expect(isToolRegistered("test_tool")).toBe(false);
    expect(getToolDefinition("test_tool")).toBeUndefined();
  });

  it("should return all tool definitions", () => {
    const tool1: ToolDefinition = {
      name: "tool_1",
      description: "First tool",
      parameters: { type: "object", properties: {} },
    };

    const tool2: ToolDefinition = {
      name: "tool_2",
      description: "Second tool",
      parameters: { type: "object", properties: {} },
    };

    registerTool(tool1, vi.fn());
    registerTool(tool2, vi.fn());

    const allTools = getAllToolDefinitions();
    expect(allTools.length).toBe(2);
    expect(allTools.map((t) => t.name).sort()).toEqual(["tool_1", "tool_2"]);
  });
});

describe("Tool Execution", () => {
  beforeEach(() => {
    const allTools = getAllToolDefinitions();
    allTools.forEach((tool) => {
      unregisterTool(tool.name);
    });
  });

  it("should execute a registered tool", async () => {
    const definition: ToolDefinition = {
      name: "echo",
      description: "Echoes the input",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: ["message"],
      },
    };

    const handler = vi.fn(async (context: ToolExecutionContext, params: Record<string, unknown>) => {
      return { result: params.message };
    });

    registerTool(definition, handler);

    const context: ToolExecutionContext = {
      sessionId: "session-1",
      toolCallId: "call-1",
      timestamp: Date.now(),
    };

    const result = await executeTool("echo", context, { message: "Hello" });

    expect(result).toEqual({ result: "Hello" });
    expect(handler).toHaveBeenCalledWith(context, { message: "Hello" });
  });

  it("should return error for unregistered tool", async () => {
    const context: ToolExecutionContext = {
      sessionId: "session-1",
      toolCallId: "call-1",
      timestamp: Date.now(),
    };

    const result = await executeTool("nonexistent", context, {});
    expect(result.error).toContain('Tool "nonexistent" is not registered');
    expect(result.result).toBeNull();
  });

  it("should handle tool execution errors", async () => {
    const definition: ToolDefinition = {
      name: "failing_tool",
      description: "A tool that fails",
      parameters: { type: "object", properties: {} },
    };

    const handler = vi.fn(async () => {
      throw new Error("Tool execution failed");
    });

    registerTool(definition, handler);

    const context: ToolExecutionContext = {
      sessionId: "session-1",
      toolCallId: "call-1",
      timestamp: Date.now(),
    };

    const result = await executeTool("failing_tool", context, {});
    expect(result.error).toBe("Tool execution failed");
    expect(result.result).toBeNull();
  });

  it("should handle async tool execution", async () => {
    const definition: ToolDefinition = {
      name: "async_tool",
      description: "An async tool",
      parameters: { type: "object", properties: {} },
    };

    const handler = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { result: "async result" };
    });

    registerTool(definition, handler);

    const context: ToolExecutionContext = {
      sessionId: "session-1",
      toolCallId: "call-1",
      timestamp: Date.now(),
    };

    const result = await executeTool("async_tool", context, {});

    expect(result).toEqual({ result: "async result" });
  });

  it("should pass correct context to handler", async () => {
    const definition: ToolDefinition = {
      name: "context_tool",
      description: "A tool that checks context",
      parameters: { type: "object", properties: {} },
    };

    let receivedContext: ToolExecutionContext | null = null;
    const handler = vi.fn(async (context: ToolExecutionContext) => {
      receivedContext = context;
      return { result: "ok" };
    });

    registerTool(definition, handler);

    const context: ToolExecutionContext = {
      sessionId: "test-session",
      toolCallId: "test-call-123",
      timestamp: 1234567890,
    };

    await executeTool("context_tool", context, {});

    expect(receivedContext).toEqual(context);
  });
});

describe("Tool Definition Validation", () => {
  it("should accept valid tool definition", () => {
    const definition: ToolDefinition = {
      name: "valid_tool",
      description: "A valid tool",
      parameters: {
        type: "object",
        properties: {
          input: { 
            type: "string",
            description: "Input string",
          },
          count: { 
            type: "number",
            description: "Count value",
          },
        },
        required: ["input"],
      },
    };

    const handler = vi.fn(async () => ({ result: "ok" }));

    expect(() => registerTool(definition, handler)).not.toThrow();
  });

  it("should handle tool with no parameters", () => {
    const definition: ToolDefinition = {
      name: "no_params_tool",
      description: "A tool with no parameters",
      parameters: {
        type: "object",
        properties: {},
      },
    };

    const handler = vi.fn(async () => ({ result: "ok" }));

    expect(() => registerTool(definition, handler)).not.toThrow();
  });

  it("should handle tool with complex parameters", () => {
    const definition: ToolDefinition = {
      name: "complex_tool",
      description: "A tool with complex parameters",
      parameters: {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              items: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    };

    const handler = vi.fn(async () => ({ result: "ok" }));

    expect(() => registerTool(definition, handler)).not.toThrow();
  });
});

describe("Tool Execution Context", () => {
  beforeEach(() => {
    const allTools = getAllToolDefinitions();
    allTools.forEach((tool) => {
      unregisterTool(tool.name);
    });
  });

  it("should include session ID in context", async () => {
    const definition: ToolDefinition = {
      name: "session_tool",
      description: "A tool that uses session",
      parameters: { type: "object", properties: {} },
    };

    let capturedSessionId = "";
    const handler = vi.fn(async (context: ToolExecutionContext) => {
      capturedSessionId = context.sessionId;
      return { result: "ok" };
    });

    registerTool(definition, handler);

    await executeTool(
      "session_tool",
      {
        sessionId: "my-session-123",
        toolCallId: "call-1",
        timestamp: Date.now(),
      },
      {}
    );

    expect(capturedSessionId).toBe("my-session-123");
  });

  it("should include tool call ID in context", async () => {
    const definition: ToolDefinition = {
      name: "callid_tool",
      description: "A tool that uses call ID",
      parameters: { type: "object", properties: {} },
    };

    let capturedCallId = "";
    const handler = vi.fn(async (context: ToolExecutionContext) => {
      capturedCallId = context.toolCallId;
      return { result: "ok" };
    });

    registerTool(definition, handler);

    await executeTool(
      "callid_tool",
      {
        sessionId: "session-1",
        toolCallId: "unique-call-id-456",
        timestamp: Date.now(),
      },
      {}
    );

    expect(capturedCallId).toBe("unique-call-id-456");
  });

  it("should include timestamp in context", async () => {
    const definition: ToolDefinition = {
      name: "timestamp_tool",
      description: "A tool that uses timestamp",
      parameters: { type: "object", properties: {} },
    };

    let capturedTimestamp = 0;
    const handler = vi.fn(async (context: ToolExecutionContext) => {
      capturedTimestamp = context.timestamp;
      return { result: "ok" };
    });

    registerTool(definition, handler);

    const now = Date.now();
    await executeTool(
      "timestamp_tool",
      {
        sessionId: "session-1",
        toolCallId: "call-1",
        timestamp: now,
      },
      {}
    );

    expect(capturedTimestamp).toBe(now);
  });
});
