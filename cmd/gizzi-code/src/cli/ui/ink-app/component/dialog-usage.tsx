import { createMemo, createSignal, For, Show, onMount, Match, Switch } from "solid-js"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { SessionUsage } from "@/runtime/session/usage"
import { useKeyboard } from "@opentui/solid"
import { UsagePanel } from "@/cli/ui/ink-app/component/usage-panel"
import type { RGBA } from "@opentui/core"

type Tab = "overview" | "daily" | "sessions"

export function DialogUsage(props: { sessionID?: string }) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const [activeTab, setActiveTab] = createSignal<Tab>(props.sessionID ? "sessions" : "overview")
  const [summary, setSummary] = createSignal<SessionUsage.UsageSummary | null>(null)
  const [loading, setLoading] = createSignal(true)

  onMount(async () => {
    const data = await SessionUsage.getSummary(
      props.sessionID ? { sessionID: props.sessionID } : undefined
    )
    setSummary(data)
    setLoading(false)
  })

  useKeyboard((evt) => {
    if (evt.name === "escape" || evt.name === "q") {
      dialog.clear()
      return
    }
    if (evt.name === "1" || evt.name === "o") {
      setActiveTab("overview")
      return
    }
    if (evt.name === "2" || evt.name === "d") {
      setActiveTab("daily")
      return
    }
    if (evt.name === "3" || evt.name === "s") {
      setActiveTab("sessions")
      return
    }
  })

  const hasData = createMemo(() => {
    const s = summary()
    return s && s.grandTotal.messages > 0
  })

  return (
    <box
      flexDirection="column"
      width={props.sessionID ? 50 : 80}
      maxHeight={45}
      padding={tone().space.md}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Header */}
      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.md} justifyContent="space-between">
        <box flexDirection="row" gap={tone().space.sm}>
          <span style={{ fg: theme.accent, bold: true }}>💰 Usage</span>
          <Show when={props.sessionID}>
            <text fg={theme.textMuted}>(Current Session)</text>
          </Show>
        </box>
        <Show when={hasData()}>
          <text fg={theme.accent}>
            {SessionUsage.formatCost(summary()!.grandTotal.cost)} total
          </text>
        </Show>
      </box>

      {/* Tabs - only show in global view */}
      <Show when={!props.sessionID}>
        <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.md}>
          <TabButton
            label="Overview"
            shortcut="1"
            active={activeTab() === "overview"}
            onClick={() => setActiveTab("overview")}
          />
          <TabButton
            label="Daily"
            shortcut="2"
            active={activeTab() === "daily"}
            onClick={() => setActiveTab("daily")}
          />
          <TabButton
            label="Sessions"
            shortcut="3"
            active={activeTab() === "sessions"}
            onClick={() => setActiveTab("sessions")}
          />
        </box>
      </Show>

      {/* Content */}
      <box flexDirection="column" flexGrow={1}>
        <Show when={loading()}>
          <box flexDirection="column" gap={1} alignItems="center" padding={tone().space.lg}>
            <text fg={theme.accent}>◐</text>
            <text fg={theme.textMuted}>Loading usage data...</text>
          </box>
        </Show>

        <Show when={!loading() && !hasData()}>
          <box flexDirection="column" gap={1} alignItems="center" padding={tone().space.lg}>
            <text fg={theme.textMuted}>No usage data available yet.</text>
            <text fg={theme.textMuted}>Start a conversation to see usage statistics.</text>
          </box>
        </Show>

        <Show when={!loading() && hasData()}>
          <Switch>
            <Match when={activeTab() === "overview"}>
              <OverviewView summary={summary()!} />
            </Match>
            <Match when={activeTab() === "daily"}>
              <DailyView summary={summary()!} />
            </Match>
            <Match when={activeTab() === "sessions"}>
              <SessionsView summary={summary()!} detailed={!props.sessionID} />
            </Match>
          </Switch>
        </Show>
      </box>

      {/* Footer */}
      <box flexDirection="row" gap={tone().space.md} marginTop={tone().space.sm}>
        <text fg={theme.textMuted}>Esc/q close</text>
        <Show when={!props.sessionID}>
          <text fg={theme.textMuted}>1/2/3 tabs</text>
        </Show>
      </box>
    </box>
  )
}

function TabButton(props: {
  label: string
  shortcut: string
  active: boolean
  onClick: () => void
}) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()

  return (
    <box
      flexDirection="row"
      gap={tone().space.xs}
      padding={tone().space.sm}
      backgroundColor={props.active ? theme.backgroundElement : undefined}
      onMouseUp={props.onClick}
    >
      <text fg={props.active ? theme.accent : theme.textMuted}>{props.shortcut}</text>
      <text fg={props.active ? theme.text : theme.textMuted}>{props.label}</text>
    </box>
  )
}

function OverviewView(props: { summary: SessionUsage.UsageSummary }) {
  return (
    <UsagePanel summary={props.summary} view="full" />
  )
}

function DailyView(props: { summary: SessionUsage.UsageSummary }) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()

  const maxCost = () => Math.max(...props.summary.daily.map(d => d.total.cost), 0.01)

  return (
    <box flexDirection="column" gap={tone().space.sm}>
      <For each={props.summary.daily.slice(0, 14)}>
        {(day) => {
          const percentage = () => Math.round((day.total.cost / maxCost()) * 100)
          const barWidth = 20
          const filled = () => Math.round((percentage() / 100) * barWidth)
          const empty = () => barWidth - filled()

          return (
            <box
              flexDirection="column"
              gap={tone().space.xs}
              padding={tone().space.sm}
              backgroundColor={theme.backgroundElement}
            >
              <box flexDirection="row" gap={tone().space.md} alignItems="center">
                <text width={10} wrapMode="none" fg={theme.text}>
                  <span style={{ bold: true }}>{formatDate(day.date)}</span>
                </text>
                <box flexDirection="row">
                  <text fg={theme.info}>{"█".repeat(filled())}</text>
                  <text fg={theme.backgroundElement}>{"█".repeat(empty())}</text>
                </box>
                <text fg={theme.accent} width={8} wrapMode="none">
                  {SessionUsage.formatCost(day.total.cost)}
                </text>
              </box>
              <box flexDirection="row" gap={tone().space.md}>
                <text fg={theme.textMuted}>{String(day.sessions.length ?? 0)} sessions</text>
                <text fg={theme.textMuted}>•</text>
                <text fg={theme.textMuted}>{String(day.total.messages ?? 0)} messages</text>
                <text fg={theme.textMuted}>•</text>
                <text fg={theme.textMuted}>{SessionUsage.formatTokens(day.total.tokens)} tokens</text>
              </box>
            </box>
          )
        }}
      </For>
    </box>
  )
}

function SessionsView(props: { summary: SessionUsage.UsageSummary; detailed?: boolean }) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()

  const maxCost = () => Math.max(...props.summary.sessions.map(s => s.total.cost), 0.01)

  return (
    <box flexDirection="column" gap={tone().space.sm}>
      <For each={props.summary.sessions.slice(0, props.detailed ? 20 : 5)}>
        {(session) => {
          const percentage = () => Math.round((session.total.cost / maxCost()) * 100)
          const barWidth = props.detailed ? 20 : 15
          const filled = () => Math.round((percentage() / 100) * barWidth)
          const empty = () => barWidth - filled()

          return (
            <box
              flexDirection="column"
              gap={tone().space.xs}
              padding={tone().space.sm}
              backgroundColor={theme.backgroundElement}
            >
              <box flexDirection="row" gap={tone().space.md} alignItems="center">
                <text flexGrow={1} fg={theme.text}>
                  <span style={{ bold: true }}>{formatSessionID(session.sessionID)}</span>
                </text>
                <Show when={props.detailed}>
                  <box flexDirection="row">
                    <text fg={theme.accent}>{"█".repeat(filled())}</text>
                    <text fg={theme.backgroundElement}>{"█".repeat(empty())}</text>
                  </box>
                </Show>
                <text fg={theme.accent} width={8} wrapMode="none">
                  {SessionUsage.formatCost(session.total.cost)}
                </text>
              </box>
              <box flexDirection="row" gap={tone().space.md}>
                <text fg={theme.textMuted}>{String(session.messageCount ?? 0)} messages</text>
                <text fg={theme.textMuted}>•</text>
                <text fg={theme.textMuted}>{SessionUsage.formatTokens(session.total.tokens)} tokens</text>
                <Show when={props.detailed}>
                  <text fg={theme.textMuted}>•</text>
                  <text fg={theme.textMuted}>{formatTime(session.startTime)}</text>
                </Show>
              </box>
            </box>
          )
        }}
      </For>
    </box>
  )
}

// Helpers
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === today.toISOString().split("T")[0]) return "Today"
  if (dateStr === yesterday.toISOString().split("T")[0]) return "Yesterday"

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatSessionID(id: string): string {
  if (id.length > 20) return id.slice(0, 8) + "..." + id.slice(-6)
  return id
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}
