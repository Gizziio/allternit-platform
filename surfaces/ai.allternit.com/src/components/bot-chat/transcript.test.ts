import { describe, expect, it } from "vitest";
import {
  applyEvent,
  deriveRung,
  formatGap,
  initTranscript,
} from "./transcript";
import { GAP_THRESHOLD_MS, THINKING_BUFFER_CAP } from "./types";

const T0 = new Date("2026-09-10T14:00:00").getTime();

function user(text: string, createdAt = T0) {
  return applyEvent(initTranscript(), {
    type: "message.user",
    id: `u-${text}`,
    text,
    createdAt,
  });
}

describe("rungs", () => {
  it("starts at typing after a user message (turn start → first token)", () => {
    const t = user("hi");
    expect(deriveRung(t)).toBe("typing");
  });

  it("promotes to thinking on the first thinking delta", () => {
    const t = applyEvent(user("hi"), {
      type: "thinking.delta",
      id: "a1",
      textDelta: "Let me check",
    });
    expect(deriveRung(t)).toBe("thinking");
    expect(t.activeTurn?.thinkingBuffer).toBe("Let me check");
  });

  it("collapses thinking to streaming on the first answer token", () => {
    let t = applyEvent(user("hi"), {
      type: "thinking.delta",
      id: "a1",
      textDelta: "reasoning…",
    });
    t = applyEvent(t, { type: "message.delta", id: "a1", textDelta: "Hello" });
    expect(deriveRung(t)).toBe("streaming");
    expect(t.activeTurn?.partialText).toBe("Hello");
  });

  it("returns null after turn.completed and materializes the settled message", () => {
    let t = applyEvent(user("hi"), { type: "message.delta", id: "a1", textDelta: "Done." });
    t = applyEvent(t, { type: "turn.completed", id: "a1", createdAt: T0 + 5000 });
    expect(deriveRung(t)).toBeNull();
    expect(t.rows).toHaveLength(2);
    const last = t.rows[t.rows.length - 1];
    expect(last.kind).toBe("message");
    if (last.kind === "message") {
      expect(last.message.role).toBe("bot");
      expect(last.message.text).toBe("Done.");
      expect(last.message.status).toBe("settled");
    }
  });

  it("caps the thinking buffer at 2000 chars, keeping the tail", () => {
    let t = user("hi");
    t = applyEvent(t, { type: "thinking.delta", id: "a1", textDelta: "x".repeat(1500) });
    t = applyEvent(t, { type: "thinking.delta", id: "a1", textDelta: "y".repeat(1000) });
    expect(t.activeTurn?.thinkingBuffer).toHaveLength(THINKING_BUFFER_CAP);
    expect(t.activeTurn?.thinkingBuffer.endsWith("y".repeat(1000))).toBe(true);
  });

  it("flushes a partially streamed turn when a new user message arrives", () => {
    let t = applyEvent(user("hi"), { type: "message.delta", id: "a1", textDelta: "partial" });
    t = applyEvent(t, {
      type: "message.user",
      id: "u2",
      text: "next",
      createdAt: T0 + 1000,
    });
    const texts = t.rows.map((r) => (r.kind === "message" ? r.message.text : null));
    expect(texts).toEqual(["hi", "partial", "next"]);
    expect(deriveRung(t)).toBe("typing");
  });

  it("adopts the assistant message id from the first delta", () => {
    let t = applyEvent(user("hi"), { type: "message.delta", id: "a1", textDelta: "x" });
    expect(t.activeTurn?.id).toBe("a1");
    t = applyEvent(t, { type: "turn.completed", id: "a1", createdAt: T0 + 100 });
    expect(t.rows[t.rows.length - 1].id).toBe("a1");
  });
});

describe("gap timestamps", () => {
  it("injects a timestamp-gap row between rows ≥30 minutes apart", () => {
    let t = user("first", T0);
    t = applyEvent(t, {
      type: "message.user",
      id: "u2",
      text: "second",
      createdAt: T0 + GAP_THRESHOLD_MS + 60_000,
    });
    expect(t.rows).toHaveLength(3);
    expect(t.rows[1].kind).toBe("timestamp-gap");
    if (t.rows[1].kind === "timestamp-gap") {
      expect(t.rows[1].from).toBe(T0);
      expect(t.rows[1].to).toBe(T0 + GAP_THRESHOLD_MS + 60_000);
    }
  });

  it("does not inject a gap under the threshold", () => {
    let t = user("first", T0);
    t = applyEvent(t, {
      type: "message.user",
      id: "u2",
      text: "second",
      createdAt: T0 + 60_000,
    });
    expect(t.rows.every((r) => r.kind !== "timestamp-gap")).toBe(true);
  });
});

describe("formatGap", () => {
  const now = new Date("2026-09-10T14:00:00").getTime();

  it("labels same-day gaps as Today", () => {
    const to = new Date("2026-09-10T02:30:00").getTime();
    expect(formatGap(to - GAP_THRESHOLD_MS, to, now)).toBe("Today 2:30 AM");
  });

  it("labels yesterday's gap", () => {
    const to = new Date("2026-09-09T14:30:00").getTime();
    expect(formatGap(to - GAP_THRESHOLD_MS, to, now)).toBe("Yesterday 2:30 PM");
  });

  it("labels older gaps with the date", () => {
    const to = new Date("2026-09-03T09:15:00").getTime();
    expect(formatGap(to - GAP_THRESHOLD_MS, to, now)).toMatch(/^Sep 3 9:15 AM$/);
  });

  it("includes the year for a different calendar year", () => {
    const to = new Date("2025-12-20T09:15:00").getTime();
    expect(formatGap(to - GAP_THRESHOLD_MS, to, now)).toMatch(/^Dec 20, 2025 9:15 AM$/);
  });
});

describe("approvals and errors", () => {
  it("defaults to an approve/deny pair when the wire event has no options", () => {
    let t = user("run it");
    t = applyEvent(t, {
      type: "approval.requested",
      approval: {
        id: "ap1",
        botId: "b1",
        botName: "Scout",
        title: "Allow running shell command?",
        createdAt: T0 + 1000,
      },
    });
    const row = t.rows[t.rows.length - 1];
    expect(row.kind).toBe("approval");
    if (row.kind === "approval") {
      expect(row.approval.options).toEqual([
        { id: "approve", label: "Approve", kind: "approve" },
        { id: "deny", label: "Deny", kind: "deny" },
      ]);
      expect(row.approval.grantKey).toBeUndefined();
    }
  });

  it("keeps server-issued grantKey and wire options", () => {
    let t = user("run it");
    t = applyEvent(t, {
      type: "approval.requested",
      approval: {
        id: "ap1",
        botId: "b1",
        botName: "Scout",
        title: "Allow file write?",
        grantKey: "grant-abc",
        options: [{ id: "always", label: "Always allow" }],
        createdAt: T0 + 1000,
      },
    });
    const row = t.rows[t.rows.length - 1];
    if (row.kind === "approval") {
      expect(row.approval.grantKey).toBe("grant-abc");
      expect(row.approval.options[0].kind).toBe("approve");
    }
    const resolved = applyEvent(t, { type: "approval.resolved", id: "ap1", outcome: "approved" });
    const resolvedRow = resolved.rows[resolved.rows.length - 1];
    if (resolvedRow.kind === "approval") {
      expect(resolvedRow.approval.status).toBe("approved");
    }
  });

  it("appends error rows without disturbing the active turn", () => {
    let t = applyEvent(user("hi"), { type: "message.delta", id: "a1", textDelta: "x" });
    t = applyEvent(t, {
      type: "error",
      id: "e1",
      text: "The model stream failed mid-turn.",
      createdAt: T0 + 2000,
    });
    const last = t.rows[t.rows.length - 1];
    expect(last.kind).toBe("error");
    expect(deriveRung(t)).toBe("streaming");
  });

  it("appends artifact rows and preserves active turn", () => {
    let t = applyEvent(user("make an app"), { type: "message.delta", id: "a1", textDelta: "Here is your app:" });
    t = applyEvent(t, {
      type: "artifact.created",
      id: "art-101",
      artifact: {
        id: "art-101",
        kind: "html",
        title: "Calculator App",
        content: "<button>1</button>",
      },
      createdAt: T0 + 1500,
    });
    const last = t.rows[t.rows.length - 1];
    expect(last.kind).toBe("artifact");
    if (last.kind === "artifact") {
      expect(last.artifact.title).toBe("Calculator App");
      expect(last.artifact.kind).toBe("html");
    }
    expect(deriveRung(t)).toBe("streaming");
  });
});
