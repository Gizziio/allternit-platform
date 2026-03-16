import { createMemo } from "solid-js"
import { useSync } from "@/cli/ui/tui/context/sync"
import { DialogSelect } from "@/cli/ui/tui/ui/dialog-select"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useRoute } from "@/cli/ui/tui/context/route"
import { Clipboard } from "@/cli/ui/tui/util/clipboard"
import type { PromptInfo } from "@/cli/ui/tui/component/prompt/history"
import type { Message, Part } from "@a2r/sdk"
import { GIZZICopy } from "@/shared/brand"

type TextPart = Part & {
  type: "text"
  text: string
  synthetic?: boolean
}

type FilePart = Part & {
  type: "file"
}

export function DialogMessage(props: {
  messageID: string
  sessionID: string
  setPrompt?: (prompt: PromptInfo) => void
}) {
  const sync = useSync()
  const sdk = useSDK()
  const message = createMemo(() => ((sync.data.message as Record<string, (Message & { id?: string })[]>)[props.sessionID] ?? []).find((x) => (x as { id?: string }).id === props.messageID))
  const route = useRoute()

  return (
    <DialogSelect
      title={GIZZICopy.dialogs.messageActionsTitle}
      options={[
        {
          title: GIZZICopy.dialogs.revert,
          value: "session.revert",
          description: GIZZICopy.dialogs.messageRevertDescription,
          onSelect: (dialog) => {
            const msg = message()
            if (!msg) return

            sdk.client.session.revert({
              path: { id: props.sessionID },
              body: { messageID: (msg as { id?: string }).id! },
            })

            if (props.setPrompt) {
              const parts = (sync.data.part as Record<string, Part[]>)[(msg as { id?: string }).id!]
              const promptInfo = (parts as Part[]).reduce(
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
              props.setPrompt(promptInfo)
            }

            dialog.clear()
          },
        },
        {
          title: GIZZICopy.dialogs.copy,
          value: "message.copy",
          description: GIZZICopy.dialogs.messageCopyDescription,
          onSelect: async (dialog) => {
            const msg = message()
            if (!msg) return

            const parts = (sync.data.part as Record<string, Part[]>)[(msg as { id?: string }).id!]
            const text = (parts as Part[]).reduce((agg: string, part: Part) => {
              const p = part as TextPart
              if (p.type === "text" && !p.synthetic) {
                agg += p.text
              }
              return agg
            }, "")

            await Clipboard.copy(text)
            dialog.clear()
          },
        },
        {
          title: GIZZICopy.dialogs.fork,
          value: "session.fork",
          description: GIZZICopy.dialogs.messageForkDescription,
          onSelect: async (dialog) => {
            const result = await sdk.client.session.fork({
              path: { id: props.sessionID },
              body: { messageID: props.messageID },
            })
            const initialPrompt = (() => {
              const msg = message()
              if (!msg) return undefined
              const parts = (sync.data.part as Record<string, Part[]>)[(msg as { id?: string }).id!]
              return (parts as Part[]).reduce(
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
            })()
            route.navigate({
              sessionID: result.data!.id,
              type: "session",
              initialPrompt,
            })
            dialog.clear()
          },
        },
      ]}
    />
  )
}
