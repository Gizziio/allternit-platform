
import { type Accessor, createMemo, createSignal, Match, Show, Switch } from "solid-js"
import { useRouteData } from "@/cli/ui/tui/context/route"
import { useSync } from "@/cli/ui/tui/context/sync"
import { pipe, sumBy } from "remeda"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { SplitBorder } from "@/cli/ui/tui/component/border"

// Local type definition (replaces @a2r/sdk/v2)
interface AssistantMessage {
  role: "assistant"
  id: string
  providerID: string
  modelID: string
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
  }
}
import { useCommandDialog } from "@/cli/ui/tui/component/dialog-command"
import { useKeybind } from "@/cli/ui/tui/context/keybind"
import { useTerminalDimensions } from "@opentui/solid"
import { GIZZICopy } from "@/shared/brand"
import { GIZZIHeader, useGIZZITheme } from "@/cli/ui/components/gizzi"

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
  const session = createMemo(() => (sync as any).session.get(route.sessionID)!)
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])

  const cost = createMemo(() => {
    const total = pipe(
      messages() as any[],
      sumBy((x: any) => (x.role === "assistant" ? x.cost : 0)),
    )
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total)
  })

  const context = createMemo(() => {
    const last = messages().findLast((x: any) => x.role === "assistant" && x.tokens.output > 0) as unknown as AssistantMessage
    if (!last) return
    const total =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = (sync.data.provider as any[]).find((x: any) => x.id === last.providerID)?.models[last.modelID]
    let result = total.toLocaleString()
    if (model?.limit.context) {
      result += "  " + Math.round((total / model.limit.context) * 100) + "%"
    }
    return result
  })

  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const keybind = useKeybind()
  const command = useCommandDialog()
  const [hover, setHover] = createSignal<"parent" | "prev" | "next" | null>(null)
  const dimensions = useTerminalDimensions()
  const narrow = createMemo(() => dimensions().width < 80)
  const compact = createMemo(() => dimensions().width < 104)
  const titleWidth = createMemo(() => Math.max(20, dimensions().width - (compact() ? 18 : 42)))
  const isHeightConstrained = createMemo(() => dimensions().height < 28)
  const padding = () => (isHeightConstrained() ? tone().space.xs : tone().space.sm)
  const sessionTitle = createMemo(() => {
    const value = session()?.title ?? ""
    return value.replace(/\s+/g, " ").trim()
  })

  return (
    <box flexShrink={0}>
      <box
        paddingTop={padding()}
        paddingBottom={padding()}
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
            <box flexDirection="column" gap={padding()}>
              <GIZZIHeader
                title={GIZZICopy.header.subagentSession}
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
                    {GIZZICopy.header.parent} <span style={{ fg: theme.textMuted }}>{keybind.print("session_parent")}</span>
                  </text>
                </box>
                <box
                  onMouseOver={() => setHover("prev")}
                  onMouseOut={() => setHover(null)}
                  onMouseUp={() => command.trigger("session.child.previous")}
                  backgroundColor={hover() === "prev" ? theme.backgroundElement : theme.backgroundPanel}
                >
                  <text fg={theme.text}>
                    {GIZZICopy.header.previous}{" "}
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
                    {GIZZICopy.header.next} <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle")}</span>
                  </text>
                </box>
              </box>
            </box>
          </Match>
          <Match when={true}>
            <box flexDirection={narrow() ? "column" : "row"} gap={tone().space.sm}>
              <GIZZIHeader
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
