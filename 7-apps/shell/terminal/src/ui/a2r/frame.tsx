import type { JSX } from "@opentui/solid"
import { useTheme } from "@tui/context/theme"
import { useA2RTheme } from "./theme"

export function A2RFrame(props: { children: JSX.Element }) {
  const tone = useA2RTheme()
  const { theme } = useTheme()
  return (
    <box
      flexDirection="column"
      flexGrow={1}
      width="100%"
      minWidth={0}
      paddingLeft={tone().space.md}
      paddingRight={tone().space.md}
      paddingTop={tone().space.sm}
      gap={tone().space.sm}
      backgroundColor={theme.background}
    >
      {props.children}
    </box>
  )
}
