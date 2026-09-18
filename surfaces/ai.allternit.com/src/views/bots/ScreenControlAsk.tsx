"use client";

/**
 * OpenMaus ask-before-foreground: Allow once / Always allow / Deny.
 * Does not stop Computer Cloud; it only gates the on-screen viewport.
 */

import React from "react";
import { Desktop, ShieldWarning } from "@phosphor-icons/react";
import type { ScreenControlDecision } from "@/lib/bots/screen-control-ask";

export function ScreenControlAsk({
  botName,
  onDecide,
}: {
  botName: string;
  onDecide: (decision: ScreenControlDecision) => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Take screen control?"
      className="mx-3 my-2 rounded-[22px] border-[1.5px] border-[var(--accent-primary)] bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <ShieldWarning size={16} className="mt-0.5 shrink-0 text-[var(--accent-primary)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">
            Take screen control?
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Background input didn’t register. {botName} needs the computer in the
            foreground to continue. Computer Cloud stays running either way.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onDecide("allow-once")}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-primary)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ui-text-inverse,#fff)]"
            >
              <Desktop size={13} />
              Allow once
            </button>
            <button
              type="button"
              onClick={() => onDecide("always")}
              className="rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              Always allow
            </button>
            <button
              type="button"
              onClick={() => onDecide("deny")}
              className="rounded-full px-3 py-1.5 text-[12.5px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Deny
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
