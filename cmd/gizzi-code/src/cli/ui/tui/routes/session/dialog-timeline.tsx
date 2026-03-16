import { createMemo, onMount } from "solid-js"
import { useSync } from "@/cli/ui/tui/context/sync"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import type { Message, Part } from "@a2r/sdk"
// Local TextPart type (SDK exports as unknown)
type TextPart = Part & {
  type: "text"
  text: string
  synthetic?: boolean
  ignored?: boolean
}
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
    const messages = (sync.data.message as Record<string, Message[]>)[props.sessionID] ?? []
    const result = [] as DialogSelectOption<string>[]
    for (const message of messages) {
      const msg = message as Message & { role?: string; id?: string; time?: { created: number } }
      if (msg.role !== "user") continue
      const part = ((sync.data.part as Record<string, Part[]>)[msg.id!] ?? []).find(
        (x) => {
          const p = x as Part & { type?: string; synthetic?: boolean; ignored?: boolean }
          return p.type === "text" && !p.synthetic && !p.ignored
        },
      ) as TextPart
      if (!part) continue
      result.push({
        title: part.text.replace(/\n/g, " "),
        value: msg.id!,
        footer: Locale.time(msg.time?.created ?? 0),
        onSelect: (dialog) => {
          dialog.replace(() => (
            <DialogMessage messageID={msg.id!} sessionID={props.sessionID} setPrompt={props.setPrompt} />
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
