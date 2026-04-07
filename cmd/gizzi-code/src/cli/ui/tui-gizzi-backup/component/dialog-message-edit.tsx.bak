/**
 * Message Edit Dialog
 * 
 * Edit a previously sent message and resubmit it.
 */

import { createSignal, Show } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useToast } from "@/cli/ui/tui/ui/toast"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { Identifier } from "@/shared/id/id"

interface DialogMessageEditProps {
  sessionID: string
  messageID: string
  originalText: string
  onEdited?: () => void
}

export function DialogMessageEdit(props: DialogMessageEditProps) {
  const { theme } = useTheme()
  const dialog = useDialog()
  const toast = useToast()
  const sync = useSync()
  const sdk = useSDK()
  
  const [text, setText] = createSignal(props.originalText)
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  
  // Get message parts for any file attachments
  const parts = () => {
    const messageParts = sync.data.part?.[props.messageID] || []
    return messageParts.filter((p: any) => p.type === "file")
  }
  
  useKeyboard((evt) => {
    if (evt.name === "escape") {
      dialog.clear()
      return
    }
    
    if (evt.name === "return" && evt.ctrl && !isSubmitting()) {
      handleSubmit()
    }
  })
  
  const handleSubmit = async () => {
    const newText = text().trim()
    if (!newText) {
      toast.show({ message: "Message cannot be empty", variant: "warning" })
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // First revert to before this message
      await sdk.client.session.revert({
        path: { sessionID: props.sessionID },
        body: { messageID: props.messageID },
      })
      
      // Then submit the edited message as a prompt
      // Get the model and agent settings from the session
      const session = (sync.data.session as Record<string, any>)?.[props.sessionID]
      const model = session?.model || { providerID: "openai", modelID: "gpt-4o" }
      const agent = session?.agent || "default"
      const variant = session?.variant
      
      const parts: any[] = [
        {
          id: Identifier.ascending("part"),
          type: "text",
          text: newText,
        }
      ]
      
      // Include any file attachments from original message
      const fileParts = sync.data.part?.[props.messageID]?.filter((p: any) => p.type === "file") || []
      parts.push(...fileParts.map((p: any) => ({
        id: Identifier.ascending("part"),
        ...p,
      })))
      
      await sdk.client.session.prompt({
        path: { sessionID: props.sessionID },
        body: {
          providerID: model.providerID,
          modelID: model.modelID,
          messageID: Identifier.ascending("message"),
          agent,
          model,
          variant,
          parts,
        },
      } as any)
      
      toast.show({ 
        message: "Message edited and sent", 
        variant: "success",
        duration: 2000,
      })
      
      props.onEdited?.()
      dialog.clear()
    } catch (error: any) {
      toast.show({ 
        message: `Failed to edit message: ${error.message || error}`, 
        variant: "error" 
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <box flexDirection="column" minWidth={80} minHeight={20}>
      {/* Header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        padding={1}
        border={["bottom"]}
        borderColor={theme.border}
      >
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Edit Message
        </text>
        <text fg={theme.textMuted}>
          Ctrl+Enter to save
        </text>
      </box>
      
      {/* Original text hint */}
      <box padding={1}>
        <text fg={theme.textMuted} attributes={TextAttributes.ITALIC}>
          Editing will revert the conversation to before this message.
        </text>
      </box>
      
      {/* Text input area */}
      <box
        flexDirection="column"
        flexGrow={1}
        padding={1}
        borderStyle="single"
        borderColor={theme.border}
        backgroundColor={RGBA.fromInts(0, 0, 0, 30)}
      >
        <textarea
          initialValue={text()}
          onContentChange={(value) => setText(typeof value === 'string' ? value : (value as any).content)}
          placeholder="Edit your message..."
          flexGrow={1}
          textColor={theme.text}
          focusedTextColor={theme.text}
          backgroundColor={RGBA.fromInts(0, 0, 0, 0)}
        />
      </box>
      
      {/* File attachments indicator */}
      <Show when={parts().length > 0}>
        <box flexDirection="row" gap={1} padding={1}>
          <text fg={theme.textMuted}>
            Attachments: {parts().length} file(s) will be preserved
          </text>
        </box>
      </Show>
      
      {/* Actions */}
      <box
        flexDirection="row"
        justifyContent="flex-end"
        gap={1}
        padding={1}
        border={["top"]}
        borderColor={theme.border}
      >
        <box
          paddingLeft={2}
          paddingRight={2}
          borderStyle="single"
          borderColor={theme.border}
          onMouseUp={() => dialog.clear()}
        >
          <text fg={theme.textMuted}>Cancel (Esc)</text>
        </box>
        
        <box
          paddingLeft={2}
          paddingRight={2}
          borderStyle="single"
          borderColor={isSubmitting() ? theme.border : theme.success}
          backgroundColor={isSubmitting() ? undefined : theme.success}
          onMouseUp={handleSubmit}
        >
          <text fg={isSubmitting() ? theme.textMuted : RGBA.fromInts(0, 0, 0)}>
            {isSubmitting() ? "Saving..." : "Save (Ctrl+Enter)"}
          </text>
        </box>
      </box>
    </box>
  )
}
