/**
 * Background Tasks Dashboard
 * 
 * Shows all background operations: runs, cron jobs, PTY sessions
 * Uses GIZZI Motion Language for visual indication
 */

import { createMemo, For, Show, Switch, Match, onMount } from "solid-js"
import { useRoute } from "@/cli/ui/tui/context/route"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useOrbitalHarness, useRailsScan } from "@/cli/ui/components/animation"
import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import type { RunRegistry } from "@/runtime/session/run-registry"
import type { CronTypes } from "@/runtime/automation/cron/types"

export function BackgroundTasks() {
  const { navigate } = useRoute()
  const sync = useSync()
  const { theme } = useTheme()

  // Handle ESC key to navigate back to home
  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault()
      evt.stopPropagation()
      navigate({ type: "home" })
    }
  })

  // Get all background tasks
  const runs = createMemo(() => Object.values(sync.data.runs))
  const cronJobs = createMemo(() => unwrapArray(sync.data.cron_jobs))
  const cronRuns = createMemo(() => unwrapArray(sync.data.cron_runs))

  // Separate active vs completed
  const activeRuns = createMemo(() => 
    runs().filter((r: RunRegistry.RunInfo) => r.status === "pending" || r.status === "running")
  )
  const completedRuns = createMemo(() =>
    runs().filter((r: RunRegistry.RunInfo) => r.status === "completed" || r.status === "aborted" || r.status === "errored")
  )

  const activeCronRuns = createMemo(() =>
    cronRuns().filter((r: CronTypes.CronRun) => r.status === "running")
  )

  // Total active count
  const totalActive = createMemo(() =>
    activeRuns().length + activeCronRuns().length
  )

  return (
    <box flexDirection="column" padding={1} gap={1}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Background Tasks
        </text>
        <text fg={theme.textMuted} onMouseUp={() => navigate({ type: "home" })}>
          esc close
        </text>
      </box>

      {/* Summary */}
      <box flexDirection="row" gap={2}>
        <text fg={theme.text}>
          <span style={{ fg: theme.accent }}>●</span> {totalActive()} active
        </text>
        <text fg={theme.textMuted}>
          {runs().length} runs total
        </text>
        <text fg={theme.textMuted}>
          {cronJobs().length} cron jobs
        </text>
      </box>

      {/* Active Section */}
      <Show when={totalActive() > 0}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Active ({totalActive()})
          </text>
          
          <For each={activeRuns()}>
            {(run) => <RunItem run={run} />}
          </For>
          
          <For each={activeCronRuns()}>
            {(run) => <CronRunItem run={run} />}
          </For>
        </box>
      </Show>

      {/* Recent Completed */}
      <Show when={completedRuns().length > 0}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
            Recent ({completedRuns().length})
          </text>
          
          <For each={completedRuns().slice(-5)}>
            {(run) => <RunItem run={run} compact />}
          </For>
        </box>
      </Show>

      {/* Cron Jobs Status */}
      <Show when={cronJobs().length > 0}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
            Cron Jobs ({cronJobs().length})
          </text>
          
          <For each={cronJobs()}>
            {(job) => <CronJobItem job={job} />}
          </For>
        </box>
      </Show>
    </box>
  )
}

function RunItem(props: { 
  run: RunRegistry.RunInfo
  compact?: boolean 
}) {
  const { theme } = useTheme()

  const statusColor = createMemo(() => {
    switch (props.run.status) {
      case "running": return theme.accent
      case "pending": return theme.warning
      case "completed": return theme.success
      case "aborted": return theme.textMuted
      case "errored": return theme.error
      default: return theme.textMuted
    }
  })

  const animInputs = createMemo(() => {
    const phase = props.run.status === "running" ? "executing" : 
           props.run.status === "pending" ? "connecting" : "completed"
    const severity: "high" | "med" | "low" = props.run.status === "running" ? "high" : "low"
    return { phase, severity }
  })

  const harness = useOrbitalHarness(
    () => animInputs().phase,
    () => animInputs().severity
  )

  const duration = createMemo(() => {
    const end = props.run.finishedAt ?? Date.now()
    const ms = end - props.run.createdAt
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m`
  })

  return (
    <box flexDirection="row" gap={2} paddingLeft={1}>
      <text fg={statusColor()}>
        {props.run.status === "running" ? harness() : statusIcon(props.run.status)}
      </text>
      
      <box flexDirection="column" flexGrow={1}>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text}>
            {props.run.agent || "default"}
          </text>
          <text fg={theme.textMuted}>
            {props.run.runId.slice(0, 8)}
          </text>
        </box>
        
        <Show when={!props.compact && props.run.prompt}>
          <text fg={theme.textMuted} wrapMode="word">
            {props.run.prompt?.slice(0, 60)}
            {(props.run.prompt?.length || 0) > 60 ? "..." : ""}
          </text>
        </Show>
      </box>
      
      <text fg={theme.textMuted}>{duration()}</text>
    </box>
  )
}

function CronRunItem(props: { run: CronTypes.CronRun }) {
  const { theme } = useTheme()

  const rails = useRailsScan(() => [])

  const duration = createMemo(() => {
    const start = props.run.startedAt
    const end = props.run.finishedAt ?? Date.now()
    const ms = end - start
    return `${Math.round(ms / 1000)}s`
  })

  return (
    <box flexDirection="row" gap={2} paddingLeft={1}>
      <text fg={theme.accent}>{rails()}</text>
      
      <box flexDirection="column" flexGrow={1}>
        <text fg={theme.text}>cron:{props.run.jobId.slice(0, 8)}</text>
        <text fg={theme.textMuted}>{props.run.status}</text>
      </box>
      
      <text fg={theme.textMuted}>{duration()}</text>
    </box>
  )
}

function CronJobItem(props: { job: CronTypes.CronJob }) {
  const { theme } = useTheme()
  
  const isActive = createMemo(() => props.job.status === "active")

  return (
    <box flexDirection="row" gap={2} paddingLeft={1}>
      <text fg={isActive() ? theme.success : theme.textMuted}>
        {isActive() ? "●" : "⏸"}
      </text>
      
      <box flexDirection="column" flexGrow={1}>
        <text fg={theme.text}>{props.job.name}</text>
        <text fg={theme.textMuted}>{props.job.schedule}</text>
      </box>
      
      <text fg={theme.textMuted}>
        {props.job.runCount} runs
      </text>
    </box>
  )
}

function statusIcon(status: RunRegistry.RunStatus): string {
  switch (status) {
    case "completed": return "✓"
    case "aborted": return "◌"
    case "errored": return "✕"
    case "pending": return "○"
    default: return "·"
  }
}

function unwrapArray<T>(value: T[] | (() => T[])) {
  if (typeof value === "function") return value()
  return value
}
