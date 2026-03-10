import { createSignal, createMemo, For, Show } from "solid-js"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useKeyboard } from "@opentui/solid"
import { Clipboard } from "@/cli/ui/tui/util/clipboard"
import { useToast } from "@/cli/ui/tui/ui/toast"
import type { Message } from "@a2r/sdk/v2"

export type ExportFormat = "markdown" | "json" | "text" | "html"

export function DialogExport(props: { sessionID: string }) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const sync = useSync()
  const toast = useToast()

  const [format, setFormat] = createSignal<ExportFormat>("markdown")
  const [includeSystem, setIncludeSystem] = createSignal(false)
  const [includeCode, setIncludeCode] = createSignal(true)
  const [range, setRange] = createSignal<"all" | "last10" | "last50" | "custom">("all")
  const [customStart, setCustomStart] = createSignal("")
  const [customEnd, setCustomEnd] = createSignal("")
  const [preview, setPreview] = createSignal(false)

  const messages = createMemo(() => sync.data.message[props.sessionID] ?? [])

  const filteredMessages = createMemo(() => {
    const msgs = messages()
    switch (range()) {
      case "last10":
        return msgs.slice(-10)
      case "last50":
        return msgs.slice(-50)
      case "custom": {
        const start = parseInt(customStart()) || 1
        const end = parseInt(customEnd()) || msgs.length
        return msgs.slice(start - 1, end)
      }
      default:
        return msgs
    }
  })

  const generateExport = (): string => {
    const msgs = filteredMessages()

    switch (format()) {
      case "markdown":
        return exportAsMarkdown(msgs, sync.data.part, includeSystem())
      case "json":
        return exportAsJSON(msgs, sync.data.part, includeSystem())
      case "text":
        return exportAsText(msgs, sync.data.part)
      case "html":
        return exportAsHTML(msgs, sync.data.part, includeSystem())
      default:
        return ""
    }
  }

  const handleExport = async () => {
    const content = generateExport()
    await Clipboard.copy(content)
    toast.show({ 
      message: `Exported ${filteredMessages().length} messages to clipboard!`, 
      variant: "success", 
      duration: 3000 
    })
    dialog.clear()
  }

  const handlePreview = () => {
    setPreview(!preview())
  }

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      dialog.clear()
      return
    }
    if (evt.name === "return" && !preview()) {
      handleExport()
      return
    }
  })

  const FormatButton = (props: { label: string; value: ExportFormat }) => (
    <box
      flexDirection="row"
      gap={tone().space.xs}
      padding={tone().space.sm}
      backgroundColor={format() === props.value ? theme.backgroundElement : undefined}
      onMouseUp={() => setFormat(props.value)}
    >
      <text fg={format() === props.value ? theme.accent : theme.textMuted}>
        {props.label}
      </text>
    </box>
  )

  const RangeButton = (props: { label: string; value: "all" | "last10" | "last50" | "custom" }) => (
    <box
      flexDirection="row"
      gap={tone().space.xs}
      padding={tone().space.sm}
      backgroundColor={range() === props.value ? theme.backgroundElement : undefined}
      onMouseUp={() => setRange(props.value)}
    >
      <text fg={range() === props.value ? theme.accent : theme.textMuted}>
        {props.label}
      </text>
    </box>
  )

  return (
    <box
      flexDirection="column"
      width={70}
      maxHeight={45}
      padding={tone().space.md}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Header */}
      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.md}>
        <span style={{ fg: theme.accent, bold: true }}>📤 Export Session</span>
      </box>

      <Show when={!preview()}>
        {/* Format Selection */}
        <box flexDirection="column" gap={tone().space.sm} marginBottom={tone().space.md}>
          <text fg={theme.textMuted}>Format:</text>
          <box flexDirection="row" gap={tone().space.sm}>
            <FormatButton label="Markdown" value="markdown" />
            <FormatButton label="JSON" value="json" />
            <FormatButton label="Text" value="text" />
            <FormatButton label="HTML" value="html" />
          </box>
        </box>

        {/* Range Selection */}
        <box flexDirection="column" gap={tone().space.sm} marginBottom={tone().space.md}>
          <text fg={theme.textMuted}>Range:</text>
          <box flexDirection="row" gap={tone().space.sm} flexWrap="wrap">
            <RangeButton label={`All (${messages().length})`} value="all" />
            <RangeButton label="Last 10" value="last10" />
            <RangeButton label="Last 50" value="last50" />
            <RangeButton label="Custom" value="custom" />
          </box>
        </box>

        {/* Options */}
        <box flexDirection="column" gap={tone().space.sm} marginBottom={tone().space.md}>
          <text fg={theme.textMuted}>Options:</text>
          <box flexDirection="row" gap={tone().space.md}>
            <box
              flexDirection="row"
              gap={tone().space.xs}
              onMouseUp={() => setIncludeSystem(!includeSystem())}
            >
              <text fg={includeSystem() ? theme.accent : theme.textMuted}>
                {includeSystem() ? "☑" : "☐"}
              </text>
              <text fg={theme.text}>Include system prompts</text>
            </box>
            <box
              flexDirection="row"
              gap={tone().space.xs}
              onMouseUp={() => setIncludeCode(!includeCode())}
            >
              <text fg={includeCode() ? theme.accent : theme.textMuted}>
                {includeCode() ? "☑" : "☐"}
              </text>
              <text fg={theme.text}>Include code blocks</text>
            </box>
          </box>
        </box>
      </Show>

      {/* Preview */}
      <Show when={preview()}>
        <box
          flexDirection="column"
          gap={tone().space.sm}
          padding={tone().space.sm}
          backgroundColor={theme.backgroundElement}
          flexGrow={1}
        >
          <text fg={theme.textMuted}>Preview:</text>
          <text fg={theme.text} wrapMode="word">
            {generateExport().slice(0, 500)}...
          </text>
        </box>
      </Show>

      {/* Summary */}
      <box flexDirection="row" gap={tone().space.sm} marginTop={tone().space.sm}>
        <text fg={theme.textMuted}>
          Will export {filteredMessages().length} messages
        </text>
      </box>

      {/* Actions */}
      <box flexDirection="row" gap={tone().space.md} marginTop={tone().space.md}>
        <box
          flexDirection="row"
          gap={tone().space.xs}
          padding={tone().space.sm}
          backgroundColor={theme.backgroundElement}
          onMouseUp={handlePreview}
        >
          <text fg={theme.accent}>{preview() ? "Hide" : "Preview"}</text>
        </box>
        <box flexGrow={1} />
        <box
          flexDirection="row"
          gap={tone().space.xs}
          padding={tone().space.sm}
          backgroundColor={theme.accent}
          onMouseUp={handleExport}
        >
          <text fg={theme.background}>Export to Clipboard</text>
        </box>
      </box>

      {/* Footer */}
      <box flexDirection="row" gap={tone().space.md} marginTop={tone().space.sm}>
        <text fg={theme.textMuted}>Esc to cancel</text>
        <text fg={theme.textMuted}>Enter to export</text>
      </box>
    </box>
  )
}

// Export format generators
function exportAsMarkdown(
  messages: Message[],
  parts: Record<string, any[]>,
  includeSystem: boolean
): string {
  let output = `# Session Export\n\n`
  output += `Exported: ${new Date().toISOString()}\n\n`
  output += `---\n\n`

  messages.forEach((msg) => {
    const role = msg.role === "user" ? "**You**" : "**Assistant**"
    output += `## ${role}\n\n`

    if (msg.role === "user") {
      const text = (msg as any).text || ""
      output += text + "\n\n"
    } else {
      const msgParts = parts[msg.id] || []
      msgParts.forEach((part: any) => {
        if (part.type === "text") {
          output += part.text + "\n\n"
        } else if (part.type === "tool" && part.state?.status === "completed") {
          output += `*Tool: ${part.tool}*\n`
          output += "```\n" + part.state.output.slice(0, 200) + "...\n```\n\n"
        }
      })
    }

    output += "---\n\n"
  })

  return output
}

function exportAsJSON(
  messages: Message[],
  parts: Record<string, any[]>,
  includeSystem: boolean
): string {
  const export_ = {
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((msg) => ({
      ...msg,
      parts: parts[msg.id] || [],
    })),
  }
  return JSON.stringify(export_, null, 2)
}

function exportAsText(messages: Message[], parts: Record<string, any[]>): string {
  let output = `Session Export\n`
  output += `==============\n\n`

  messages.forEach((msg) => {
    const role = msg.role === "user" ? "You" : "Assistant"
    output += `${role}:\n`
    output += `${"-".repeat(role.length + 1)}\n`

    if (msg.role === "user") {
      output += (msg as any).text || ""
    } else {
      const msgParts = parts[msg.id] || []
      msgParts.forEach((part: any) => {
        if (part.type === "text") {
          output += part.text
        }
      })
    }

    output += "\n\n"
  })

  return output
}

function exportAsHTML(
  messages: Message[],
  parts: Record<string, any[]>,
  includeSystem: boolean
): string {
  let output = `<!DOCTYPE html>\n<html>\n<head>\n<title>Session Export</title>\n</head>\n<body>\n`
  output += `<h1>Session Export</h1>\n`
  output += `<p>Exported: ${new Date().toISOString()}</p>\n<hr>\n`

  messages.forEach((msg) => {
    const role = msg.role === "user" ? "You" : "Assistant"
    output += `<h2>${role}</h2>\n`

    if (msg.role === "user") {
      output += `<p>${escapeHtml((msg as any).text || "")}</p>\n`
    } else {
      const msgParts = parts[msg.id] || []
      msgParts.forEach((part: any) => {
        if (part.type === "text") {
          output += `<p>${escapeHtml(part.text)}</p>\n`
        } else if (part.type === "code") {
          output += `<pre><code>${escapeHtml(part.text)}</code></pre>\n`
        }
      })
    }

    output += "<hr>\n"
  })

  output += "</body>\n</html>"
  return output
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
