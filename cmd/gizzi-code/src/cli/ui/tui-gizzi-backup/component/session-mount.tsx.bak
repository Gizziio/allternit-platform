/**
 * SessionMount — live session status bar above the prompt.
 * Shows phase, runtime stats, rotating tips, and completion phrases.
 */

import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi/theme"
import { GIZZICopy } from "@/runtime/brand/brand"

// How long each tip stays visible (ms)
const TIP_INTERVAL_MS = 6000
// Phrase index is stable per page load so it rotates per session
let globalPhraseIndex = Math.floor(Math.random() * GIZZICopy.session.completionPhrases.length)

function fmtElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function fmtTokens(n: number): string {
  if (!n || n <= 0) return ""
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tokens`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k tokens`
  return `${n} tokens`
}

// Human-readable tool name mapping
function fmtToolName(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower === "bash" || lower === "execute_bash") return "Running bash"
  if (lower === "read" || lower === "read_file") return "Reading file"
  if (lower === "write" || lower === "write_file") return "Writing file"
  if (lower === "edit" || lower === "edit_file") return "Editing file"
  if (lower === "glob" || lower === "list_files") return "Finding files"
  if (lower === "grep" || lower === "search") return "Searching"
  if (lower === "webfetch" || lower === "web_fetch") return "Fetching URL"
  if (lower === "websearch" || lower === "web_search") return "Searching web"
  if (lower === "todowrite" || lower === "todo_write") return "Updating tasks"
  if (lower === "todoread" || lower === "todo_read") return "Reading tasks"
  if (lower === "mcp") return "Calling MCP"
  if (lower === "computer_use") return "Using computer"
  if (lower.includes("task")) return "Managing tasks"
  if (lower.includes("memory")) return "Accessing memory"
  // Capitalize first letter and replace underscores
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function SessionMount(props: {
  isHeightConstrained: boolean
  activeTools?: string[]
  sessionStatus?: "idle" | "thinking" | "executing" | "responding" | "compacting"
  // Session-level stats
  sessionElapsedSeconds?: number
  sessionTokens?: number
  thoughtSeconds?: number
  // Completion: when a run just finished, pass the run duration in ms
  lastRunMs?: number
  // Current todo list from the latest todowrite call
  todos?: Array<{ content: string; status: string }>
}) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()

  const isActive = createMemo(() => !!props.sessionStatus && props.sessionStatus !== "idle")
  const isCompacting = createMemo(() => props.sessionStatus === "compacting")

  const phaseColor = createMemo(() => {
    const s = props.sessionStatus
    if (!s || s === "idle") return tone().status.idle
    if (s === "thinking") return tone().status.planning
    if (s === "executing") return tone().status.executing
    if (s === "responding") return tone().status.responding
    if (s === "compacting") return tone().status.compacting
    return tone().status.connecting
  })

  const phaseGlyph = createMemo(() => {
    const s = props.sessionStatus
    if (!s || s === "idle") return "○"
    if (s === "thinking") return "◆"
    if (s === "executing") return "⧉"
    if (s === "responding") return "▶"
    if (s === "compacting") return "⟳"
    return "●"
  })

  const phaseLabel = createMemo(() => {
    const s = props.sessionStatus
    if (!s || s === "idle") return "Ready"
    if (s === "thinking") return "Thinking…"
    if (s === "executing") {
      const tools = props.activeTools ?? []
      if (tools.length === 0) return "Running tools"
      if (tools.length === 1) return fmtToolName(tools[0]!)
      return `${fmtToolName(tools[0]!)}  +${tools.length - 1}`
    }
    if (s === "responding") return "Responding…"
    if (s === "compacting") return "Compacting context…"
    return "Working…"
  })

  // Tip rotation
  const [tipIndex, setTipIndex] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => {
      setTipIndex((i) => (i + 1) % GIZZICopy.session.tips.length)
    }, TIP_INTERVAL_MS)
    onCleanup(() => clearInterval(timer))
  })
  const currentTip = createMemo(() => GIZZICopy.session.tips[tipIndex() % GIZZICopy.session.tips.length] ?? "")

  // Stats line: session elapsed | tokens | thought
  const statsLine = createMemo(() => {
    const parts: string[] = []
    const tokens = fmtTokens(props.sessionTokens ?? 0)
    if (tokens) parts.push(tokens)
    if (props.thoughtSeconds && props.thoughtSeconds > 0) parts.push(`thought ${fmtElapsed(props.thoughtSeconds)}`)
    return parts.join("  ·  ")
  })

  // Rotate phrase index when a run finishes (active → idle transition)
  createEffect(() => {
    if (!isActive() && (props.lastRunMs ?? 0) > 0) {
      globalPhraseIndex++
    }
  })

  // Completion phrase (shown briefly after a run finishes)
  const completionText = createMemo(() => {
    if (isActive()) return ""
    if (!props.lastRunMs || props.lastRunMs <= 0) return ""
    const phrase = GIZZICopy.session.completionPhrases[globalPhraseIndex % GIZZICopy.session.completionPhrases.length]
    const t = fmtElapsed(Math.round(props.lastRunMs / 1000))
    return phrase ? phrase(t) : ""
  })

  const showTip = createMemo(() => isActive() && !props.isHeightConstrained)
  const showCompletion = createMemo(() => !isActive() && !!completionText())
  const hasTodos = createMemo(() => (props.todos?.length ?? 0) > 0)

  return (
    <Show when={isActive() || showCompletion() || hasTodos()}>
      <box
        flexDirection="column"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        flexShrink={0}
        gap={0}
      >
        {/* Phase row — always shown when active */}
        <Show when={isActive()}>
          <box flexDirection="row" gap={1} flexShrink={0} alignItems="center">
            <text fg={phaseColor()}>
              <span style={{ bold: true }}>{phaseGlyph()}</span>
            </text>
            <text fg={phaseColor()}>
              <span style={{ bold: true }}>{phaseLabel()}</span>
            </text>
            {/* Elapsed time */}
            <Show when={(props.sessionElapsedSeconds ?? 0) > 0}>
              <text fg={theme.border}>·</text>
              <text fg={theme.textMuted}>{fmtElapsed(props.sessionElapsedSeconds ?? 0)}</text>
            </Show>
            {/* Token + thought stats */}
            <Show when={!!statsLine()}>
              <text fg={theme.border}>·</text>
              <text fg={theme.textMuted}>{statsLine()}</text>
            </Show>
            <Show when={isCompacting()}>
              <text fg={theme.textMuted}>· compressing history</text>
            </Show>
          </box>
        </Show>

        {/* Todo list — always visible when todos exist, like Gizzi */}
        <Show when={hasTodos()}>
          <box flexDirection="column" gap={0} paddingTop={isActive() ? 1 : 0} flexShrink={0}>
            <For each={props.todos ?? []}>
              {(todo) => {
                const done = () => todo.status === "completed"
                const active = () => todo.status === "in_progress"
                return (
                  <box flexDirection="row" gap={1}>
                    <text fg={done() ? tone().status.idle : active() ? theme.warning : theme.textMuted}>
                      {done() ? "✓" : active() ? "●" : "○"}
                    </text>
                    <text fg={done() ? theme.textMuted : active() ? theme.warning : theme.text}>
                      {todo.content}
                    </text>
                  </box>
                )
              }}
            </For>
          </box>
        </Show>

        {/* Tip row — rotates while working */}
        <Show when={showTip()}>
          <box flexDirection="row" gap={1} paddingLeft={2} flexShrink={0}>
            <text fg={theme.textMuted}>
              <span style={{ fg: phaseColor() }}>›</span>{"  "}{currentTip()}
            </text>
          </box>
        </Show>

        {/* Completion phrase — shown when idle after a run */}
        <Show when={showCompletion()}>
          <box flexDirection="row" gap={1} flexShrink={0}>
            <text fg={tone().status.idle}>
              <span style={{ bold: true }}>◇</span>
            </text>
            <text fg={theme.textMuted}>{completionText()}</text>
          </box>
        </Show>

        {/* Interrupt hint — shown while active, not height-constrained */}
        <Show when={isActive() && !props.isHeightConstrained}>
          <box flexDirection="row" gap={1} paddingLeft={2} flexShrink={0}>
            <text fg={theme.textMuted}>
              esc{"  "}<span style={{ fg: theme.error }}>stop</span>
            </text>
          </box>
        </Show>
      </box>
    </Show>
  )
}
