import { createMemo, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useDirectory } from "@/cli/ui/tui/context/directory"
import { useConnected } from "@/cli/ui/tui/component/dialog-model"
import { createStore } from "solid-js/store"
import { useRoute } from "@/cli/ui/tui/context/route"
import { useTerminalDimensions } from "@opentui/solid"
import { GIZZICopy } from "@/shared/brand"

export function Footer() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const mcp = createMemo(() => Object.values(sync.data.mcp).filter((x) => x.status === "connected").length)
  const mcpError = createMemo(() => Object.values(sync.data.mcp).some((x) => x.status === "failed"))
  const lsp = createMemo(() => Object.keys(sync.data.lsp))
  const permissions = createMemo(() => {
    if (route.data.type !== "session") return []
    return sync.data.permission[route.data.sessionID] ?? []
  })
  const directory = useDirectory()
  const connected = useConnected()
  const dimensions = useTerminalDimensions()

  const [store, setStore] = createStore({
    welcome: false,
  })

  onMount(() => {
    // Track all timeouts to ensure proper cleanup
    const timeouts: ReturnType<typeof setTimeout>[] = []

    function tick() {
      if (connected()) return
      if (!store.welcome) {
        setStore("welcome", true)
        timeouts.push(setTimeout(() => tick(), 5000))
        return
      }

      if (store.welcome) {
        setStore("welcome", false)
        timeouts.push(setTimeout(() => tick(), 10_000))
        return
      }
    }
    timeouts.push(setTimeout(() => tick(), 10_000))

    onCleanup(() => {
      timeouts.forEach(clearTimeout)
    })
  })

  const footerRightWidth = createMemo(() => {
    if (store.welcome) {
      return GIZZICopy.footer.boot.length + 16
    }
    if (!connected()) return 0
    const law = permissions().length > 0 ? GIZZICopy.footer.lawBeacon({ count: permissions().length }).length + 4 : 0
    const runtime = `${lsp().length} ${GIZZICopy.footer.runtime}`.length + 4
    const adapters = mcp() ? `${mcp()} ${GIZZICopy.footer.adapters}`.length + 4 : 0
    return law + runtime + adapters + 12
  })
  const directoryLabel = createMemo(() => {
    const limit = Math.max(16, dimensions().width - footerRightWidth() - 8)
    return truncateMiddle(directory(), limit)
  })

  return (
    <box flexDirection="row" justifyContent="space-between" gap={1} flexShrink={0}>
      <text fg={theme.textMuted} wrapMode="none">
        {directoryLabel()}
      </text>
      <box gap={2} flexDirection="row" flexShrink={0}>
        <Switch>
          <Match when={store.welcome}>
            <text fg={theme.text}>
              {GIZZICopy.footer.boot} <span style={{ fg: theme.textMuted }}>/connect</span>
            </text>
          </Match>
          <Match when={connected()}>
            <Show when={permissions().length > 0}>
              <text fg={theme.warning}>
                <span style={{ fg: theme.warning }}>△</span> {GIZZICopy.footer.lawBeacon({ count: permissions().length })}
              </text>
            </Show>
            <text fg={theme.text}>
              <span style={{ fg: lsp().length > 0 ? theme.success : theme.textMuted }}>•</span> {lsp().length}{" "}
              {GIZZICopy.footer.runtime}
            </text>
            <Show when={mcp()}>
              <text fg={theme.text}>
                <Switch>
                  <Match when={mcpError()}>
                    <span style={{ fg: theme.error }}>⊙ </span>
                  </Match>
                  <Match when={true}>
                    <span style={{ fg: theme.success }}>⊙ </span>
                  </Match>
                </Switch>
                {mcp()} {GIZZICopy.footer.adapters}
              </text>
            </Show>
            <text fg={theme.textMuted}>/status</text>
          </Match>
        </Switch>
      </box>
    </box>
  )
}

function truncateMiddle(value: string, max: number) {
  if (max <= 0) return ""
  if (value.length <= max) return value
  if (max === 1) return "…"
  const left = Math.ceil((max - 1) / 2)
  const right = Math.floor((max - 1) / 2)
  return `${value.slice(0, left)}…${value.slice(-right)}`
}
