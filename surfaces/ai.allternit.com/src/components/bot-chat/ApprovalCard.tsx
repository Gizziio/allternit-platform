"use client";

/**
 * Approval card (Phase 1B).
 *
 * Inline answer surface for one `ApprovalRequest`. While pending: accent
 * tint (~12%) + 1.5px accent stroke, raised-hand header, one capsule per
 * option. After resolution: quiet grey settled state ("Approved ✓" /
 * "Denied" / "Expired"). The "Always allow this tool" link renders ONLY when
 * the server issued a `grantKey` — the client never invents keys.
 *
 * @module bot-chat/ApprovalCard
 */

import React from "react";
import { Check, Hand, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ApprovalRequest } from "./types";
import { vibrateApproval } from "./haptics";

const DEFAULT_ACCENT = "var(--accent-primary)";

/** Accent at ~12% opacity over transparent; works with hex and CSS vars. */
function tint(accent: string, pct: number): string {
  return `color-mix(in srgb, ${accent} ${pct}%, transparent)`;
}

const SETTLED_LABEL: Record<Exclude<ApprovalRequest["status"], "pending">, string> = {
  approved: "Approved ✓",
  denied: "Denied",
  expired: "Expired",
};

export interface ApprovalCardProps {
  approval: ApprovalRequest;
  accentColor?: string;
  onAnswer: (optionId: string) => void;
  onGrant?: (grantKey: string) => void;
  className?: string;
}

export function ApprovalCard({
  approval,
  accentColor = DEFAULT_ACCENT,
  onAnswer,
  onGrant,
  className,
}: ApprovalCardProps) {
  const pending = approval.status === "pending";
  const settledLabel =
    approval.status === "pending" ? null : SETTLED_LABEL[approval.status];

  return (
    <div
      role={pending ? "alertdialog" : "status"}
      aria-label={approval.title}
      className={cn("w-full overflow-hidden rounded-[22px] px-4 py-3", className)}
      style={
        pending
          ? {
              backgroundColor: tint(accentColor, 12),
              border: `1.5px solid ${accentColor}`,
            }
          : {
              backgroundColor: "var(--bg-elevated, rgba(255,255,255,0.06))",
              border: "1.5px solid transparent",
              opacity: 0.85,
            }
      }
    >
      <div className="flex items-center gap-2">
        <Hand
          className="size-4 shrink-0"
          style={{ color: pending ? accentColor : undefined }}
          aria-hidden="true"
        />
        <span
          className="text-xs font-medium"
          style={{ color: pending ? accentColor : undefined }}
        >
          {approval.botName} is waiting on you
        </span>
        {!pending && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
            {approval.status === "approved" && (
              <Check className="size-3.5" aria-hidden="true" />
            )}
            {approval.status === "denied" && <X className="size-3.5" aria-hidden="true" />}
            {settledLabel}
          </span>
        )}
      </div>

      <div className="mt-2 text-sm font-semibold text-[var(--text-primary,#e5e5e5)]">
        {approval.title}
      </div>
      {approval.detail && (
        <div className="mt-1 text-xs leading-relaxed text-[var(--text-secondary,#a1a1aa)]">
          {approval.detail}
        </div>
      )}

      {pending ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {approval.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  vibrateApproval();
                  onAnswer(option.id);
                }}
                className={cn(
                  "min-h-[40px] rounded-full px-4 text-sm font-semibold transition-opacity",
                  option.kind === "neutral" && "border bg-transparent",
                )}
                style={
                  option.kind === "approve"
                    ? { backgroundColor: accentColor, color: "#fff" }
                    : option.kind === "deny"
                      ? {
                          backgroundColor:
                            "var(--bg-elevated, rgba(255,255,255,0.12))",
                          color: "var(--text-primary, #e5e5e5)",
                        }
                      : {
                          borderColor:
                            "var(--text-tertiary, rgba(255,255,255,0.35))",
                          color: "var(--text-primary, #e5e5e5)",
                        }
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          {approval.grantKey && (
            <button
              type="button"
              onClick={() => onGrant?.(approval.grantKey as string)}
              className="mt-2.5 min-h-[40px] text-xs font-medium underline underline-offset-2"
              style={{ color: accentColor }}
            >
              Always allow this tool
            </button>
          )}
        </>
      ) : (
        <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
          {settledLabel}
        </div>
      )}
    </div>
  );
}
