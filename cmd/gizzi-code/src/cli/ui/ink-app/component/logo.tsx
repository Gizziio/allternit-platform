import { GIZZIBanner } from "@/cli/ui/components/gizzi"
import { MonolithLogo } from "@/cli/ui/components/gizzi/monolith-logo"

export function Logo() {
  return (
    <box flexDirection="column" alignItems="center" gap={1}>
      <MonolithLogo />
      <GIZZIBanner />
    </box>
  )
}
