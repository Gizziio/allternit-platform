import { createMemo, For, Show, createSignal } from "solid-js"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useSync } from "@/cli/ui/ink-app/context/sync"
import { useKeyboard } from "@opentui/solid"

// Local type definitions (SDK types are now unknown)
interface FilePartSourceFile {
  type: "file"
  path: string
}

interface FilePartSourceSymbol {
  type: "symbol"
  path: string
}

interface FilePartSource {
  type: "file" | "symbol"
  path?: string
}

interface FilePart {
  type: "file"
  filename?: string
  mime?: string
  source?: FilePartSource
}

interface ToolPartState {
  status: string
  input?: {
    path?: string
  }
  output?: string
}

interface ToolPart {
  type: "tool"
  state: ToolPartState
  tool: string
}

type Part = FilePart | ToolPart | { type: string }

type FileAction = "read" | "edited" | "created" | "mentioned"

interface FileReference {
  path: string
  actions: Set<FileAction>
  mime?: string
  partCount: number
}

export function DialogFileRefs(props: { sessionID: string }) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const sync = useSync()
  const [filter, setFilter] = createSignal<"all" | FileAction>("all")

  const messages = createMemo(() => (sync.data.message[props.sessionID] ?? []) as Array<{ id: string }>)

  const fileRefs = createMemo(() => {
    const refs = new Map<string, FileReference>()

    messages().forEach((msg) => {
      const parts = (sync.data.part[msg.id] ?? []) as Part[]

      parts.forEach((part) => {
        // File parts (attachments)
        if (part.type === "file") {
          const filePart = part as FilePart
          let path = filePart.filename || "unknown"
          // Check if source exists and has path (for file or symbol types)
          if (filePart.source && (filePart.source.type === "file" || filePart.source.type === "symbol")) {
            path = filePart.source.path || path
          }
          const existing = refs.get(path)
          if (existing) {
            existing.actions.add("read")
            existing.partCount++
          } else {
            refs.set(path, {
              path,
              actions: new Set(["read"]),
              mime: filePart.mime,
              partCount: 1,
            })
          }
        }

        // Tool parts that reference files
        if (part.type === "tool" && (part as ToolPart).state?.status === "completed") {
          const toolPart = part as ToolPart
          const tool = toolPart.tool

          // Read tool
          if (tool === "read" && toolPart.state.input?.path) {
            const path = toolPart.state.input.path
            const existing = refs.get(path)
            if (existing) {
              existing.actions.add("read")
            } else {
              refs.set(path, {
                path,
                actions: new Set(["read"]),
                partCount: 1,
              })
            }
          }

          // Write/Edit tools
          if ((tool === "write_file" || tool === "edit_file") && toolPart.state.input?.path) {
            const path = toolPart.state.input.path
            const existing = refs.get(path)
            const action: FileAction = tool === "write_file" ? "created" : "edited"
            if (existing) {
              existing.actions.add(action)
            } else {
              refs.set(path, {
                path,
                actions: new Set([action]),
                partCount: 1,
              })
            }
          }

          // Glob/ls tools
          if ((tool === "glob" || tool === "ls") && toolPart.state.output) {
            // Try to extract file paths from output
            const output = toolPart.state.output
            const lines = output.split("\n")
            lines.forEach((line: string) => {
              // Simple heuristic: lines that look like file paths
              if (line.match(/\.(ts|js|json|md|py|go|rs|java|cpp|c|h|yaml|yml|toml)$/)) {
                const path = line.trim().split(" ").pop() || line.trim()
                if (path && !refs.has(path)) {
                  refs.set(path, {
                    path,
                    actions: new Set(["mentioned"]),
                    partCount: 1,
                  })
                }
              }
            })
          }
        }
      })
    })

    return Array.from(refs.values()).sort((a, b) => a.path.localeCompare(b.path))
  })

  const filteredRefs = createMemo(() => {
    if (filter() === "all") return fileRefs()
    return fileRefs().filter((ref) => ref.actions.has(filter() as FileAction))
  })

  const stats = createMemo(() => {
    const all = fileRefs()
    return {
      total: all.length,
      read: all.filter((r) => r.actions.has("read")).length,
      edited: all.filter((r) => r.actions.has("edited")).length,
      created: all.filter((r) => r.actions.has("created")).length,
      mentioned: all.filter((r) => r.actions.has("mentioned")).length,
    }
  })

  useKeyboard((evt) => {
    if (evt.name === "escape" || evt.name === "q") {
      dialog.clear()
      return
    }
    if (evt.name === "1" || evt.name === "a") {
      setFilter("all")
      return
    }
    if (evt.name === "2" || evt.name === "r") {
      setFilter("read")
      return
    }
    if (evt.name === "3" || evt.name === "e") {
      setFilter("edited")
      return
    }
    if (evt.name === "4" || evt.name === "c") {
      setFilter("created")
      return
    }
  })

  const getActionIcon = (actions: Set<FileAction>) => {
    if (actions.has("created")) return "✚"
    if (actions.has("edited")) return "✎"
    if (actions.has("read")) return "👁"
    return "•"
  }

  const getActionColor = (actions: Set<FileAction>) => {
    if (actions.has("created")) return theme.success
    if (actions.has("edited")) return theme.warning
    if (actions.has("read")) return theme.info
    return theme.textMuted
  }

  const FilterButton = (props: { label: string; value: "all" | FileAction; count: number }) => (
    <box
      flexDirection="row"
      gap={tone().space.xs}
      padding={tone().space.sm}
      backgroundColor={filter() === props.value ? theme.backgroundElement : undefined}
      onMouseUp={() => setFilter(props.value as "all" | FileAction)}
    >
      <text fg={filter() === props.value ? theme.accent : theme.textMuted}>
        {props.label}
      </text>
      <text fg={theme.textMuted}>({String(props.count ?? 0)})</text>
    </box>
  )

  return (
    <box
      flexDirection="column"
      width={70}
      maxHeight={45}
      padding={tone().space.md}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Header */}
      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.md}>
        <span style={{ fg: theme.accent, bold: true }}>📁 Files in Session</span>
        <text fg={theme.textMuted}>({String(stats().total ?? 0)} total)</text>
      </box>

      {/* Filters */}
      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.md}>
        <FilterButton label="All" value="all" count={stats().total} />
        <FilterButton label="Read" value="read" count={stats().read} />
        <FilterButton label="Edited" value="edited" count={stats().edited} />
        <FilterButton label="Created" value="created" count={stats().created} />
      </box>

      {/* File List */}
      <box flexDirection="column" flexGrow={1} gap={tone().space.xs}>
        <Show when={filteredRefs().length === 0}>
          <text fg={theme.textMuted}>No files found.</text>
        </Show>
        
        <For each={filteredRefs()}>
          {(ref) => (
            <box
              flexDirection="row"
              gap={tone().space.sm}
              padding={tone().space.sm}
              backgroundColor={theme.backgroundElement}
            >
              <text fg={getActionColor(ref.actions)} width={2}>
                {getActionIcon(ref.actions)}
              </text>
              <text fg={theme.text} flexGrow={1} wrapMode="word">
                {ref.path}
              </text>
              <text fg={theme.textMuted}>
                {Array.from(ref.actions).join(", ")}
              </text>
            </box>
          )}
        </For>
      </box>

      {/* Legend */}
      <box flexDirection="row" gap={tone().space.md} marginTop={tone().space.sm}>
        <text fg={theme.success}>✚ created</text>
        <text fg={theme.warning}>✎ edited</text>
        <text fg={theme.info}>👁 read</text>
        <text fg={theme.textMuted}>• mentioned</text>
      </box>

      {/* Footer */}
      <box flexDirection="row" gap={tone().space.md} marginTop={tone().space.sm}>
        <text fg={theme.textMuted}>Esc/q close</text>
        <text fg={theme.textMuted}>1-4 filter</text>
      </box>
    </box>
  )
}
