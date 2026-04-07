/**
 * Workspace Dialog
 *
 * Shows the active GizziClaw/.openclaw workspace identity and lets users:
 *  - View current agent name, emoji, vibe, workspace path
 *  - Initialize a new .gizzi/ workspace
 *  - Import from an existing .openclaw/ installation
 */

import { createMemo, createSignal, Show, For } from "solid-js"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useToast } from "@/cli/ui/tui/ui/toast"
import { RGBA, TextAttributes } from "@opentui/core"
import { useKeybind } from "@/cli/ui/tui/context/keybind"
import { Log } from "@/runtime/util/log"

const log = Log.create({ service: "dialog-workspace" })

type WorkspaceAction =
  | { type: "init"; format?: "layered" | "flat" }
  | { type: "import" }
  | { type: "close" }

export function DialogWorkspace() {
  const dialog = useDialog()
  const sync = useSync()
  const { theme } = useTheme()
  const sdk = useSDK()
  const toast = useToast()
  const keybind = useKeybind()

  const workspace = createMemo(() => sync.data.workspace)
  const [busy, setBusy] = createSignal(false)
  const [result, setResult] = createSignal<string>()

  const accentColor = RGBA.fromInts(212, 176, 140)
  const successColor = RGBA.fromInts(134, 239, 172)
  const errorColor = RGBA.fromInts(248, 113, 113)
  const mutedColor = () => theme.textMuted

  // Direct fetch to /v1/workspace/ — bypasses auto-generated SDK client
  // (workspace routes are not yet in the generated client)
  async function workspaceFetch(path: string, body?: object): Promise<any> {
    const baseUrl = (sdk as any).url ?? ""
    const resp = await fetch(`${baseUrl}/v1/workspace${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }))
      throw new Error(err?.error ?? `HTTP ${resp.status}`)
    }
    return resp.json()
  }

  async function runAction(action: WorkspaceAction) {
    if (busy()) return
    if (action.type === "close") {
      dialog.clear()
      return
    }

    setBusy(true)
    setResult(undefined)
    try {
      if (action.type === "init") {
        await workspaceFetch("/init", { format: action.format ?? "flat" })
        const label = action.format === "layered" ? "5-layer A2R workspace" : "flat workspace"
        setResult(`${label} initialized at ~/.gizzi/`)
        toast.show({ variant: "success", message: `GizziClaw ${label} initialized` })
      } else if (action.type === "import") {
        const data = await workspaceFetch("/import", {})
        const imported = Array.isArray(data?.imported) ? data.imported : []
        setResult(`Imported: ${imported.join(", ") || "nothing new"}`)
        toast.show({ variant: "success", message: `Imported ${imported.length} file(s) from OpenClaw` })
      }
      // Refresh workspace state via instance sync
      await sdk.client.instance.sync().catch(() => {})
    } catch (e: any) {
      const msg = e?.message ?? "Unknown error"
      setResult(`Error: ${msg}`)
      log.error("workspace action failed", { action: action.type, error: msg })
    } finally {
      setBusy(false)
    }
  }

  const menuItems = createMemo(() => {
    const items: Array<{ label: string; description: string; action: WorkspaceAction }> = []

    if (!workspace()) {
      items.push({
        label: "Initialize workspace (5-layer)",
        description: "Create ~/.gizzi/ with full A2R workspace: L1-COGNITIVE, L2-IDENTITY, L3-GOVERNANCE, L4-SKILLS",
        action: { type: "init", format: "layered" },
      })
      items.push({
        label: "Initialize workspace (flat)",
        description: "Create ~/.gizzi/ with SOUL.md, IDENTITY.md, USER.md, MEMORY.md — OpenClaw-compatible",
        action: { type: "init", format: "flat" },
      })
      items.push({
        label: "Import from OpenClaw",
        description: "Copy workspace files from ~/.openclaw/workspace/",
        action: { type: "import" },
      })
    } else {
      items.push({
        label: "Sync from OpenClaw",
        description: "Re-import changed files from ~/.openclaw/workspace/ (skips existing)",
        action: { type: "import" },
      })
    }

    items.push({ label: "Close", description: "Dismiss this dialog", action: { type: "close" } })
    return items
  })

  const [selected, setSelected] = createSignal(0)

  function handleKey(evt: any) {
    if (keybind.match("up", evt) || evt.key === "ArrowUp") {
      setSelected((i) => Math.max(0, i - 1))
      evt.preventDefault()
    } else if (keybind.match("down", evt) || evt.key === "ArrowDown") {
      setSelected((i) => Math.min(menuItems().length - 1, i + 1))
      evt.preventDefault()
    } else if (evt.key === "Enter" || evt.key === " ") {
      const item = menuItems()[selected()]
      if (item) runAction(item.action)
      evt.preventDefault()
    } else if (evt.key === "Escape") {
      dialog.clear()
      evt.preventDefault()
    }
  }

  return (
    <box
      flexDirection="column"
      width={60}
      maxWidth="90%"
      borderStyle="single"
      borderColor={accentColor}
      onKeyDown={handleKey}
    >
      {/* Header */}
      <box
        paddingX={2}
        paddingY={1}
        borderStyle="single"
        borderColor={RGBA.fromInts(212, 176, 140, 60)}
        flexDirection="row"
        gap={1}
      >
        <text fg={accentColor} attributes={TextAttributes.BOLD}>
          GizziClaw Workspace
        </text>
        <box flexGrow={1} />
        <Show when={workspace()}>
          <text fg={mutedColor()}>
            {workspace()!.type === "openclaw"
              ? "openclaw"
              : (workspace() as any).layered
                ? "gizzi · 5-layer"
                : "gizzi · flat"}
          </text>
        </Show>
      </box>

      {/* Current workspace identity */}
      <Show
        when={workspace()}
        fallback={
          <box paddingX={2} paddingTop={1}>
            <text fg={mutedColor()}>No workspace detected</text>
          </box>
        }
      >
        {(ws) => (
          <box flexDirection="column" paddingX={2} paddingTop={1} gap={0}>
            <box flexDirection="row" gap={1}>
              <Show when={ws().emoji}>
                <text fg={accentColor}>{ws().emoji}</text>
              </Show>
              <text fg={theme.text} attributes={TextAttributes.BOLD}>
                {ws().name ?? "Gizzi Agent"}
              </text>
            </box>
            <Show when={ws().vibe}>
              <text fg={mutedColor()}>{ws().vibe}</text>
            </Show>
            <box flexDirection="row" gap={1} paddingTop={1}>
              <Show when={ws().hasSoul}>
                <text fg={successColor}>soul</text>
              </Show>
              <Show when={ws().hasMemory}>
                <text fg={successColor}>memory</text>
              </Show>
              <Show when={(ws() as any).hasBrain}>
                <text fg={successColor}>brain</text>
              </Show>
              <box flexGrow={1} />
              <text fg={mutedColor()}>{ws().path}</text>
            </box>
          </box>
        )}
      </Show>

      {/* Divider */}
      <box height={0} borderStyle="single" borderColor={RGBA.fromInts(212, 176, 140, 40)} marginY={1} />

      {/* Actions menu */}
      <box flexDirection="column" paddingX={2} paddingBottom={1} gap={0}>
        <For each={menuItems()}>
          {(item, i) => (
            <box
              flexDirection="column"
              paddingY={0}
              paddingX={1}
              backgroundColor={selected() === i() ? RGBA.fromInts(212, 176, 140, 30) : "transparent"}
              onMouseUp={() => { setSelected(i()); runAction(item.action) }}
              onMouseMove={() => setSelected(i())}
            >
              <text
                fg={selected() === i() ? accentColor : theme.text}
                attributes={selected() === i() ? TextAttributes.BOLD : undefined}
              >
                {selected() === i() ? "› " : "  "}{item.label}
              </text>
              <text fg={mutedColor()} paddingLeft={2}>
                {item.description}
              </text>
            </box>
          )}
        </For>
      </box>

      {/* Status / result */}
      <Show when={result() || busy()}>
        <box paddingX={2} paddingBottom={1}>
          <text fg={busy() ? mutedColor() : result()?.startsWith("Error") ? errorColor : successColor}>
            {busy() ? "Working…" : result()}
          </text>
        </box>
      </Show>

      {/* Footer hint */}
      <box paddingX={2} paddingBottom={1}>
        <text fg={mutedColor()}>↑↓ select  enter confirm  esc close</text>
      </box>
    </box>
  )
}
