/**
 * InlineSpinner — Tiny arc indicator with two modes:
 *
 *   Indeterminate (no progress prop): spinning arc — used for Thinking…, step traces.
 *   Determinate   (progress 0–1):     static arc that fills clockwise — used for tool
 *                                     call rows where elapsed time drives progress.
 */
"use client";

import { memo } from "react";

interface InlineSpinnerProps {
  size?: number;
  color?: string;
  /** 0–1. When provided the arc fills to this fraction; when omitted the arc spins. */
  progress?: number;
}

export const InlineSpinner = memo(function InlineSpinner({
  size = 12,
  color = "#D4B08C",
  progress,
}: InlineSpinnerProps) {
  const r = (size / 2) * 0.72;
  const circ = 2 * Math.PI * r;

  const isDeterminate = progress !== undefined;
  // Indeterminate: fixed 28% arc that spins. Determinate: arc fills based on progress.
  const arcFrac = isDeterminate ? Math.max(0.02, Math.min(1, progress)) : 0.28;
  const dash = circ * arcFrac;

  return (
    <>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        style={{
          animation: isDeterminate ? "none" : "inline-spin 0.9s linear infinite",
          flexShrink: 0,
          display: "block",
        }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeOpacity={0.15}
          strokeWidth={size * 0.14}
        />
        {/* Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={size * 0.14}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={isDeterminate ? { transition: "stroke-dasharray 0.12s ease-out" } : undefined}
        />
      </svg>
      {!isDeterminate && (
        <style>{`@keyframes inline-spin { to { transform: rotate(360deg); } }`}</style>
      )}
    </>
  );
});

InlineSpinner.displayName = "InlineSpinner";
