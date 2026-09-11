"use client";

/**
 * Expandable parent → spawned-subagent tree for a bot session.
 *
 * @module BotSubagentTree
 */

import React, { useState } from "react";
import { CaretRight, Check, CircleNotch, Warning, Robot } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { BotActivityChild, BotActivityStep, BotActivityTree } from "@/lib/bots/bot-subagent-tree";

function mark(status: BotActivityStep["status"]) {
  if (status === "running") {
    return <CircleNotch size={11} className="shrink-0 animate-spin text-[var(--text-tertiary)]" />;
  }
  if (status === "error") {
    return <Warning size={11} className="shrink-0 text-[var(--status-error)]" />;
  }
  return <Check size={11} className="shrink-0 text-[var(--status-success)]" />;
}

function dur(ms?: number) {
  if (ms == null || ms < 50) return null;
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function StepRow({ step }: { step: BotActivityStep }) {
  return (
    <li className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
      {mark(step.status)}
      <span className="font-medium">{step.name}</span>
      {step.status === "success" ? "✓" : step.status === "error" ? "✗" : "…"}
      {dur(step.durationMs) ? (
        <span className="text-[var(--text-tertiary)]">{dur(step.durationMs)}</span>
      ) : null}
    </li>
  );
}

function ChildCard({ child }: { child: BotActivityChild }) {
  const [open, setOpen] = useState(child.status === "running");
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left"
      >
        <CaretRight
          size={12}
          className={cn("shrink-0 text-[var(--text-tertiary)] transition-transform", open && "rotate-90")}
        />
        {mark(child.status)}
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--text-primary)]">
          {child.name}
        </span>
        {dur(child.durationMs) ? (
          <span className="text-[10px] text-[var(--text-tertiary)]">{dur(child.durationMs)}</span>
        ) : null}
      </button>
      {open && (
        <div className="space-y-1 border-t border-[var(--border-subtle)] px-2 py-1.5">
          {child.task ? (
            <p className="text-[11px] text-[var(--text-secondary)]">{child.task}</p>
          ) : null}
          {child.steps.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {child.steps.map((step) => (
                <StepRow key={step.id} step={step} />
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-[var(--text-tertiary)]">No nested steps yet</p>
          )}
        </div>
      )}
    </div>
  );
}

export function BotSubagentTree({ tree }: { tree: BotActivityTree }) {
  const elapsed = dur(tree.elapsedMs);
  return (
    <div data-testid="bot-subagent-tree" className="flex min-w-0 flex-col gap-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
        {tree.running} running · {tree.done} done
        {tree.failed ? ` · ${tree.failed} failed` : ""}
        {" · "}
        {tree.actions} actions
        {elapsed ? ` · ${elapsed}` : ""}
      </p>
      <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
        <Robot size={12} />
        <span className="font-medium text-[var(--text-primary)]">{tree.parentName}</span>
      </div>
      {tree.parentSteps.length > 0 && (
        <ul className="flex flex-col gap-0.5 pl-3">
          {tree.parentSteps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </ul>
      )}
      {tree.children.map((child) => (
        <ChildCard key={child.id} child={child} />
      ))}
    </div>
  );
}

export default BotSubagentTree;
