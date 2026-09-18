"use client";

/**
 * Quiet message chrome, merged from OpenMausBot ChatView:
 * one "…" handle; hover/focus/tap reveals Copy. Idle bubbles stay clean.
 * Allternit tokens + Phosphor — no OpenMaus classes or mascot.
 */

import React, { useState, type ReactNode } from "react";
import { Check, Copy, DotsThree } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function MessageHoverActions({
  side,
  children,
}: {
  side: "user" | "bot";
  children: ReactNode;
}): React.ReactNode {
  const [open, setOpen] = useState(false);
  const mirrored = side === "user";
  return (
    <div
      className={cn(
        "flex items-center self-end pb-0.5",
        mirrored && "flex-row-reverse",
      )}
      data-testid="message-hover-actions"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Message actions"
        aria-expanded={open}
        className={cn(
          "rounded-md p-1.5 text-[var(--text-tertiary)] transition-opacity hover:bg-[var(--shell-item-hover)] hover:text-[var(--text-primary)] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100",
          open ? "bg-[var(--shell-item-hover)] text-[var(--text-primary)] opacity-100" : "opacity-0",
        )}
      >
        <DotsThree size={14} weight="bold" aria-hidden />
      </button>
      <div
        className={cn(
          "grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out group-hover:grid-cols-[1fr] group-focus-within:grid-cols-[1fr]",
          open && "grid-cols-[1fr]",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-0.5 overflow-hidden",
            mirrored && "flex-row-reverse",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function CopyMessageButton({ text }: { text: string }): React.ReactNode {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      aria-label="Copy message"
      className="rounded-md p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--shell-item-hover)] hover:text-[var(--text-primary)]"
    >
      {copied ? <Check size={14} className="text-[var(--status-success)]" /> : <Copy size={14} />}
    </button>
  );
}
