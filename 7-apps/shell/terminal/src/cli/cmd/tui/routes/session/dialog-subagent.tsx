import { DialogSelect } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { A2RCopy } from "@/brand"

export function DialogSubagent(props: { sessionID: string }) {
  const route = useRoute()

  return (
    <DialogSelect
      title={A2RCopy.dialogs.subagentActionsTitle}
      options={[
        {
          title: A2RCopy.dialogs.open,
          value: "subagent.view",
          description: A2RCopy.dialogs.subagentOpenDescription,
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
