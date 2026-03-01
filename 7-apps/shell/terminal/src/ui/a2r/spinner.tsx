import type { RGBA } from "@opentui/core"
import type { JSX } from "@opentui/solid"
import { Show, createMemo } from "solid-js"
import { useA2RTheme } from "./theme"
import { useAnimation, useAnimatedFrame } from "@/ui/animation"

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

export type A2RSpinnerVariant = "quadrant" | "braille" | "dots" | "monolith" | "schematic"

export function A2RSpinner(props: { 
  children?: JSX.Element
  color?: RGBA
  variant?: A2RSpinnerVariant
}) {
  const tone = useA2RTheme()
  const animation = useAnimation()
  const color = () => props.color ?? tone().muted
  const label = () => toText(props.children)
  
  const variant = () => props.variant ?? "monolith"
  const animId = createMemo(() => {
    const v = variant()
    if (v === "monolith") return "a2r.monolith"
    if (v === "schematic") return "a2r.schematic"
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
