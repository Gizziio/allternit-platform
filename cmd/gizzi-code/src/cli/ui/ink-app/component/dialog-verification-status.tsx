import { createMemo, For, Show, createSignal, onMount } from "solid-js"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useSDK } from "@/cli/ui/ink-app/context/sdk"
import { useKeyboard } from "@opentui/solid"

interface StoredVerification {
  id: string
  sessionId: string
  timestamp: string
  type: "patch_equivalence" | "fault_localization" | "code_qa" | "general" | "batch"
  result: {
    passed: boolean
    confidence: "high" | "medium" | "low"
    methodsUsed: string[]
    consensus: boolean
  }
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function DialogVerificationStatus(props: { sessionID?: string }) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const gizziTheme = useGIZZITheme()
  const sdk = useSDK()

  const [verifications, setVerifications] = createSignal<StoredVerification[]>([])
  const [loading, setLoading] = createSignal(true)
  const [selectedIdx, setSelectedIdx] = createSignal(0)

  const fetchVerifications = async () => {
    const base = sdk.url.replace(/\/$/, "")
    const url = props.sessionID
      ? `${base}/verification/query?sessionId=${props.sessionID}&limit=20`
      : `${base}/verification/query?limit=20`
    const result = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .catch(() => [])
    return Array.isArray(result) ? result : (result?.data ?? [])
  }

  onMount(async () => {
    setVerifications(await fetchVerifications())
    setLoading(false)
  })

  useKeyboard((evt) => {
    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      setSelectedIdx((i) => Math.max(0, i - 1))
    }
    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      setSelectedIdx((i) => Math.min(verifications().length - 1, i + 1))
    }
    if (evt.name === "r") {
      evt.preventDefault()
      setLoading(true)
      fetchVerifications().then((data) => {
        setVerifications(data)
        setLoading(false)
      })
    }
    if (evt.name === "escape") {
      evt.preventDefault()
      dialog.clear()
    }
  })

  const confidenceColor = createMemo(() => (conf: "high" | "medium" | "low") => {
    const t = theme
    if (conf === "high") return t.success
    if (conf === "medium") return t.warning
    return t.error
  })

  return (
    <box
      flexDirection="column"
      width={80}
      maxHeight={35}
      padding={1}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Title */}
      <box flexDirection="row" marginBottom={1}>
        <text bold fg={theme.text}>
          Verification Status
        </text>
      </box>

      {/* Body */}
      <Show when={loading()}>
        <text fg={theme.textMuted}>Loading verifications...</text>
      </Show>

      <Show when={!loading() && verifications().length === 0}>
        <text fg={theme.textMuted}>No verifications recorded for this session.</text>
      </Show>

      <Show when={!loading() && verifications().length > 0}>
        {/* Column headers */}
        <box flexDirection="row" marginBottom={1}>
          <text fg={theme.textMuted}>{"  "}</text>
          <text fg={theme.textMuted} width={4}>{" "}</text>
          <text fg={theme.textMuted} width={17}>{"TYPE           "}</text>
          <text fg={theme.textMuted} width={10}>{"CONFIDENCE"}</text>
          <text fg={theme.textMuted}>{"TIME       "}</text>
        </box>

        <For each={verifications()}>
          {(v, i) => {
            const isActive = createMemo(() => selectedIdx() === i())
            const passIcon = v.result.passed ? "✓" : "✗"
            const passColor = v.result.passed ? theme.success : theme.error
            const typeLabel = v.type.toUpperCase().slice(0, 15).padEnd(15)
            const confLabel = v.result.confidence.padEnd(8)
            const timeLabel = timeAgo(v.timestamp)

            return (
              <box
                flexDirection="row"
                backgroundColor={isActive() ? theme.backgroundElement : undefined}
              >
                <text fg={theme.textMuted}>{isActive() ? ">" : " "}</text>
                <text fg={passColor} width={3}>{` ${passIcon}`}</text>
                <text fg={theme.text} width={17}>{` ${typeLabel}`}</text>
                <text fg={confidenceColor()(v.result.confidence)} width={10}>{` ${confLabel}`}</text>
                <text fg={theme.textMuted}>{` ${timeLabel}`}</text>
              </box>
            )
          }}
        </For>
      </Show>

      {/* Footer */}
      <box flexDirection="row" gap={2} marginTop={1}>
        <text fg={theme.textMuted}>↑↓ navigate</text>
        <text fg={theme.textMuted}>r refresh</text>
        <text fg={theme.textMuted}>Esc close</text>
      </box>
    </box>
  )
}
