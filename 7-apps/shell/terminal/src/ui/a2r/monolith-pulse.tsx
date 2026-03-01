/**
 * A2Rchitech Monolith Pulse
 * 
 * A technical, geometric pulse component for the TUI.
 * Uses specialized Braille patterns to represent the 'Architect Monolith' 
 * in a high-fidelity compact form (2x2 grid).
 */

import { createMemo, Show } from "solid-js"
import { useA2RTheme } from "./theme"
import { useAnimation, useAnimatedFrame } from "@/ui/animation"
import type { RGBA } from "@opentui/core"

export type MonolithPulseVariant = "monolith" | "schematic" | "core" | "minolith"

export function MonolithPulse(props: {
  variant?: MonolithPulseVariant
  color?: RGBA
  state?: "idle" | "thinking" | "executing" | "responding"
}) {
  const tone = useA2RTheme()
  const animation = useAnimation()
  
  const color = () => props.color ?? tone().accent
  const variant = () => props.variant ?? "monolith"
  
  // Map variant + state to animation IDs
  const animId = createMemo(() => {
    const v = variant()
    const s = props.state ?? "thinking"
    
    if (v === "schematic") return "a2r.schematic"
    
    // Official high-fidelity monolith animations
    if (s === "thinking") return "a2r.monolith.pulse"
    if (s === "executing") return "a2r.monolith.executing"
    return "a2r.monolith.idle"
  })

  const frame = useAnimatedFrame(animId())

  return (
    <Show when={animation.enabled()} fallback={<text fg={color()}>◮</text>}>
      <text fg={color()}>{frame()}</text>
    </Show>
  )
}

/**
 * Technical transition markers for the work thread.
 * These use 2-character wide blocks to maintain logo likeness.
 */
export const MONOLITH_GLYPHS = {
  connecting: "▖ ",
  thinking: "▞ ",
  executing: "⚙ ",
  responding: "■ ",
  completed: "❖ ",
  error: "× "
} as const
