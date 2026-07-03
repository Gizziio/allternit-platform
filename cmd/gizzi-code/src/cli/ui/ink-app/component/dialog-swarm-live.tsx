// @ts-nocheck
import { createSignal, createMemo, onCleanup, onMount, For, Show } from "solid-js"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useSDK } from "@/cli/ui/ink-app/context/sdk"
import { useKeyboard } from "@opentui/solid"
import { useSync } from "@/cli/ui/ink-app/context/sync"

// ─── Spinner frames ─────────────────────────────────────────────────────────
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const

// ─── Agent status types ─────────────────────────────────────────────────────
type AgentStatus = "working" | "thinking" | "completed" | "error" | "idle"

interface AgentNode {
  id: string
  parentID?: string
  title: string
  status: AgentStatus
  activity?: string
  tokens?: { input: number; output: number }
  time: { created: number; updated: number }
  todoCompleted?: number
  todoTotal?: number
}

// ─── Pure logic functions (exported for testing) ─────────────────────────────

/**
 * Get the current spinner frame for a given tick index.
 */
export function getSpinnerFrame(tick: number): string {
  return SPINNER_FRAMES[tick % SPINNER_FRAMES.length]
}

/**
 * Format elapsed milliseconds into a human-readable duration string.
 * Examples: "0s", "12s", "1m 23s", "2h 5m"
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

/**
 * Map agent status to display icon.
 */
export function statusToIcon(status: AgentStatus): string {
  switch (status) {
    case "working":
    case "thinking":
      return "spinner" // placeholder — caller replaces with animated frame
    case "completed":
      return "✓"
    case "error":
      return "✗"
    case "idle":
      return "○"
    default:
      return "○"
  }
}

/**
 * Generate the tree connector prefix for a given node.
 * @param isLast Whether this is the last sibling
 * @param depth  Nesting depth (0 = root)
 */
export function treeConnector(isLast: boolean, depth: number): string {
  if (depth === 0) return isLast ? "└─ " : "├─ "
  const indent = "│  ".repeat(depth - 1) + (isLast ? "   " : "│  ")
  return indent + (isLast ? "└─ " : "├─ ")
}

/**
 * Generate continuation indent for sub-lines under a node.
 */
export function treeContinuation(isLast: boolean, depth: number): string {
  if (depth === 0) return isLast ? "   " : "│  "
  const indent = "│  ".repeat(depth - 1) + (isLast ? "   " : "│  ")
  return indent + (isLast ? "   " : "│  ")
}

/**
 * Format token counts as a compact badge.
 */
function formatTokenBadge(tokens: { input: number; output: number }): string {
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
  return `${fmt(tokens.input)}↓ ${fmt(tokens.output)}↑`
}

/**
 * Build a flat render list with depth info from a tree of agents.
 */
function flattenTree(
  agents: AgentNode[],
  parentID?: string,
  depth: number = 0,
): { agent: AgentNode; depth: number; isLast: boolean }[] {
  const children = agents.filter((a) => (a.parentID ?? undefined) === parentID)
  const result: { agent: AgentNode; depth: number; isLast: boolean }[] = []
  children.forEach((child, i) => {
    const isLast = i === children.length - 1
    result.push({ agent: child, depth, isLast })
    result.push(...flattenTree(agents, child.id, depth + 1))
  })
  return result
}

// ─── Map sync status to AgentStatus ──────────────────────────────────────────
function mapSyncStatus(syncType?: string): AgentStatus {
  if (syncType === "busy" || syncType === "thinking") return "working"
  if (syncType === "retry") return "thinking"
  if (syncType === "idle") return "completed"
  if (syncType === "error") return "error"
  return "idle"
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DialogSwarmLive(props: {
  sessionID: string
  tasks?: { id: string; title: string; status: string }[]
}) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const sdk = useSDK()
  const sync = useSync()

  // ── State ──────────────────────────────────────────────────────────────────
  const [agents, setAgents] = createSignal<AgentNode[]>([])
  const [loading, setLoading] = createSignal(true)
  const [selectedIdx, setSelectedIdx] = createSignal(0)
  const [spinnerTick, setSpinnerTick] = createSignal(0)
  const [now, setNow] = createSignal(Date.now())
  const [visibleIds, setVisibleIds] = createSignal<Set<string>>(new Set())
  const [fadingIds, setFadingIds] = createSignal<Set<string>>(new Set())

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchAgents = async () => {
    try {
      const result = await sdk.client.session.children({ path: { sessionID: props.sessionID } } as any)
      const fetched: AgentNode[] = ((result as any).data ?? []).map((s: any) => {
        const syncStatus = (sync.data.session_status?.[s.id] as any)?.type
        return {
          id: s.id,
          parentID: s.parentID,
          title: s.title ?? "Agent",
          status: mapSyncStatus(syncStatus),
          activity: (sync.data.session_status?.[s.id] as any)?.activity,
          tokens: (sync.data.session_status?.[s.id] as any)?.tokens,
          time: s.time ?? { created: Date.now(), updated: Date.now() },
          todoCompleted: (sync.data.session_status?.[s.id] as any)?.todoCompleted,
          todoTotal: (sync.data.session_status?.[s.id] as any)?.todoTotal,
        }
      })

      // Track new agents for fade-in
      const prev = visibleIds()
      const newFading = new Set<string>()
      for (const agent of fetched) {
        if (!prev.has(agent.id)) {
          newFading.add(agent.id)
        }
      }
      if (newFading.size > 0) {
        setFadingIds(newFading)
        setTimeout(() => setFadingIds(new Set()), 600)
      }

      setVisibleIds(new Set(fetched.map((a) => a.id)))
      setAgents(fetched)
      setSelectedIdx((prev) => Math.min(prev, Math.max(0, fetched.length - 1)))
    } catch {
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  // ── Intervals ──────────────────────────────────────────────────────────────
  onMount(() => {
    fetchAgents()
  })

  const spinnerInterval = setInterval(() => {
    setSpinnerTick((prev) => prev + 1)
    setNow(Date.now())
  }, 80)

  const refreshInterval = setInterval(() => {
    fetchAgents()
  }, 2000)

  onCleanup(() => {
    clearInterval(spinnerInterval)
    clearInterval(refreshInterval)
  })

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useKeyboard((evt) => {
    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      setSelectedIdx((prev) => Math.max(0, prev - 1))
      return
    }
    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      setSelectedIdx((prev) => Math.min(flatList().length - 1, prev + 1))
      return
    }
    if (evt.name === "r") {
      evt.preventDefault()
      fetchAgents()
      return
    }
    if (evt.name === "escape") {
      evt.preventDefault()
      dialog.clear()
      return
    }
  })

  // ── Derived ────────────────────────────────────────────────────────────────
  const flatList = createMemo(() => flattenTree(agents()))

  const statusColor = (status: AgentStatus): any => {
    switch (status) {
      case "working":
      case "thinking":
        return theme.warning
      case "completed":
        return theme.success
      case "error":
        return theme.error
      case "idle":
        return theme.textMuted
      default:
        return theme.textMuted
    }
  }

  const taskStats = createMemo(() => {
    if (!props.tasks || props.tasks.length === 0) return undefined
    const completed = props.tasks.filter((t) => t.status === "completed" || t.status === "done").length
    return { completed, total: props.tasks.length }
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <box
      flexDirection="column"
      width={90}
      maxHeight={40}
      padding={1}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <box flexDirection="row" marginBottom={1} justifyContent="space-between">
        <box flexDirection="row">
          <text bold fg={theme.accent}>
            ◈ Agent Swarm
          </text>
          <Show when={!loading()}>
            <text fg={theme.textMuted}>
              {" — "}
              {String(agents().length)} agent{agents().length !== 1 ? "s" : ""} active
            </text>
          </Show>
        </box>
        <Show when={taskStats()}>
          {(stats) => (
            <text fg={theme.accent} bold>
              [{String(stats().completed)}/{String(stats().total)}]
            </text>
          )}
        </Show>
      </box>

      {/* ── Task list (if provided) ────────────────────────────────────── */}
      <Show when={props.tasks && props.tasks.length > 0}>
        <box flexDirection="column" marginBottom={1}>
          <For each={props.tasks}>
            {(task) => {
              const isDone = () => task.status === "completed" || task.status === "done"
              const isFailed = () => task.status === "error" || task.status === "failed"
              return (
                <box flexDirection="row" paddingX={1}>
                  <text fg={isDone() ? theme.success : isFailed() ? theme.error : theme.textMuted}>
                    {isDone() ? "✓" : isFailed() ? "✗" : "○"}{" "}
                  </text>
                  <text
                    fg={isDone() ? theme.textMuted : theme.text}
                    wrapMode="none"
                  >
                    {task.title}
                  </text>
                </box>
              )
            }}
          </For>
        </box>
      </Show>

      {/* ── Agent tree ─────────────────────────────────────────────────── */}
      <box flexDirection="column" flexGrow={1}>
        <Show when={loading()}>
          <text fg={theme.textMuted}>Loading swarm data...</text>
        </Show>

        <Show when={!loading() && agents().length === 0}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.textMuted}>No agents in the swarm yet.</text>
            <text fg={theme.textMuted}>
              Agents appear here when the model spawns sub-sessions.
            </text>
          </box>
        </Show>

        <Show when={!loading() && flatList().length > 0}>
          <box flexDirection="column">
            <For each={flatList()}>
              {(entry, i) => {
                const isSelected = () => i() === selectedIdx()
                const agent = entry.agent
                const color = () => statusColor(agent.status)
                const isFading = () => fadingIds().has(agent.id)
                const elapsed = () => formatElapsed(now() - agent.time.created)

                // Spinner or static icon
                const icon = () => {
                  if (agent.status === "working" || agent.status === "thinking") {
                    return getSpinnerFrame(spinnerTick())
                  }
                  return statusToIcon(agent.status)
                }

                const prefix = () => treeConnector(entry.isLast, entry.depth)
                const contPrefix = () => treeContinuation(entry.isLast, entry.depth)

                const truncatedTitle = () =>
                  agent.title.length > 45 ? agent.title.slice(0, 42) + "…" : agent.title

                return (
                  <box flexDirection="column">
                    {/* Primary row: connector + icon + title + elapsed + tokens */}
                    <box
                      flexDirection="row"
                      paddingX={1}
                      backgroundColor={isSelected() ? theme.backgroundElement : undefined}
                    >
                      <text fg={theme.textMuted}>{prefix()}</text>
                      <text fg={color()}>{icon()} </text>
                      <text
                        fg={isSelected() ? theme.text : isFading() ? theme.textMuted : theme.text}
                        bold={isSelected()}
                        wrapMode="none"
                      >
                        {truncatedTitle()}
                      </text>
                      <text fg={theme.textMuted}> </text>
                      <text fg={theme.textMuted}>{elapsed()}</text>
                      <Show when={agent.tokens}>
                        <text fg={theme.textMuted}>
                          {" "}⟨{formatTokenBadge(agent.tokens!)}⟩
                        </text>
                      </Show>
                      <Show when={agent.todoTotal != null && agent.todoTotal > 0}>
                        <text fg={theme.accent}>
                          {" "}[{String(agent.todoCompleted ?? 0)}/{String(agent.todoTotal)}]
                        </text>
                      </Show>
                    </box>

                    {/* Secondary row: activity description */}
                    <Show when={agent.activity && (agent.status === "working" || agent.status === "thinking")}>
                      <box flexDirection="row" paddingX={1}>
                        <text fg={theme.textMuted}>{contPrefix()}  </text>
                        <text fg={theme.textMuted} wrapMode="none">
                          {agent.activity!.length > 55
                            ? agent.activity!.slice(0, 52) + "…"
                            : agent.activity!}
                        </text>
                      </box>
                    </Show>
                  </box>
                )
              }}
            </For>
          </box>
        </Show>
      </box>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <box flexDirection="row" gap={tone().space.md} marginTop={1}>
        <text fg={theme.textMuted}>↑↓ navigate</text>
        <text fg={theme.textMuted}>r refresh</text>
        <text fg={theme.textMuted}>Esc close</text>
      </box>
    </box>
  )
}
