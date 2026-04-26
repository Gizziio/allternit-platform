import { createMemo, For, Show, createSignal, onMount, type JSX } from "solid-js"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useSDK } from "@/cli/ui/ink-app/context/sdk"
import { useKeyboard } from "@opentui/solid"
import { DialogPrompt } from "@/cli/ui/ink-app/ui/dialog-prompt"
import type { MemoryType } from "@/runtime/memory/memory-service"
interface MemoryItem {
  filename: string
  name: string
  description: string
  type: MemoryType
  filepath: string
  body?: string
}

export function DialogMemoryExplorer() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const sdk = useSDK()

  const [items, setItems] = createSignal<MemoryItem[]>([])
  const [selectedIdx, setSelectedIdx] = createSignal(0)
  const [detail, setDetail] = createSignal<MemoryItem | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [filter, setFilter] = createSignal("")
  const [typeFilter, setTypeFilter] = createSignal<MemoryType | "">("")
  const [confirmDelete, setConfirmDelete] = createSignal<string | null>(null)
  const [statusMsg, setStatusMsg] = createSignal("")

  const apiBase = () => `${sdk.url}/v1/memory`

  const apiFetch = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
  }

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await apiFetch("/")
      setItems(data as MemoryItem[])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (filename: string) => {
    try {
      const data = await apiFetch(`/${encodeURIComponent(filename)}`)
      setDetail(data as MemoryItem)
    } catch {
      setDetail(null)
    }
  }

  onMount(loadItems)

  const filteredItems = createMemo(() => {
    const q = filter().toLowerCase()
    const t = typeFilter()
    return items().filter((item) => {
      if (t && item.type !== t) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.type.includes(q)
      )
    })
  })

  const selected = createMemo(() => filteredItems()[selectedIdx()] ?? null)

  const showStatus = (msg: string) => {
    setStatusMsg(msg)
    setTimeout(() => setStatusMsg(""), 2000)
  }

  const handleDelete = async (filename: string) => {
    if (confirmDelete() !== filename) {
      setConfirmDelete(filename)
      showStatus(`Press d again to delete "${filename}"`)
      return
    }
    setConfirmDelete(null)
    try {
      await apiFetch(`/${encodeURIComponent(filename)}`, { method: "DELETE" })
      showStatus(`Deleted: ${filename}`)
      await loadItems()
      const maxIdx = Math.max(0, filteredItems().length - 2)
      setSelectedIdx(Math.min(selectedIdx(), maxIdx))
      setDetail(null)
    } catch {
      showStatus("Delete failed")
    }
  }

  const handleNew = async () => {
    const name = await DialogPrompt.show(dialog, "Memory name (snake_case)", {
      placeholder: "user_role",
      description: () => (
        <text fg={theme.textMuted}>Short identifier, used as filename</text>
      ) as unknown as JSX.Element,
    })
    if (!name) { dialog.replace(() => <DialogMemoryExplorer />); return }

    const description = await DialogPrompt.show(dialog, "One-line description", {
      placeholder: "User is a senior Rust developer focused on blockchain",
      description: () => (
        <text fg={theme.textMuted}>Used to decide relevance in future sessions</text>
      ) as unknown as JSX.Element,
    })
    if (!description) { dialog.replace(() => <DialogMemoryExplorer />); return }

    const body = await DialogPrompt.show(dialog, "Memory body", {
      placeholder: "Content...",
      description: () => (
        <text fg={theme.textMuted}>For feedback/project types: fact first, then Why: and How to apply:</text>
      ) as unknown as JSX.Element,
    })
    if (!body) { dialog.replace(() => <DialogMemoryExplorer />); return }

    const filename = name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "")
    try {
      await apiFetch(`/${encodeURIComponent(filename)}`, {
        method: "PUT",
        body: JSON.stringify({ name, description, type: "project" as MemoryType, body }),
      })
      showStatus(`Saved: ${name}.md`)
      await loadItems()
    } catch {
      showStatus("Save failed")
    }
    dialog.replace(() => <DialogMemoryExplorer />)
  }

  const cycleTypeFilter = () => {
    const types: Array<MemoryType | ""> = ["", "user", "feedback", "project", "reference"]
    const current = typeFilter()
    const idx = types.indexOf(current)
    setTypeFilter(types[(idx + 1) % types.length])
    setSelectedIdx(0)
  }

  useKeyboard((evt) => {
    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      setConfirmDelete(null)
      const next = Math.max(0, selectedIdx() - 1)
      setSelectedIdx(next)
      const item = filteredItems()[next]
      if (item) loadDetail(item.filename)
    }
    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      setConfirmDelete(null)
      const next = Math.min(filteredItems().length - 1, selectedIdx() + 1)
      setSelectedIdx(next)
      const item = filteredItems()[next]
      if (item) loadDetail(item.filename)
    }
    if (evt.name === "return") {
      evt.preventDefault()
      const item = selected()
      if (item) loadDetail(item.filename)
    }
    if (evt.name === "d") {
      evt.preventDefault()
      const item = selected()
      if (item) handleDelete(item.filename)
    }
    if (evt.name === "n") {
      evt.preventDefault()
      handleNew()
    }
    if (evt.name === "t") {
      evt.preventDefault()
      cycleTypeFilter()
    }
    if (evt.name === "r") {
      evt.preventDefault()
      loadItems()
    }
    if (evt.name === "escape") {
      evt.preventDefault()
      dialog.clear()
    }
  })

  const detailLines = createMemo(() => {
    const d = detail()
    if (!d) return []
    return [
      `name: ${d.name}`,
      `type: ${d.type}`,
      `description: ${d.description}`,
      `file: ${d.filename}`,
      ``,
      ...(d.body ?? "").split("\n").slice(0, 25),
    ]
  })

  return (
    <box
      flexDirection="column"
      width={114}
      maxHeight={42}
      padding={1}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text}>Memory Explorer</text>
          <Show when={typeFilter()}>
            <text fg={theme.accent}>[{typeFilter()}]</text>
          </Show>
        </box>
        <text fg={theme.textMuted}>{items().length} memories</text>
      </box>

      {/* Status bar */}
      <Show when={statusMsg()}>
        <box marginBottom={1}>
          <text fg={theme.warning}>{statusMsg()}</text>
        </box>
      </Show>

      {/* Body */}
      <box flexDirection="row" flexGrow={1}>
        {/* Left: memory list */}
        <box width={36} flexDirection="column">
          <Show when={loading()}>
            <text fg={theme.textMuted}>Loading...</text>
          </Show>
          <Show when={!loading()}>
            <For each={filteredItems()}>
              {(item, i) => (
                <box
                  flexDirection="row"
                  paddingX={1}
                  gap={1}
                  backgroundColor={selectedIdx() === i() ? theme.backgroundElement : undefined}
                >
                  <text
                    fg={
                      item.type === "user" ? theme.info :
                      item.type === "feedback" ? theme.warning :
                      item.type === "project" ? theme.success :
                      theme.accent
                    }
                  >
                    {item.type.slice(0, 1).toUpperCase()}
                  </text>
                  <text
                    fg={selectedIdx() === i() ? theme.text : theme.textMuted}
                    wrapMode="none"
                  >
                    {item.name.length > 24 ? item.name.slice(0, 23) + "…" : item.name}
                  </text>
                  <Show when={confirmDelete() === item.filename}>
                    <text fg={theme.error}>✕</text>
                  </Show>
                </box>
              )}
            </For>
            <Show when={filteredItems().length === 0 && !loading()}>
              <text fg={theme.textMuted} paddingX={1}>
                {filter() || typeFilter() ? "No matches" : "No memories saved"}
              </text>
            </Show>
          </Show>
        </box>

        {/* Divider */}
        <box width={1} borderStyle="single" borderColor={theme.border} />

        {/* Right: detail view */}
        <box flexGrow={1} flexDirection="column" paddingX={1}>
          <Show when={detail()}>
            <For each={detailLines()}>
              {(line) => (
                <text fg={line.startsWith("name:") || line.startsWith("type:") || line.startsWith("description:") || line.startsWith("file:") ? theme.accent : theme.text} wrapMode="none">
                  {line}
                </text>
              )}
            </For>
          </Show>
          <Show when={!detail() && selected()}>
            <text fg={theme.textMuted}>Press Enter to load details</text>
          </Show>
          <Show when={!detail() && !selected()}>
            <text fg={theme.textMuted}>Select a memory to view</text>
          </Show>
        </box>
      </box>

      {/* Footer */}
      <box flexDirection="row" gap={2} marginTop={1} flexWrap="wrap">
        <text fg={theme.textMuted}>↑↓ navigate</text>
        <text fg={theme.textMuted}>Enter view</text>
        <text fg={theme.textMuted}>n new</text>
        <text fg={theme.textMuted}>d delete</text>
        <text fg={theme.textMuted}>t type filter</text>
        <text fg={theme.textMuted}>r refresh</text>
        <text fg={theme.textMuted}>Esc close</text>
      </box>
    </box>
  )
}
