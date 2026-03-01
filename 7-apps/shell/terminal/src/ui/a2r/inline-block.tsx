import type { RGBA } from "@opentui/core"
import type { JSX } from "@opentui/solid"
import { createMemo, Show } from "solid-js"
import { A2RSpinner } from "./spinner"
import { blockValue, inlineText } from "./inline-coerce"
import { useA2RTheme } from "./theme"

export type A2RInlineKind = "receipt" | "note" | "law" | "wih" | "dag" | "checkpoint"

const KINDS: Record<A2RInlineKind, { icon: string; label: string }> = {
  receipt: { icon: "■", label: "RECEIPT" },
  note: { icon: "◆", label: "NOTE" },
  law: { icon: "▲", label: "LAW" },
  wih: { icon: "▶", label: "WIH" },
  dag: { icon: "»", label: "DAG" },
  checkpoint: { icon: "❖", label: "CHECKPOINT" },
}

export function A2RInlineBlock(props: {
  mode?: "inline" | "block"
  kind?: A2RInlineKind
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
  const tone = useA2RTheme()
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
              <Show when={props.spinnerComponent} fallback={<A2RSpinner color={props.fg ?? tone().muted} />}>
                {props.spinnerComponent}
              </Show>
              <text fg={props.fg ?? tone().muted}>
                {meta().label.toLowerCase()} {safeLabel()}
              </text>
            </box>
          </Show>
          <Show when={block().text}>
            <text fg={props.fg ?? tone().fg}>{block().text}</text>
          </Show>
          <Show when={safeError()}>
            <text fg={tone().danger}>{safeError()}</text>
          </Show>
        </box>
      }
    >
      <box flexDirection="column">
        <text fg={props.fg ?? tone().fg} attributes={props.attributes}>
          <Show 
            when={props.pending && props.spinnerComponent}
            fallback={<span style={{ fg: props.iconColor ?? tone().accent }}>{marker()}</span>}
          >
            {props.spinnerComponent}
          </Show>{" "}
          <span style={{ fg: tone().muted }}>{meta().label}</span>{" "}
          <span style={{ fg: tone().muted }}>{tone().glyph.separator}</span> {resolvedInline()}
        </text>
        <Show when={safeError()}>
          <text fg={tone().danger}>{safeError()}</text>
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
