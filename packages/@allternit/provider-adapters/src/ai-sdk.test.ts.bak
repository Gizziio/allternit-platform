import { describe, expect, it } from "vitest";
import { AiSdkReplyAdapter, type AiSdkStreamPart } from "./ai-sdk";
import type { ReplyEvent } from "@allternit/replies-contract";

function makeAdapter(replyId = "r1", runId = "run1") {
  const events: ReplyEvent[] = [];
  const adapter = new AiSdkReplyAdapter({
    replyId,
    runId,
    onEvent: (e) => events.push(e),
  });
  return { adapter, events };
}

function types(events: ReplyEvent[]) {
  return events.map((e) => e.type);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("lifecycle", () => {
  it("emits reply.started on first part", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "start" });
    expect(events[0].type).toBe("reply.started");
    expect((events[0] as Extract<ReplyEvent, { type: "reply.started" }>).replyId).toBe("r1");
  });

  it("emits reply.started only once for multiple parts", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "start" });
    adapter.process({ type: "text-start", id: "t1" });
    expect(events.filter((e) => e.type === "reply.started")).toHaveLength(1);
  });

  it("emits reply.completed on finish", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "start" });
    adapter.process({ type: "finish", finishReason: "stop" });
    expect(types(events)).toContain("reply.completed");
  });

  it("emits reply.failed on error part", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "error", error: new Error("something broke") });
    const failed = events.find((e) => e.type === "reply.failed") as
      Extract<ReplyEvent, { type: "reply.failed" }> | undefined;
    expect(failed?.error).toBe("something broke");
  });

  it("emits reply.failed on abort", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "start" });
    adapter.process({ type: "abort", reason: "cancelled" });
    const failed = events.find((e) => e.type === "reply.failed") as
      Extract<ReplyEvent, { type: "reply.failed" }> | undefined;
    expect(failed?.error).toBe("cancelled");
  });
});

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

describe("text streaming", () => {
  it("text-start → reply.item.added(text)", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "text-start", id: "t1" });
    const added = events.find((e) => e.type === "reply.item.added") as
      Extract<ReplyEvent, { type: "reply.item.added" }> | undefined;
    expect(added?.kind).toBe("text");
    expect(added?.itemId).toBe("t1");
  });

  it("text-delta emits reply.text.delta", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "text-start", id: "t1" });
    adapter.process({ type: "text-delta", id: "t1", text: "Hello" });
    const delta = events.find((e) => e.type === "reply.text.delta") as
      Extract<ReplyEvent, { type: "reply.text.delta" }> | undefined;
    expect(delta?.delta).toBe("Hello");
  });

  it("text-delta without text-start auto-opens item", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "text-delta", id: "t1", text: "Hi" });
    expect(events.some((e) => e.type === "reply.item.added")).toBe(true);
    expect(events.some((e) => e.type === "reply.text.delta")).toBe(true);
  });

  it("text-end emits reply.item.done", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "text-start", id: "t1" });
    adapter.process({ type: "text-end", id: "t1" });
    expect(events.some((e) => e.type === "reply.item.done")).toBe(true);
  });

  it("second text-delta for same id does not re-open item", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "text-start", id: "t1" });
    adapter.process({ type: "text-delta", id: "t1", text: "A" });
    adapter.process({ type: "text-delta", id: "t1", text: "B" });
    expect(events.filter((e) => e.type === "reply.item.added")).toHaveLength(1);
    expect(events.filter((e) => e.type === "reply.text.delta")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Reasoning
// ---------------------------------------------------------------------------

describe("reasoning / extended thinking", () => {
  it("reasoning-start → reply.item.added(reasoning)", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "reasoning-start", id: "rp1" });
    const added = events.find((e) => e.type === "reply.item.added") as
      Extract<ReplyEvent, { type: "reply.item.added" }> | undefined;
    expect(added?.kind).toBe("reasoning");
  });

  it("reasoning-delta emits reply.reasoning.delta", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "reasoning-start", id: "rp1" });
    adapter.process({ type: "reasoning-delta", id: "rp1", text: "Thinking..." });
    const delta = events.find((e) => e.type === "reply.reasoning.delta") as
      Extract<ReplyEvent, { type: "reply.reasoning.delta" }> | undefined;
    expect(delta?.delta).toBe("Thinking...");
    expect(delta?.itemId).toBe("rp1");
  });

  it("reasoning-delta without reasoning-start auto-opens item", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "reasoning-delta", id: "rp1", text: "Step 1" });
    expect(events.some((e) => e.type === "reply.item.added")).toBe(true);
  });

  it("reasoning-end emits reply.item.done", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "reasoning-start", id: "rp1" });
    adapter.process({ type: "reasoning-end", id: "rp1" });
    expect(events.some((e) => e.type === "reply.item.done")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool calls
// ---------------------------------------------------------------------------

describe("tool calls", () => {
  it("tool-input-start → reply.item.added(tool_call) + tool_call.started", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "tool-input-start", id: "tc1", toolName: "bash" });
    expect(events.some((e) => e.type === "reply.item.added" &&
      (e as Extract<ReplyEvent, { type: "reply.item.added" }>).kind === "tool_call")).toBe(true);
    const started = events.find((e) => e.type === "tool_call.started") as
      Extract<ReplyEvent, { type: "tool_call.started" }> | undefined;
    expect(started?.toolName).toBe("bash");
  });

  it("tool-result → tool_call.completed + reply.item.done", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "tool-call", toolCallId: "tc1", toolName: "bash", args: { cmd: "ls" } });
    adapter.process({ type: "tool-result", toolCallId: "tc1", toolName: "bash", result: { stdout: "file.txt" } });
    const completed = events.find((e) => e.type === "tool_call.completed") as
      Extract<ReplyEvent, { type: "tool_call.completed" }> | undefined;
    expect(completed?.output).toEqual({ stdout: "file.txt" });
    expect(events.some((e) => e.type === "reply.item.done")).toBe(true);
  });

  it("tool-error → tool_call.failed + reply.item.done", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "tool-call", toolCallId: "tc1", toolName: "bash", args: {} });
    adapter.process({ type: "tool-error", toolCallId: "tc1", toolName: "bash", error: "permission denied" });
    const failed = events.find((e) => e.type === "tool_call.failed") as
      Extract<ReplyEvent, { type: "tool_call.failed" }> | undefined;
    expect(failed?.error).toBe("permission denied");
    expect(events.some((e) => e.type === "reply.item.done")).toBe(true);
  });

  it("tool-call without prior tool-input-start opens item once", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "tool-call", toolCallId: "tc2", toolName: "read_file", args: { path: "/x" } });
    expect(events.filter((e) => e.type === "reply.item.added")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Sources → citations
// ---------------------------------------------------------------------------

describe("sources / citations", () => {
  it("source part → citation.added", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({ type: "source", url: "https://example.com", title: "Example", id: "cite1" });
    const citation = events.find((e) => e.type === "citation.added") as
      Extract<ReplyEvent, { type: "citation.added" }> | undefined;
    expect(citation?.url).toBe("https://example.com");
    expect(citation?.title).toBe("Example");
  });
});

// ---------------------------------------------------------------------------
// Files → artifacts
// ---------------------------------------------------------------------------

describe("files / artifacts", () => {
  it("file part → reply.item.added(artifact) + artifact.created", () => {
    const { adapter, events } = makeAdapter();
    adapter.process({
      type: "file",
      id: "art1",
      file: { mimeType: "image/png", url: "https://cdn.example.com/img.png" },
    });
    const added = events.find((e) => e.type === "reply.item.added") as
      Extract<ReplyEvent, { type: "reply.item.added" }> | undefined;
    expect(added?.kind).toBe("artifact");
    const artifact = events.find((e) => e.type === "artifact.created") as
      Extract<ReplyEvent, { type: "artifact.created" }> | undefined;
    expect(artifact?.artifactType).toBe("image/png");
  });
});

// ---------------------------------------------------------------------------
// consume() — AsyncIterable
// ---------------------------------------------------------------------------

describe("consume()", () => {
  it("processes all parts from an async iterable", async () => {
    const { adapter, events } = makeAdapter();
    const parts: AiSdkStreamPart[] = [
      { type: "start" },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", text: "Hello" },
      { type: "text-end", id: "t1" },
      { type: "finish", finishReason: "stop" },
    ];
    await adapter.consume((async function* () { yield* parts; })());
    expect(types(events)).toContain("reply.started");
    expect(types(events)).toContain("reply.text.delta");
    expect(types(events)).toContain("reply.completed");
  });

  it("emits reply.failed if the iterable throws", async () => {
    const { adapter, events } = makeAdapter();
    async function* boom() {
      yield { type: "start" } as AiSdkStreamPart;
      throw new Error("network dropped");
    }
    await adapter.consume(boom());
    expect(events.some((e) => e.type === "reply.failed")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mixed multi-part reply
// ---------------------------------------------------------------------------

describe("mixed multi-part reply", () => {
  it("reasoning + text + tool produces correct event sequence", async () => {
    const { adapter, events } = makeAdapter();
    const parts: AiSdkStreamPart[] = [
      { type: "start" },
      { type: "reasoning-start", id: "rp1" },
      { type: "reasoning-delta", id: "rp1", text: "Step 1." },
      { type: "reasoning-end", id: "rp1" },
      { type: "text-start", id: "tp1" },
      { type: "text-delta", id: "tp1", text: "Answer:" },
      { type: "text-end", id: "tp1" },
      { type: "tool-call", toolCallId: "tc1", toolName: "search", args: { q: "test" } },
      { type: "tool-result", toolCallId: "tc1", toolName: "search", result: [{ title: "Result" }] },
      { type: "finish", finishReason: "tool-calls" },
    ];
    await adapter.consume((async function* () { yield* parts; })());

    expect(events.filter((e) => e.type === "reply.started")).toHaveLength(1);
    const itemAdded = events.filter(
      (e): e is Extract<ReplyEvent, { type: "reply.item.added" }> => e.type === "reply.item.added",
    );
    expect(itemAdded.map((e) => e.kind).sort()).toEqual(["reasoning", "text", "tool_call"]);
    expect(types(events)).toContain("reply.reasoning.delta");
    expect(types(events)).toContain("reply.text.delta");
    expect(types(events)).toContain("tool_call.completed");
    expect(types(events)).toContain("reply.completed");
  });
});
