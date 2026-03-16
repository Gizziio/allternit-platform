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

type FilePart = Part & {
  type: "file"
}

import { Locale } from "@/shared/util/locale"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useRoute } from "@/cli/ui/tui/context/route"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import type { PromptInfo } from "@/cli/ui/tui/component/prompt/history"
import { GIZZICopy } from "@/shared/brand"

export function DialogForkFromTimeline(props: { sessionID: string; onMove: (messageID: string) => void }) {
  const sync = useSync()
  const dialog = useDialog()
  const sdk = useSDK()
  const route = useRoute()

  onMount(() => {
    dialog.setSize("large")
  })

  const options = createMemo((): DialogSelectOption<string>[] => {
    const messages = (sync.data.message as Record<string, (Message & { role?: string; id?: string; time?: { created: number } })[]>)[props.sessionID] ?? []
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
        onSelect: async (dialog) => {
          const forked = await sdk.client.session.fork({
            path: { id: props.sessionID },
            body: { messageID: msg.id! },
          })
          const parts = (sync.data.part as Record<string, Part[]>)[msg.id!] ?? []
          const initialPrompt = (parts as Part[]).reduce(
            (agg: { input: string; parts: PromptInfo["parts"] }, part: Part) => {
              const p = part as TextPart | FilePart
              if (p.type === "text") {
                if (!p.synthetic) agg.input += (p as TextPart).text
              }
              if (p.type === "file") agg.parts.push(p as FilePart)
              return agg
            },
            { input: "", parts: [] as PromptInfo["parts"] },
          )
          route.navigate({
            sessionID: forked.data!.id,
            type: "session",
            initialPrompt,
          })
          dialog.clear()
        },
      })
    }
    result.reverse()
    return result
  })

  return (
    <DialogSelect
      onMove={(option) => props.onMove(option.value)}
      title={GIZZICopy.dialogs.forkFromMessageTitle}
      options={options()}
    />
  )
}
