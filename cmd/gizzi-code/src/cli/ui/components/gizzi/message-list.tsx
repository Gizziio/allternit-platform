import type { JSX } from "@opentui/solid"

export function GIZZIMessageList(props: { children: JSX.Element }) {
  return (
    <box flexDirection="column" gap={1} width="100%" minWidth={0}>
      {props.children}
    </box>
  )
}
