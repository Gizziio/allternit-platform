import { createMemo, For, Show, createSignal, onMount } from "solid-js"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useKeyboard } from "@opentui/solid"
import { useSync } from "@/cli/ui/tui/context/sync"
import { TextAttributes } from "@opentui/core"

interface SessionInfo {
  id: string
  parentID?: string
  title: string
  time: { created: number; updated: number }
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function DialogSwarmTree(props: { sessionID: string }) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const sdk = useSDK()
  const sync = useSync()

  const [children, setChildren] = createSignal<SessionInfo[]>([])
  const [loading, setLoading] = createSignal(true)
  const [selectedIdx, setSelectedIdx] = createSignal(0)

  const fetchChildren = async () => {
    setLoading(true)
    try {
      const result = await sdk.client.session.children({ path: { sessionID: props.sessionID } } as any)
      const fetched: SessionInfo[] = (result as any).data ?? []
      setChildren(fetched)
      setSelectedIdx((prev) => Math.min(prev, Math.max(0, fetched.length - 1)))
    } catch {
      setChildren([])
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    fetchChildren()
  })

  useKeyboard((evt) => {
    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      setSelectedIdx((prev) => Math.max(0, prev - 1))
      return
    }
    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      setSelectedIdx((prev) => Math.min(children().length - 1, prev + 1))
      return
    }
    if (evt.name === "r") {
      evt.preventDefault()
      fetchChildren()
      return
    }
    if (evt.name === "escape") {
      evt.preventDefault()
      dialog.clear()
      return
    }
  })

  const statusIcon = (childID: string): { icon: string; fg: string } => {
    const status = (sync.data.session_status?.[childID] as any)?.type
    if (status === "busy" || status === "thinking" || status === "retry") {
      return { icon: "⟳", fg: theme.warning as unknown as string}
    }
    if (status === "idle") {
      return { icon: "✓", fg: theme.success as unknown as string}
    }
    return { icon: "○", fg: theme.textMuted as unknown as string}
  }

  const list = createMemo(() => children())

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
      {/* Header */}
      <box flexDirection="row" marginBottom={1}>
        <text attributes={TextAttributes.BOLD} fg={theme.accent}>
          Agent Swarm
        </text>
        <Show when={!loading()}>
          <text fg={theme.textMuted}>
            {" — "}
            {String(list().length)} subagent{list().length !== 1 ? "s" : ""} spawned
          </text>
        </Show>
      </box>

      {/* Body */}
      <box flexDirection="column" flexGrow={1}>
        <Show when={loading()}>
          <text fg={theme.textMuted}>Loading subagents...</text>
        </Show>

        <Show when={!loading() && list().length === 0}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.textMuted}>No subagents spawned in this session.</text>
            <text fg={theme.textMuted}>
              Subagents are created when the model uses @agent-name syntax.
            </text>
          </box>
        </Show>

        <Show when={!loading() && list().length > 0}>
          <box flexDirection="column">
            <For each={list()}>
              {(child, i) => {
                const isLast = () => i() === list().length - 1
                const isSelected = () => i() === selectedIdx()
                const connector = () => (isLast() ? "└─" : "├─")
                const continuation = () => (isLast() ? "   " : "│  ")
                const { icon, fg } = statusIcon(child.id)
                const truncatedTitle = () =>
                  child.title.length > 50 ? child.title.slice(0, 47) + "…" : child.title

                return (
                  <box flexDirection="column">
                    {/* Title row */}
                    <box
                      flexDirection="row"
                      paddingX={1}
                      backgroundColor={isSelected() ? theme.backgroundElement : undefined}
                    >
                      <text fg={theme.textMuted}>{connector()} </text>
                      <text fg={fg}>{icon} </text>
                      <text
                        fg={isSelected() ? theme.text : theme.textMuted}
                        attributes={isSelected() ? TextAttributes.BOLD : undefined}
                        wrapMode="none"
                      >
                        {truncatedTitle()}
                      </text>
                    </box>
                    {/* Created time row */}
                    <box flexDirection="row" paddingX={1}>
                      <text fg={theme.textMuted}>{continuation()}   </text>
                      <text fg={theme.textMuted}>
                        Created: {timeAgo(child.time.created)}
                      </text>
                    </box>
                  </box>
                )
              }}
            </For>
          </box>
        </Show>
      </box>

      {/* Footer */}
      <box flexDirection="row" gap={tone().space.md} marginTop={1}>
        <text fg={theme.textMuted}>↑↓ navigate</text>
        <text fg={theme.textMuted}>r refresh</text>
        <text fg={theme.textMuted}>Esc close</text>
      </box>
    </box>
  )
}
