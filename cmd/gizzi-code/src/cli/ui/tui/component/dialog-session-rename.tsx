import { DialogPrompt } from "@/cli/ui/tui/ui/dialog-prompt"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useSync } from "@/cli/ui/tui/context/sync"
import { createMemo } from "solid-js"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { GIZZICopy } from "@/shared/brand"
import { Binary } from "@a2r/util/binary"

// Local types since SDK exports 'unknown'
interface Session {
  id: string
  title?: string
}

interface DialogSessionRenameProps {
  session: string
}

export function DialogSessionRename(props: DialogSessionRenameProps) {
  const dialog = useDialog()
  const sync = useSync()
  const sdk = useSDK()
  
  const session = createMemo(() => {
    const sessions = sync.data.session as Session[] | undefined
    if (!sessions) return undefined
    const match = Binary.search(sessions, props.session, (s) => s.id)
    return match.found ? sessions[match.index] : undefined
  })

  return (
    <DialogPrompt
      title={GIZZICopy.dialogs.renameSessionTitle}
      value={session()?.title}
      onConfirm={(value) => {
        sdk.client.session.update({
          path: { sessionID: props.session },
          body: { title: value },
        })
        dialog.clear()
      }}
      onCancel={() => dialog.clear()}
    />
  )
}
