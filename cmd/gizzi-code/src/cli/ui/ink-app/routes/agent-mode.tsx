// @ts-nocheck
import { createMemo, createSignal, For, Show } from "solid-js"
import { useRoute, useRouteData } from "@/cli/ui/ink-app/context/route"
import { useSync } from "@/cli/ui/ink-app/context/sync"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useKeyboard } from "@opentui/solid"
import { GIZZICopy, sanitizeBrandSurface } from "@/shared/brand"
import type { CronJob } from "@/runtime/automation/cron/types"

// Local CronRun type for UI (SDK exports unknown)
interface CronRun {
  id: string
  jobId: string
  status: string
  scheduledAt: string
  startedAt?: string
  finishedAt?: string
}
import type { RunRegistry } from "@/runtime/session/run-registry"

// Suppress unknown type errors from SDK
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySyncData = any

// Local type for Agent (SDK exports unknown)
interface HarnessConfig {
  mode: "byok" | "cloud" | "local" | "subprocess"
  byok?: {
    anthropic?: { apiKey: string; baseURL?: string }
    openai?: { apiKey: string; baseURL?: string }
    google?: { apiKey: string; baseURL?: string }
  }
  cloud?: {
    baseURL: string
    accessToken: string
    refreshToken?: string
  }
  local?: {
    baseURL: string
  }
  subprocess?: {
    command: string
    cwd?: string
    env?: Record<string, string>
  }
}

interface Agent {
  name: string
  description?: string
  color?: string
  native?: boolean
  hidden?: boolean
  mode?: string
  model?: {
    providerID: string
    modelID: string
  }
  harness?: HarnessConfig
}

export function AgentMode() {
  const route = useRoute()
  const routeData = useRouteData("agent-mode")
  const sync = useSync()
  const { theme } = useTheme()

  const [activeTab, setActiveTab] = createSignal<
    "agents" | "cron" | "runs" | "harness" | "goals" | "routines" | "loops"
  >(routeData?.tab ?? "agents")

  // Handle navigation keys
  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault()
      evt.stopPropagation()
      route.navigate({ type: "home" })
      return
    }

    const tabs: Array<
      "agents" | "cron" | "runs" | "harness" | "goals" | "routines" | "loops"
    > = ["agents", "cron", "runs", "harness", "goals", "routines", "loops"]
    const idx = tabs.indexOf(activeTab())

    if (evt.name === "leftArrow" || evt.name === "h") {
      evt.preventDefault()
      evt.stopPropagation()
      const next = tabs[Math.max(0, idx - 1)]
      if (next) setActiveTab(next)
      return
    }

    if (evt.name === "rightArrow" || evt.name === "l") {
      evt.preventDefault()
      evt.stopPropagation()
      const next = tabs[Math.min(tabs.length - 1, idx + 1)]
      if (next) setActiveTab(next)
      return
    }

    if (evt.name === "1") {
      evt.preventDefault()
      evt.stopPropagation()
      setActiveTab("agents")
      return
    }
    if (evt.name === "2") {
      evt.preventDefault()
      evt.stopPropagation()
      setActiveTab("cron")
      return
    }
    if (evt.name === "3") {
      evt.preventDefault()
      evt.stopPropagation()
      setActiveTab("runs")
      return
    }
    if (evt.name === "4") {
      evt.preventDefault()
      evt.stopPropagation()
      setActiveTab("harness")
      return
    }
    if (evt.name === "5") {
      evt.preventDefault()
      evt.stopPropagation()
      setActiveTab("goals")
      return
    }
    if (evt.name === "6") {
      evt.preventDefault()
      evt.stopPropagation()
      setActiveTab("routines")
      return
    }
    if (evt.name === "7") {
      evt.preventDefault()
      evt.stopPropagation()
      setActiveTab("loops")
      return
    }
  })

  const agents = createMemo(() => sync.data.agent as Agent[])
  const cronJobs = createMemo(() => (sync.data as AnySyncData).cron_jobs as CronJob[])
  const cronRuns = createMemo(() => (sync.data as AnySyncData).cron_runs as CronRun[])
  const runs = createMemo(() => Object.values(sync.data.runs) as RunRegistry.RunInfo[])
  const goals = createMemo(() => (sync.data as AnySyncData).goals as AnySyncData[])
  const routines = createMemo(() => (sync.data as AnySyncData).routines as AnySyncData[])
  const loops = createMemo(() => (sync.data as AnySyncData).loops as AnySyncData[])

  const activeRuns = createMemo(() => runs().filter((r) => r.status === "running" || r.status === "pending"))

  return (
    <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
      {/* Header */}
      <box flexDirection="row" gap={2} borderStyle="single" padding={1}>
        <span style={{ fg: theme.accent, bold: true }}>
          {GIZZICopy.agentMode.title}
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
          <span style={{ fg: theme.accent, bold: true }}>Runs ({String(activeRuns().length)})</span>
        </Show>
        <Show when={activeTab() !== "runs"}>
          <text fg={theme.info}>Runs ({String(activeRuns().length ?? 0)})</text>
        </Show>
        <Show when={activeTab() === "harness"}>
          <span style={{ fg: theme.accent, bold: true }}>Harness</span>
        </Show>
        <Show when={activeTab() !== "harness"}>
          <text fg={theme.info}>Harness</text>
        </Show>
        <Show when={activeTab() === "goals"}>
          <span style={{ fg: theme.accent, bold: true }}>Goals ({String(goals().length)})</span>
        </Show>
        <Show when={activeTab() !== "goals"}>
          <text fg={theme.info}>Goals ({String(goals().length ?? 0)})</text>
        </Show>
        <Show when={activeTab() === "routines"}>
          <span style={{ fg: theme.accent, bold: true }}>Routines ({String(routines().length)})</span>
        </Show>
        <Show when={activeTab() !== "routines"}>
          <text fg={theme.info}>Routines ({String(routines().length ?? 0)})</text>
        </Show>
        <Show when={activeTab() === "loops"}>
          <span style={{ fg: theme.accent, bold: true }}>Loops ({String(loops().length)})</span>
        </Show>
        <Show when={activeTab() !== "loops"}>
          <text fg={theme.info}>Loops ({String(loops().length ?? 0)})</text>
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
        <Show when={activeTab() === "harness"}>
          <HarnessList agents={agents()} />
        </Show>
        <Show when={activeTab() === "goals"}>
          <GoalList goals={goals()} />
        </Show>
        <Show when={activeTab() === "routines"}>
          <RoutineList routines={routines()} />
        </Show>
        <Show when={activeTab() === "loops"}>
          <LoopList loops={loops()} />
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
        Available Agents ({String(props.agents.length)})
      </span>
      <box flexDirection="column" gap={1}>
        <For each={props.agents}>
          {(agent) => (
            <AgentItem
              agent={agent}
              isDefault={(sync.data as AnySyncData).config?.default_agent === agent.name}
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

function HarnessList(props: { agents: Agent[] }) {
  const { theme } = useTheme()

  const agentsWithHarness = createMemo(() =>
    props.agents.filter((a) => a.harness && a.harness.mode)
  )

  return (
    <box flexDirection="column" gap={1}>
      <span style={{ fg: theme.accent, bold: true }}>
        Agent Harness Configurations ({String(agentsWithHarness().length)})
      </span>
      <box flexDirection="column" gap={1}>
        <For each={agentsWithHarness()}>
          {(agent) => <HarnessItem agent={agent} />}
        </For>
      </box>
      <Show when={agentsWithHarness().length === 0}>
        <text fg={theme.textMuted}>No agents have a harness configured.</text>
      </Show>
    </box>
  )
}

function HarnessItem(props: { agent: Agent }) {
  const { theme } = useTheme()
  const harness = props.agent.harness!

  const details = createMemo(() => {
    switch (harness.mode) {
      case "byok": {
        const providers = []
        if (harness.byok?.anthropic) providers.push("anthropic")
        if (harness.byok?.openai) providers.push("openai")
        if (harness.byok?.google) providers.push("google")
        return providers.length > 0 ? `providers: ${providers.join(", ")}` : "no provider configured"
      }
      case "cloud":
        return harness.cloud?.baseURL ? `endpoint: ${harness.cloud.baseURL}` : "no endpoint configured"
      case "local":
        return harness.local?.baseURL ? `endpoint: ${harness.local.baseURL}` : "no endpoint configured"
      case "subprocess":
        return harness.subprocess?.command ? `command: ${harness.subprocess.command}` : "no command configured"
      default:
        return "unknown harness mode"
    }
  })

  return (
    <box flexDirection="row" gap={2} padding={1} borderStyle="single">
      <box flexDirection="column" flexGrow={1} gap={1}>
        <box flexDirection="row" gap={1}>
          <span style={{ fg: theme.accent, bold: true }}>
            {props.agent.native ? "●" : "○"} {props.agent.name}
          </span>
          <text fg={theme.info}>[{harness.mode}]</text>
        </box>
        <text fg={theme.textMuted}>{details()}</text>
        <Show when={props.agent.model}>
          <text fg={theme.textMuted}>
            Model: {props.agent.model!.providerID}/{props.agent.model!.modelID}
          </text>
        </Show>
      </box>
    </box>
  )
}

function GoalList(props: { goals: AnySyncData[] }) {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" gap={1}>
      <span style={{ fg: theme.accent, bold: true }}>
        Goals ({String(props.goals.length)})
      </span>
      <box flexDirection="column" gap={1}>
        <For each={props.goals}>
          {(goal) => (
            <box flexDirection="row" gap={2} padding={1} borderStyle="single">
              <box flexDirection="column" flexGrow={1} gap={1}>
                <box flexDirection="row" gap={1}>
                  <span style={{ fg: theme.accent, bold: true }}>{goal.objective as string}</span>
                  <text fg={theme.info}>[{String(goal.state)}]</text>
                </box>
                <text fg={theme.textMuted}>Progress: {String(goal.progress ?? 0)}%</text>
                <Show when={Array.isArray(goal.milestones) && goal.milestones.length > 0}>
                  <text fg={theme.textMuted}>
                    Milestones: {String((goal.milestones as AnySyncData[]).filter((m: AnySyncData) => m.status === "completed").length)}/{String((goal.milestones as AnySyncData[]).length)}
                  </text>
                </Show>
              </box>
            </box>
          )}
        </For>
      </box>
      <Show when={props.goals.length === 0}>
        <text fg={theme.textMuted}>No goals found.</text>
      </Show>
    </box>
  )
}

function RoutineList(props: { routines: AnySyncData[] }) {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" gap={1}>
      <span style={{ fg: theme.accent, bold: true }}>
        Routines ({String(props.routines.length)})
      </span>
      <box flexDirection="column" gap={1}>
        <For each={props.routines}>
          {(routine) => (
            <box flexDirection="row" gap={2} padding={1} borderStyle="single">
              <box flexDirection="column" flexGrow={1} gap={1}>
                <box flexDirection="row" gap={1}>
                  <span style={{ fg: theme.accent, bold: true }}>{routine.name as string}</span>
                  <text fg={theme.info}>[{String(routine.state)}]</text>
                </box>
                <Show when={routine.schedule}>
                  <text fg={theme.textMuted}>Schedule: {String(routine.schedule)}</text>
                </Show>
                <Show when={Array.isArray(routine.steps) && routine.steps.length > 0}>
                  <text fg={theme.textMuted}>
                    Steps: {String((routine.steps as AnySyncData[]).filter((s: AnySyncData) => s.status === "done").length)}/{String((routine.steps as AnySyncData[]).length)}
                  </text>
                </Show>
              </box>
            </box>
          )}
        </For>
      </box>
      <Show when={props.routines.length === 0}>
        <text fg={theme.textMuted}>No routines found.</text>
      </Show>
    </box>
  )
}

function LoopList(props: { loops: AnySyncData[] }) {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" gap={1}>
      <span style={{ fg: theme.accent, bold: true }}>
        Loops ({String(props.loops.length)})
      </span>
      <box flexDirection="column" gap={1}>
        <For each={props.loops}>
          {(loop) => (
            <box flexDirection="row" gap={2} padding={1} borderStyle="single">
              <box flexDirection="column" flexGrow={1} gap={1}>
                <box flexDirection="row" gap={1}>
                  <span style={{ fg: theme.accent, bold: true }}>{loop.command as string}</span>
                  <text fg={theme.info}>[{String(loop.state)}]</text>
                </box>
                <Show when={loop.exit_condition}>
                  <text fg={theme.textMuted}>Exit: {String(loop.exit_condition)}</text>
                </Show>
                <text fg={theme.textMuted}>Max iterations: {String(loop.max_iterations ?? 10)}</text>
                <Show when={Array.isArray(loop.iteration_log) && loop.iteration_log.length > 0}>
                  <text fg={theme.textMuted}>
                    Iterations: {String((loop.iteration_log as AnySyncData[]).length)}
                  </text>
                </Show>
              </box>
            </box>
          )}
        </For>
      </box>
      <Show when={props.loops.length === 0}>
        <text fg={theme.textMuted}>No loops found.</text>
      </Show>
    </box>
  )
}

function CronList(props: { jobs: CronJob[]; runs: CronRun[] }) {
  const { theme } = useTheme()

  const activeJobs = createMemo(() => props.jobs.filter((j) => j.status === "active"))

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={2}>
        <span style={{ fg: theme.accent, bold: true }}>
          Cron Jobs ({String(props.jobs.length)})
        </span>
        <text fg={theme.success}>Active: {String(activeJobs().length ?? 0)}</text>
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

function CronJobItem(props: { job: CronJob; runs: CronRun[] }) {
  const { theme } = useTheme()

  const lastRun = createMemo(() => {
    if (props.runs.length === 0) return undefined
    return props.runs.sort((a, b) => new Date(b.startedAt ?? 0).getTime() - new Date(a.startedAt ?? 0).getTime())[0]
  })

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
        <text fg={theme.textMuted}>{((props.job as AnySyncData).prompt ?? "").slice(0, 80)}...</text>
        <box flexDirection="row" gap={2}>
          <text fg={theme.textMuted}>Runs: {String(props.job.runCount)}</text>
          <Show when={props.job.failCount > 0}>
            <text fg={theme.error}>Failed: {String(props.job.failCount)}</text>
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
        Active & Recent Runs ({String(props.runs.length)})
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
