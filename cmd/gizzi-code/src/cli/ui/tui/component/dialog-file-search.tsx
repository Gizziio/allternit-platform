import { createMemo, For, Show, createSignal, createResource, createEffect } from "solid-js"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useKeyboard } from "@opentui/solid"
import { useSync } from "@/cli/ui/tui/context/sync"
import type { TextareaRenderable } from "@opentui/core"

interface FileMatch {
  path: { text: string }
  lines: { text: string }
  line_number: number
  absolute_offset: number
  submatches: Array<{ match: { text: string }; start: number; end: number }>
}

export function DialogFileSearch(props: { sessionID: string }) {
  let inputRef: TextareaRenderable | undefined

  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const sdk = useSDK()
  const sync = useSync()

  const [queryInput, setQueryInput] = createSignal("")
  const [debouncedQuery, setDebouncedQuery] = createSignal("")
  const [activeIndex, setActiveIndex] = createSignal(0)

  // Debounce query changes
  createEffect(() => {
    const value = queryInput()
    const timer = setTimeout(() => {
      setDebouncedQuery(value)
      setActiveIndex(0)
    }, 300)
    return () => clearTimeout(timer)
  })

  const cwd = createMemo(() => {
    const session = (sync.data.session as any)?.[props.sessionID]
    return session?.path?.cwd ?? (sync.data.config as any)?.path?.cwd ?? "."
  })

  const [results] = createResource(
    () => [debouncedQuery(), cwd()] as const,
    async ([pattern, directory]) => {
      if (!pattern.trim()) return []
      try {
        const result = await (sdk.client.file as any).search({
          query: { cwd: directory, pattern, limit: 50 },
        })
        if ((result as any).error) return []
        return ((result.data ?? []) as FileMatch[])
      } catch {
        return []
      }
    },
  )

  const handleQueryChange = () => {
    if (!inputRef || inputRef.isDestroyed) return
    const value = inputRef.plainText
    setQueryInput(value)
  }

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      dialog.clear()
      return
    }
    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
      return
    }
    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      const count = results()?.length ?? 0
      setActiveIndex((i) => Math.min(count - 1, i + 1))
      return
    }
    if (evt.name === "return") {
      evt.preventDefault()
      dialog.clear()
      return
    }
  })

  const resultCount = createMemo(() => results()?.length ?? 0)

  return (
    <box
      flexDirection="column"
      width={90}
      maxHeight={40}
      padding={tone().space.md}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Header hint */}
      <box flexDirection="row" marginBottom={tone().space.sm}>
        <text fg={theme.textMuted}>Search file contents (ripgrep)</text>
      </box>

      {/* Search input */}
      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.sm}>
        <text fg={theme.textMuted}>Pattern:</text>
        <box flexGrow={1}>
          <textarea
            ref={(el) => {
              inputRef = el
            }}
            initialValue={queryInput()}
            onContentChange={handleQueryChange}
            placeholder="Type to search file contents..."
            minHeight={1}
            maxHeight={1}
            textColor={theme.text}
            focusedTextColor={theme.text}
          />
        </box>
        <Show when={resultCount() > 0}>
          <text fg={theme.accent}>{resultCount()} results</text>
        </Show>
      </box>

      {/* Results */}
      <box flexDirection="column" flexGrow={1}>
        <Show
          when={queryInput().trim().length > 0}
          fallback={
            <text fg={theme.textMuted}>Type to search file contents...</text>
          }
        >
          <Show
            when={!results.loading && resultCount() > 0}
            fallback={
              <Show
                when={results.loading}
                fallback={<text fg={theme.textMuted}>No results found.</text>}
              >
                <text fg={theme.textMuted}>Searching...</text>
              </Show>
            }
          >
            <For each={results()}>
              {(result, index) => {
                const isActive = createMemo(() => index() === activeIndex())
                const filepath = createMemo(() => result.path.text)
                const lineText = createMemo(() => result.lines.text.trimEnd())
                const lineNum = createMemo(() => result.line_number)

                return (
                  <box
                    flexDirection="row"
                    gap={tone().space.sm}
                    padding={tone().space.sm}
                    backgroundColor={isActive() ? theme.backgroundElement : undefined}
                    onMouseUp={() => {
                      setActiveIndex(index())
                      dialog.clear()
                    }}
                  >
                    <text flexShrink={0} fg={isActive() ? theme.accent : theme.textMuted}>
                      {isActive() ? ">" : " "}
                    </text>
                    <box flexDirection="row" gap={tone().space.sm} flexGrow={1}>
                      <text fg={theme.accent}>{filepath()}</text>
                      <text fg={theme.textMuted}>:{lineNum()}</text>
                      <text fg={theme.text} flexGrow={1} wrapMode="word">
                        {lineText()}
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
        <text fg={theme.textMuted}>Enter select</text>
        <text fg={theme.textMuted}>Esc close</text>
      </box>
    </box>
  )
}
