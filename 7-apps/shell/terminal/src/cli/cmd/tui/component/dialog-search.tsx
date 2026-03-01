import { createMemo, For, Show, createSignal } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useTheme } from "@tui/context/theme"
import { useA2RTheme } from "@/ui/a2r"
import { useSync } from "@tui/context/sync"
import { useSearch } from "@tui/hooks/useSearch"
import { useKeyboard } from "@opentui/solid"
import type { TextareaRenderable } from "@opentui/core"

export function DialogSearch(props: { sessionID: string; onNavigate?: (messageID: string) => void }) {
  let inputRef: TextareaRenderable
  
  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useA2RTheme()
  const sync = useSync()
  const [queryInput, setQueryInput] = createSignal("")

  const messages = createMemo(() => sync.data.message[props.sessionID] ?? [])
  const getParts = (messageID: string) => sync.data.part[messageID] ?? []

  const search = useSearch(messages, getParts)

  // Sync query input with search
  const handleQueryChange = () => {
    if (!inputRef || inputRef.isDestroyed) return
    const value = inputRef.plainText
    setQueryInput(value)
    search.setQuery(value)
  }

  // Handle keyboard navigation
  useKeyboard((evt) => {
    if (evt.name === "escape") {
      dialog.clear()
      return
    }
    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      search.prevResult()
      return
    }
    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      search.nextResult()
      return
    }
    if (evt.name === "return") {
      evt.preventDefault()
      const result = search.currentResult()
      if (result) {
        props.onNavigate?.(result.messageID)
        dialog.clear()
      }
      return
    }
  })

  const resultCounter = createMemo(() => {
    if (!search.hasResults()) return ""
    return `${search.currentIndex() + 1}/${search.resultCount()}`
  })

  return (
    <box
      flexDirection="column"
      width={80}
      maxHeight={40}
      padding={tone().space.md}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Search input */}
      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.sm}>
        <text fg={theme.textMuted}>Search:</text>
        <box flexGrow={1}>
          <textarea
            ref={(el) => { inputRef = el }}
            initialValue={queryInput()}
            onContentChange={handleQueryChange}
            placeholder="Type to search messages..."
            minHeight={1}
            maxHeight={1}
            textColor={theme.text}
            focusedTextColor={theme.text}
          />
        </box>
        <Show when={search.hasResults()}>
          <text fg={theme.accent}>{resultCounter()}</text>
        </Show>
      </box>

      {/* Results */}
      <box flexDirection="column" flexGrow={1}>
        <Show
          when={queryInput().trim().length > 0}
          fallback={
            <text fg={theme.textMuted}>
              Type to search across all messages in this session.
            </text>
          }
        >
          <Show
            when={search.hasResults()}
            fallback={
              <text fg={theme.textMuted}>No results found.</text>
            }
          >
            <For each={search.results()}>
              {(result, index) => {
                const isActive = createMemo(() => index() === search.currentIndex())
                const message = createMemo(() =>
                  messages().find((m) => m.id === result.messageID)
                )
                const role = createMemo(() =>
                  message()?.role === "user" ? "You" : "Assistant"
                )

                return (
                  <box
                    flexDirection="row"
                    gap={tone().space.sm}
                    padding={tone().space.sm}
                    backgroundColor={isActive() ? theme.backgroundElement : undefined}
                    onMouseUp={() => {
                      search.goToResult(index())
                      props.onNavigate?.(result.messageID)
                      dialog.clear()
                    }}
                  >
                    <text flexShrink={0} fg={isActive() ? theme.accent : theme.textMuted}>
                      {isActive() ? ">" : " "}
                    </text>
                    <box flexDirection="column" flexGrow={1}>
                      <box flexDirection="row" gap={tone().space.sm}>
                        <text fg={role() === "You" ? theme.text : theme.accent}>
                          {role()}
                        </text>
                        <text fg={theme.textMuted}>#{result.messageIndex + 1}</text>
                      </box>
                      <text fg={theme.textMuted} wrapMode="word">
                        {result.preview}
                      </text>
                    </box>
                  </box>
                )
              }}
            </For>
          </Show>
        </Show>
      </box>

      {/* Footer */}
      <box flexDirection="row" gap={tone().space.md} marginTop={tone().space.sm}>
        <text fg={theme.textMuted}>↑↓ navigate</text>
        <text fg={theme.textMuted}>Enter jump</text>
        <text fg={theme.textMuted}>Esc close</text>
      </box>
    </box>
  )
}
