import { createMemo, onMount } from "solid-js"
import { useSync } from "@/cli/ui/tui/context/sync"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import type { TextPart } from "@a2r/sdk/v2"
import { Locale } from "@/shared/util/locale"
import { DialogMessage } from "@/cli/ui/tui/routes/session/dialog-message"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import type { PromptInfo } from "@/cli/ui/tui/component/prompt/history"
import { GIZZICopy } from "@/shared/brand"

export function DialogTimeline(props: {
  sessionID: string
  onMove: (messageID: string) => void
  setPrompt?: (prompt: PromptInfo) => void
}) {
  const sync = useSync()
  const dialog = useDialog()

  onMount(() => {
    dialog.setSize("large")
  })

  const options = createMemo((): DialogSelectOption<string>[] => {
    const messages = sync.data.message[props.sessionID] ?? []
    const result = [] as DialogSelectOption<string>[]
    for (const message of messages) {
      if (message.role !== "user") continue
      const part = (sync.data.part[message.id] ?? []).find(
        (x) => x.type === "text" && !x.synthetic && !x.ignored,
      ) as TextPart
      if (!part) continue
      result.push({
        title: part.text.replace(/\n/g, " "),
        value: message.id,
        footer: Locale.time(message.time.created),
        onSelect: (dialog) => {
          dialog.replace(() => (
            <DialogMessage messageID={message.id} sessionID={props.sessionID} setPrompt={props.setPrompt} />
          ))
        },
      })
    }
    result.reverse()
    return result
  })

  return (
    <DialogSelect onMove={(option) => props.onMove(option.value)} title={GIZZICopy.dialogs.timelineTitle} options={options()} />
  )
}
