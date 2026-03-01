/**
 * A2Rchitech Monolith Logo (TUI Version)
 * 
 * An optimized Unicode representation of the Architect Monolith.
 * Uses technical block gradients for a high-fidelity look.
 */

import { useA2RTheme } from "./theme"
import { useAnimatedFrame } from "@/ui/animation"

export function MonolithLogo() {
  const tone = useA2RTheme()
  const frame = useAnimatedFrame("a2r.home.monolith")

  return (
    <box flexDirection="column" alignItems="center">
      <text fg={tone().accent}>{frame()}</text>
    </box>
  )
}
