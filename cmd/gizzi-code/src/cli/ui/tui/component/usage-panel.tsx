import { createMemo, For, Show, Match, Switch } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { SessionUsage } from "@/runtime/session/usage"
import { renderProgressBar } from "@/cli/ui/components/animation/progress"
import type { RGBA } from "@opentui/core"

export type UsageView = "compact" | "detailed" | "full"

export function UsagePanel(props: {
  summary: SessionUsage.UsageSummary
  view?: UsageView
  sessionID?: string
  limit?: number
}) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const view = () => props.view ?? "compact"

  const grandTotal = () => props.summary.grandTotal
  const sessions = () => props.summary.sessions.slice(0, props.limit ?? 10)
  const daily = () => props.summary.daily.slice(0, props.limit ?? 7)

  // Calculate max values for bar scaling
  const maxSessionCost = () => Math.max(...sessions().map(s => s.total.cost), 0.01)
  const maxDailyCost = () => Math.max(...daily().map(d => d.total.cost), 0.01)

  return (
    <box flexDirection="column" gap={tone().space.md}>
      {/* Grand Total Cards */}
      <box flexDirection="row" gap={tone().space.sm}>
        <StatCard
          label="Cost"
          value={SessionUsage.formatCost(grandTotal().cost)}
          color={theme.accent}
          width={18}
        />
        <StatCard
          label="Tokens"
          value={SessionUsage.formatTokens(grandTotal().tokens)}
          color={theme.info}
          width={18}
        />
        <Show when={view() !== "compact"}>
          <StatCard
            label="Messages"
            value={grandTotal().messages.toString()}
            color={theme.success}
            width={14}
          />
        </Show>
      </box>

      {/* Session Breakdown */}
      <Show when={view() === "full" && sessions().length > 0}>
        <box flexDirection="column" gap={tone().space.sm}>
          <SectionTitle title="Session Usage" />
          <box flexDirection="column" gap={tone().space.xs}>
            <For each={sessions()}>
              {(session) => (
                <UsageBar
                  label={formatSessionID(session.sessionID)}
                  value={session.total.cost}
                  max={maxSessionCost()}
                  displayValue={SessionUsage.formatCost(session.total.cost)}
                  subtext={`${session.messageCount} msgs · ${SessionUsage.formatTokens(session.total.tokens)} tokens`}
                  color={theme.accent}
                  width={38}
                />
              )}
            </For>
          </box>
        </box>
      </Show>

      {/* Daily Breakdown */}
      <Show when={view() === "full" && daily().length > 0}>
        <box flexDirection="column" gap={tone().space.sm}>
          <SectionTitle title="Daily Trend" />
          <box flexDirection="column" gap={tone().space.xs}>
            <For each={daily()}>
              {(day) => (
                <UsageBar
                  label={formatDate(day.date)}
                  value={day.total.cost}
                  max={maxDailyCost()}
                  displayValue={SessionUsage.formatCost(day.total.cost)}
                  subtext={`${day.sessions.length} sessions`}
                  color={theme.info}
                  width={38}
                />
              )}
            </For>
          </box>
        </box>
      </Show>

      {/* Top Models */}
      <Show when={view() !== "compact"}>
        <box flexDirection="column" gap={tone().space.sm}>
          <SectionTitle title="Models" />
          <For each={getTopModels(props.summary).slice(0, 4)}>
            {(model) => (
              <ModelRow
                name={model.name}
                tokens={model.tokens}
                cost={model.cost}
                totalCost={grandTotal().cost}
              />
            )}
          </For>
        </box>
      </Show>

      {/* Top Providers */}
      <Show when={view() === "full"}>
        <box flexDirection="column" gap={tone().space.sm}>
          <SectionTitle title="Providers" />
          <For each={getTopProviders(props.summary).slice(0, 3)}>
            {(provider) => (
              <ProviderRow
                name={provider.name}
                cost={provider.cost}
                totalCost={grandTotal().cost}
              />
            )}
          </For>
        </box>
      </Show>
    </box>
  )
}

function StatCard(props: {
  label: string
  value: string
  color: RGBA
  width: number
}) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()

  return (
    <box
      flexDirection="column"
      gap={tone().space.xs}
      padding={tone().space.sm}
      backgroundColor={theme.backgroundElement}
      width={props.width}
    >
      <text fg={props.color}>
        <span style={{ bold: true }}>{props.value}</span>
      </text>
      <text fg={theme.textMuted}>{props.label}</text>
    </box>
  )
}

function SectionTitle(props: { title: string }) {
  const { theme } = useTheme()
  return (
    <text fg={theme.textMuted}>
      <span style={{ bold: true }}>{props.title}</span>
    </text>
  )
}

function UsageBar(props: {
  label: string
  value: number
  max: number
  displayValue: string
  subtext: string
  color: RGBA
  width: number
}) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()

  const percentage = () => Math.min(100, Math.round((props.value / props.max) * 100))
  const barWidth = 12

  const bar = () => {
    const filled = Math.round((percentage() / 100) * barWidth)
    const empty = barWidth - filled
    return (
      <text fg={props.color}>
        {"█".repeat(filled)}
      </text>
    )
  }

  const emptyBar = () => {
    const filled = Math.round((percentage() / 100) * barWidth)
    const empty = barWidth - filled
    return (
      <text fg={theme.backgroundElement}>
        {"█".repeat(empty)}
      </text>
    )
  }

  return (
    <box flexDirection="row" gap={tone().space.sm} alignItems="center">
      <text fg={theme.text} width={10} wrapMode="none">
        {props.label.slice(0, 10)}
      </text>
      <box flexDirection="row">
        {bar()}
        {emptyBar()}
      </box>
      <text fg={props.color} width={8} wrapMode="none">
        {props.displayValue}
      </text>
      <text fg={theme.textMuted} wrapMode="none">
        {props.subtext}
      </text>
    </box>
  )
}

function ModelRow(props: {
  name: string
  tokens: number
  cost: number
  totalCost: number
}) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()

  const percentage = () => Math.min(100, Math.round((props.cost / Math.max(props.totalCost, 0.01)) * 100))
  const barWidth = 8

  const bar = () => {
    const filled = Math.max(1, Math.round((percentage() / 100) * barWidth))
    return "█".repeat(filled) + "░".repeat(barWidth - filled)
  }

  return (
    <box flexDirection="row" gap={tone().space.sm} alignItems="center">
      <text fg={theme.text} flexGrow={1} wrapMode="word">
        {truncateModelName(props.name)}
      </text>
      <text fg={theme.accent}>
        {bar()}
      </text>
      <text fg={theme.textMuted} width={6} wrapMode="none">
        {SessionUsage.formatTokens(props.tokens)}
      </text>
      <text fg={theme.accent} width={8} wrapMode="none">
        {SessionUsage.formatCost(props.cost)}
      </text>
    </box>
  )
}

function ProviderRow(props: {
  name: string
  cost: number
  totalCost: number
}) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()

  const percentage = () => Math.min(100, Math.round((props.cost / Math.max(props.totalCost, 0.01)) * 100))
  const barWidth = 8

  const bar = () => {
    const filled = Math.max(1, Math.round((percentage() / 100) * barWidth))
    return "█".repeat(filled) + "░".repeat(barWidth - filled)
  }

  return (
    <box flexDirection="row" gap={tone().space.sm} alignItems="center">
      <text fg={theme.text} flexGrow={1}>
        {props.name}
      </text>
      <text fg={theme.info}>
        {bar()}
      </text>
      <text fg={theme.info} width={8} wrapMode="none">
        {SessionUsage.formatCost(props.cost)}
      </text>
    </box>
  )
}

// Helpers
function formatSessionID(id: string): string {
  if (id.length > 10) return id.slice(0, 5) + ".." + id.slice(-3)
  return id
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === today.toISOString().split("T")[0]) return "Today"
  if (dateStr === yesterday.toISOString().split("T")[0]) return "Yest"

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function truncateModelName(name: string): string {
  // Remove common prefixes and truncate
  const cleaned = name
    .replace(/^anthropic\//, "")
    .replace(/^openai\//, "")
    .replace(/^google\//, "")
  if (cleaned.length > 22) return cleaned.slice(0, 20) + ".."
  return cleaned
}

function getTopModels(summary: SessionUsage.UsageSummary): Array<{
  name: string
  tokens: number
  cost: number
}> {
  const modelMap = new Map<string, { tokens: number; cost: number }>()

  for (const session of summary.sessions) {
    for (const [modelID, data] of Object.entries(session.byModel)) {
      const existing = modelMap.get(modelID) ?? { tokens: 0, cost: 0 }
      modelMap.set(modelID, {
        tokens: existing.tokens + data.tokens,
        cost: existing.cost + data.cost,
      })
    }
  }

  return Array.from(modelMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.cost - a.cost)
}

function getTopProviders(summary: SessionUsage.UsageSummary): Array<{
  name: string
  tokens: number
  cost: number
}> {
  const providerMap = new Map<string, { tokens: number; cost: number }>()

  for (const session of summary.sessions) {
    for (const [providerID, data] of Object.entries(session.byProvider)) {
      const existing = providerMap.get(providerID) ?? { tokens: 0, cost: 0 }
      providerMap.set(providerID, {
        tokens: existing.tokens + data.tokens,
        cost: existing.cost + data.cost,
      })
    }
  }

  return Array.from(providerMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.cost - a.cost)
}
