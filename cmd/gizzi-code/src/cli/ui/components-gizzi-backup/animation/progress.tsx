/**
 * Progress Bar Component
 * 
 * Deterministic progress indicator for known-duration tasks.
 * Can be used standalone or with the animation system.
 */

import { createMemo, Show } from "solid-js"
import type { RGBA } from "@opentui/core"

export type ProgressBarProps = {
  /** Current value (0 to max) */
  value: number
  /** Maximum value */
  max?: number
  /** Width in characters (default: 20) */
  width?: number
  /** Show percentage text */
  showPercentage?: boolean
  /** Fill character (default: █) */
  fillChar?: string
  /** Empty character (default: ░) */
  emptyChar?: string
  /** Foreground color */
  color?: RGBA
  /** Background/muted color */
  mutedColor?: RGBA
}

/**
 * Render a progress bar string.
 * Pure function - can be used outside of SolidJS.
 */
export function renderProgressBar(props: {
  value: number
  max?: number
  width?: number
  fillChar?: string
  emptyChar?: string
}): string {
  const max = Math.max(1, props.max ?? 100)
  const width = Math.max(1, props.width ?? 20)
  const fillChar = props.fillChar ?? "█"
  const emptyChar = props.emptyChar ?? "░"
  
  const clampedValue = Math.max(0, Math.min(props.value, max))
  const ratio = clampedValue / max
  const filled = Math.round(ratio * width)
  const empty = width - filled
  
  return fillChar.repeat(filled) + emptyChar.repeat(empty)
}

/**
 * Get percentage string.
 */
export function getPercentage(value: number, max?: number): string {
  const maxVal = Math.max(1, max ?? 100)
  const clampedValue = Math.max(0, Math.min(value, maxVal))
  const pct = Math.round((clampedValue / maxVal) * 100)
  return `${pct}%`
}

/**
 * Progress bar component for SolidJS.
 * Static (non-animated) progress indicator.
 */
export function ProgressBar(props: ProgressBarProps) {
  const bar = createMemo(() => renderProgressBar({
    value: props.value,
    max: props.max,
    width: props.width,
    fillChar: props.fillChar,
    emptyChar: props.emptyChar,
  }))
  
  const percentage = createMemo(() => 
    props.showPercentage ? getPercentage(props.value, props.max) : null
  )

  return (
    <box flexDirection="row" gap={1}>
      <text>{bar()}</text>
      <Show when={percentage()}>
        <text>{percentage()}</text>
      </Show>
    </box>
  )
}

/**
 * Determinate progress with animation support.
 * For tasks where you know the current progress (e.g., file download).
 * 
 * Example:
 * ```tsx
 * <DeterminateProgress 
 *   value={downloadedBytes} 
 *   max={totalBytes}
 *   width={30}
 *   showPercentage
 * />
 * ```
 */
export function DeterminateProgress(props: ProgressBarProps & {
  /** Label to show next to progress */
  label?: string
}) {
  const bar = createMemo(() => renderProgressBar({
    value: props.value,
    max: props.max,
    width: props.width ?? 30,
    fillChar: props.fillChar,
    emptyChar: props.emptyChar,
  }))

  return (
    <box flexDirection="row" gap={1}>
      <Show when={props.label}>
        <text>{props.label}</text>
      </Show>
      <text>{bar()}</text>
      <Show when={props.showPercentage}>
        <text>{getPercentage(props.value, props.max)}</text>
      </Show>
    </box>
  )
}

/**
 * Indeterminate progress (animated) for unknown duration tasks.
 * Uses the animation system.
 * 
 * Example:
 * ```tsx
 * const frame = useAnimatedFrame("spinner.braille")
 * <text>{frame()}</text>
 * ```
 */

// Animation specs for progress indicators
export const ProgressAnimations = {
  /** Braille dots moving left to right */
  braille: {
    id: "progress.braille",
    frames: ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈"],
    intervalTicks: 1,
    mode: "loop" as const,
  },
  
  /** Blocks filling up */
  blocks: {
    id: "progress.blocks",
    frames: ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"],
    intervalTicks: 2,
    mode: "loop" as const,
  },
  
  /** Growing bar */
  growing: {
    id: "progress.growing",
    frames: [
      "░░░░░░░░░░",
      "█░░░░░░░░░",
      "██░░░░░░░░",
      "███░░░░░░░",
      "████░░░░░░",
      "█████░░░░░",
      "██████░░░░",
      "███████░░░",
      "████████░░",
      "█████████░",
      "██████████",
    ],
    intervalTicks: 3,
    mode: "loop" as const,
  },
}
