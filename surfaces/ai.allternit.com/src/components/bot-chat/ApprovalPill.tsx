"use client";

/**
 * Approval pill (Phase 1B).
 *
 * Fake-island surface for phone chrome. Collapsed: a small dark capsule
 * showing "{botName} needs you" (+ count when there is more than one).
 * POSITIONING IS THE PARENT'S JOB (safe-area pinning lands in 1C) — this
 * component renders only the pill + its inline expansion. Tapping expands
 * the question with per-option capsules directly below the capsule (never a
 * modal); tapping outside or answering collapses it. Expansion animates
 * height/opacity, `motion-safe:` only.
 *
 * @module bot-chat/ApprovalPill
 */

import React, { useEffect, useRef, useState } from "react";
import { CaretUp, Hand, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ApprovalRequest } from "./types";
import { vibrateApproval } from "./haptics";

const DEFAULT_ACCENT = "var(--accent-primary)";

const EXPAND_CSS = `
@keyframes bot-chat-pill-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

export interface ApprovalPillProps {
  approvals: ApprovalRequest[];
  accentColor?: string;
  onAnswer: (approvalId: string, optionId: string) => void;
  onGrant?: (approvalId: string, grantKey: string) => void;
  className?: string;
}

export function ApprovalPill({
  approvals,
  accentColor = DEFAULT_ACCENT,
  onAnswer,
  onGrant,
  className,
}: ApprovalPillProps) {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pending = approvals.filter((a) => a.status === "pending");
  const first = pending[0];
  const count = pending.length;

  // Tap-outside collapses. Answering collapses via the call sites below.
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [expanded]);

  if (!first) return null;

  const answer = (approvalId: string, optionId: string) => {
    vibrateApproval();
    onAnswer(approvalId, optionId);
    setExpanded(false);
  };

  return (
    <div ref={rootRef} className={cn("flex w-full flex-col items-center", className)}>
      <style>{EXPAND_CSS}</style>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-[44px] items-center gap-2 rounded-full bg-black/70 px-4 text-xs font-semibold text-white shadow-lg backdrop-blur"
      >
        <Hand className="size-3.5" style={{ color: accentColor }} aria-hidden="true" />
        {first.botName} needs you
        {count > 1 && (
          <span
            className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ backgroundColor: accentColor, color: "#fff" }}
          >
            {count}
          </span>
        )}
        <CaretUp
          className={cn("size-3.5 text-white/60 transition-transform", !expanded && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div
          className="mt-2 w-full min-w-[260px] max-w-sm rounded-2xl bg-[var(--bg-elevated,#1c1c1f)] p-3 shadow-xl motion-safe:animate-[bot-chat-pill-in_0.15s_ease-out]"
          role="dialog"
          aria-label={`Approval from ${first.botName}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Approval
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setExpanded(false)}
              className="flex size-[44px] items-center justify-center text-[var(--text-tertiary)]"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {pending.map((approval) => (
            <div key={approval.id} className="mt-1">
              <div className="text-xs font-medium text-[var(--text-tertiary)]">
                {approval.botName} is waiting on you
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-primary,#e5e5e5)]">
                {approval.title}
              </div>
              {approval.detail && (
                <div className="mt-1 text-xs leading-relaxed text-[var(--text-secondary,#a1a1aa)]">
                  {approval.detail}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {approval.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => answer(approval.id, option.id)}
                    className={cn(
                      "min-h-[40px] rounded-full px-4 text-sm font-semibold",
                      option.kind === "neutral" &&
                        "border border-[var(--text-tertiary,rgba(255,255,255,0.35))]",
                    )}
                    style={
                      option.kind === "approve"
                        ? { backgroundColor: accentColor, color: "#fff" }
                        : option.kind === "deny"
                          ? {
                              backgroundColor: "rgba(255,255,255,0.12)",
                              color: "var(--text-primary, #e5e5e5)",
                            }
                          : { color: "var(--text-primary, #e5e5e5)" }
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {approval.grantKey && (
                <button
                  type="button"
                  onClick={() => {
                    onGrant?.(approval.id, approval.grantKey as string);
                    setExpanded(false);
                  }}
                  className="mt-2 min-h-[40px] text-xs font-medium underline underline-offset-2"
                  style={{ color: accentColor }}
                >
                  Always allow this tool
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
