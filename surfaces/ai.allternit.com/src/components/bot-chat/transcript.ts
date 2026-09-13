/**
 * Transcript fold (Phase 1A).
 *
 * The ONLY way transcript state changes: `applyEvent(transcript, event)`
 * returns a new `BotChatTranscript`. Pure — no I/O, no clocks (events carry
 * timestamps; `formatGap` takes an injectable `now` for tests).
 *
 * Responsibilities:
 * - rungs: thinking → typing → streaming, collapsed/settled by turn events
 * - tool-run folding: 2+ consecutive non-error tool rows fold into one
 *   `toolRun` row; an erroring tool row NEVER folds — it splits out of the
 *   run it was previewed in and renders standalone
 * - gap timestamps: a `timestamp-gap` row appears between adjacent content
 *   rows whose timestamps differ by ≥ GAP_THRESHOLD_MS
 *
 * @module bot-chat/transcript
 */

import {
  GAP_THRESHOLD_MS,
  THINKING_BUFFER_CAP,
  type ActiveTurn,
  type ApprovalOption,
  type ApprovalRequest,
  type BotChatMessage,
  type BotChatTranscript,
  type BotChatRung,
  type ToolCallRecord,
  type ToolRunGroup,
  type TranscriptRow,
  type InlineArtifact,
} from "./types";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Wire shape for `approval.requested` — `options` may be absent. */
export interface ApprovalRequestedWire {
  id: string;
  botId: string;
  botName: string;
  title: string;
  detail?: string;
  options?: Array<{ id: string; label: string; kind?: ApprovalOption["kind"] }>;
  grantKey?: string;
  timeout?: number;
  createdAt?: number;
}

export type TranscriptEvent =
  | { type: "message.user"; id: string; text: string; createdAt: number }
  | { type: "message.delta"; id: string; textDelta: string }
  | { type: "thinking.delta"; id: string; textDelta: string }
  | {
      type: "tool.call";
      id: string;
      tool: string;
      inputSummary: string;
      createdAt?: number;
    }
  | {
      type: "tool.result";
      id: string;
      outputSummary: string;
      durationMs?: number;
      status?: "success" | "error";
      error?: string;
      createdAt?: number;
    }
  | { type: "approval.requested"; approval: ApprovalRequestedWire }
  | {
      type: "approval.resolved";
      id: string;
      outcome: "approved" | "denied" | "expired";
    }
  | {
      type: "artifact.created";
      id: string;
      artifact: InlineArtifact;
      createdAt?: number;
    }
  | { type: "turn.completed"; id: string; createdAt?: number }
  | { type: "error"; id: string; text: string; createdAt?: number };

// ---------------------------------------------------------------------------
// Init + selectors
// ---------------------------------------------------------------------------

export function initTranscript(): BotChatTranscript {
  return { rows: [], activeTurn: null };
}

/** Current rung of the active turn, or null when the bot is idle. */
export function deriveRung(transcript: BotChatTranscript): BotChatRung | null {
  return transcript.activeTurn?.rung ?? null;
}

// ---------------------------------------------------------------------------
// Gap timestamps
// ---------------------------------------------------------------------------

function lastContentTs(rows: TranscriptRow[]): number | null {
  const last = rows[rows.length - 1];
  if (!last) return null;
  return last.kind === "timestamp-gap" ? last.to : last.createdAt;
}

/**
 * Append a `timestamp-gap` row when `createdAt` is ≥ GAP_THRESHOLD_MS after
 * the previous content row. Returns the extended row list.
 */
function withGapRow(rows: TranscriptRow[], createdAt: number): TranscriptRow[] {
  const prevTs = lastContentTs(rows);
  if (prevTs !== null && createdAt - prevTs >= GAP_THRESHOLD_MS) {
    return [
      ...rows,
      {
        kind: "timestamp-gap",
        id: `gap-${prevTs}-${createdAt}`,
        from: prevTs,
        to: createdAt,
      },
    ];
  }
  return rows;
}

const GAP_MINUTE = 60 * 1000;
const GAP_HOUR = 60 * GAP_MINUTE;
const GAP_DAY = 24 * GAP_HOUR;

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${suffix}`;
}

/**
 * Human label for a gap, e.g. "Yesterday 2:30 PM". `now` is injectable for
 * tests; defaults to the real clock (only used for day names, not math).
 */
export function formatGap(from: number, to: number, now: number = Date.now()): string {
  const toDate = new Date(to);
  const nowDate = new Date(now);
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(nowDate) - startOf(toDate)) / GAP_DAY);

  let dayPart: string;
  if (sameCalendarDay(toDate, nowDate)) {
    dayPart = "Today";
  } else if (dayDiff === 1) {
    dayPart = "Yesterday";
  } else if (toDate.getFullYear() === nowDate.getFullYear()) {
    dayPart = toDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else {
    dayPart = toDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return `${dayPart} ${formatTime(toDate)}`;
}

// ---------------------------------------------------------------------------
// Tool-run folding
// ---------------------------------------------------------------------------

function runStatus(calls: ToolCallRecord[]): ToolRunGroup["status"] {
  if (calls.some((c) => c.status === "running")) return "running";
  if (calls.some((c) => c.status === "error")) return "error";
  return "success";
}

/**
 * Append a new tool call to `rows`, folding it into the previous row when
 * that row is a non-error tool row. A tool row whose status is `error` never
 * folds — it always renders standalone.
 */
function appendToolCall(rows: TranscriptRow[], call: ToolCallRecord): TranscriptRow[] {
  if (call.status === "error") {
    return [
      ...rows,
      { kind: "toolCall", id: call.id, createdAt: call.createdAt ?? 0, call },
    ];
  }

  // Only a directly adjacent row folds. A trailing timestamp-gap row (just
  // inserted by withGapRow) means the calls are NOT consecutive — 30+ minutes
  // apart is a new activity burst, and the new call renders standalone after
  // the gap. An errored row also blocks folding.
  const prev = rows[rows.length - 1];
  if (prev?.kind === "toolCall" && prev.call.status !== "error") {
    const group: ToolRunGroup = {
      id: `run-${prev.call.id}`,
      calls: [prev.call, call],
      status: runStatus([prev.call, call]),
      expanded: false,
    };
    return [
      ...rows.slice(0, -1),
      { kind: "toolRun", id: group.id, createdAt: prev.createdAt, run: group },
    ];
  }
  if (prev?.kind === "toolRun" && prev.run.status !== "error") {
    const calls = [...prev.run.calls, call];
    return [
      ...rows.slice(0, -1),
      {
        ...prev,
        run: { ...prev.run, calls, status: runStatus(calls) },
      },
    ];
  }
  return [...rows, { kind: "toolCall", id: call.id, createdAt: call.createdAt ?? 0, call }];
}

/**
 * Locate the tool row holding call `id`. Tool rows are never the row after a
 * `timestamp-gap` insert mid-operation, so a backward scan skipping gap rows
 * is sufficient and safe.
 */
function findToolRow(
  rows: TranscriptRow[],
  id: string,
): { index: number; row: Extract<TranscriptRow, { kind: "toolCall" | "toolRun" }> } | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row.kind === "timestamp-gap") continue;
    if (row.kind === "toolCall" && row.call.id === id) return { index: i, row };
    if (row.kind === "toolRun" && row.run.calls.some((c) => c.id === id)) {
      return { index: i, row };
    }
    return null;
  }
  return null;
}

/**
 * Apply a tool result to the row model. If the call was previewed inside a
 * run group and the result is an error, the run closes before it: the call
 * splits out and renders standalone; a group left with one member collapses
 * back to a single `toolCall` row.
 */
function applyToolResult(
  rows: TranscriptRow[],
  id: string,
  update: (call: ToolCallRecord) => ToolCallRecord,
): TranscriptRow[] {
  const found = findToolRow(rows, id);
  if (!found) return rows;

  if (found.row.kind === "toolCall") {
    const next = update(found.row.call);
    const nextRows = rows.slice();
    nextRows[found.index] = {
      ...found.row,
      id: next.id,
      call: next,
    };
    return nextRows;
  }

  // Inside a run group.
  const group = found.row.run;
  const target = group.calls.find((c) => c.id === id);
  if (!target) return rows;
  const updated = update(target);

  if (updated.status === "error") {
    const remaining = group.calls.filter((c) => c.id !== id);
    const errorRow: TranscriptRow = {
      kind: "toolCall",
      id: updated.id,
      createdAt: updated.createdAt ?? found.row.createdAt,
      call: updated,
    };
    if (remaining.length === 0) {
      const nextRows = rows.slice();
      nextRows[found.index] = errorRow;
      return nextRows;
    }
    if (remaining.length === 1) {
      // Run closes before the error: collapse to the single surviving call.
      const nextRows = rows.slice();
      nextRows[found.index] = {
        kind: "toolCall",
        id: remaining[0].id,
        createdAt: found.row.createdAt,
        call: remaining[0],
      };
      nextRows.splice(found.index + 1, 0, errorRow);
      return nextRows;
    }
    const nextRows = rows.slice();
    nextRows[found.index] = {
      ...found.row,
      run: { ...group, calls: remaining, status: runStatus(remaining) },
    };
    nextRows.splice(found.index + 1, 0, errorRow);
    return nextRows;
  }

  const calls = group.calls.map((c) => (c.id === id ? updated : c));
  const nextRows = rows.slice();
  nextRows[found.index] = {
    ...found.row,
    run: { ...group, calls, status: runStatus(calls) },
  };
  return nextRows;
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

function normalizeApproval(wire: ApprovalRequestedWire): ApprovalRequest {
  const options: ApprovalOption[] =
    wire.options && wire.options.length > 0
      ? wire.options.map((o) => ({
          id: o.id,
          label: o.label,
          kind:
            o.kind ??
            (/allow|approve|yes/i.test(o.id + o.label)
              ? "approve"
              : /deny|reject|no/i.test(o.id + o.label)
                ? "deny"
                : "neutral"),
        }))
      : [
          { id: "approve", label: "Approve", kind: "approve" },
          { id: "deny", label: "Deny", kind: "deny" },
        ];
  return {
    id: wire.id,
    botId: wire.botId,
    botName: wire.botName,
    title: wire.title,
    detail: wire.detail,
    options,
    grantKey: wire.grantKey,
    timeout: wire.timeout,
    status: "pending",
    createdAt: wire.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Active turn helpers
// ---------------------------------------------------------------------------

function openTurn(id: string, startedAt: number, rung: BotChatRung): ActiveTurn {
  return {
    id,
    rung,
    thinkingBuffer: "",
    partialText: "",
    pendingToolCalls: [],
    startedAt,
  };
}

/** Settle the active turn into a bot message row, if it produced text. */
function settleTurn(
  transcript: BotChatTranscript,
  createdAt: number,
): BotChatTranscript {
  const turn = transcript.activeTurn;
  if (!turn) return transcript;
  const rows =
    turn.partialText.length > 0
      ? [
          ...withGapRow(transcript.rows, createdAt),
          {
            kind: "message" as const,
            id: turn.id,
            createdAt,
            message: {
              id: turn.id,
              role: "bot" as const,
              text: turn.partialText,
              createdAt,
              status: "settled" as const,
            } satisfies BotChatMessage,
          },
        ]
      : transcript.rows;
  return { rows, activeTurn: null };
}

// ---------------------------------------------------------------------------
// The fold
// ---------------------------------------------------------------------------

export function applyEvent(
  transcript: BotChatTranscript,
  event: TranscriptEvent,
): BotChatTranscript {
  switch (event.type) {
    case "message.user": {
      const settled = settleTurn(transcript, event.createdAt);
      const message: BotChatMessage = {
        id: event.id,
        role: "user",
        text: event.text,
        createdAt: event.createdAt,
        status: "settled",
      };
      // Turn start: the bot is now "typing" until the first thinking or
      // answer token arrives. `message.delta` adopts the assistant id.
      const activeTurn: ActiveTurn = {
        ...openTurn(`turn:${event.id}`, event.createdAt, "typing"),
      };
      return {
        rows: [
          ...withGapRow(settled.rows, event.createdAt),
          { kind: "message", id: message.id, createdAt: event.createdAt, message },
        ],
        activeTurn,
      };
    }

    case "message.delta": {
      const turn = transcript.activeTurn;
      if (!turn) {
        return {
          rows: transcript.rows,
          activeTurn: {
            ...openTurn(event.id, 0, "streaming"),
            partialText: event.textDelta,
          },
        };
      }
      return {
        rows: transcript.rows,
        activeTurn: {
          ...turn,
          // A delta identifies the assistant message; adopt its id once.
          id: turn.id.startsWith("turn:") ? event.id : turn.id,
          rung: "streaming",
          partialText: turn.partialText + event.textDelta,
        },
      };
    }

    case "thinking.delta": {
      const turn = transcript.activeTurn;
      if (!turn) {
        return {
          rows: transcript.rows,
          activeTurn: {
            ...openTurn(event.id, 0, "thinking"),
            thinkingBuffer: event.textDelta.slice(-THINKING_BUFFER_CAP),
          },
        };
      }
      const buffer = (turn.thinkingBuffer + event.textDelta).slice(-THINKING_BUFFER_CAP);
      // Thinking never downgrades a turn already producing answer tokens.
      const rung: BotChatRung = turn.rung === "streaming" ? "streaming" : "thinking";
      return {
        rows: transcript.rows,
        activeTurn: {
          ...turn,
          id: turn.id.startsWith("turn:") ? event.id : turn.id,
          rung,
          thinkingBuffer: buffer,
        },
      };
    }

    case "tool.call": {
      const call: ToolCallRecord = {
        id: event.id,
        tool: event.tool,
        inputSummary: event.inputSummary,
        status: "running",
        createdAt: event.createdAt,
      };
      const ts = event.createdAt ?? lastContentTs(transcript.rows) ?? 0;
      const callWithTs: ToolCallRecord = { ...call, createdAt: ts };
      const turn = transcript.activeTurn;
      return {
        rows: appendToolCall(withGapRow(transcript.rows, ts), callWithTs),
        activeTurn: turn
          ? {
              ...turn,
              pendingToolCalls: [...turn.pendingToolCalls, callWithTs],
            }
          : turn,
      };
    }

    case "tool.result": {
      const updated = applyToolResult(transcript.rows, event.id, (call) => ({
        ...call,
        outputSummary: event.outputSummary,
        durationMs: event.durationMs ?? call.durationMs,
        status: event.status ?? "success",
        error: event.error,
        createdAt: event.createdAt ?? call.createdAt,
      }));
      const turn = transcript.activeTurn;
      return {
        rows: updated,
        activeTurn: turn
          ? {
              ...turn,
              pendingToolCalls: turn.pendingToolCalls.map((c) =>
                c.id === event.id
                  ? {
                      ...c,
                      outputSummary: event.outputSummary,
                      durationMs: event.durationMs ?? c.durationMs,
                      status: event.status ?? "success",
                      error: event.error,
                    }
                  : c,
              ),
            }
          : turn,
      };
    }

    case "approval.requested": {
      const approval = normalizeApproval(event.approval);
      const ts = approval.createdAt ?? lastContentTs(transcript.rows) ?? 0;
      return {
        rows: [
          ...withGapRow(transcript.rows, ts),
          { kind: "approval", id: approval.id, createdAt: ts, approval },
        ],
        activeTurn: transcript.activeTurn,
      };
    }

    case "approval.resolved": {
      const rows = transcript.rows.map((row): TranscriptRow => {
        if (row.kind === "approval" && row.approval.id === event.id) {
          return {
            ...row,
            approval: { ...row.approval, status: event.outcome },
          };
        }
        return row;
      });
      return { rows, activeTurn: transcript.activeTurn };
    }

    case "artifact.created": {
      const ts = event.createdAt ?? lastContentTs(transcript.rows) ?? 0;
      return {
        rows: [
          ...withGapRow(transcript.rows, ts),
          { kind: "artifact", id: event.id, createdAt: ts, artifact: event.artifact },
        ],
        activeTurn: transcript.activeTurn,
      };
    }

    case "turn.completed": {
      const ts = event.createdAt ?? transcript.activeTurn?.startedAt ?? 0;
      return settleTurn(transcript, ts);
    }

    case "error": {
      const ts = event.createdAt ?? lastContentTs(transcript.rows) ?? 0;
      return {
        rows: [
          ...withGapRow(transcript.rows, ts),
          { kind: "error", id: event.id, createdAt: ts, text: event.text },
        ],
        activeTurn: transcript.activeTurn,
      };
    }
  }
}
