import { describe, expect, it } from "vitest";
import {
  createConversationReplyState,
  reduceReplyEvent,
} from "./index";
import type { ReplyEvent, ConversationReplyState } from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyEvents(
  events: ReplyEvent[],
  initial?: ConversationReplyState,
): ConversationReplyState {
  return events.reduce(
    (state, event) => reduceReplyEvent(state, event),
    initial ?? createConversationReplyState(),
  );
}

const TS = 1_700_000_000_000;

// ---------------------------------------------------------------------------
// createConversationReplyState
// ---------------------------------------------------------------------------

describe("createConversationReplyState", () => {
  it("returns empty replies and orderedReplyIds", () => {
    const state = createConversationReplyState();
    expect(state.replies).toEqual({});
    expect(state.orderedReplyIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// reply lifecycle
// ---------------------------------------------------------------------------

describe("reply lifecycle", () => {
  it("reply.started opens a streaming reply", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", conversationId: "conv1", ts: TS },
    ]);
    expect(state.orderedReplyIds).toEqual(["r1"]);
    expect(state.replies["r1"]).toMatchObject({
      id: "r1",
      runId: "run_r1",
      conversationId: "conv1",
      status: "streaming",
      items: [],
    });
  });

  it("reply.started is idempotent — does not duplicate orderedReplyIds", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS + 1 },
    ]);
    expect(state.orderedReplyIds).toEqual(["r1"]);
  });

  it("reply.completed sets status and completedAt", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      { type: "reply.completed", replyId: "r1", runId: "run_r1", ts: TS + 500 },
    ]);
    expect(state.replies["r1"].status).toBe("complete");
    expect(state.replies["r1"].completedAt).toBe(TS + 500);
  });

  it("reply.failed sets status and error", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      { type: "reply.failed", replyId: "r1", runId: "run_r1", error: "timeout", ts: TS + 500 },
    ]);
    expect(state.replies["r1"].status).toBe("failed");
    expect(state.replies["r1"].error).toBe("timeout");
  });

  it("events for unknown replyId are no-ops", () => {
    const state = applyEvents([
      { type: "reply.completed", replyId: "unknown", runId: "run_unknown", ts: TS },
    ]);
    expect(state.orderedReplyIds).toEqual([]);
    expect(state.replies).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// text item
// ---------------------------------------------------------------------------

describe("text item", () => {
  it("reply.item.added (text) creates open item with empty text", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      { type: "reply.item.added", replyId: "r1", runId: "run_r1", itemId: "i1", kind: "text", ts: TS },
    ]);
    expect(state.replies["r1"].items[0]).toMatchObject({
      kind: "text", id: "i1", text: "", isOpen: true,
    });
  });

  it("reply.text.delta accumulates text", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      { type: "reply.item.added", replyId: "r1", runId: "run_r1", itemId: "i1", kind: "text", ts: TS },
      { type: "reply.text.delta", replyId: "r1", runId: "run_r1", itemId: "i1", delta: "Hello", ts: TS },
      { type: "reply.text.delta", replyId: "r1", runId: "run_r1", itemId: "i1", delta: " world", ts: TS },
    ]);
    expect((state.replies["r1"].items[0] as { text: string }).text).toBe("Hello world");
  });

  it("reply.item.done closes the item", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      { type: "reply.item.added", replyId: "r1", runId: "run_r1", itemId: "i1", kind: "text", ts: TS },
      { type: "reply.text.delta", replyId: "r1", runId: "run_r1", itemId: "i1", delta: "Hi", ts: TS },
      { type: "reply.item.done", replyId: "r1", runId: "run_r1", itemId: "i1", ts: TS },
    ]);
    expect(state.replies["r1"].items[0].isOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reasoning item
// ---------------------------------------------------------------------------

describe("reasoning item", () => {
  it("accumulates reasoning delta and stores summary", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      { type: "reply.item.added", replyId: "r1", runId: "run_r1", itemId: "think1", kind: "reasoning", ts: TS },
      { type: "reply.reasoning.delta", replyId: "r1", runId: "run_r1", itemId: "think1", delta: "Step 1.", summary: "Thinking…", ts: TS },
      { type: "reply.reasoning.delta", replyId: "r1", runId: "run_r1", itemId: "think1", delta: " Step 2.", ts: TS },
    ]);
    const item = state.replies["r1"].items[0] as { text: string; summary?: string };
    expect(item.text).toBe("Step 1. Step 2.");
    expect(item.summary).toBe("Thinking…");
  });
});

// ---------------------------------------------------------------------------
// tool_call item
// ---------------------------------------------------------------------------

describe("tool_call item", () => {
  it("full lifecycle: queued → running → done", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      { type: "reply.item.added", replyId: "r1", runId: "run_r1", itemId: "tc1", kind: "tool_call", ts: TS },
      {
        type: "tool_call.started",
        replyId: "r1", runId: "run_r1", itemId: "tc1",
        toolCallId: "tc1", toolName: "bash", input: { cmd: "ls" }, ts: TS,
      },
      {
        type: "tool_call.progress",
        replyId: "r1", runId: "run_r1", itemId: "tc1",
        toolCallId: "tc1", statusText: "running…", ts: TS,
      },
      {
        type: "tool_call.completed",
        replyId: "r1", runId: "run_r1", itemId: "tc1",
        toolCallId: "tc1", output: { stdout: "file.ts" }, ts: TS + 200,
      },
    ]);
    const item = state.replies["r1"].items[0] as {
      kind: string; state: string; toolName: string;
      input: unknown; progressLines: string[]; output: unknown; isOpen: boolean; endedAt?: number;
    };
    expect(item.kind).toBe("tool_call");
    expect(item.state).toBe("done");
    expect(item.toolName).toBe("bash");
    expect(item.input).toEqual({ cmd: "ls" });
    expect(item.progressLines).toEqual(["running…"]);
    expect(item.output).toEqual({ stdout: "file.ts" });
    expect(item.isOpen).toBe(false);
    expect(item.endedAt).toBe(TS + 200);
  });

  it("tool_call.failed sets error state and keeps item open", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      { type: "reply.item.added", replyId: "r1", runId: "run_r1", itemId: "tc1", kind: "tool_call", ts: TS },
      {
        type: "tool_call.started",
        replyId: "r1", runId: "run_r1", itemId: "tc1",
        toolCallId: "tc1", toolName: "read_file", ts: TS,
      },
      {
        type: "tool_call.failed",
        replyId: "r1", runId: "run_r1", itemId: "tc1",
        toolCallId: "tc1", error: "file not found", ts: TS + 100,
      },
    ]);
    const item = state.replies["r1"].items[0] as { state: string; error?: string; isOpen: boolean };
    expect(item.state).toBe("error");
    expect(item.error).toBe("file not found");
    expect(item.isOpen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// artifact item
// ---------------------------------------------------------------------------

describe("artifact item", () => {
  it("artifact.created creates and populates artifact item", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      {
        type: "artifact.created",
        replyId: "r1", runId: "run_r1", itemId: "art1",
        artifactId: "a-001", artifactType: "code", title: "solution.ts",
        url: "https://example.com/art/a-001", ts: TS,
      },
    ]);
    const item = state.replies["r1"].items[0] as {
      kind: string; artifactId: string; artifactType: string; title: string; url?: string;
    };
    expect(item.kind).toBe("artifact");
    expect(item.artifactId).toBe("a-001");
    expect(item.artifactType).toBe("code");
    expect(item.title).toBe("solution.ts");
    expect(item.url).toBe("https://example.com/art/a-001");
  });
});

// ---------------------------------------------------------------------------
// citation item
// ---------------------------------------------------------------------------

describe("citation item", () => {
  it("citation.added accumulates multiple refs", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      {
        type: "citation.added",
        replyId: "r1", runId: "run_r1", itemId: "cit1",
        citationId: "c1", title: "RFC 2119", url: "https://rfc.example/2119", ts: TS,
      },
      {
        type: "citation.added",
        replyId: "r1", runId: "run_r1", itemId: "cit1",
        citationId: "c2", title: "RFC 7230", url: "https://rfc.example/7230", snippet: "HTTP/1.1", ts: TS,
      },
    ]);
    const item = state.replies["r1"].items[0] as { kind: string; items: { id: string; title: string; snippet?: string }[] };
    expect(item.kind).toBe("citation");
    expect(item.items).toHaveLength(2);
    expect(item.items[0].id).toBe("c1");
    expect(item.items[1].snippet).toBe("HTTP/1.1");
  });
});

// ---------------------------------------------------------------------------
// multi-reply conversation
// ---------------------------------------------------------------------------

describe("multi-reply conversation", () => {
  it("orderedReplyIds preserves insertion order across multiple replies", () => {
    const state = applyEvents([
      { type: "reply.started", replyId: "r1", runId: "run_r1", ts: TS },
      { type: "reply.completed", replyId: "r1", runId: "run_r1", ts: TS + 100 },
      { type: "reply.started", replyId: "r2", runId: "run_r2", ts: TS + 200 },
      { type: "reply.completed", replyId: "r2", runId: "run_r2", ts: TS + 300 },
    ]);
    expect(state.orderedReplyIds).toEqual(["r1", "r2"]);
    expect(state.replies["r1"].status).toBe("complete");
    expect(state.replies["r2"].status).toBe("complete");
  });
});

// ---------------------------------------------------------------------------
// replay test — reconstruct a Reply from a stored event sequence
// ---------------------------------------------------------------------------

describe("replay", () => {
  it("reconstructs a complete Reply from a sequence of events with no external state", () => {
    const events: ReplyEvent[] = [
      { type: "reply.started", replyId: "replay1", runId: "run_replay1", conversationId: "conv-x", ts: TS },
      { type: "reply.item.added", replyId: "replay1", runId: "run_replay1", itemId: "think1", kind: "reasoning", ts: TS + 1 },
      { type: "reply.reasoning.delta", replyId: "replay1", runId: "run_replay1", itemId: "think1", delta: "Reasoning…", ts: TS + 2 },
      { type: "reply.item.done", replyId: "replay1", runId: "run_replay1", itemId: "think1", ts: TS + 3 },
      { type: "reply.item.added", replyId: "replay1", runId: "run_replay1", itemId: "text1", kind: "text", ts: TS + 4 },
      { type: "reply.text.delta", replyId: "replay1", runId: "run_replay1", itemId: "text1", delta: "The answer is ", ts: TS + 5 },
      { type: "reply.text.delta", replyId: "replay1", runId: "run_replay1", itemId: "text1", delta: "42.", ts: TS + 6 },
      { type: "reply.item.done", replyId: "replay1", runId: "run_replay1", itemId: "text1", ts: TS + 7 },
      { type: "reply.completed", replyId: "replay1", runId: "run_replay1", ts: TS + 8 },
    ];

    const state = applyEvents(events);
    const reply = state.replies["replay1"];

    expect(reply.status).toBe("complete");
    expect(reply.conversationId).toBe("conv-x");
    expect(reply.items).toHaveLength(2);

    const [reasoning, text] = reply.items;
    expect(reasoning.kind).toBe("reasoning");
    expect((reasoning as { text: string }).text).toBe("Reasoning…");
    expect(reasoning.isOpen).toBe(false);

    expect(text.kind).toBe("text");
    expect((text as { text: string }).text).toBe("The answer is 42.");
    expect(text.isOpen).toBe(false);
  });
});
