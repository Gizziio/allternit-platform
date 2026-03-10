import type { RGBA } from "@opentui/core"
import type { JSX } from "@opentui/solid"
import { createMemo, Show } from "solid-js"
import { GIZZISpinner } from "@/cli/ui/components/gizzi/spinner"
import { blockValue, inlineText } from "@/cli/ui/components/gizzi/inline-coerce"
import { useGIZZITheme } from "@/cli/ui/components/gizzi/theme"

export type GIZZIInlineKind = "receipt" | "note" | "law" | "wih" | "dag" | "checkpoint"

const KINDS: Record<GIZZIInlineKind, { icon: string; label: string }> = {
  receipt: { icon: "■", label: "RECEIPT" },
  note: { icon: "◆", label: "NOTE" },
  law: { icon: "▲", label: "LAW" },
  wih: { icon: "▶", label: "WIH" },
  dag: { icon: "»", label: "DAG" },
  checkpoint: { icon: "❖", label: "CHECKPOINT" },
}

export function GIZZIInlineBlock(props: {
  mode?: "inline" | "block"
  kind?: GIZZIInlineKind
  pending?: boolean
  pendingLabel?: string
  title?: string
  icon?: string
  iconColor?: RGBA
  fg?: RGBA
  attributes?: number
  spinner?: boolean
  spinnerComponent?: JSX.Element
  error?: string
  children?: JSX.Element
}) {
  const tone = useGIZZITheme()
  const mode = () => props.mode ?? "inline"
  const kind = () => props.kind ?? "receipt"
  const meta = () => KINDS[kind()]
  const marker = () => props.icon ?? meta().icon
  const label = () => props.title ?? ""
  const inlineContent = () => inlineText(props.children)
  const safeLabel = () => truncateInline(inlineText(label()), mode() === "block" ? 92 : 120)
  const safePendingLabel = () => inlineText(props.pendingLabel ?? "pending")
  const safeError = () => inlineText(props.error)
  const block = createMemo(() => blockValue(props.children))
  const resolvedInline = createMemo(() => (props.pending ? safePendingLabel() : inlineContent()))

  return (
    <Show
      when={mode() === "inline"}
      fallback={
        <box gap={1}>
          <Show
            when={props.spinner}
            fallback={
              <text paddingLeft={3} fg={props.fg ?? tone().muted}>
                <span style={{ fg: props.iconColor ?? tone().accent }}>{marker()}</span>{" "}
                <span style={{ fg: tone().muted }}>{meta().label}</span>{" "}
                <span style={{ fg: tone().muted }}>{tone().glyph.separator}</span> {safeLabel()}
              </text>
            }
          >
            <box paddingLeft={3} flexDirection="row" gap={1}>
              <Show when={props.spinnerComponent} fallback={<GIZZISpinner color={props.fg ?? tone().muted} />}>
                {props.spinnerComponent}
              </Show>
              <text fg={props.fg ?? tone().muted}>
                {meta().label.toLowerCase()} {safeLabel()}
              </text>
            </box>
          </Show>
          <Show when={block().text}>
            <text fg={props.fg ?? tone().fg}>{block().text as string}</text>
          </Show>
          <Show when={safeError()}>
            <text fg={tone().danger}>{safeError() as string}</text>
          </Show>
        </box>
      }
    >
      <box flexDirection="column">
        <text fg={props.fg ?? tone().fg} attributes={props.attributes}>
          <Show 
            when={props.pending && props.spinnerComponent}
            fallback={<span style={{ fg: props.iconColor ?? tone().accent }}>{marker()} </span>}
          >
            {props.spinnerComponent as any}
            {" "}
          </Show>
          <span style={{ fg: tone().muted }}>{meta().label} {tone().glyph.separator} </span>
          {resolvedInline() as string}
        </text>
        <Show when={safeError()}>
          <text fg={tone().danger}>{safeError() as string}</text>
        </Show>
      </box>
    </Show>
  )
}

function truncateInline(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  if (normalized.length <= max) return normalized
  if (max <= 1) return normalized.slice(0, max)
  return normalized.slice(0, max - 1) + "…"
}
