import type { RGBA } from "@opentui/core"
import type { JSX } from "@opentui/solid"
import { Show, createMemo } from "solid-js"
import { useGIZZITheme } from "@/cli/ui/components/gizzi/theme"
import { useAnimation, useAnimatedFrame } from "@/cli/ui/components/animation"

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

export type GIZZISpinnerVariant = "quadrant" | "braille" | "dots" | "monolith" | "schematic"

export function GIZZISpinner(props: { 
  children?: JSX.Element
  color?: RGBA
  variant?: GIZZISpinnerVariant
}) {
  const tone = useGIZZITheme()
  const animation = useAnimation()
  const color = () => props.color ?? tone().muted
  const label = () => toText(props.children)
  
  const variant = () => props.variant ?? "monolith"
  const animId = createMemo(() => {
    const v = variant()
    if (v === "monolith") return "gizzi.monolith"
    if (v === "schematic") return "gizzi.schematic"
    return v === "quadrant" ? "spinner.quadrant" 
      : v === "braille" ? "spinner.braille" 
      : "spinner.dots"
  })
  
  const frame = useAnimatedFrame(animId())

  return (
    <Show when={animation.enabled()} fallback={<text fg={color()}>... {label()}</text>}>
      <box flexDirection="row" gap={1}>
        <text fg={color()}>{frame()}</text>
        <Show when={label()}>
          <text fg={color()}>{label()}</text>
        </Show>
      </box>
    </Show>
  )
}
