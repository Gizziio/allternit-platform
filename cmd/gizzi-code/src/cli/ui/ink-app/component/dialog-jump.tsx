import { createSignal, createMemo, For, Show } from "solid-js"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useKeyboard } from "@opentui/solid"
import type { TextareaRenderable } from "@opentui/core"

export function DialogJump(props: {
  totalMessages: number
  onJump: (index: number) => void
  currentIndex?: number
}) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const [input, setInput] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)
  
  let inputRef: TextareaRenderable

  const suggestions = createMemo(() => {
    const val = input().trim()
    if (!val) return []
    
    const num = parseInt(val)
 if (isNaN(num)) return []
    
    // Suggest nearby message numbers
    const suggestions: { label: string; index: number }[] = []
    
    if (num >= 1 && num <= props.totalMessages) {
      suggestions.push({ label: `Message ${num}`, index: num - 1 })
    }
    
    // Add relative suggestions
    if (props.currentIndex !== undefined) {
      const current = props.currentIndex + 1
      if (num !== current) {
        suggestions.push({ label: `Current (${current})`, index: props.currentIndex })
      }
      if (num !== 1) {
        suggestions.push({ label: `First message`, index: 0 })
      }
      if (num !== props.totalMessages) {
        suggestions.push({ label: `Last message (${props.totalMessages})`, index: props.totalMessages - 1 })
      }
    }
    
    return suggestions.slice(0, 5)
  })

  const handleJump = (index: number) => {
    if (index >= 0 && index < props.totalMessages) {
      props.onJump(index)
      dialog.clear()
    } else {
      setError(`Invalid message number (1-${props.totalMessages})`)
    }
  }

  const handleSubmit = () => {
    const val = input().trim()
    if (!val) {
      dialog.clear()
      return
    }
    
    const num = parseInt(val)
    if (isNaN(num)) {
      setError("Please enter a number")
      return
    }
    
    handleJump(num - 1) // Convert to 0-based index
  }

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      dialog.clear()
      return
    }
    
    if (evt.name === "return") {
      evt.preventDefault()
      handleSubmit()
      return
    }
    
    // Number input validation
    if (/^[0-9]$/.test(evt.name)) {
      // Allow numbers
      return
    }
    
    // Navigation in suggestions
    if (evt.name === "up" || evt.name === "down") {
      // Would need more complex state management for suggestion selection
      return
    }
  })

  return (
    <box
      flexDirection="column"
      width={50}
      padding={tone().space.md}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.md}>
        <span style={{ fg: theme.accent, bold: true }}>⏩ Jump to Message</span>
      </box>

      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.sm}>
        <text fg={theme.textMuted}>Message # (1-{String(props.totalMessages ?? 0)}):</text>
      </box>

      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.md}>
        <textarea
          ref={(el) => { inputRef = el }}
          initialValue={input()}
          onContentChange={() => {
            if (inputRef && !inputRef.isDestroyed) {
              setInput(inputRef.plainText)
              setError(null)
            }
          }}
          placeholder={`1-${props.totalMessages}`}
          minHeight={1}
          maxHeight={1}
          textColor={theme.text}
          focusedTextColor={theme.text}
          width={20}
        />
      </box>

      <Show when={error()}>
        <text fg={theme.error} marginBottom={tone().space.sm}>
          {error()}
        </text>
      </Show>

      <Show when={suggestions().length > 0}>
        <box flexDirection="column" gap={tone().space.xs} marginTop={tone().space.sm}>
          <text fg={theme.textMuted}>Suggestions:</text>
          <For each={suggestions()}>
            {(suggestion) => (
              <box
                flexDirection="row"
                gap={tone().space.sm}
                padding={tone().space.sm}
                backgroundColor={theme.backgroundElement}
                onMouseUp={() => handleJump(suggestion.index)}
              >
                <text fg={theme.accent}>{String(suggestion.index + 1)}</text>
                <text fg={theme.textMuted}>{suggestion.label}</text>
              </box>
            )}
          </For>
        </box>
      </Show>

      <box flexDirection="row" gap={tone().space.md} marginTop={tone().space.md}>
        <text fg={theme.textMuted}>Enter to jump</text>
        <text fg={theme.textMuted}>Esc to cancel</text>
      </box>
    </box>
  )
}
