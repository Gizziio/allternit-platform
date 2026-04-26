import { createMemo, For, Show } from "solid-js"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/ink-app/ui/dialog-select"
import { useSync } from "@/cli/ui/ink-app/context/sync"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useBookmarks } from "@/cli/ui/ink-app/hooks/useBookmarks"

interface UIMessage {
  id: string
  role: "user" | "assistant" | "system"
  text?: string
}
import { GIZZICopy } from "@/shared/brand"

export function DialogBookmarks(props: { sessionID: string }) {
  const dialog = useDialog()
  const sync = useSync()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const bookmarks = useBookmarks(props.sessionID)

  const messages = createMemo(() => (sync.data.message[props.sessionID] ?? []) as UIMessage[])

  const bookmarkedMessages = createMemo(() => {
    const msgList = messages()
    const bookmarkedIDs = bookmarks.getBookmarkedMessageIDs()
    return bookmarkedIDs
      .map((id) => msgList.find((m) => m.id === id))
      .filter((m): m is UIMessage => m !== undefined)
      .sort((a, b) => a.id.localeCompare(b.id))
  })

  const options = createMemo(() => {
    const msgs = bookmarkedMessages()
    return msgs.map((message) => {
      const isUser = message.role === "user"
      const preview = isUser
        ? getUserPreview(message)
        : getAssistantPreview(message, sync.data.part[message.id] ?? [])

      return {
        value: message.id,
        title: isUser ? "You" : "Assistant",
        description: preview,
        onSelect: () => {
          dialog.clear()
          // The parent component should handle scrolling to this message
          // We can emit an event or use a callback
        },
      }
    })
  })

  function getUserPreview(message: UIMessage): string {
    // Get first line of user message
    const text = (message as any).text ?? ""
    return text.split("\n")[0].slice(0, 60) || "(no text)"
  }

  function getAssistantPreview(message: UIMessage, parts: any[]): string {
    // Get first text part
    const textPart = parts.find((p) => p.type === "text" && p.text?.trim())
    if (textPart) {
      return textPart.text.split("\n")[0].slice(0, 60)
    }
    return "(assistant response)"
  }

  return (
    <Show
      when={bookmarks.count() > 0}
      fallback={
        <box padding={tone().space.lg}>
          <text fg={theme.textMuted}>No bookmarks yet.</text>
          <text fg={theme.textMuted}>
            Press <span style={{ fg: theme.text }}>m</span> to bookmark a message.
          </text>
        </box>
      }
    >
      <DialogSelect
        title="Bookmarked Messages"
        options={options()}
        onSelect={(option) => {
          // Navigate to message
          const msgElement = document.getElementById(`message-${option.value}`)
          if (msgElement) {
            msgElement.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          dialog.clear()
        }}
      />
    </Show>
  )
}
