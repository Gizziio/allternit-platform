import { createMemo } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useAnimation } from "@/cli/ui/components/animation"
import { useGIZZITheme } from "@/cli/ui/components/gizzi/theme"

export function SetupBanner(props: { stepId: string }) {
  const animation = useAnimation()
  const tone = useGIZZITheme()
  const sceneID = createMemo(() => `gizzi.setup.${props.stepId}`)
  const frame = createMemo(() => animation.frame(sceneID()))
  
  // The setup frame includes:
  // Line 0: Badge [ THEME • SUN ] (26 chars)
  // Line 1-8: Mascot (14 chars centered under badge)
  
  const lines = createMemo(() => frame().split("\n"))
  const badge = createMemo(() => lines()[0])

  return (
    <box flexDirection="column" alignItems="center" gap={1}>
      <text fg={tone().accent} attributes={TextAttributes.BOLD}>
        {badge()}
      </text>
    </box>
  )
}
