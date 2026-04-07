import { createMemo } from "solid-js"
import { useLocal } from "@/cli/ui/tui/context/local"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { GIZZICopy, sanitizeBrandSurface } from "@/runtime/brand/brand"

export function DialogAgent() {
  const local = useLocal()
  const dialog = useDialog()

  const options = createMemo<DialogSelectOption<string>[]>(() =>
    (local.agent.list() as any[]).map((item) => {
      return {
        value: item.name as string,
        title: item.name as string,
        description: item.native ? GIZZICopy.dialogs.agentNative : sanitizeBrandSurface((item.description as string) ?? ""),
      }
    }),
  )

  const currentAgent = createMemo(() => local.agent.current())

  return (
    <DialogSelect
      title={GIZZICopy.dialogs.selectAgentTitle}
      current={(currentAgent() as any)?.name}
      options={options()}
      onSelect={(option) => {
        local.agent.set(option.value)
        dialog.clear()
      }}
    />
  )
}
