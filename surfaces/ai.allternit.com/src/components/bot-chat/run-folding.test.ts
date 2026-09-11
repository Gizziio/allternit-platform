import { describe, expect, it } from "vitest";
import { applyEvent, initTranscript } from "./transcript";
import type { BotChatTranscript, TranscriptRow } from "./types";

const T0 = new Date("2026-09-10T14:00:00").getTime();

let seq = 0;
function start() {
  seq = 0;
  return applyEvent(initTranscript(), {
    type: "message.user",
    id: "u1",
    text: "do the thing",
    createdAt: T0,
  });
}

function call(t: BotChatTranscript, tool: string, createdAt = T0 + 1000) {
  seq += 1;
  return applyEvent(t, {
    type: "tool.call",
    id: `c${seq}`,
    tool,
    inputSummary: `${tool} input ${seq}`,
    createdAt,
  });
}

function result(
  t: BotChatTranscript,
  id: string,
  status: "success" | "error" = "success",
  durationMs = 240,
) {
  return applyEvent(t, {
    type: "tool.result",
    id,
    outputSummary: `out for ${id}`,
    durationMs,
    status,
    error: status === "error" ? `${id} blew up` : undefined,
  });
}

function rowsOf(t: BotChatTranscript): TranscriptRow[] {
  return t.rows;
}

describe("tool-run folding", () => {
  it("keeps a single tool call as a standalone toolCall row", () => {
    const t = call(start(), "web_search");
    expect(rowsOf(t).map((r) => r.kind)).toEqual(["message", "toolCall"]);
  });

  it("folds 2+ consecutive tool calls into one toolRun row", () => {
    let t = call(start(), "web_search");
    t = call(t, "read_file");
    const rows = rowsOf(t);
    expect(rows.map((r) => r.kind)).toEqual(["message", "toolRun"]);
    const run = rows[rows.length - 1];
    if (run.kind === "toolRun") {
      expect(run.run.calls).toHaveLength(2);
      expect(run.run.status).toBe("running");
      expect(run.run.expanded).toBe(false);
    }
  });

  it("grows an existing run with a third consecutive call", () => {
    let t = call(start(), "a");
    t = call(t, "b");
    t = call(t, "c");
    const run = rowsOf(t)[rowsOf(t).length - 1];
    if (run.kind === "toolRun") {
      expect(run.run.calls.map((c) => c.tool)).toEqual(["a", "b", "c"]);
      expect(run.run.status).toBe("running");
    } else {
      throw new Error("expected toolRun");
    }
  });

  it("run reports success once every member settles", () => {
    let t = call(start(), "a");
    t = call(t, "b");
    t = result(t, "c1");
    let run = rowsOf(t)[rowsOf(t).length - 1];
    if (run.kind === "toolRun") expect(run.run.status).toBe("running");
    t = result(t, "c2");
    run = rowsOf(t)[rowsOf(t).length - 1];
    if (run.kind === "toolRun") expect(run.run.status).toBe("success");
    else throw new Error("expected toolRun");
  });

  it("never folds an errored call — a message between calls also breaks the run", () => {
    let t = call(start(), "a");
    t = applyEvent(t, {
      type: "message.user",
      id: "u2",
      text: "also this",
      createdAt: T0 + 5000,
    });
    t = call(t, "b");
    const kinds = rowsOf(t).map((r) => r.kind);
    expect(kinds).toEqual(["message", "toolCall", "message", "toolCall"]);
  });

  it("error inside a previewed run splits it: run closes before the error, error renders standalone", () => {
    let t = call(start(), "a");
    t = call(t, "b"); // folds into a run [c1, c2]
    t = result(t, "c1", "success");
    t = result(t, "c2", "error");
    const rows = rowsOf(t);
    // message, toolCall(c1 collapsed from the run), toolCall(c2 error, standalone)
    expect(rows.map((r) => r.kind)).toEqual(["message", "toolCall", "toolCall"]);
    const first = rows[1];
    const second = rows[2];
    if (first.kind === "toolCall" && second.kind === "toolCall") {
      expect(first.call.tool).toBe("a");
      expect(first.call.status).toBe("success");
      expect(second.call.tool).toBe("b");
      expect(second.call.status).toBe("error");
      expect(second.call.error).toBeDefined();
    } else {
      throw new Error("expected two standalone toolCall rows");
    }
  });

  it("error as the last member of a 3-call run leaves a 2-call run plus standalone error", () => {
    let t = call(start(), "a");
    t = call(t, "b");
    t = call(t, "c");
    t = result(t, "c3", "error");
    const rows = rowsOf(t);
    expect(rows.map((r) => r.kind)).toEqual(["message", "toolRun", "toolCall"]);
    const run = rows[1];
    if (run.kind === "toolRun") {
      expect(run.run.calls.map((c) => c.tool)).toEqual(["a", "b"]);
    } else {
      throw new Error("expected surviving run");
    }
    const err = rows[2];
    if (err.kind === "toolCall") {
      expect(err.call.status).toBe("error");
    }
  });

  it("a successful call after an error starts fresh — no folding across the break", () => {
    let t = call(start(), "a");
    t = result(t, "c1", "error");
    t = call(t, "b");
    const rows = rowsOf(t);
    expect(rows.map((r) => r.kind)).toEqual(["message", "toolCall", "toolCall"]);
    const err = rows[1];
    const next = rows[2];
    if (err.kind === "toolCall" && next.kind === "toolCall") {
      expect(err.call.status).toBe("error");
      expect(next.call.tool).toBe("b");
    }
  });

  it("does not fold across a timestamp-gap row", () => {
    let t = call(start(), "a", T0 + 1000);
    t = call(t, "b", T0 + 1000 + 31 * 60 * 1000);
    const kinds = rowsOf(t).map((r) => r.kind);
    expect(kinds).toEqual(["message", "toolCall", "timestamp-gap", "toolCall"]);
  });

  it("expand state lives in the row model but the fold never toggles it", () => {
    let t = call(start(), "a");
    t = call(t, "b");
    t = call(t, "c");
    const run = rowsOf(t)[rowsOf(t).length - 1];
    if (run.kind !== "toolRun") throw new Error("expected toolRun");
    expect(run.run.expanded).toBe(false);
    // Simulate a UI toggle, then fold another event; the fold must not
    // clobber the flag it did not set.
    const manuallyExpanded: BotChatTranscript = {
      ...t,
      rows: t.rows.map((r) =>
        r.kind === "toolRun" ? { ...r, run: { ...r.run, expanded: true } } : r,
      ),
    };
    const after = result(manuallyExpanded, "c1");
    const runAfter = after.rows[after.rows.length - 1];
    if (runAfter.kind === "toolRun") {
      expect(runAfter.run.expanded).toBe(true);
      expect(runAfter.run.status).toBe("running");
    } else {
      throw new Error("expected toolRun");
    }
  });
});
