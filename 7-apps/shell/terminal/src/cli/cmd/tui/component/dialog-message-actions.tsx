import { Show, For, createMemo, Match, Switch } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import type { Message, AssistantMessage, UserMessage, Part } from "@a2r/sdk/v2"
import { useBookmarks } from "@tui/hooks/useBookmarks"
import { Clipboard } from "@tui/util/clipboard"
import { useToast } from "@tui/ui/toast"
import { getFirstCodeBlock, getAllCodeBlocks } from "@/util/code-blocks"
import { useA2RTheme } from "@/ui/a2r"
import type { RGBA } from "@opentui/core"

export type MessageAction = 
  | "copy"
  | "copy-code"
  | "edit"
  | "delete"
  | "bookmark"
  | "pin"
  | "reply"
  | "view-metadata"
  | "jump-to-related"

export function DialogMessageActions(props: {
  message: Message
  sessionID: string
  onAction?: (action: MessageAction) => void
}) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const sync = useSync()
  const bookmarks = useBookmarks(props.sessionID)
  const toast = useToast()

  const parts = createMemo(() => sync.data.part[props.message.id] ?? [])
  
  const codeBlocks = createMemo(() => {
    const textParts = parts().filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
    const allText = textParts.map(p => p.text).join("\n")
    return getAllCodeBlocks(allText)
  })
  
  const isBookmarked = createMemo(() => bookmarks.isBookmarked(props.message.id))

  const isUser = props.message.role === "user"
  const isAssistant = props.message.role === "assistant"

  const handleAction = async (action: MessageAction) => {
    switch (action) {
      case "copy": {
        const textParts = parts().filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
        const text = textParts.map(p => p.text).join("\n")
        await Clipboard.copy(text)
        toast.show({ message: "Message copied!", variant: "success", duration: 2000 })
        break
      }
      
      case "copy-code": {
        const textParts = parts().filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
        const allText = textParts.map(p => p.text).join("\n")
        const code = getFirstCodeBlock(allText)
        if (code) {
          await Clipboard.copy(code.code)
          toast.show({ message: "Code copied!", variant: "success", duration: 2000 })
        }
        break
      }
      
      case "bookmark": {
        bookmarks.toggle(props.message.id)
        const isNowBookmarked = bookmarks.isBookmarked(props.message.id)
        toast.show({ 
          message: isNowBookmarked ? "Message bookmarked" : "Bookmark removed", 
          variant: "info", 
          duration: 2000 
        })
        break
      }
      
      case "view-metadata": {
        if (isAssistant) {
          dialog.replace(() => <DialogMessageMetadata message={props.message as AssistantMessage} />)
        }
        return
      }
      
      case "view-metadata":
        // Already handled above, don't close dialog
        break
      case "delete":
      case "edit":
      case "pin":
      case "reply":
      case "jump-to-related":
        props.onAction?.(action)
        dialog.clear()
        break
    }
  }

  const options = [
    { 
      value: "copy" as MessageAction, 
      title: "Copy message", 
      description: "Copy full message text",
    },
    ...(codeBlocks().length > 0 ? [{
      value: "copy-code" as MessageAction,
      title: "Copy code block",
      description: `Copy first of ${codeBlocks().length} code block${codeBlocks().length > 1 ? "s" : ""}`,
    }] : []),
    { 
      value: "bookmark" as MessageAction, 
      title: isBookmarked() ? "Remove bookmark" : "Add bookmark", 
      description: isBookmarked() ? "Remove from bookmarks" : "Save for later reference",
    },
    ...(isUser ? [{
      value: "edit" as MessageAction,
      title: "Edit message",
      description: "Modify and resend",
    }] : []),
    {
      value: "reply" as MessageAction,
      title: "Reply to this",
      description: "Start a thread from this message",
    },
    ...(isAssistant ? [{
      value: "view-metadata" as MessageAction,
      title: "View metadata",
      description: "Tokens, cost, model info",
    }] : []),
    {
      value: "jump-to-related" as MessageAction,
      title: "Jump to related",
      description: "Parent or child messages",
    },
    {
      value: "delete" as MessageAction,
      title: "Delete message",
      description: "Remove from conversation",
    },
  ]

  return (
    <DialogSelect
      title={`Message Actions ${isUser ? "(You)" : "(Assistant)"}`}
      options={options.map(opt => ({
        ...opt,
        onSelect: () => handleAction(opt.value)
      }))}
      onSelect={(option) => handleAction(option.value as MessageAction)}
    />
  )
}

// Metadata dialog for assistant messages
function DialogMessageMetadata(props: { message: AssistantMessage }) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useA2RTheme()
  const sync = useSync()

  const assistant = props.message
  const model = sync.data.provider
    .find(p => p.id === assistant.providerID)
    ?.models[assistant.modelID]

  const totalTokens = () => 
    assistant.tokens.input + 
    assistant.tokens.output + 
    assistant.tokens.cache.read + 
    assistant.tokens.cache.write +
    assistant.tokens.reasoning

  return (
    <box
      flexDirection="column"
      width={50}
      padding={tone().space.md}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      <box flexDirection="row" marginBottom={tone().space.md}>
        <span style={{ fg: theme.accent, bold: true }}>📊 Message Metadata</span>
      </box>

      <box flexDirection="column" gap={tone().space.sm}>
        {/* Model Info */}
        <MetadataRow label="Model" value={`${assistant.providerID}/${assistant.modelID}`} />
        <MetadataRow label="Agent" value={assistant.agent} />
        
        {/* Tokens */}
        <box flexDirection="column" gap={tone().space.xs} marginTop={tone().space.sm}>
          <span style={{ fg: theme.textMuted, bold: true }}>Tokens</span>
          <MetadataRow label="Input" value={assistant.tokens.input.toLocaleString()} />
          <MetadataRow label="Output" value={assistant.tokens.output.toLocaleString()} />
          <Show when={assistant.tokens.reasoning > 0}>
            <MetadataRow label="Reasoning" value={assistant.tokens.reasoning.toLocaleString()} />
          </Show>
          <Show when={assistant.tokens.cache.read > 0}>
            <MetadataRow label="Cache Read" value={assistant.tokens.cache.read.toLocaleString()} />
          </Show>
          <Show when={assistant.tokens.cache.write > 0}>
            <MetadataRow label="Cache Write" value={assistant.tokens.cache.write.toLocaleString()} />
          </Show>
          <MetadataRow label="Total" value={totalTokens().toLocaleString()} color={theme.accent} />
        </box>

        {/* Cost */}
        <MetadataRow 
          label="Cost" 
          value={`$${assistant.cost.toFixed(4)}`} 
          color={theme.accent}
        />

        {/* Timing */}
        <box flexDirection="column" gap={tone().space.xs} marginTop={tone().space.sm}>
          <span style={{ fg: theme.textMuted, bold: true }}>Timing</span>
          <MetadataRow 
            label="Created" 
            value={new Date(assistant.time.created).toLocaleTimeString()} 
          />
          <Show when={assistant.time.completed}>
            <MetadataRow 
              label="Completed" 
              value={new Date(assistant.time.completed!).toLocaleTimeString()} 
            />
          </Show>
        </box>

        {/* Context */}
        <Show when={model?.limit.context}>
          <box flexDirection="column" gap={tone().space.xs} marginTop={tone().space.sm}>
            <span style={{ fg: theme.textMuted, bold: true }}>Context</span>
            <MetadataRow 
              label="Context Limit" 
              value={`${(model!.limit.context / 1000).toFixed(0)}K tokens`} 
            />
            <MetadataRow 
              label="Usage" 
              value={`${Math.round((totalTokens() / model!.limit.context) * 100)}%`}
              color={totalTokens() / model!.limit.context > 0.8 ? theme.warning : theme.success}
            />
          </box>
        </Show>
      </box>

      <box flexDirection="row" gap={tone().space.md} marginTop={tone().space.md}>
        <text fg={theme.textMuted}>Esc to close</text>
      </box>
    </box>
  )
}

function MetadataRow(props: { label: string; value: string; color?: RGBA }) {
  const { theme } = useTheme()
  const tone = useA2RTheme()
  
  return (
    <box flexDirection="row" gap={tone().space.md}>
      <text width={14} fg={theme.textMuted} wrapMode="none">{props.label}</text>
      <text fg={props.color || theme.text}>{props.value}</text>
    </box>
  )
}
