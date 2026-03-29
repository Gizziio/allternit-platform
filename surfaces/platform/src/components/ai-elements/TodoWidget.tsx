/**
 * TodoWidget — Inline plan/task card shown at the start of multi-step agentic tasks.
 *
 * Renders when Claude outputs a structured todo list (markdown checklist in the first
 * text part, or a `todo-plan` part type). Shows each step with live status:
 *   ○ pending  →  spinner running  →  ✓ done  →  ✗ error
 *
 * Collapses to a summary bar once all steps complete.
 */

"use client";

import React, { memo, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Circle,
  Warning,
  CaretDown,
  CaretRight,
} from '@phosphor-icons/react';
import { InlineSpinner } from "@/components/ai-elements/inline-spinner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodoStep {
  id: string;
  label: string;
  state: "pending" | "running" | "done" | "error";
}

interface TodoWidgetProps {
  steps: TodoStep[];
  title?: string;
  /** If true, shows as collapsed summary bar */
  defaultCollapsed?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a markdown checklist from text.
 * Supports:
 *   - [ ] Step label
 *   - [x] Step label
 *   1. Step label
 *   • Step label
 */
export function parseTodoSteps(text: string): TodoStep[] | null {
  const lines = text.split("\n");
  const steps: TodoStep[] = [];
  let idx = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Unchecked checkbox
    const unchecked = trimmed.match(/^-?\s*\[\s*\]\s+(.+)/);
    if (unchecked) {
      steps.push({ id: `step-${idx}`, label: unchecked[1].trim(), state: "pending" });
      idx++;
      continue;
    }
    // Checked checkbox
    const checked = trimmed.match(/^-?\s*\[[xX✓]\]\s+(.+)/);
    if (checked) {
      steps.push({ id: `step-${idx}`, label: checked[1].trim(), state: "done" });
      idx++;
      continue;
    }
    // Numbered list
    const numbered = trimmed.match(/^\d+\.\s+(.+)/);
    if (numbered) {
      steps.push({ id: `step-${idx}`, label: numbered[1].trim(), state: "pending" });
      idx++;
      continue;
    }
    // Bullet
    const bullet = trimmed.match(/^[•·–—]\s+(.+)/);
    if (bullet) {
      steps.push({ id: `step-${idx}`, label: bullet[1].trim(), state: "pending" });
      idx++;
    }
  }

  return steps.length >= 2 ? steps : null;
}

// ─── Step icon ────────────────────────────────────────────────────────────────

function StepIcon({ state }: { state: TodoStep["state"] }) {
  if (state === "running") return <InlineSpinner size={13} color="rgba(212,176,140,0.85)" />;
  if (state === "done")    return <CheckCircle size={13} style={{ color: "rgba(74,222,128,0.7)", flexShrink: 0 }} />;
  if (state === "error")   return <Warning size={13} style={{ color: "rgba(248,113,113,0.7)", flexShrink: 0 }} />;
  return <Circle size={13} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const TodoWidget = memo(function TodoWidget({
  steps,
  title = "Plan",
  defaultCollapsed = false,
}: TodoWidgetProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const doneCount    = steps.filter(s => s.state === "done").length;
  const runningCount = steps.filter(s => s.state === "running").length;
  const errorCount   = steps.filter(s => s.state === "error").length;
  const allDone      = doneCount === steps.length;

  const summaryColor = allDone
    ? "rgba(74,222,128,0.6)"
    : runningCount > 0
    ? "rgba(212,176,140,0.65)"
    : errorCount > 0
    ? "rgba(248,113,113,0.65)"
    : "rgba(255,255,255,0.3)";

  return (
    <div style={{
      margin: "8px 0",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.07)",
      background: "rgba(255,255,255,0.025)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "9px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Status indicator */}
        {runningCount > 0 ? (
          <InlineSpinner size={12} color="rgba(212,176,140,0.7)" />
        ) : allDone ? (
          <CheckCircle size={12} style={{ color: "rgba(74,222,128,0.55)", flexShrink: 0 }} />
        ) : (
          <Circle size={12} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
        )}

        {/* Title */}
        <span style={{
          flex: 1,
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: summaryColor,
        }}>
          {title}
        </span>

        {/* Progress badge */}
        <span style={{
          fontSize: "10px",
          color: "rgba(255,255,255,0.28)",
          fontWeight: 500,
          marginRight: "4px",
        }}>
          {doneCount}/{steps.length}
        </span>

        {/* Expand chevron */}
        {collapsed
          ? <CaretRight size={11} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
          : <CaretDown size={11} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
        }
      </button>

      {/* Steps */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              padding: "2px 12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}>
              {steps.map((step) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <StepIcon state={step.state} />
                  <span style={{
                    fontSize: "12.5px",
                    lineHeight: "1.45",
                    fontWeight: step.state === "running" ? 500 : 400,
                    color: step.state === "running"
                      ? "rgba(236,236,236,0.85)"
                      : step.state === "done"
                      ? "rgba(255,255,255,0.38)"
                      : step.state === "error"
                      ? "rgba(248,113,113,0.7)"
                      : "rgba(255,255,255,0.55)",
                    textDecoration: step.state === "done" ? "line-through" : "none",
                    textDecorationColor: "rgba(255,255,255,0.2)",
                  }}>
                    {step.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

TodoWidget.displayName = "TodoWidget";
