import type { JSX } from "@opentui/solid"

export function GIZZIMessageList(props: { children: JSX.Element }) {
  return (
    <box flexDirection="column" width="100%" minWidth={0} flexShrink={0}>
      {props.children}
    </box>
  )
}
