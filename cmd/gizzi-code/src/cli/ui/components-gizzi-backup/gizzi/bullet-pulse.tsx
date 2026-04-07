/**
 * Allternit BulletPulse
 *
 * Branded single-character animated bullet for inline tool status.
 * Renders a heartbeat-style dot progression while a tool is running,
 * and a static character when completed or errored.
 *
 * This is Allternit's equivalent of Gizzi's animated ⏺ inline bullet.
 * Our version: · → • → ● → ● → • → · (1s cycle, single-width chars)
 *
 * States:
 *   running  → animated heartbeat pulse  (theme.primary)
 *   complete → static ●                  (theme.textMuted)
 *   error    → static ✗                  (theme.error)
 */

import { createMemo } from "solid-js"
import { useAnimatedFrame } from "@/cli/ui/components/animation"
import type { RGBA } from "@opentui/core"

export type BulletPulseState = "running" | "complete" | "error"

export function BulletPulse(props: {
  state?: BulletPulseState
  color?: RGBA
}) {
  // Fix on the running animation — useAnimatedFrame requires a static string.
  // This component is always mounted inside <Show when={isPending()}> so
  // state switching is handled by the parent unmounting/remounting.
  const frame = useAnimatedFrame("gizzi.bullet.running")

  // For non-running states, show a static symbol directly
  const display = createMemo(() => {
    switch (props.state) {
      case "error": return "✗"
      case "complete": return "●"
      default: return frame()
    }
  })

  return (
    <span style={{ fg: props.color }}>{display()}</span>
  )
}
