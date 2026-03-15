import { createMemo, For, Show, createSignal, onMount } from "solid-js"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useKeyboard } from "@opentui/solid"
import { useSync } from "@/cli/ui/tui/context/sync"

const MEMORY_FILES = [
  { key: "L1-COGNITIVE/BRAIN.md", label: "BRAIN.md", layer: "L1", description: "Task graph & agent state" },
  { key: "L1-COGNITIVE/memory/MEMORY.md", label: "MEMORY.md", layer: "L1", description: "Session memory index" },
  { key: "L2-IDENTITY/IDENTITY.md", label: "IDENTITY.md", layer: "L2", description: "Agent identity & role" },
  { key: "L2-IDENTITY/CONVENTIONS.md", label: "CONVENTIONS.md", layer: "L2", description: "Project conventions" },
]

export function DialogMemoryExplorer() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const sdk = useSDK()
  const sync = useSync()

  const [selectedIdx, setSelectedIdx] = createSignal(0)
  const [fileContent, setFileContent] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(false)

  const fetchContent = async (key: string) => {
    const cwd = (sync.data.config as any)?.path?.cwd ?? "."
    const filePath = `${cwd}/.gizzi/${key}`
    setLoading(true)
    setFileContent(null)
    try {
      const result = await sdk.client.file.read({ query: { path: filePath } } as any)
      setFileContent((result as any).data?.content ?? "(empty)")
    } catch {
      setFileContent("(file not found)")
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    fetchContent(MEMORY_FILES[0].key)
  })

  useKeyboard((evt) => {
    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      const next = Math.max(0, selectedIdx() - 1)
      setSelectedIdx(next)
      fetchContent(MEMORY_FILES[next].key)
    }
    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      const next = Math.min(MEMORY_FILES.length - 1, selectedIdx() + 1)
      setSelectedIdx(next)
      fetchContent(MEMORY_FILES[next].key)
    }
    if (evt.name === "return") {
      evt.preventDefault()
      fetchContent(MEMORY_FILES[selectedIdx()].key)
    }
    if (evt.name === "escape") {
      evt.preventDefault()
      dialog.clear()
    }
  })

  const previewLines = createMemo(() => {
    const content = fileContent()
    if (!content) return []
    return content.split("\n").slice(0, 30)
  })

  return (
    <box
      flexDirection="column"
      width={110}
      maxHeight={40}
      padding={1}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Header */}
      <box flexDirection="row" marginBottom={1}>
        <text bold fg={theme.text}>
          Memory Explorer — L1/L2 Cognitive Layers
        </text>
      </box>

      {/* Two-panel body */}
      <box flexDirection="row" flexGrow={1}>
        {/* Left: file list */}
        <box width={32} flexDirection="column">
          <For each={MEMORY_FILES}>
            {(file, i) => (
              <box
                flexDirection="row"
                paddingX={1}
                backgroundColor={selectedIdx() === i() ? theme.backgroundElement : undefined}
              >
                <text
                  fg={file.layer === "L1" ? theme.accent : theme.success}
                  bold
                >
                  {file.layer}{" "}
                </text>
                <text fg={selectedIdx() === i() ? theme.text : theme.textMuted}>
                  {file.label}
                </text>
              </box>
            )}
          </For>
          <box flexDirection="column" marginTop={1} paddingX={1}>
            <text fg={theme.textMuted} italic>
              {MEMORY_FILES[selectedIdx()]?.description ?? ""}
            </text>
          </box>
        </box>

        {/* Divider */}
        <box width={1} borderStyle="single" borderColor={theme.border} />

        {/* Right: content preview */}
        <box flexGrow={1} flexDirection="column" padding={1}>
          <Show when={loading()}>
            <text fg={theme.textMuted}>Loading...</text>
          </Show>
          <Show when={!loading()}>
            <For each={previewLines()}>
              {(line) => (
                <text fg={theme.text} wrapMode="none">
                  {line}
                </text>
              )}
            </For>
            <Show when={fileContent() !== null && (fileContent()?.split("\n").length ?? 0) > 30}>
              <text fg={theme.textMuted}>… (truncated to 30 lines)</text>
            </Show>
          </Show>
        </box>
      </box>

      {/* Footer */}
      <box flexDirection="row" gap={2} marginTop={1}>
        <text fg={theme.textMuted}>↑↓ select</text>
        <text fg={theme.textMuted}>Enter view</text>
        <text fg={theme.textMuted}>Esc close</text>
      </box>
    </box>
  )
}
