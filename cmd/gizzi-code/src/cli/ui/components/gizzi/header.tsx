import type { JSX } from "@opentui/solid"
import { Show, createMemo } from "solid-js"
import { useGIZZITheme } from "@/cli/ui/components/gizzi/theme"

export function GIZZIHeader(props: { title: string; right?: JSX.Element; maxTitleWidth?: number }) {
  const tone = useGIZZITheme()
  const safeTitle = createMemo(() => {
    const normalized = props.title.replace(/\s+/g, " ").trim()
    const max = Math.max(16, props.maxTitleWidth ?? 56)
    if (normalized.length <= max) return normalized
    if (max <= 1) return normalized.slice(0, max)
    return normalized.slice(0, max - 1) + "…"
  })
  return (
    <box flexDirection="row" justifyContent="space-between" gap={1} minWidth={0}>
      <text fg={tone().fg} wrapMode="none" flexShrink={1}>
        <span style={{ fg: tone().accent, bold: true }}>{tone().glyph.status}</span>{" "}
        <span style={{ bold: true }}>{safeTitle()}</span>
      </text>
      <Show when={props.right}>{props.right}</Show>
    </box>
  )
}
