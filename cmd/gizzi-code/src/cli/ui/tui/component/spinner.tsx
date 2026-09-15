import { Show } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useKV } from "@/cli/ui/tui/context/kv"
import type { JSX } from "@opentui/solid"
import type { RGBA } from "@opentui/core"
import "opentui-spinner/solid"

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function toText(value: unknown): string {
  if (value == null || typeof value === "boolean") return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return String(value)
  if (Array.isArray(value)) return value.map((item) => toText(item)).join("")
  if (typeof value === "function") {
    try {
      return toText(value())
    } catch {
      return ""
    }
  }
  return ""
}

export function Spinner(props: { children?: JSX.Element; color?: RGBA }) {
  const { theme } = useTheme()
  const kv = useKV()
  const color = () => props.color ?? theme.textMuted
  const label = () => toText(props.children)
  return (
    <Show when={kv.get("animations_enabled", true)} fallback={<text fg={color()}>⋯ {label()}</text>}>
      <box flexDirection="row" gap={1}>
        <spinner frames={frames} interval={80} color={color()} />
        <Show when={label()}>
          <text fg={color()}>{label()}</text>
        </Show>
      </box>
    </Show>
  )
}
