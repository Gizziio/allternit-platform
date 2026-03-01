import type { Part, SessionStatus } from "@a2r/sdk/v2"
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { A2RSpinner } from "./spinner"
import { type A2RRuntimeState, useA2RTheme } from "./theme"
import { resolveFixtureState, resolveRuntimeState } from "./status-runtime"
import { A2RCopy } from "@/brand"
import { useAnimation, useStatusFrame } from "@/ui/animation"
import { formatRetryStatus } from "@/util/provider-error"

export function A2RStatusBar(props: {
  status: SessionStatus
  parts?: Part[]
  interrupt?: number
  queuedSince?: number
  startedAt?: number
  fixtureMode?: string
  fixtureDelayMs?: number
  runId?: string
  compact?: boolean
  width?: number
}) {
  const tone = useA2RTheme()
  const animation = useAnimation()
  const [now, setNow] = createSignal(Date.now())
  const width = createMemo(() => props.width ?? 120)
  const compact = createMemo(() => !!props.compact)
  const narrow = createMemo(() => compact() || width() < 112)
  const micro = createMemo(() => width() < 88)
  const queued = createMemo(() => !!props.queuedSince)
  const fixture = createMemo(() => {
    if ((props.parts ?? []).length > 0) return undefined
    if (props.status.type === "retry") return undefined
    return resolveFixtureState(props.fixtureMode, props.startedAt, now(), props.fixtureDelayMs)
  })
  const state = createMemo(() => fixture()?.state ?? resolveRuntimeState(props.status, props.parts ?? [], queued()))
  const retry = createMemo(() =>
    props.status.type === "retry"
      ? formatRetryStatus({
          message: props.status.message,
          attempt: props.status.attempt,
          next: props.status.next,
          now: now(),
        })
      : undefined,
  )
  const color = createMemo(() => tone().status[state()])
  const statusLabel = createMemo(() => {
    if (queued()) return A2RCopy.session.modeQueued
    if (retry()) return retry()!.label
    if (fixture()?.state) return label(fixture()!.state)
    return label(state())
  })
  const statusLimit = createMemo(() => {
    if (micro()) return 10
    if (narrow()) return 20
    return 28
  })
  const statusText = createMemo(() => truncateStatus(statusLabel(), statusLimit()))
  const live = createMemo(() => state() !== "idle" || queued())
  const tools = createMemo(() =>
    fixture()?.tools ??
      (props.parts ?? [])
        .filter((part): part is Extract<Part, { type: "tool" }> => part.type === "tool")
        .filter((part) => part.state.status === "pending" || part.state.status === "running")
        .map((part) => part.tool),
  )
  const overflow = createMemo(() => Math.max(0, tools().length - 3))
  const detail = createMemo(() => {
    if (fixture()?.hint) return fixture()!.hint
    if (queued()) {
      return A2RCopy.session.hintQueued
    }
    if (retry()) return retry()!.detail
    return hint(state())
  })
  const elapsed = createMemo(() => {
    const start = props.startedAt ?? props.queuedSince
    if (!start) return undefined
    return Math.max(0, Math.floor((now() - start) / 1000))
  })

  // Use new animation system for pulse frames
  const pulse = useStatusFrame(() => queued() ? "connecting" : state())

  const detailLine = createMemo(() => {
    if (!live()) return detail()
    if (queued() || retry() || compact() || narrow()) return detail()
    return `${detail()} ${tone().glyph.separator} ${pulse()}`
  })
  const detailLimit = createMemo(() => {
    if (micro()) return 0
    if (narrow()) return Math.max(22, width() - 62)
    return Math.max(28, width() - 76)
  })
  const detailText = createMemo(() => truncateStatus(detailLine(), detailLimit()))

  // Keep timer for elapsed time display only
  createEffect(() => {
    if (!live()) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    onCleanup(() => clearInterval(timer))
  })

  return (
    <box flexDirection="row" justifyContent="space-between" flexGrow={1} width="100%" gap={1}>
      <box flexDirection="row" gap={1} flexShrink={1}>
        <Show when={live() && !micro()}>
          <A2RSpinner color={color()} />
        </Show>
        <text fg={color()} wrapMode="none">
          <span style={{ bold: true }}>{tone().glyph.status}</span> {statusText()}
        </text>
        <Show when={props.runId && !narrow()}>
          <text fg={tone().accent} wrapMode="none">
            <span style={{ bold: true }}>*</span> run:{props.runId?.slice(0, 6)}
          </text>
        </Show>
        <Show when={!compact() && tools().length === 0 && detailText()}>
          <text fg={tone().muted} wrapMode="none">
            {detailText()}
          </text>
        </Show>
        <Show when={compact() && tools().length > 0}>
          <text fg={tone().muted} wrapMode="none">
            <span style={{ fg: tone().accent }}>{tone().glyph.tool}</span>{" "}
            {truncateStatus(tools().length > 1 ? `${tools()[0]} +${tools().length - 1}` : tools()[0], 18)}
          </text>
        </Show>
        <For each={compact() || micro() ? [] : tools().slice(0, 3)}>
          {(tool) => (
            <text fg={tone().fg} wrapMode="none">
              <span style={{ fg: tone().accent }}>{tone().glyph.tool}</span> <span style={{ fg: tone().muted }}>{tool}</span>
            </text>
          )}
        </For>
        <Show when={!compact() && !micro() && overflow() > 0}>
          <text fg={tone().muted} wrapMode="none">
            {A2RCopy.session.moreTools({ count: overflow() })}
          </text>
        </Show>
      </box>
      <box flexDirection="row" gap={1} flexShrink={0}>
        <Show when={elapsed() !== undefined && !micro()}>
          <text fg={tone().muted} wrapMode="none">
            {elapsed()}s
          </text>
        </Show>
        <Show when={props.status.type !== "idle" || props.runId}>
          <Show
            when={!compact()}
            fallback={
              <text fg={props.interrupt && props.interrupt > 0 ? color() : tone().fg} wrapMode="none">
                esc
              </text>
            }
          >
            <text fg={props.interrupt && props.interrupt > 0 ? color() : tone().fg} wrapMode="none">
              esc{" "}
              <span style={{ fg: props.interrupt && props.interrupt > 0 ? color() : tone().muted }}>
                {props.interrupt && props.interrupt > 0
                  ? A2RCopy.session.interruptAgainLabel
                  : props.runId
                    ? `${A2RCopy.session.interruptRunLabel} ${props.runId.slice(0, 6)}...`
                    : A2RCopy.session.interruptLabel}
              </span>
            </text>
          </Show>
        </Show>
      </box>
    </box>
  )
}

function label(state: A2RRuntimeState) {
  if (state === "idle") return A2RCopy.session.modeIdle
  if (state === "connecting") return A2RCopy.session.modeConnecting
  if (state === "hydrating") return A2RCopy.session.modeHydrating
  if (state === "planning") return A2RCopy.session.modeThinking
  if (state === "web") return A2RCopy.session.modeWeb
  if (state === "executing") return A2RCopy.session.modeTools
  if (state === "responding") return A2RCopy.session.modeResponding
  return A2RCopy.session.modeCompacting
}

function hint(state: A2RRuntimeState) {
  if (state === "idle") return ""
  if (state === "connecting") return A2RCopy.session.hintConnecting
  if (state === "hydrating") return A2RCopy.session.hintHydrating
  if (state === "planning") return A2RCopy.session.hintPlanning
  if (state === "web") return A2RCopy.session.hintWeb
  if (state === "executing") return A2RCopy.session.hintExecuting
  if (state === "responding") return A2RCopy.session.hintResponding
  return A2RCopy.session.hintCompacting
}

function truncateStatus(value: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  if (max <= 0) return ""
  if (normalized.length <= max) return normalized
  if (max === 1) return "…"
  return normalized.slice(0, max - 1) + "…"
}
