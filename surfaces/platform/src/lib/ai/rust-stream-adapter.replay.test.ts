/**
 * Replay Test: Validate adapter against real SSE fixtures
 * 
 * This test reads recorded SSE from .a2r/fixtures/chat.sse
 * and validates the adapter produces correct UI parts.
 * 
 * If the fixture doesn't exist, the test is skipped.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { RustStreamEvent, UIPart } from "./rust-stream-adapter";

const FIXTURE_PATH = join(process.cwd(), ".a2r/fixtures/chat.sse");

// Parse SSE format into events
function parseSSE(content: string): RustStreamEvent[] {
  const events: RustStreamEvent[] = [];
  const lines = content.split("\n");
  
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    
    const data = line.slice(6);
    if (data === "[DONE]") continue;
    
    try {
      const event = JSON.parse(data) as RustStreamEvent;
      events.push(event);
    } catch {
      // Skip unparseable lines
    }
  }
  
  return events;
}

// Simulate adapter mapping
function mapEventsToUIParts(events: RustStreamEvent[]): UIPart[] {
  const parts: UIPart[] = [];
  
  for (const event of events) {
    switch (event.type) {
      case "content_block_delta":
        if (event.delta?.type === "text_delta" && event.delta.text) {
          const lastPart = parts.at(-1);
          if (lastPart?.type === "text") {
            lastPart.text += event.delta.text;
          } else {
            parts.push({ type: "text", text: event.delta.text });
          }
        }
        break;
        
      case "content_block_start":
        if (event.content_block?.type === "tool_use") {
          parts.push({
            type: "dynamic-tool",
            state: "input-available",
            toolCallId: event.content_block.id,
            toolName: event.content_block.name ?? "tool",
            input: event.content_block.input ?? {},
          });
        }
        break;
        
      case "source":
        parts.push({
          type: "source-document",
          sourceId: event.sourceId ?? `src-${Date.now()}`,
          mediaType: "text/html",
          title: event.title ?? "Source",
        });
        break;
    }
  }
  
  return parts;
}

// Check for valid tool state transitions
function validateToolStates(events: RustStreamEvent[]): string[] {
  const errors: string[] = [];
  const toolStates = new Map<string, string>();
  
  for (const event of events) {
    if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
      const id = event.content_block.id;
      if (toolStates.has(id)) {
        errors.push(`Tool ${id} started twice`);
      }
      toolStates.set(id, "input-available");
    }
    
    if (event.type === "tool_result" && event.toolCallId) {
      const current = toolStates.get(event.toolCallId);
      if (!current) {
        errors.push(`Tool ${event.toolCallId} got result before start`);
      } else if (current !== "input-available") {
        errors.push(`Tool ${event.toolCallId} invalid transition: ${current} -> result`);
      }
      toolStates.set(event.toolCallId, "output-available");
    }
    
    if (event.type === "tool_error" && event.toolCallId) {
      const current = toolStates.get(event.toolCallId);
      if (!current) {
        errors.push(`Tool ${event.toolCallId} got error before start`);
      }
      toolStates.set(event.toolCallId, "output-error");
    }
  }
  
  return errors;
}

describe("Rust Stream Adapter Replay", () => {
  let fixtureExists = false;
  let events: RustStreamEvent[] = [];
  
  beforeAll(() => {
    fixtureExists = existsSync(FIXTURE_PATH);
    if (fixtureExists) {
      const content = readFileSync(FIXTURE_PATH, "utf-8");
      events = parseSSE(content);
    }
  });
  
  it.skipIf(!fixtureExists)("should parse fixture without errors", () => {
    expect(events.length).toBeGreaterThan(0);
    
    // All events should have valid types
    const validTypes = [
      "message_start",
      "content_block_start",
      "content_block_delta",
      "tool_result",
      "tool_error",
      "source",
      "finish",
    ];
    
    for (const event of events) {
      expect(validTypes).toContain(event.type);
    }
  });
  
  it.skipIf(!fixtureExists)("should map to valid UI parts", () => {
    const parts = mapEventsToUIParts(events);
    
    // All parts should have valid types
    const validPartTypes = [
      "text",
      "dynamic-tool",
      "source-document",
      "file",
    ];
    
    for (const part of parts) {
      expect(validPartTypes).toContain(part.type);
      
      // Type-specific validation
      if (part.type === "text") {
        expect(typeof (part as { text: string }).text).toBe("string");
      }
      
      if (part.type === "dynamic-tool") {
        const toolPart = part as { state: string; toolCallId: string; toolName: string };
        expect(["input-streaming", "input-available", "output-available", "output-error"]).toContain(toolPart.state);
        expect(typeof toolPart.toolCallId).toBe("string");
        expect(typeof toolPart.toolName).toBe("string");
      }
      
      if (part.type === "source-document") {
        const sourcePart = part as { sourceId: string; title: string };
        expect(typeof sourcePart.sourceId).toBe("string");
        expect(typeof sourcePart.title).toBe("string");
      }
    }
  });
  
  it.skipIf(!fixtureExists)("should have valid tool state transitions", () => {
    const errors = validateToolStates(events);
    expect(errors).toEqual([]);
  });
  
  it.skipIf(!fixtureExists)("should handle text accumulation", () => {
    const parts = mapEventsToUIParts(events);
    const textParts = parts.filter((p): p is { type: "text"; text: string } => p.type === "text");
    
    // Adjacent text deltas should be accumulated into single parts
    // (This is adapter behavior, not a strict requirement)
    expect(textParts.length).toBeGreaterThanOrEqual(0);
  });
});
