import { DialogSelect } from "@/cli/ui/tui/ui/dialog-select"
import { useRoute } from "@/cli/ui/tui/context/route"
import { GIZZICopy } from "@/runtime/brand/brand"

export function DialogSubagent(props: { sessionID: string }) {
  const route = useRoute()

  return (
    <DialogSelect
      title={GIZZICopy.dialogs.subagentActionsTitle}
      options={[
        {
          title: GIZZICopy.dialogs.open,
          value: "subagent.view",
          description: GIZZICopy.dialogs.subagentOpenDescription,
          onSelect: (dialog) => {
            route.navigate({
              type: "session",
              sessionID: props.sessionID,
            })
            dialog.clear()
          },
        },
      ]}
    />
  )
}
