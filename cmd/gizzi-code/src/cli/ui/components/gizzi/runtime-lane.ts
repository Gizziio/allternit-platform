export type RuntimeLaneStatus = "pending" | "running" | "completed" | "error"

export type RuntimeLaneToolSnapshot = {
  callID: string
  tool: string
  status: RuntimeLaneStatus
  label: string
  detail?: string
  meta?: string
  web?: boolean
}

export type RuntimeLaneCard = {
  id: string
  icon: string
  title: string
  body: string
  meta?: string
  status: RuntimeLaneStatus
  pulse?: boolean
}

export function deriveRuntimeLaneCards(input: {
  tools: RuntimeLaneToolSnapshot[]
  modeLabel: string
  modeHint: string
  modeStatus: RuntimeLaneStatus
  runID: string
  elapsedSeconds: number
  pulse: string
  heartbeat: string
  separator: string
  glyphTool: string
  includeHistory: boolean
  historyLimit: number
  maxCards: number
  defaultExecutingHint: string
}): RuntimeLaneCard[] {
  const active = input.tools.findLast((tool) => tool.status === "pending" || tool.status === "running")
  const settled = input.tools.filter(
    (tool) =>
      (tool.status === "completed" || tool.status === "error") && (!active || tool.callID !== active.callID),
  )

  const settledCards = input.includeHistory
    ? settled.slice(-Math.max(1, input.historyLimit)).toReversed()
    : settled.slice(-1)

  const cards: RuntimeLaneCard[] = []

  if (active) {
    const meta = [active.meta, active.status === "running" ? input.pulse : "queued"].filter(Boolean).join(
      ` ${input.separator} `,
    )
    cards.push({
      id: `active-${active.callID}`,
      icon: active.web ? "⊕" : "⚙",
      title: `${titleCase(active.label)} executing`,
      body: active.detail || input.defaultExecutingHint,
      meta: meta || undefined,
      status: active.status,
      pulse: true,
    })
  }

  cards.push(
    ...settledCards.map((tool) => ({
      id: `settled-${tool.callID}`,
      icon: tool.status === "error" ? "×" : "■",
      title: `${titleCase(tool.label)} ${tool.status === "error" ? "failed" : "sealed"}`,
      body: tool.detail || (tool.status === "error" ? "operation failed" : "operation completed"),
      meta: tool.meta || undefined,
      status: tool.status,
      pulse: false,
    })),
  )

  const stage: RuntimeLaneCard = {
    id: `stage-${input.runID}`,
    icon: "❖",
    title: `${input.modeLabel} focus`,
    body: input.modeHint,
    meta: `run ${input.runID} ${input.separator} ${input.elapsedSeconds}s ${input.separator} ${input.pulse}`,
    status: input.modeStatus,
    pulse: true,
  }

  const activeCount = input.tools.filter((tool) => tool.status === "pending" || tool.status === "running").length
  const completedCount = input.tools.filter((tool) => tool.status === "completed").length
  const errorCount = input.tools.filter((tool) => tool.status === "error").length

  const bundle: RuntimeLaneCard = {
    id: `bundle-${input.runID}`,
    icon: "◈",
    title: "Manifest Bundle",
    body: `active:${activeCount} sealed:${completedCount} errors:${errorCount}`,
    meta: `phase:${input.modeLabel.toLowerCase()} ${input.heartbeat}`,
    status: "completed",
    pulse: false,
  }

  const maxCards = Math.max(2, input.maxCards)
  const headBudget = Math.max(0, maxCards - 2)
  const head = cards.slice(0, headBudget)
  return [...head, stage, bundle]
}

function titleCase(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}
