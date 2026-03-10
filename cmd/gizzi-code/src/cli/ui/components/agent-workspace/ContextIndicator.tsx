import { createMemo, For } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"

interface ContextIndicatorProps {
  used: number
  max?: number
}

export function ContextIndicator(props: ContextIndicatorProps) {
  const { theme } = useTheme()
  const max = () => props.max ?? 128

  const ratio = createMemo(() => Math.min(props.used / max(), 1))
  const filledCount = createMemo(() => Math.ceil(ratio() * 10))

  const statusColor = createMemo(() => {
    const r = ratio()
    if (r < 0.5) return theme.success
    if (r < 0.75) return theme.warning
    if (r < 0.9) return theme.accent
    return theme.error
  })

  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <text fg={theme.textMuted} wrapMode="none">
        <span style={{ bold: true }}>CTX</span>
      </text>
      <box flexDirection="row" gap={0}>
        <For each={Array.from({ length: 10 }, (_, i) => i)}>
          {(i) => (
            <text fg={i < filledCount() ? statusColor() : theme.border} wrapMode="none">
              {i < filledCount() ? "█" : "░"}
            </text>
          )}
        </For>
      </box>
      <text fg={statusColor()} wrapMode="none">
        <span style={{ bold: true }}>{Math.round(ratio() * 100)}%</span>
      </text>
      <text fg={theme.textMuted} wrapMode="none">
        ({props.used}k/{max()}k)
      </text>
    </box>
  )
}
