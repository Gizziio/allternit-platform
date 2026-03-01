import { createMemo, For, Show } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useTheme } from "@tui/context/theme"
import { useA2RTheme } from "@/ui/a2r"
import { useSync } from "@tui/context/sync"
import { usePinned } from "@tui/hooks/usePinned"
import type { Message } from "@a2r/sdk/v2"
import { useKeyboard } from "@opentui/solid"

export function DialogPinned(props: { 
  sessionID: string
  onNavigate?: (messageID: string) => void
}) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useA2RTheme()
  const sync = useSync()
  const pinned = usePinned(props.sessionID)

  const messages = createMemo(() => sync.data.message[props.sessionID] ?? [])

  const pinnedMessages = createMemo(() => {
    const msgList = messages()
    return pinned.messages()
      .map((pin) => ({
        pin,
        message: msgList.find((m) => m.id === pin.messageID),
      }))
      .filter((item): item is { pin: typeof item.pin; message: Message } => 
        item.message !== undefined
      )
      .sort((a, b) => a.pin.pinnedAt - b.pin.pinnedAt)
  })

  useKeyboard((evt) => {
    if (evt.name === "escape" || evt.name === "q") {
      dialog.clear()
      return
    }
  })

  const getPreview = (message: Message): string => {
    if (message.role === "user") {
      const text = (message as any).text ?? ""
      return text.split("\n")[0].slice(0, 50) || "(no text)"
    }
    
    const parts = sync.data.part[message.id] ?? []
    const textPart = parts.find((p: any) => p.type === "text" && p.text?.trim())
    if (textPart) {
      return (textPart as any).text.split("\n")[0].slice(0, 50)
    }
    return "(assistant response)"
  }

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  return (
    <box
      flexDirection="column"
      width={70}
      maxHeight={40}
      padding={tone().space.md}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Header */}
      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.md}>
        <span style={{ fg: theme.accent, bold: true }}>📌 Pinned Messages</span>
        <Show when={pinned.count() > 0}>
          <text fg={theme.textMuted}>({pinned.count()})</text>
        </Show>
      </box>

      {/* Pinned List */}
      <box flexDirection="column" flexGrow={1} gap={tone().space.sm}>
        <Show when={pinnedMessages().length === 0}>
          <box flexDirection="column" gap={tone().space.sm} alignItems="center" padding={tone().space.lg}>
            <text fg={theme.textMuted}>No pinned messages yet.</text>
            <text fg={theme.textMuted}>
              Press <span style={{ fg: theme.accent }}>p</span> on any message to pin it.
            </text>
          </box>
        </Show>

        <For each={pinnedMessages()}>
          {({ pin, message }) => (
            <box
              flexDirection="column"
              gap={tone().space.xs}
              padding={tone().space.sm}
              backgroundColor={theme.backgroundElement}
            >
              <box flexDirection="row" gap={tone().space.sm} alignItems="center">
                <text fg={theme.accent}>📌</text>
                <text fg={message.role === "user" ? theme.text : theme.accent}>
                  <span style={{ bold: true }}>
                    {message.role === "user" ? "You" : "Assistant"}
                  </span>
                </text>
                <text fg={theme.textMuted}>{formatTime(pin.pinnedAt)}</text>
                <box flexGrow={1} />
                <text 
                  fg={theme.error}
                  onMouseUp={() => {
                    pinned.unpin(message.id)
                  }}
                >
                  ✕
                </text>
              </box>
              
              <text 
                fg={theme.text} 
                wrapMode="word"
                onMouseUp={() => {
                  props.onNavigate?.(message.id)
                  dialog.clear()
                }}
              >
                {getPreview(message)}
              </text>

              <Show when={pin.note}>
                <text fg={theme.textMuted}>
                  Note: {pin.note}
                </text>
              </Show>
            </box>
          )}
        </For>
      </box>

      {/* Footer */}
      <box flexDirection="row" gap={tone().space.md} marginTop={tone().space.sm}>
        <text fg={theme.textMuted}>Esc/q close</text>
        <text fg={theme.textMuted}>Click message to jump</text>
        <Show when={pinned.count() > 0}>
          <text fg={theme.textMuted}>✕ to unpin</text>
        </Show>
      </box>
    </box>
  )
}
