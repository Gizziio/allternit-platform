"use client";

/**
 * Bot transcript (Phase 1A).
 *
 * Composes `BotChatTranscript` rows into the full scrollable list and renders
 * the active-turn chrome (working chamber → typing dots → streaming bubble)
 * below them. Follow-scroll is keyed on total character count and
 * unanimated; it only follows when the viewport is already near the bottom.
 * Tapping the transcript dismisses the keyboard through the optional
 * `onDismissKeyboard` prop.
 *
 * Approval rows render as a quiet placeholder in 1A — the approval card and
 * pill land in 1B.
 *
 * @module bot-chat/BotTranscript
 */

import { useEffect, useMemo, useRef } from "react";
import type { BotChatTranscript, TranscriptRow } from "./types";
import { deriveRung } from "./transcript";
import { SettledBubble } from "./SettledBubble";
import { StreamingBubble } from "./StreamingBubble";
import { TypingDots } from "./TypingDots";
import { WorkingChamber } from "./WorkingChamber";
import { ToolReceiptChip } from "./ToolReceiptChip";
import { ToolRunCapsule } from "./ToolRunCapsule";
import { GapTimestamp } from "./GapTimestamp";
import { ErrorRow } from "./ErrorRow";

const FOLLOW_THRESHOLD_PX = 80;

function rowChars(row: TranscriptRow): number {
  switch (row.kind) {
    case "message":
      return row.message.text.length;
    case "toolCall":
      return row.call.inputSummary.length + (row.call.outputSummary?.length ?? 0);
    case "toolRun":
      return row.run.calls.reduce((n, c) => n + c.inputSummary.length, 0);
    case "approval":
      return row.approval.title.length;
    case "timestamp-gap":
      return 0;
    case "error":
      return row.text.length;
  }
}

function TranscriptRowView({ row }: { row: TranscriptRow }) {
  switch (row.kind) {
    case "message":
      return (
        <SettledBubble
          role={row.message.role}
          text={row.message.text}
          className={row.message.status === "error" ? "opacity-90" : undefined}
        />
      );
    case "toolCall":
      return <ToolReceiptChip call={row.call} />;
    case "toolRun":
      return <ToolRunCapsule run={row.run} />;
    case "timestamp-gap":
      return <GapTimestamp from={row.from} to={row.to} />;
    case "error":
      return <ErrorRow text={row.text} />;
    case "approval": {
      // 1A placeholder: the approval card lands in 1B. Quiet, factual row.
      const statusLabel =
        row.approval.status === "pending"
          ? "Needs your call"
          : row.approval.status === "approved"
            ? "Approved"
            : row.approval.status === "denied"
              ? "Denied"
              : "Expired";
      return (
        <div className="w-full rounded-lg border border-[var(--bg-elevated)] bg-[var(--bg-elevated)]/30 px-3 py-2.5">
          <div className="text-xs font-medium text-[var(--text-secondary,#a1a1aa)]">
            {row.approval.title}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{statusLabel}</div>
        </div>
      );
    }
  }
}

export interface BotTranscriptProps {
  transcript: BotChatTranscript;
  className?: string;
  onDismissKeyboard?: () => void;
}

export function BotTranscript({ transcript, className, onDismissKeyboard }: BotTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rung = deriveRung(transcript);
  const turn = transcript.activeTurn;

  // Follow key: character count only. Grows monotonically while streaming,
  // so scrolling stays unanimated and cheap.
  const charCount = useMemo(
    () =>
      transcript.rows.reduce((n, row) => n + rowChars(row), 0) +
      (turn?.partialText.length ?? 0) +
      (turn?.thinkingBuffer.length ?? 0),
    [transcript.rows, turn?.partialText, turn?.thinkingBuffer],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [charCount]);

  return (
    <div
      ref={scrollRef}
      onClick={() => onDismissKeyboard?.()}
      style={{ touchAction: "pan-y" }}
      className={className}
    >
      <div className="flex flex-col gap-2 px-3 py-2">
        {transcript.rows.map((row) => (
          <TranscriptRowView key={row.id} row={row} />
        ))}

        {turn && rung === "thinking" && (
          <WorkingChamber thinking={turn.thinkingBuffer} rung={rung} />
        )}
        {turn && rung === "typing" && <TypingDots />}
        {turn && rung === "streaming" && (
          <>
            <StreamingBubble text={turn.partialText} status="streaming" />
            {turn.thinkingBuffer.length > 0 && (
              <WorkingChamber thinking={turn.thinkingBuffer} rung={rung} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
