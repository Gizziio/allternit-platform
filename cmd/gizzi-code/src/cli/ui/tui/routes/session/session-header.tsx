/**
 * SessionHeader - A2R matrix badge, Gizziio Code branding, and session telemetry
 */

import { createMemo, createSignal, onCleanup, Show } from "solid-js"
import { RGBA, TextAttributes } from "@opentui/core"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useRoute } from "@/cli/ui/tui/context/route"
import { useLocal } from "@/cli/ui/tui/context/local"
import { useTerminalDimensions } from "@opentui/solid"
import { Installation } from "@/shared/installation"
import type { Session } from "@a2r/sdk"

const SAND = RGBA.fromInts(212, 176, 140)
const CYAN = RGBA.fromInts(86, 182, 194)

// Compact 2-line matrix badge derived from GIZZIIO binary encoding
// Full: 01000111 01101001 01111010 01111010 01101001 01101111
const BADGE_L1 = "0100 0111"
const BADGE_L2 = "0110 1111"

// Extended Session type with known fields
type SessionExt = Session & {
  id: string
  title?: string
  time: { created: number }
}

export function SessionHeader() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const local = useLocal()
  const dimensions = useTerminalDimensions()

  // Reactive now — ticks every second so elapsed time stays live
  const [now, setNow] = createSignal(Date.now())
  const timer = setInterval(() => setNow(Date.now()), 1000)
  onCleanup(() => clearInterval(timer))

  const sessionInfo = createMemo(() => {
    if (route.data.type !== "session") return null
    const sessions = sync.data?.session as SessionExt[] | undefined
    const session = sessions?.find(s => s.id === (route.data as { sessionID: string }).sessionID)
    if (!session) return null

    const elapsed = (() => {
      const seconds = Math.floor((now() - session.time.created) / 1000)
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return `${minutes}m`
      const hours = Math.floor(minutes / 60)
      return `${hours}h ${minutes % 60}m`
    })()

    const title = session.title || session.id.slice(0, 8)
    const messages = (sync.data?.message as Record<string, unknown[]> | undefined)?.[(route.data as { sessionID: string }).sessionID] ?? []

    return {
      id: session.id.slice(0, 8),
      title,
      elapsed,
      msgCount: messages.length,
    }
  })

  const modelInfo = createMemo(() => {
    const parsed = local.model.parsed()
    const model = String(parsed.model || "")
    if (!model || model === "No provider selected") return null
    return model
  })

  const agentName = createMemo(() => {
    const name = local.agent.current()?.name
    if (!name || name === "default") return null
    return name
  })

  const version = createMemo(() => {
    try { return Installation.VERSION ?? "dev" } catch { return "dev" }
  })

  const separator = createMemo(() => "─".repeat(Math.max(0, dimensions().width)))

  return (
    <box flexDirection="column" width="100%" flexShrink={0}>
      {/* Main header row */}
      <box
        flexDirection="row"
        width="100%"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        flexShrink={0}
        alignItems="flex-start"
        gap={1}
      >
        {/* Matrix badge — 2-line compact binary derived from GIZZIIO encoding */}
        <box flexDirection="column" flexShrink={0}>
          <text fg={CYAN} attributes={TextAttributes.BOLD}>{BADGE_L1}</text>
          <text fg={SAND}>{BADGE_L2}</text>
        </box>

        <text fg={theme.border}>│</text>

        {/* Brand + version stacked */}
        <box flexDirection="column" flexShrink={0}>
          <text fg={SAND} attributes={TextAttributes.BOLD}>Gizziio Code</text>
          <text fg={theme.textMuted}>{version()}</text>
        </box>

        {/* Session telemetry — aligns to first row */}
        <Show when={sessionInfo()}>
          <text fg={theme.border}>│</text>
          <text fg={theme.text} truncate>
            {sessionInfo()!.title}
          </text>
          <text fg={theme.textMuted} flexShrink={0}>
            {"  "}{sessionInfo()!.id}
          </text>
          <text fg={theme.border}>│</text>
          <text fg={theme.textMuted} flexShrink={0}>
            {sessionInfo()!.elapsed}
          </text>
          <text fg={theme.border}>·</text>
          <text fg={theme.textMuted} flexShrink={0}>
            {String(sessionInfo()!.msgCount)} msgs
          </text>
          <Show when={agentName()}>
            <text fg={theme.border}>·</text>
            <text fg={CYAN} flexShrink={0}>{agentName()!}</text>
          </Show>
          <Show when={modelInfo()}>
            <text fg={theme.border}>·</text>
            <text fg={theme.textMuted} truncate>
              {modelInfo()!}
            </text>
          </Show>
        </Show>
      </box>

      {/* Full-width separator line */}
      <text fg={theme.border}>{separator()}</text>
    </box>
  )
}
