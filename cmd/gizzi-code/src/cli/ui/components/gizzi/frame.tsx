import type { JSX } from "@opentui/solid"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi/theme"

export function GIZZIFrame(props: { children: JSX.Element; isHeightConstrained?: boolean }) {
  const tone = useGIZZITheme()
  const { theme } = useTheme()
  const top = () => (props.isHeightConstrained ? tone().space.xs : tone().space.sm)
  const gap = () => (props.isHeightConstrained ? tone().space.xs : tone().space.sm)

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      width="100%"
      height="100%"
      minWidth={0}
      paddingLeft={tone().space.md}
      paddingRight={tone().space.md}
      paddingTop={top()}
      gap={gap()}
      backgroundColor={theme.background}
    >
      {props.children}
    </box>
  )
}
