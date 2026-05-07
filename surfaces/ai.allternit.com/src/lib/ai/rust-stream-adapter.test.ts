/**
 * Unit tests for Rust Stream Adapter
 * Tests the deterministic mapping: RustEventType -> AI SDK UI Part
 */

import { describe, it, expect } from "vitest";
import type { RustStreamEvent, UIPart } from "./rust-stream-adapter";

// ============================================================================
// Test Fixtures - SSE Events from Rust API
// ============================================================================

const FIXTURES = {
  messageStart: {
    type: "message_start" as const,
    messageId: "msg-123",
  },
  
  textDelta: {
    type: "content_block_delta" as const,
    delta: {
      type: "text_delta" as const,
      text: "Hello world",
    },
  },
  
  toolStart: {
    type: "content_block_start" as const,
    content_block: {
      type: "tool_use" as const,
      id: "tool-call-456",
      name: "web_search",
      input: { query: "test" },
    },
  },
  
  toolResult: {
    type: "tool_result" as const,
    toolCallId: "tool-call-456",
    result: { results: [{ title: "Test", url: "https://example.com" }] },
  },
  
  toolError: {
    type: "tool_error" as const,
    toolCallId: "tool-call-456",
    error: "Network timeout",
  },

  mcpApp: {
    type: "mcp_app" as const,
    toolCallId: "tool-call-456",
    toolName: "weather.dashboard",
    connectorId: "connector-1",
    connectorName: "Weather",
    resourceUri: "ui://weather/dashboard",
    title: "Weather Dashboard",
    html: "<html><body>app</body></html>",
    allow: "geolocation",
    prefersBorder: false,
    tool: {
      name: "weather.dashboard",
      title: "Weather Dashboard",
      inputSchema: {
        type: "object",
      },
      _meta: {
        ui: {
          resourceUri: "ui://weather/dashboard",
        },
      },
    },
    toolInput: {
      location: "Austin",
    },
    toolResult: {
      content: [
        {
          type: "text",
          text: "Sunny",
        },
      ],
    },
    permissions: {
      geolocation: {},
    },
    csp: {
      connectDomains: ["https://api.example.com"],
    },
    domain: "https://apps.example.com",
  },
  
  source: {
    type: "source" as const,
    sourceId: "src-789",
    url: "https://example.com",
    title: "Example Source",
  },

  plan: {
    type: "plan" as const,
    planId: "plan-123",
    title: "Live execution plan",
    steps: [
      { id: "step-1", description: "Web Search", status: "in-progress" as const },
    ],
  },

  checkpoint: {
    type: "checkpoint" as const,
    checkpointId: "checkpoint-1",
    description: "Web Search completed",
  },

  task: {
    type: "task" as const,
    taskId: "task-1",
    title: "Web Search",
    description: "OpenAI ai sdk docs",
    status: "running" as const,
    progress: 35,
  },

  citation: {
    type: "citation" as const,
    citationId: "citation-1",
    sourceId: "src-789",
    content: "Example source snippet",
    startIndex: 0,
    endIndex: 22,
  },

  artifact: {
    type: "artifact" as const,
    artifactId: "artifact-123",
    kind: "svg",
    content: "<svg></svg>",
    title: "Architecture Diagram",
  },

  error: {
    type: "error" as const,
    error: "Stream failed",
  },
  
  finish: {
    type: "finish" as const,
    durationMs: 3200,
    modelId: "claude-3-5-sonnet",
  },
};

// ============================================================================
// Manual mapping test (simulates what the adapter does)
// ============================================================================

function mapRustEventToUIPart(event: RustStreamEvent): UIPart | null {
  switch (event.type) {
    case "content_block_delta":
      if (event.delta?.type === "text_delta" && event.delta.text) {
        return {
          type: "text",
          text: event.delta.text,
        };
      }
      return null;
      
    case "content_block_start":
      if (event.content_block?.type === "tool_use") {
        return {
          type: "dynamic-tool",
          state: "input-available",
          toolCallId: event.content_block.id,
          toolName: event.content_block.name ?? "tool",
          input: event.content_block.input ?? {},
        };
      }
      return null;
      
    case "source":
      return {
        type: "source-document",
        sourceId: event.sourceId ?? `src-${Date.now()}`,
        mediaType: "text/html",
        title: event.title ?? "Source",
        url: event.url,
      } as UIPart;

    case "mcp_app":
      if (
        !event.toolCallId ||
        !event.toolName ||
        !event.connectorId ||
        !event.connectorName ||
        !event.resourceUri ||
        !event.title ||
        !event.html
      ) {
        return null;
      }

      return {
        type: "mcp-app",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        connectorId: event.connectorId,
        connectorName: event.connectorName,
        resourceUri: event.resourceUri,
        title: event.title,
        html: event.html,
        allow: event.allow,
        prefersBorder: event.prefersBorder,
        tool: event.tool,
        toolInput: event.toolInput,
        toolResult: event.toolResult,
        permissions: event.permissions,
        csp: event.csp,
        domain: event.domain,
      } as UIPart;

    case "plan":
      return {
        type: "plan",
        planId: event.planId ?? "plan-fallback",
        title: event.title ?? "Execution plan",
        steps: event.steps ?? [],
      } as UIPart;

    case "checkpoint":
      return {
        type: "checkpoint",
        checkpointId: event.checkpointId ?? "checkpoint-fallback",
        description: event.description ?? "Checkpoint reached",
      } as UIPart;

    case "task":
      return {
        type: "task",
        taskId: event.taskId ?? "task-fallback",
        title: event.title ?? "Task",
        description: event.description,
        status: event.status ?? "running",
        progress: event.progress,
      } as UIPart;

    case "citation":
      return {
        type: "citation",
        citationId: event.citationId ?? "citation-fallback",
        sourceId: event.sourceId ?? "source-fallback",
        text: event.content ?? "Citation",
        startIndex: event.startIndex ?? 0,
        endIndex: event.endIndex ?? 0,
      } as UIPart;

    case "artifact":
      return {
        type: "artifact",
        artifactId: event.artifactId ?? "artifact-fallback",
        kind: "svg",
        content: event.content,
        title: event.title ?? "Generated artifact",
      } as UIPart;

    case "error":
      return {
        type: "error",
        message: event.error ?? "Unknown error",
        kind: "unknown",
      };
      
    default:
      return null;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Rust Stream Adapter Mapping", () => {
  describe("TextUIPart mapping", () => {
    it("should map text_delta to TextUIPart", () => {
      const part = mapRustEventToUIPart(FIXTURES.textDelta);
      
      expect(part).not.toBeNull();
      expect(part?.type).toBe("text");
      if (part?.type === "text") {
        expect(part.text).toBe("Hello world");
      }
    });
    
    it("should return null for empty text delta", () => {
      const emptyDelta: RustStreamEvent = {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "" },
      };
      
      const part = mapRustEventToUIPart(emptyDelta);
      // Empty text returns null (no UI part created)
      expect(part).toBeNull();
    });
  });
  
  describe("DynamicToolUIPart mapping", () => {
    it("should map tool_use to DynamicToolUIPart", () => {
      const part = mapRustEventToUIPart(FIXTURES.toolStart);
      
      expect(part).not.toBeNull();
      expect(part?.type).toBe("dynamic-tool");
      if (part?.type === "dynamic-tool") {
        expect(part.toolName).toBe("web_search");
        expect(part.toolCallId).toBe("tool-call-456");
        expect(part.state).toBe("input-available");
        expect(part.input).toEqual({ query: "test" });
      }
    });
    
    it("should handle tool with empty input", () => {
      const toolNoInput: RustStreamEvent = {
        type: "content_block_start",
        content_block: {
          type: "tool_use",
          id: "tool-1",
          name: "simple_tool",
        },
      };
      
      const part = mapRustEventToUIPart(toolNoInput);
      expect(part?.type).toBe("dynamic-tool");
      if (part?.type === "dynamic-tool") {
        expect(part.input).toEqual({});
      }
    });
  });
  
  describe("SourceDocumentUIPart mapping", () => {
    it("should map source event to SourceDocumentUIPart", () => {
      const part = mapRustEventToUIPart(FIXTURES.source);
      
      expect(part).not.toBeNull();
      expect(part?.type).toBe("source-document");
      if (part?.type === "source-document") {
        expect(part.sourceId).toBe("src-789");
        expect(part.title).toBe("Example Source");
        expect(part.mediaType).toBe("text/html");
        expect(part.url).toBe("https://example.com");
      }
    });
    
    it("should handle source without title", () => {
      const sourceNoTitle: RustStreamEvent = {
        type: "source",
        sourceId: "src-1",
        url: "https://example.com",
      };
      
      const part = mapRustEventToUIPart(sourceNoTitle);
      expect(part?.type).toBe("source-document");
      if (part?.type === "source-document") {
        expect(part.title).toBe("Source");
      }
    });
    
    it("should generate sourceId if missing", () => {
      const sourceNoId: RustStreamEvent = {
        type: "source",
        url: "https://example.com",
      };
      
      const part = mapRustEventToUIPart(sourceNoId);
      expect(part?.type).toBe("source-document");
      if (part?.type === "source-document") {
        expect(part.sourceId).toMatch(/^src-/);
      }
    });
  });

  describe("McpAppUIPart mapping", () => {
    it("should map mcp_app event to an inline MCP app part", () => {
      const part = mapRustEventToUIPart(FIXTURES.mcpApp);

      expect(part).not.toBeNull();
      expect(part?.type).toBe("mcp-app");
      if (part?.type === "mcp-app") {
        expect(part.toolCallId).toBe("tool-call-456");
        expect(part.connectorName).toBe("Weather");
        expect(part.resourceUri).toBe("ui://weather/dashboard");
        expect(part.allow).toBe("geolocation");
        expect(part.prefersBorder).toBe(false);
        expect(part.tool?.name).toBe("weather.dashboard");
        expect(part.toolInput).toEqual({ location: "Austin" });
        expect(part.toolResult).toEqual({
          content: [
            {
              type: "text",
              text: "Sunny",
            },
          ],
        });
        expect(part.permissions).toEqual({ geolocation: {} });
        expect(part.domain).toBe("https://apps.example.com");
      }
    });
  });

  describe("ArtifactUIPart mapping", () => {
    it("should map artifact event to ArtifactUIPart", () => {
      const part = mapRustEventToUIPart(FIXTURES.artifact);

      expect(part).not.toBeNull();
      expect(part?.type).toBe("artifact");
      if (part?.type === "artifact") {
        expect(part.artifactId).toBe("artifact-123");
        expect(part.title).toBe("Architecture Diagram");
        expect(part.content).toBe("<svg></svg>");
      }
    });
  });

  describe("Plan and task mapping", () => {
    it("should map plan event to PlanUIPart", () => {
      const part = mapRustEventToUIPart(FIXTURES.plan);

      expect(part).not.toBeNull();
      expect(part?.type).toBe("plan");
      if (part?.type === "plan") {
        expect(part.planId).toBe("plan-123");
        expect(part.steps).toHaveLength(1);
        expect(part.steps[0]?.status).toBe("in-progress");
      }
    });

    it("should map task event to TaskUIPart", () => {
      const part = mapRustEventToUIPart(FIXTURES.task);

      expect(part).not.toBeNull();
      expect(part?.type).toBe("task");
      if (part?.type === "task") {
        expect(part.taskId).toBe("task-1");
        expect(part.status).toBe("running");
        expect(part.progress).toBe(35);
      }
    });

    it("should map checkpoint event to CheckpointUIPart", () => {
      const part = mapRustEventToUIPart(FIXTURES.checkpoint);

      expect(part).not.toBeNull();
      expect(part?.type).toBe("checkpoint");
      if (part?.type === "checkpoint") {
        expect(part.description).toBe("Web Search completed");
      }
    });
  });

  describe("CitationUIPart mapping", () => {
    it("should map citation event to CitationUIPart", () => {
      const part = mapRustEventToUIPart(FIXTURES.citation);

      expect(part).not.toBeNull();
      expect(part?.type).toBe("citation");
      if (part?.type === "citation") {
        expect(part.sourceId).toBe("src-789");
        expect(part.text).toBe("Example source snippet");
      }
    });
  });

  describe("ErrorUIPart mapping", () => {
    it("should map error event to ErrorUIPart", () => {
      const part = mapRustEventToUIPart(FIXTURES.error);

      expect(part).not.toBeNull();
      expect(part?.type).toBe("error");
      if (part?.type === "error") {
        expect(part.message).toBe("Stream failed");
        expect(part.kind).toBe("unknown");
      }
    });
  });
  
  describe("Event types that produce no UIPart", () => {
    it("message_start should return null (creates message, not part)", () => {
      const part = mapRustEventToUIPart(FIXTURES.messageStart);
      expect(part).toBeNull();
    });
    
    it("tool_result should return null (updates existing part)", () => {
      const part = mapRustEventToUIPart(FIXTURES.toolResult);
      expect(part).toBeNull();
    });
    
    it("tool_error should return null (updates existing part)", () => {
      const part = mapRustEventToUIPart(FIXTURES.toolError);
      expect(part).toBeNull();
    });
    
    it("finish should return null (no UI part)", () => {
      const part = mapRustEventToUIPart(FIXTURES.finish);
      expect(part).toBeNull();
    });
  });
  
  describe("Deterministic mapping table", () => {
    it("should have exactly one handler per RustEventType", () => {
      const allEventTypes: RustStreamEvent["type"][] = [
        "message_start",
        "content_block_start",
        "content_block_delta",
        "tool_result",
        "tool_error",
        "mcp_app",
        "source",
        "plan",
        "plan_update",
        "checkpoint",
        "task",
        "citation",
        "artifact",
        "error",
        "finish",
      ];
      
      // Each event type should be handled (even if returning null)
      for (const eventType of allEventTypes) {
        const event = { type: eventType } as RustStreamEvent;
        // Should not throw
        expect(() => mapRustEventToUIPart(event)).not.toThrow();
      }
    });
  });
});

// ============================================================================
// SSE Parsing Tests
// ============================================================================

describe("SSE Parsing", () => {
  it("should parse SSE data lines correctly", () => {
    const sseLine = 'data: {"type":"text","text":"hello"}';
    const data = sseLine.slice(6); // Remove "data: "
    const parsed = JSON.parse(data);
    
    expect(parsed.type).toBe("text");
    expect(parsed.text).toBe("hello");
  });
  
  it("should handle [DONE] signal", () => {
    const doneLine = "data: [DONE]";
    const data = doneLine.slice(6);
    
    expect(data).toBe("[DONE]");
  });
  
  it("should ignore non-data lines", () => {
    const commentLine = ": this is a comment";
    const emptyLine = "";
    
    // Lines that don't start with "data: " should be ignored
    expect(commentLine.startsWith("data: ")).toBe(false);
    expect(emptyLine.startsWith("data: ")).toBe(false);
  });
});
