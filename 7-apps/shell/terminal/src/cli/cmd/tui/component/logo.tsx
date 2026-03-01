import { A2RBanner } from "@/ui/a2r"
import { MonolithLogo } from "@/ui/a2r/monolith-logo"

export function Logo() {
  return (
    <box flexDirection="column" alignItems="center" gap={1}>
      <MonolithLogo />
      <A2RBanner />
    </box>
  )
}
