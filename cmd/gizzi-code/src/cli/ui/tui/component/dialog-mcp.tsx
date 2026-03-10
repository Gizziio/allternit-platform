import { createMemo, createSignal } from "solid-js"
import { useLocal } from "@/cli/ui/tui/context/local"
import { useSync } from "@/cli/ui/tui/context/sync"
import { map, pipe, entries, sortBy } from "remeda"
import { DialogSelect, type DialogSelectRef, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { Keybind } from "@/shared/util/keybind"
import { TextAttributes } from "@opentui/core"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { GIZZICopy } from "@/shared/brand"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "tui.dialog-mcp" })

function Status(props: { enabled: boolean; loading: boolean }) {
  const { theme } = useTheme()
  if (props.loading) {
    return <span style={{ fg: theme.textMuted }}>⋯ {GIZZICopy.dialogs.loading}</span>
  }
  if (props.enabled) {
    return <span style={{ fg: theme.success, attributes: TextAttributes.BOLD }}>✓ {GIZZICopy.dialogs.enabled}</span>
  }
  return <span style={{ fg: theme.textMuted }}>○ {GIZZICopy.dialogs.disabled}</span>
}

export function DialogMcp() {
  const local = useLocal()
  const sync = useSync()
  const sdk = useSDK()
  const [, setRef] = createSignal<DialogSelectRef<unknown>>()
  const [loading, setLoading] = createSignal<string | null>(null)

  const options = createMemo(() => {
    // Track sync data and loading state to trigger re-render when they change
    const mcpData = sync.data.mcp
    const loadingMcp = loading()

    return pipe(
      mcpData ?? {},
      entries(),
      sortBy(([name]) => name),
      map(([name, status]) => ({
        value: name,
        title: name,
        description: status.status === "failed" ? GIZZICopy.dialogs.failed : status.status,
        footer: <Status enabled={local.mcp.isEnabled(name)} loading={loadingMcp === name} />,
        category: undefined,
      })),
    )
  })

  const keybinds = createMemo(() => [
    {
      keybind: Keybind.parse("space")[0],
      title: GIZZICopy.dialogs.toggle,
      onTrigger: async (option: DialogSelectOption<string>) => {
        // Prevent toggling while an operation is already in progress
        if (loading() !== null) return

        setLoading(option.value)
        try {
          await local.mcp.toggle(option.value)
          // Refresh MCP status from server
          const status = await sdk.client.mcp.status()
          if (status.data) {
            sync.set("mcp", status.data)
          } else {
            log.debug("Failed to refresh MCP status: no data returned")
          }
        } catch (error) {
          log.debug("Failed to toggle MCP", { error })
        } finally {
          setLoading(null)
        }
      },
    },
  ])

  return (
    <DialogSelect
      ref={setRef}
      title={GIZZICopy.dialogs.mcpsTitle}
      options={options()}
      keybind={keybinds()}
      onSelect={(option) => {
        // Don't close on select, only on escape
      }}
    />
  )
}
