/**
 * GIZZI Monolith Pulse
 * 
 * High-fidelity 2-character animated marker for inline traces.
 * Returns a string frame, intended for use inside <text> or <span>.
 */

import { createMemo } from "solid-js"
import { useAnimatedFrame } from "@/cli/ui/components/animation"
import type { RGBA } from "@opentui/core"

export function MonolithPulse(props: {
  compact?: boolean
  color?: RGBA
  state?: "idle" | "thinking" | "executing" | "responding"
}) {
  const animId = createMemo(() => {
    switch (props.state) {
      case "thinking": return "gizzi.monolith.thinking"
      case "executing": return "gizzi.monolith.executing"
      default: return "gizzi.monolith.idle"
    }
  })

  const frame = useAnimatedFrame(animId())

  return (
    <span style={{ fg: props.color }}>{frame()}</span>
  )
}

/**
 * Technical transition markers for the work thread.
 */
export const MONOLITH_GLYPHS = {
  connecting: "  ",
  thinking: "▞ ",
  executing: "⚙ ",
  responding: "■ ",
  completed: "❖ ",
  error: "× "
} as const
