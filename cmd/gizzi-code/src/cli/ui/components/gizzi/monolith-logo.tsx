/**
 * GIZZI Mascot Logo (TUI Version)
 * 
 * The primary branded representation of GIZZI.
 * Replaced the legacy "Monolith G" with the high-fidelity mascot chassis.
 */

import { GIZZIMascot } from "@/cli/ui/components/gizzi/mascot"

export function MonolithLogo() {
  return (
    <box flexDirection="column" alignItems="center">
      <GIZZIMascot state="idle" />
    </box>
  )
}
