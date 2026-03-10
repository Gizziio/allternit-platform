import { DialogPrompt } from "@/cli/ui/tui/ui/dialog-prompt"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useSync } from "@/cli/ui/tui/context/sync"
import { createMemo } from "solid-js"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { GIZZICopy } from "@/shared/brand"

interface DialogSessionRenameProps {
  session: string
}

export function DialogSessionRename(props: DialogSessionRenameProps) {
  const dialog = useDialog()
  const sync = useSync()
  const sdk = useSDK()
  const session = createMemo(() => sync.session.get(props.session))

  return (
    <DialogPrompt
      title={GIZZICopy.dialogs.renameSessionTitle}
      value={session()?.title}
      onConfirm={(value) => {
        sdk.client.session.update({
          sessionID: props.session,
          title: value,
        })
        dialog.clear()
      }}
      onCancel={() => dialog.clear()}
    />
  )
}
