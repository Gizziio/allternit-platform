
import { createMemo, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { RGBA } from "@opentui/core"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useSync } from "@/cli/ui/ink-app/context/sync"
import { useDirectory } from "@/cli/ui/ink-app/context/directory"
import { useConnected } from "@/cli/ui/ink-app/component/dialog-model"
import { createStore } from "solid-js/store"
import { useRoute } from "@/cli/ui/ink-app/context/route"
import { useTerminalDimensions } from "@opentui/solid"
import { useLocal } from "@/cli/ui/ink-app/context/local"
import { GIZZICopy } from "@/shared/brand"
import { GIZZIMascot, type GIZZIMascotState } from "@/cli/ui/components/gizzi/mascot"

export function Footer(props: {
  mascotState?: GIZZIMascotState
  mascotHint?: string
  contextUsed?: number
  contextTotal?: number
}) {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const local = useLocal()
  const mcp = createMemo(() => Object.values(sync.data.mcp ?? {}).filter((x: any) => x?.status === "connected").length)
  const mcpError = createMemo(() => Object.values(sync.data.mcp ?? {}).some((x: any) => x?.status === "failed"))
  const mcpErrorNames = createMemo(() =>
    Object.entries(sync.data.mcp ?? {})
      .filter(([, v]: [string, any]) => v?.status === "failed")
      .map(([k]: [string, any]) => k)
      .slice(0, 2)
      .join(", "),
  )
  const lsp = createMemo(() => Object.keys(sync.data.lsp ?? {}))
  const permissions = createMemo(() => {
    if (route.data.type !== "session") return []
    return sync.data.permission?.[route.data.sessionID] ?? []
  })
  const directory = useDirectory()
  const connected = useConnected()
  const dimensions = useTerminalDimensions()

  const [store, setStore] = createStore({
    welcome: false,
  })

  onMount(() => {
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

  // Get current mode (yolo, bypass, etc.)
  const currentMode = createMemo(() => {
    const config = sync.data?.config as any
    if (config?.permissions === "allow_all" || config?.yolo) return "yolo"
    return "safe"
  })

  // Get current agent info
  const currentAgent = createMemo(() => {
    const agent = local.agent.current() as { name?: string } | null
    if (!agent) return null
    return agent
  })

  // Calculate context usage
  const contextUsage = createMemo(() => {
    const used = props.contextUsed || 0
    const total = props.contextTotal || 200000
    const percentage = Math.round((used / total) * 100)
    return {
      used,
      total,
      percentage,
      compact: `${percentage}% (${formatTokens(used)}/${formatTokens(total)})`
    }
  })

  const autoCompactThreshold = 85

  const footerRightWidth = createMemo(() => {
    if (store.welcome) {
      return GIZZICopy.footer.boot.length + 16
    }
    if (!connected()) return 0
    const law = permissions().length > 0 ? GIZZICopy.footer.lawBeacon({ count: permissions().length }).length + 4 : 0
    const runtime = `${lsp().length} ${GIZZICopy.footer.runtime}`.length + 4
    const adapters = mcp() ? `${mcp()} ${GIZZICopy.footer.adapters}`.length + 4 : 0
    const mascotWidth = props.mascotState ? 16 : 0
    return law + runtime + adapters + mascotWidth + 12
  })
  
  const directoryLabel = createMemo(() => {
    const limit = Math.max(16, dimensions().width - footerRightWidth() - 8)
    return truncateMiddle(directory(), limit)
  })

  const mascotColor = () => theme.textMuted

  // Pre-compute all text values to ensure they're strings
  const modeText = createMemo(() => currentMode() === "yolo" ? "⚡ yolo" : "🔒 safe")
  const agentNameText = createMemo(() => currentAgent()?.name ?? "")
  const contextPercentText = createMemo(() => String(contextUsage().percentage))
  const lawBeaconText = createMemo(() => String(GIZZICopy.footer.lawBeacon({ count: permissions().length })))
  const lspCountText = createMemo(() => String(lsp()?.length ?? 0))
  const mcpCountText = createMemo(() => String(mcp()))
  const mascotHintText = createMemo(() => props.mascotHint ?? "")

  return (
    <box flexDirection="column" flexShrink={0}>
      <box
        flexDirection="row" 
        justifyContent="space-between" 
        gap={1} 
        flexShrink={0}
        paddingTop={1}
        paddingBottom={1}
      >
        <text fg={theme.textMuted} wrapMode="none">
          {directoryLabel()}
        </text>
        
        <box flexDirection="row" gap={2} flexShrink={0}>
          <text fg={currentMode() === "yolo" ? theme.warning : theme.success}>
            {modeText()}
          </text>
          
          <text fg={theme.textMuted}>|</text>
          
          <Show when={currentAgent()}>
            <text fg={theme.text}>
              <span style={{ fg: theme.primary }}>●</span> {agentNameText()}
            </text>
          </Show>
        </box>
        
        <box gap={2} flexDirection="row" flexShrink={0} alignItems="center">
          <text fg={contextUsage().percentage > autoCompactThreshold ? theme.warning : theme.textMuted}>
            <span style={{ fg: contextUsage().percentage > 90 ? theme.error : contextUsage().percentage > autoCompactThreshold ? theme.warning : theme.success }}>
              {contextPercentText()}%
            </span>
            {" "}context
          </text>
          
          <Switch>
            <Match when={store.welcome}>
              <text fg={theme.text}>
                {GIZZICopy.footer.boot} <span style={{ fg: theme.textMuted }}>/connect</span>
              </text>
            </Match>
            <Match when={!connected()}>
              <text fg={theme.error}>
                ⊘ connection lost
              </text>
            </Match>
            <Match when={connected()}>
              <Show when={permissions().length > 0}>
                <text fg={theme.warning}>
                  <span style={{ fg: theme.warning }}>△</span> {String(lawBeaconText())}
                </text>
              </Show>
              <text fg={theme.text}>
                <span style={{ fg: lsp().length > 0 ? theme.success : theme.textMuted }}>•</span> {String(lspCountText())}{" "}
                {GIZZICopy.footer.runtime}
              </text>
              <Show when={mcp() || mcpError()}>
                <text fg={mcpError() ? theme.error : theme.text}>
                  <span style={{ fg: mcpError() ? theme.error : theme.success }}>⊙ </span>
                  {String(mcpCountText())} {GIZZICopy.footer.adapters}
                  <Show when={mcpError() && mcpErrorNames()}>
                    {" "}({mcpErrorNames()} failed)
                  </Show>
                </text>
              </Show>
            </Match>
          </Switch>
          
          <Show when={props.mascotState}>
            <GIZZIMascot
              state={props.mascotState!}
              compact={true}
              color={mascotColor()}
            />
          </Show>
        </box>
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

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// Helper to ensure string rendering
function s(val: unknown): string {
  if (val === undefined || val === null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  return String(val)
}
// Force recompile Sat Mar 14 17:35:15 CDT 2026
