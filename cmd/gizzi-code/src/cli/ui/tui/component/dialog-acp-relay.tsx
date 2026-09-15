import { createMemo, For, Show, createSignal, onMount } from "solid-js"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useKeyboard } from "@opentui/solid"
import { useSync } from "@/cli/ui/tui/context/sync"
import { TextAttributes } from "@opentui/core"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "tui.dialog-acp-relay" })

const ACP_DEFAULT_PORT = 4096

function deriveAcpStatus(statusType: string | undefined): "busy" | "idle" | "unknown" {
  if (statusType === "busy") return "busy"
  if (statusType === "idle") return "idle"
  return "unknown"
}

function StatusIndicator(props: { statusType: string | undefined }) {
  const { theme } = useTheme()

  const derived = createMemo(() => deriveAcpStatus(props.statusType))

  return (
    <Show
      when={derived() === "busy"}
      fallback={
        <Show
          when={derived() === "idle"}
          fallback={<span style={{ fg: theme.textMuted }}>● Unknown</span>}
        >
          <span style={{ fg: theme.success, attributes: TextAttributes.BOLD }}>● Idle</span>
        </Show>
      }
    >
      <span style={{ fg: theme.warning, attributes: TextAttributes.BOLD }}>● Active</span>
    </Show>
  )
}

export function DialogAcpRelay(props: { sessionID: string }) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const gizziTheme = useGIZZITheme()
  const sdk = useSDK()
  const sync = useSync()

  const [loading, setLoading] = createSignal(false)
  const [sessionDetail, setSessionDetail] = createSignal<any>(null)

  const sessionStatus = createMemo(() => {
    return (sync.data.session_status as Record<string, any>)[props.sessionID]
  })

  const statusType = createMemo(() => {
    const s = sessionStatus()
    return s?.type as string | undefined
  })

  const acpStatusLabel = createMemo(() => {
    const t = statusType()
    if (t === "busy") return "Active / Processing"
    if (t === "idle") return "Idle / Ready"
    return "Unknown"
  })

  const baseUrl = createMemo(() => {
    const url = (sdk as any).url as string | undefined
    if (!url) return `http://localhost:${ACP_DEFAULT_PORT}`
    // Strip trailing slash
    return url.replace(/\/$/, "")
  })

  const relayEndpoint = createMemo(() => {
    const truncatedID = props.sessionID.slice(0, 20)
    return `${baseUrl()}/acp/${truncatedID}`
  })

  const truncatedSessionID = createMemo(() => {
    return props.sessionID.length > 20
      ? `${props.sessionID.slice(0, 20)}...`
      : props.sessionID
  })

  async function refresh() {
    if (loading()) return
    setLoading(true)
    try {
      const result = await (sdk.client as any).session.get({
        path: { sessionID: props.sessionID },
      })
      if (result?.data) {
        setSessionDetail(result.data)
      }
    } catch (err) {
      log.debug("ACP relay dialog: failed to fetch session detail", { err })
    } finally {
      // Brief visual feedback before clearing loading state
      setTimeout(() => setLoading(false), 300)
    }
  }

  onMount(() => {
    refresh()
  })

  useKeyboard((evt) => {
    if (evt.name === "r") {
      evt.preventDefault()
      evt.stopPropagation()
      refresh()
    }
    if (evt.name === "escape") {
      evt.preventDefault()
      evt.stopPropagation()
      dialog.clear()
    }
  })

  return (
    <box
      width={70}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      borderStyle="single"
      borderColor={theme.border}
      backgroundColor={theme.backgroundPanel}
      gap={1}
    >
      {/* Title row */}
      <box flexDirection="row" justifyContent="space-between">
        <text style={{ fg: theme.text, attributes: TextAttributes.BOLD }}>
          ACP Relay Status
        </text>
        <Show when={loading()}>
          <text style={{ fg: theme.textMuted }}>⋯ refreshing</text>
        </Show>
      </box>

      {/* Divider */}
      <text style={{ fg: theme.border }}>{"─".repeat(64)}</text>

      {/* Session ID row */}
      <box flexDirection="row" gap={1}>
        <text style={{ fg: theme.textMuted }} width={12}>
          Session:
        </text>
        <text style={{ fg: theme.text }}>
          {truncatedSessionID()}
        </text>
      </box>

      {/* Status row */}
      <box flexDirection="row" gap={1} alignItems="center">
        <text style={{ fg: theme.textMuted }} width={12}>
          Status:
        </text>
        <box flexDirection="row" gap={2} alignItems="center">
          <text style={{ fg: theme.text }}>{acpStatusLabel()}</text>
          <StatusIndicator statusType={statusType()} />
        </box>
      </box>

      {/* Connection mode row */}
      <box flexDirection="row" gap={1}>
        <text style={{ fg: theme.textMuted }} width={12}>
          Mode:
        </text>
        <text style={{ fg: theme.text }}>In-Process (ACP)</text>
      </box>

      {/* Endpoint row */}
      <box flexDirection="row" gap={1}>
        <text style={{ fg: theme.textMuted }} width={12}>
          Endpoint:
        </text>
        <text style={{ fg: gizziTheme().accent }}>
          {relayEndpoint()}
        </text>
      </box>

      {/* Divider */}
      <text style={{ fg: theme.border }}>{"─".repeat(64)}</text>

      {/* Info block */}
      <box gap={0}>
        <text style={{ fg: theme.textMuted }}>
          ACP enables external agent connections to this session
        </text>
        <text style={{ fg: theme.textMuted }}>
          via the Agent Client Protocol (ACP) relay interface.
        </text>
        <text style={{ fg: theme.textMuted }}>
          The relay is in-process and does not expose a REST API.
        </text>
      </box>

      {/* Divider */}
      <text style={{ fg: theme.border }}>{"─".repeat(64)}</text>

      {/* Footer keybinds */}
      <box flexDirection="row" gap={2}>
        <text style={{ fg: theme.textMuted }}>↑↓ scroll</text>
        <text style={{ fg: theme.textMuted }}>
          <text style={{ fg: theme.text }}>r</text>
          {" refresh"}
        </text>
        <text style={{ fg: theme.textMuted }}>
          <text style={{ fg: theme.text }}>Esc</text>
          {" close"}
        </text>
      </box>
    </box>
  )
}
