import { createMemo, createSignal, For, Show } from "solid-js"
import { useRoute, useRouteData } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { useKeyboard } from "@opentui/solid"
import { A2RCopy, sanitizeBrandSurface } from "@/brand"
import type { Agent } from "@a2r/sdk/v2"
import type { CronTypes } from "@/automation/cron/types"
import type { RunRegistry } from "@/runtime/run-registry"

export function AgentMode() {
  const route = useRoute()
  const routeData = useRouteData("agent-mode")
  const sync = useSync()
  const { theme } = useTheme()

  const [activeTab, setActiveTab] = createSignal(routeData?.tab ?? "agents")

  // Handle ESC key to navigate back to home
  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault()
      evt.stopPropagation()
      route.navigate({ type: "home" })
    }
  })

  const agents = createMemo(() => sync.data.agent)
  const cronJobs = createMemo(() => sync.data.cron_jobs)
  const cronRuns = createMemo(() => sync.data.cron_runs)
  const runs = createMemo(() => Object.values(sync.data.runs) as RunRegistry.RunInfo[])

  const activeRuns = createMemo(() => runs().filter((r) => r.status === "running" || r.status === "pending"))

  return (
    <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
      {/* Header */}
      <box flexDirection="row" gap={2} borderStyle="single" padding={1}>
        <span style={{ fg: theme.accent, bold: true }}>
          {A2RCopy.agentMode.title}
        </span>
        <text fg={theme.textMuted}>|</text>
        <Show when={activeTab() === "agents"}>
          <span style={{ fg: theme.accent, bold: true }}>Agents</span>
        </Show>
        <Show when={activeTab() !== "agents"}>
          <text fg={theme.info}>Agents</text>
        </Show>
        <Show when={activeTab() === "cron"}>
          <span style={{ fg: theme.accent, bold: true }}>Cron Jobs</span>
        </Show>
        <Show when={activeTab() !== "cron"}>
          <text fg={theme.info}>Cron Jobs</text>
        </Show>
        <Show when={activeTab() === "runs"}>
          <span style={{ fg: theme.accent, bold: true }}>Runs ({activeRuns().length})</span>
        </Show>
        <Show when={activeTab() !== "runs"}>
          <text fg={theme.info}>Runs ({activeRuns().length})</text>
        </Show>
      </box>

      {/* Content */}
      <box flexDirection="column" flexGrow={1} borderStyle="single" padding={1}>
        <Show when={activeTab() === "agents"}>
          <AgentList agents={agents()} />
        </Show>
        <Show when={activeTab() === "cron"}>
          <CronList jobs={cronJobs()} runs={cronRuns()} />
        </Show>
        <Show when={activeTab() === "runs"}>
          <RunList runs={runs()} />
        </Show>
      </box>
    </box>
  )
}

function AgentList(props: { agents: Agent[] }) {
  const { theme } = useTheme()
  const sync = useSync()

  return (
    <box flexDirection="column" gap={1}>
      <span style={{ fg: theme.accent, bold: true }}>
        Available Agents ({props.agents.length})
      </span>
      <box flexDirection="column" gap={1}>
        <For each={props.agents}>
          {(agent) => (
            <AgentItem
              agent={agent}
              isDefault={sync.data.config.default_agent === agent.name}
            />
          )}
        </For>
      </box>
    </box>
  )
}

function AgentItem(props: { agent: Agent; isDefault: boolean }) {
  const { theme } = useTheme()

  return (
    <box flexDirection="row" gap={2} padding={1} borderStyle="single">
      <box flexDirection="column" flexGrow={1} gap={1}>
        <box flexDirection="row" gap={1}>
          <span style={{ fg: props.agent.color ? theme.accent : theme.text, bold: true }}>
            {props.agent.native ? "●" : "○"} {props.agent.name}
          </span>
          <Show when={props.isDefault}>
            <text fg={theme.success}>(default)</text>
          </Show>
          <Show when={props.agent.hidden}>
            <text fg={theme.textMuted}>[hidden]</text>
          </Show>
        </box>
        <text fg={theme.textMuted}>{sanitizeBrandSurface(props.agent.description || "No description")}</text>
        <box flexDirection="row" gap={2}>
          <text fg={theme.textMuted}>Mode: {props.agent.mode}</text>
          <Show when={props.agent.model}>
            <text fg={theme.textMuted}>
              Model: {props.agent.model!.providerID}/{props.agent.model!.modelID}
            </text>
          </Show>
        </box>
      </box>
    </box>
  )
}

function CronList(props: { jobs: CronTypes.CronJob[]; runs: CronTypes.CronRun[] }) {
  const { theme } = useTheme()

  const activeJobs = createMemo(() => props.jobs.filter((j) => j.status === "active"))

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={2}>
        <span style={{ fg: theme.accent, bold: true }}>
          Cron Jobs ({props.jobs.length})
        </span>
        <text fg={theme.success}>Active: {activeJobs().length}</text>
      </box>
      <box flexDirection="column" gap={1}>
        <For each={props.jobs}>
          {(job) => (
            <CronJobItem job={job} runs={props.runs.filter((r) => r.jobId === job.id)} />
          )}
        </For>
      </box>
    </box>
  )
}

function CronJobItem(props: { job: CronTypes.CronJob; runs: CronTypes.CronRun[] }) {
  const { theme } = useTheme()

  const lastRun = createMemo(() =>
    props.runs.length > 0
      ? props.runs.sort((a, b) => b.startedAt - a.startedAt)[0]
      : undefined
  )

  const statusColor = () => {
    if (props.job.status === "active") return theme.success
    if (props.job.status === "paused") return theme.warning
    return theme.textMuted
  }

  return (
    <box flexDirection="row" gap={2} padding={1} borderStyle="single">
      <box flexDirection="column" flexGrow={1} gap={1}>
        <box flexDirection="row" gap={2}>
          <span style={{ fg: statusColor(), bold: true }}>
            {props.job.status === "active" ? "●" : "○"} {props.job.name}
          </span>
          <text fg={theme.textMuted}>({props.job.schedule})</text>
        </box>
        <text fg={theme.textMuted}>{props.job.prompt.slice(0, 80)}...</text>
        <box flexDirection="row" gap={2}>
          <text fg={theme.textMuted}>Runs: {props.job.runCount}</text>
          <Show when={props.job.failCount > 0}>
            <text fg={theme.error}>Failed: {props.job.failCount}</text>
          </Show>
          <Show when={lastRun()}>
            <text fg={theme.textMuted}>Last: {lastRun()!.status}</text>
          </Show>
        </box>
      </box>
    </box>
  )
}

function RunList(props: { runs: RunRegistry.RunInfo[] }) {
  const { theme } = useTheme()

  const sortedRuns = createMemo(() =>
    props.runs.sort((a, b) => b.createdAt - a.createdAt)
  )

  return (
    <box flexDirection="column" gap={1}>
      <span style={{ fg: theme.accent, bold: true }}>
        Active & Recent Runs ({props.runs.length})
      </span>
      <box flexDirection="column" gap={1}>
        <For each={sortedRuns()}>
          {(run) => <RunItem run={run} />}
        </For>
      </box>
    </box>
  )
}

function RunItem(props: { run: RunRegistry.RunInfo }) {
  const { theme } = useTheme()

  const statusColor = () => {
    switch (props.run.status) {
      case "running":
        return theme.info
      case "completed":
        return theme.success
      case "errored":
        return theme.error
      case "aborted":
        return theme.warning
      default:
        return theme.textMuted
    }
  }

  const statusIcon = () => {
    switch (props.run.status) {
      case "running":
        return "⟳"
      case "completed":
        return "✓"
      case "errored":
      case "aborted":
        return "✗"
      default:
        return "○"
    }
  }

  const duration = createMemo(() => {
    const end = props.run.finishedAt ?? Date.now()
    const ms = end - props.run.createdAt
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m`
  })

  return (
    <box flexDirection="row" gap={2} padding={1} borderStyle="single">
      <box flexDirection="column" flexGrow={1} gap={1}>
        <box flexDirection="row" gap={2}>
          <span style={{ fg: statusColor(), bold: true }}>
            {statusIcon()} {props.run.runId.slice(0, 8)}
          </span>
          <text fg={theme.textMuted}>{props.run.status}</text>
          <text fg={theme.textMuted}>Duration: {duration()}</text>
        </box>
        <Show when={props.run.agent}>
          <text fg={theme.textMuted}>Agent: {props.run.agent}</text>
        </Show>
        <Show when={props.run.prompt}>
          <text fg={theme.textMuted}>{props.run.prompt!.slice(0, 80)}...</text>
        </Show>
        <Show when={props.run.error}>
          <text fg={theme.error}>Error: {props.run.error}</text>
        </Show>
      </box>
    </box>
  )
}
