import { type Accessor, createMemo, createSignal, Match, Show, Switch } from "solid-js"
import { useRouteData } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { pipe, sumBy } from "remeda"
import { useTheme } from "@tui/context/theme"
import { SplitBorder } from "@tui/component/border"
import type { AssistantMessage } from "@a2r/sdk/v2"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useKeybind } from "../../context/keybind"
import { useTerminalDimensions } from "@opentui/solid"
import { A2RCopy } from "@/brand"
import { A2RHeader, useA2RTheme } from "@/ui/a2r"

const ContextInfo = (props: { context: Accessor<string | undefined>; cost: Accessor<string> }) => {
  const { theme } = useTheme()
  const content = createMemo(() => {
    const context = props.context()
    if (!context) return ""
    const value = `${context} (${props.cost()})`.replace(/\s+/g, " ").trim()
    return value.length <= 26 ? value : value.slice(0, 25) + "…"
  })
  return (
    <Show when={props.context()}>
      <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
        {content()}
      </text>
    </Show>
  )
}

export function Header() {
  const route = useRouteData("session")
  const sync = useSync()
  const session = createMemo(() => sync.session.get(route.sessionID)!)
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])

  const cost = createMemo(() => {
    const total = pipe(
      messages(),
      sumBy((x) => (x.role === "assistant" ? x.cost : 0)),
    )
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total)
  })

  const context = createMemo(() => {
    const last = messages().findLast((x) => x.role === "assistant" && x.tokens.output > 0) as AssistantMessage
    if (!last) return
    const total =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = sync.data.provider.find((x) => x.id === last.providerID)?.models[last.modelID]
    let result = total.toLocaleString()
    if (model?.limit.context) {
      result += "  " + Math.round((total / model.limit.context) * 100) + "%"
    }
    return result
  })

  const { theme } = useTheme()
  const tone = useA2RTheme()
  const keybind = useKeybind()
  const command = useCommandDialog()
  const [hover, setHover] = createSignal<"parent" | "prev" | "next" | null>(null)
  const dimensions = useTerminalDimensions()
  const narrow = createMemo(() => dimensions().width < 80)
  const compact = createMemo(() => dimensions().width < 104)
  const titleWidth = createMemo(() => Math.max(20, dimensions().width - (compact() ? 18 : 42)))
  const sessionTitle = createMemo(() => {
    const value = session()?.title ?? ""
    return value.replace(/\s+/g, " ").trim()
  })

  return (
    <box flexShrink={0}>
      <box
        paddingTop={tone().space.sm}
        paddingBottom={tone().space.sm}
        paddingLeft={tone().space.md}
        paddingRight={tone().space.md}
        {...SplitBorder}
        border={["left"]}
        borderColor={theme.border}
        flexShrink={0}
        backgroundColor={theme.backgroundPanel}
      >
        <Switch>
          <Match when={session()?.parentID}>
            <box flexDirection="column" gap={tone().space.sm}>
              <A2RHeader
                title={A2RCopy.header.subagentSession}
                right={compact() ? undefined : <ContextInfo context={context} cost={cost} />}
                maxTitleWidth={titleWidth()}
              />
              <box flexDirection="row" gap={tone().space.md}>
                <box
                  onMouseOver={() => setHover("parent")}
                  onMouseOut={() => setHover(null)}
                  onMouseUp={() => command.trigger("session.parent")}
                  backgroundColor={hover() === "parent" ? theme.backgroundElement : theme.backgroundPanel}
                >
                  <text fg={theme.text}>
                    {A2RCopy.header.parent} <span style={{ fg: theme.textMuted }}>{keybind.print("session_parent")}</span>
                  </text>
                </box>
                <box
                  onMouseOver={() => setHover("prev")}
                  onMouseOut={() => setHover(null)}
                  onMouseUp={() => command.trigger("session.child.previous")}
                  backgroundColor={hover() === "prev" ? theme.backgroundElement : theme.backgroundPanel}
                >
                  <text fg={theme.text}>
                    {A2RCopy.header.previous}{" "}
                    <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle_reverse")}</span>
                  </text>
                </box>
                <box
                  onMouseOver={() => setHover("next")}
                  onMouseOut={() => setHover(null)}
                  onMouseUp={() => command.trigger("session.child.next")}
                  backgroundColor={hover() === "next" ? theme.backgroundElement : theme.backgroundPanel}
                >
                  <text fg={theme.text}>
                    {A2RCopy.header.next} <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle")}</span>
                  </text>
                </box>
              </box>
            </box>
          </Match>
          <Match when={true}>
            <box flexDirection={narrow() ? "column" : "row"} gap={tone().space.sm}>
              <A2RHeader
                title={sessionTitle()}
                right={compact() ? undefined : <ContextInfo context={context} cost={cost} />}
                maxTitleWidth={titleWidth()}
              />
            </box>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
