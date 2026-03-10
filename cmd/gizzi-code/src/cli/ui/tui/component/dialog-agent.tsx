import { createMemo } from "solid-js"
import { useLocal } from "@/cli/ui/tui/context/local"
import { DialogSelect } from "@/cli/ui/tui/ui/dialog-select"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { GIZZICopy, sanitizeBrandSurface } from "@/shared/brand"

export function DialogAgent() {
  const local = useLocal()
  const dialog = useDialog()

  const options = createMemo(() =>
    local.agent.list().map((item) => {
      return {
        value: item.name,
        title: item.name,
        description: item.native ? GIZZICopy.dialogs.agentNative : sanitizeBrandSurface(item.description ?? ""),
      }
    }),
  )

  return (
    <DialogSelect
      title={GIZZICopy.dialogs.selectAgentTitle}
      current={local.agent.current().name}
      options={options()}
      onSelect={(option) => {
        local.agent.set(option.value)
        dialog.clear()
      }}
    />
  )
}
