/**
 * Plugin Marketplace Dialog
 *
 * Interactive TUI for discovering, installing, and removing gizzi-code plugins.
 *
 *   ENTER / i  — install selected plugin
 *   r          — remove selected (installed) plugin
 *   SPACE      — toggle install/remove
 *   Tab        — cycle category filter
 *   ESC        — close
 *
 * Data flows through the /plugin server route so install/remove are
 * persistent (written to gizzi.json) without needing a full restart.
 */

import { createMemo, createSignal, For, Show } from "solid-js"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { Keybind } from "@/runtime/util/keybind"
import { RGBA, TextAttributes } from "@opentui/core"
import { PluginRegistry, type PluginCategory, type RegistryEntry } from "@/runtime/integrations/plugin/registry"
import { Log } from "@/runtime/util/log"

const log = Log.create({ service: "tui.dialog-plugin-marketplace" })

interface PluginEntry extends RegistryEntry {
  installed: boolean
}

type LoadingState = { pkg: string; action: "install" | "remove" } | null

const CATEGORY_ORDER: (PluginCategory | "all")[] = [
  "all",
  "auth",
  "mcp",
  "provider",
  "tools",
  "search",
  "workflow",
  "theme",
  "community",
]

const CATEGORY_LABELS: Record<PluginCategory | "all", string> = {
  all: "All",
  auth: "Auth",
  mcp: "MCP Servers",
  provider: "Providers",
  tools: "Tools",
  search: "Search",
  workflow: "Workflow",
  theme: "Themes",
  community: "Community",
}

export function DialogPluginMarketplace() {
  const { theme } = useTheme()
  const sdk = useSDK()

  const [plugins, setPlugins] = createSignal<PluginEntry[]>([])
  const [loading, setLoading] = createSignal<LoadingState>(null)
  const [activeCategory, setActiveCategory] = createSignal<PluginCategory | "all">("all")
  const [fetchError, setFetchError] = createSignal<string | null>(null)

  // Load on mount
  const loadPlugins = async () => {
    try {
      const res = await fetch(`${sdk.url}/plugin`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as {
        installed: string[]
        registry: (RegistryEntry & { installed: boolean })[]
      }
      setPlugins(data.registry)
      setFetchError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.warn("failed to load plugin registry", { error: msg })
      setFetchError(msg)
      // Fallback: show curated list with no installed status
      setPlugins(PluginRegistry.curated().map((e) => ({ ...e, installed: false })))
    }
  }

  // Trigger initial load
  loadPlugins()

  const filtered = createMemo(() => {
    const cat = activeCategory()
    const all = plugins()
    return cat === "all" ? all : all.filter((p) => p.category === cat)
  })

  const options = createMemo<DialogSelectOption<PluginEntry>>(() => {
    const busy = loading()
    return filtered().map((p) => {
      const isLoading = busy?.pkg === p.name
      const statusText = isLoading
        ? busy?.action === "install" ? "installing…" : "removing…"
        : p.installed ? "installed" : ""

      const statusColor = p.installed
        ? RGBA.fromInts(100, 200, 120)
        : theme.textMuted

      return {
        value: p,
        title: p.label,
        description: p.description,
        category: CATEGORY_LABELS[p.category],
        footer: (
          <box flexDirection="row" gap={1}>
            <Show when={p.verified}>
              <text fg={RGBA.fromInts(100, 160, 255)} attributes={TextAttributes.BOLD}>✓ official</text>
            </Show>
            <Show when={statusText}>
              <text fg={statusColor} attributes={isLoading ? undefined : TextAttributes.BOLD}>
                {isLoading ? statusText : `● ${statusText}`}
              </text>
            </Show>
            <text fg={theme.textMuted}>{p.name}</text>
          </box>
        ),
        disabled: isLoading,
      }
    }) as any
  })

  // ── Install / Remove actions ──────────────────────────────────────────────

  const install = async (entry: PluginEntry) => {
    if (loading()) return
    setLoading({ pkg: entry.name, action: "install" })
    try {
      const res = await fetch(`${sdk.url}/plugin/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: entry.name }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      await loadPlugins()
    } catch (err) {
      log.error("install failed", { pkg: entry.name, error: err })
    } finally {
      setLoading(null)
    }
  }

  const remove = async (entry: PluginEntry) => {
    if (loading()) return
    setLoading({ pkg: entry.name, action: "remove" })
    try {
      const res = await fetch(`${sdk.url}/plugin/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: entry.name }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      await loadPlugins()
    } catch (err) {
      log.error("remove failed", { pkg: entry.name, error: err })
    } finally {
      setLoading(null)
    }
  }

  const togglePlugin = async (entry: PluginEntry) => {
    if (entry.installed) await remove(entry)
    else await install(entry)
  }

  // ── Keybinds ──────────────────────────────────────────────────────────────

  const keybinds = createMemo(() => [
    {
      keybind: Keybind.parse("i")[0],
      title: "Install",
      disabled: !!loading(),
      onTrigger: (opt: DialogSelectOption<PluginEntry>) => install(opt.value),
    },
    {
      keybind: Keybind.parse("r")[0],
      title: "Remove",
      disabled: !!loading(),
      onTrigger: (opt: DialogSelectOption<PluginEntry>) => remove(opt.value),
    },
    {
      keybind: Keybind.parse("space")[0],
      title: "Toggle",
      disabled: !!loading(),
      onTrigger: (opt: DialogSelectOption<PluginEntry>) => togglePlugin(opt.value),
    },
    {
      keybind: Keybind.parse("tab")[0],
      title: "Category",
      onTrigger: () => {
        const cats = CATEGORY_ORDER
        const idx = cats.indexOf(activeCategory())
        setActiveCategory(cats[(idx + 1) % cats.length])
      },
    },
  ])

  const title = createMemo(() => {
    const cat = activeCategory()
    const label = CATEGORY_LABELS[cat]
    const count = filtered().length
    const installedCount = filtered().filter((p) => p.installed).length
    return `Plugin Marketplace — ${label} (${count} plugins, ${installedCount} installed)`
  })

  return (
    <DialogSelect
      title={title()}
      placeholder="Search plugins…"
      options={options() as any}
      keybind={keybinds()}
      onSelect={() => {
        // Don't close on select — only on ESC
      }}
    />
  )
}
