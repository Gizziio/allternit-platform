"use client";

/**
 * Bot transcript (Phase 1A).
 *
 * Composes `BotChatTranscript` rows into the full scrollable list and renders
 * the active-turn chrome (working chamber → typing dots → streaming bubble)
 * below them. Follow-scroll is keyed on total character count and
 * unanimated; it only follows when the viewport is already near the bottom.
 * The owner bumps `jumpKey` when the user sends a message, which forces a
 * scroll to the newest row regardless of the current position, and a sticky
 * "Jump to latest" pill appears whenever the viewport is scrolled away.
 * Tapping the transcript dismisses the keyboard through the optional
 * `onDismissKeyboard` prop.
 *
 * Approval rows render as `ApprovalCard`. Answers/grants pass through to the
 * parent (1C owns the wire).
 *
 * @module bot-chat/BotTranscript
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BotChatTranscript, TranscriptRow } from "./types";
import { deriveRung } from "./transcript";
import { SettledBubble } from "./SettledBubble";
import { StreamingBubble } from "./StreamingBubble";
import { TypingDots } from "./TypingDots";
import { WorkingChamber } from "./WorkingChamber";
import { ToolReceiptChip } from "./ToolReceiptChip";
import { ToolRunCapsule } from "./ToolRunCapsule";
import { ActivityLine } from "./ActivityLine";
import { SystemLine } from "./SystemLine";
import { GapTimestamp } from "./GapTimestamp";
import { ErrorRow } from "./ErrorRow";
import { ApprovalCard } from "./ApprovalCard";
import { InlineArtifactRenderer } from "./InlineArtifactRenderer";

const FOLLOW_THRESHOLD_PX = 80;

function rowChars(row: TranscriptRow): number {
  switch (row.kind) {
    case "message":
      return row.message.text.length;
    case "artifact":
      return row.artifact.content.length + row.artifact.title.length;
    case "toolCall":
      return row.call.inputSummary.length + (row.call.outputSummary?.length ?? 0);
    case "toolRun":
      return row.run.calls.reduce((n, c) => n + c.inputSummary.length, 0);
    case "approval":
      return row.approval.title.length;
    case "timestamp-gap":
      return 0;
    case "system":
      return row.text.length;
    case "error":
      return row.text.length;
  }
}

function TranscriptRowView({
  row,
  onApprovalAnswer,
  onApprovalGrant,
}: {
  row: TranscriptRow;
  onApprovalAnswer?: (approvalId: string, optionId: string) => void;
  onApprovalGrant?: (approvalId: string, grantKey: string) => void;
}) {
  switch (row.kind) {
    case "message":
      return (
        <SettledBubble
          role={row.message.role}
          text={row.message.text}
          className={row.message.status === "error" ? "opacity-90" : undefined}
        />
      );
    case "artifact":
      return <InlineArtifactRenderer artifact={row.artifact} />;
    case "toolCall":
      return <ToolReceiptChip call={row.call} />;
    case "toolRun":
      return <ToolRunCapsule run={row.run} />;
    case "timestamp-gap":
      return <GapTimestamp from={row.from} to={row.to} />;
    case "system":
      return <SystemLine text={row.text} />;
    case "error":
      return <ErrorRow text={row.text} />;
    case "approval":
      return (
        <ApprovalCard
          approval={row.approval}
          onAnswer={(optionId) => onApprovalAnswer?.(row.approval.id, optionId)}
          onGrant={(grantKey) => onApprovalGrant?.(row.approval.id, grantKey)}
        />
      );
  }
}

export interface BotTranscriptProps {
  transcript: BotChatTranscript;
  className?: string;
  onDismissKeyboard?: () => void;
  /**
   * Bumped by the owner when the user sends a message. Each change forces a
   * scroll to the newest row even when the viewport is scrolled far up.
   */
  jumpKey?: number;
  /**
   * Approval answers pass straight through to the owner of the wire adapter
   * (1C); the fold does not change on answer — the resolved event does.
   */
  onApprovalAnswer?: (approvalId: string, optionId: string) => void;
  onApprovalGrant?: (approvalId: string, grantKey: string) => void;
}

export function BotTranscript({
  transcript,
  className,
  onDismissKeyboard,
  jumpKey,
  onApprovalAnswer,
  onApprovalGrant,
}: BotTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rung = deriveRung(transcript);
  const turn = transcript.activeTurn;
  const [atBottom, setAtBottom] = useState(true);

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(
      el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX,
    );
  }, []);

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

  // A fresh user send always jumps to the current message, no matter where
  // the viewport was (history review, compacted older messages, etc.).
  useEffect(() => {
    if (jumpKey === undefined) return;
    jumpToBottom();
  }, [jumpKey, jumpToBottom]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      onClick={() => onDismissKeyboard?.()}
      style={{ touchAction: "pan-y" }}
      className={className}
    >
      <div className="flex flex-col gap-2 px-3 py-2">
        {transcript.rows.map((row) => (
          <TranscriptRowView
            key={row.id}
            row={row}
            onApprovalAnswer={onApprovalAnswer}
            onApprovalGrant={onApprovalGrant}
          />
        ))}

        {turn && rung === "thinking" && (
          <WorkingChamber thinking={turn.thinkingBuffer} rung={rung} startedAt={turn.startedAt} />
        )}
        {turn && rung === "typing" && <TypingDots />}
        {turn && turn.activity && <ActivityLine activity={turn.activity} />}
        {turn && rung === "streaming" && (
          <>
            <StreamingBubble text={turn.partialText} status="streaming" />
            {turn.thinkingBuffer.length > 0 && (
              <WorkingChamber thinking={turn.thinkingBuffer} rung={rung} startedAt={turn.startedAt} />
            )}
          </>
        )}
      </div>

      {!atBottom && (
        <button
          type="button"
          aria-label="Jump to latest message"
          onClick={(event) => {
            event.stopPropagation();
            jumpToBottom();
          }}
          className="sticky bottom-3 float-right mr-3 flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-lg"
        >
          <span aria-hidden>↓</span> Jump to latest
        </button>
      )}
    </div>
  );
}
