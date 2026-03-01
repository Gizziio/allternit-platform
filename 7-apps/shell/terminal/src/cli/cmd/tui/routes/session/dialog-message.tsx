import { createMemo } from "solid-js"
import { useSync } from "@tui/context/sync"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useSDK } from "@tui/context/sdk"
import { useRoute } from "@tui/context/route"
import { Clipboard } from "@tui/util/clipboard"
import type { PromptInfo } from "@tui/component/prompt/history"
import { A2RCopy } from "@/brand"

export function DialogMessage(props: {
  messageID: string
  sessionID: string
  setPrompt?: (prompt: PromptInfo) => void
}) {
  const sync = useSync()
  const sdk = useSDK()
  const message = createMemo(() => sync.data.message[props.sessionID]?.find((x) => x.id === props.messageID))
  const route = useRoute()

  return (
    <DialogSelect
      title={A2RCopy.dialogs.messageActionsTitle}
      options={[
        {
          title: A2RCopy.dialogs.revert,
          value: "session.revert",
          description: A2RCopy.dialogs.messageRevertDescription,
          onSelect: (dialog) => {
            const msg = message()
            if (!msg) return

            sdk.client.session.revert({
              sessionID: props.sessionID,
              messageID: msg.id,
            })

            if (props.setPrompt) {
              const parts = sync.data.part[msg.id]
              const promptInfo = parts.reduce(
                (agg, part) => {
                  if (part.type === "text") {
                    if (!part.synthetic) agg.input += part.text
                  }
                  if (part.type === "file") agg.parts.push(part)
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
          title: A2RCopy.dialogs.copy,
          value: "message.copy",
          description: A2RCopy.dialogs.messageCopyDescription,
          onSelect: async (dialog) => {
            const msg = message()
            if (!msg) return

            const parts = sync.data.part[msg.id]
            const text = parts.reduce((agg, part) => {
              if (part.type === "text" && !part.synthetic) {
                agg += part.text
              }
              return agg
            }, "")

            await Clipboard.copy(text)
            dialog.clear()
          },
        },
        {
          title: A2RCopy.dialogs.fork,
          value: "session.fork",
          description: A2RCopy.dialogs.messageForkDescription,
          onSelect: async (dialog) => {
            const result = await sdk.client.session.fork({
              sessionID: props.sessionID,
              messageID: props.messageID,
            })
            const initialPrompt = (() => {
              const msg = message()
              if (!msg) return undefined
              const parts = sync.data.part[msg.id]
              return parts.reduce(
                (agg, part) => {
                  if (part.type === "text") {
                    if (!part.synthetic) agg.input += part.text
                  }
                  if (part.type === "file") agg.parts.push(part)
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
