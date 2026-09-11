import { describe, expect, it } from "vitest";
import {
  applyEvent,
  approvalAnswerToEvent,
  approvalRequestToEvent,
  approvalResultToEvent,
  initTranscript,
  messagesToTranscript,
  streamCallbacksToEvents,
  userSendEvent,
} from "./chat-stream-adapter";

const T0 = new Date("2026-09-10T18:00:00Z").getTime();

describe("streamCallbacksToEvents", () => {
  it("maps user send, thinking, chunks, tools, and done into the fold", () => {
    let t = initTranscript();
    t = applyEvent(t, userSendEvent("hello", { id: "u1", createdAt: T0 }));

    const events: string[] = [];
    const cb = streamCallbacksToEvents(
      (e) => {
        events.push(e.type);
        t = applyEvent(t, e);
      },
      { turnId: "a1", now: () => T0 + 10 },
    );

    cb.onThinking?.("checking");
    cb.onChunk?.("Hi ");
    cb.onChunk?.("there");
    cb.onToolCall?.({ toolCallId: "tc1", toolName: "shell", input: { cmd: "ls" } });
    cb.onToolResult?.({ toolCallId: "tc1", toolName: "shell", result: "ok" });
    cb.onDone?.();

    expect(events).toEqual([
      "thinking.delta",
      "message.delta",
      "message.delta",
      "tool.call",
      "tool.result",
      "turn.completed",
    ]);
    expect(t.activeTurn).toBeNull();
    const texts = t.rows.map((r) =>
      r.kind === "message" ? r.message.text : r.kind === "toolCall" ? r.call.tool : r.kind,
    );
    expect(texts).toContain("hello");
    expect(texts).toContain("Hi there");
    expect(texts).toContain("shell");
  });

  it("maps abort/error to an error row and tool errors to an error result", () => {
    let t = applyEvent(initTranscript(), userSendEvent("go", { id: "u2", createdAt: T0 }));
    const cb = streamCallbacksToEvents((e) => {
      t = applyEvent(t, e);
    }, { turnId: "a2", now: () => T0 });

    cb.onToolCall?.({ toolCallId: "tc-err", toolName: "read" });
    cb.onToolError?.({ toolCallId: "tc-err", error: "ENOENT" });
    cb.onError?.(new Error("stream dropped"));

    const tool = t.rows.find((r) => r.kind === "toolCall");
    expect(tool?.kind === "toolCall" && tool.call.status).toBe("error");
    const err = t.rows.find((r) => r.kind === "error");
    expect(err?.kind === "error" && err.text).toBe("stream dropped");
  });
});

describe("approval mappers", () => {
  it("maps a cowork approval_request with binary defaults and no grantKey", () => {
    const event = approvalRequestToEvent({
      actionId: "act-1",
      summary: "Run a shell command",
      details: { consequence: "This will execute ls" },
      timeout: 30,
      botId: "bot-1",
      botName: "Gizzi",
    });
    expect(event.type).toBe("approval.requested");
    if (event.type !== "approval.requested") return;

    let t = applyEvent(initTranscript(), event);
    const row = t.rows[0];
    expect(row.kind).toBe("approval");
    if (row.kind !== "approval") return;
    expect(row.approval.grantKey).toBeUndefined();
    expect(row.approval.options.map((o) => o.id)).toEqual(["approve", "deny"]);
    expect(row.approval.title).toBe("Run a shell command");
    expect(row.approval.detail).toBe("This will execute ls");
  });

  it("does not invent grantKey; passes one through only when the payload has it", () => {
    const without = approvalRequestToEvent({
      actionId: "a",
      summary: "x",
    });
    if (without.type === "approval.requested") {
      expect(without.approval.grantKey).toBeUndefined();
    }

    const withKey = approvalRequestToEvent({
      actionId: "b",
      summary: "y",
      grantKey: "tool:shell",
    });
    if (withKey.type === "approval.requested") {
      expect(withKey.approval.grantKey).toBe("tool:shell");
    }
  });

  it("maps approval_result timeout / deny / approve", () => {
    expect(approvalResultToEvent({ actionId: "a", approved: true })).toEqual({
      type: "approval.resolved",
      id: "a",
      outcome: "approved",
    });
    expect(approvalResultToEvent({ actionId: "a", approved: false })).toEqual({
      type: "approval.resolved",
      id: "a",
      outcome: "denied",
    });
    expect(
      approvalResultToEvent({ actionId: "a", approved: false, responder: "timeout" }),
    ).toEqual({
      type: "approval.resolved",
      id: "a",
      outcome: "expired",
    });
  });

  it("maps a user answer option id onto resolved", () => {
    expect(approvalAnswerToEvent("appr-1", "deny")).toEqual({
      type: "approval.resolved",
      id: "appr-1",
      outcome: "denied",
    });
    expect(approvalAnswerToEvent("appr-1", "approve")).toEqual({
      type: "approval.resolved",
      id: "appr-1",
      outcome: "approved",
    });
  });
});

describe("messagesToTranscript", () => {
  it("rebuilds user/assistant turns and skips empty assistant placeholders", () => {
    const t = messagesToTranscript(
      [
        { id: "u1", role: "user", content: "hi", timestamp: T0 },
        { id: "ph", role: "assistant", content: "", timestamp: T0 + 1 },
        {
          id: "a1",
          role: "assistant",
          content: "hello",
          thinking: "wait",
          timestamp: T0 + 2,
        },
      ],
      { now: T0 },
    );
    const texts = t.rows
      .filter((r) => r.kind === "message")
      .map((r) => (r.kind === "message" ? r.message.text : ""));
    expect(texts).toEqual(["hi", "hello"]);
    expect(t.activeTurn).toBeNull();
  });
});
