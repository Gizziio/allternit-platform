/**
 * Context Visualization Dialog
 * 
 * Shows token usage, context window, and conversation stats.
 */

import { createMemo, Show, For } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useRouteData } from "@/cli/ui/tui/context/route"
import { RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { Locale } from "@/runtime/util/locale"

export function DialogContext() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const sync = useSync()
  const route = useRouteData("session")
  
  const sessionID = route.sessionID
  
  // Get session data
  const session = createMemo(() => {
    return (sync.data.session || []).find((s: any) => s.id === sessionID)
  })
  
  // Get messages for this session
  const messages = createMemo(() => {
    const allMessages = sync.data.message || {}
    return Object.values(allMessages).filter((m: any) => m.sessionID === sessionID)
  })
  
  // Calculate stats
  const stats = createMemo(() => {
    const msgs = messages() as any[]
    let totalTokens = 0
    let inputTokens = 0
    let outputTokens = 0
    let totalCost = 0
    
    for (const msg of msgs) {
      if (msg.tokens) {
        totalTokens += msg.tokens.input + msg.tokens.output
        inputTokens += msg.tokens.input
        outputTokens += msg.tokens.output
      }
      if (msg.cost) {
        totalCost += msg.cost
      }
    }
    
    return {
      messageCount: msgs.length,
      userMessages: msgs.filter(m => m.role === "user").length,
      assistantMessages: msgs.filter(m => m.role === "assistant").length,
      totalTokens,
      inputTokens,
      outputTokens,
      totalCost,
      avgTokensPerMessage: msgs.length > 0 ? Math.round(totalTokens / msgs.length) : 0,
    }
  })
  
  // Get model context limit (simplified)
  const contextLimit = createMemo(() => {
    // Default to 200k for Claude, would need actual model config
    return 200000
  })
  
  const usagePercent = createMemo(() => {
    return Math.min(100, Math.round((stats().totalTokens / contextLimit()) * 100))
  })
  
  // Progress bar color
  const progressColor = createMemo(() => {
    const percent = usagePercent()
    if (percent < 50) return theme.success
    if (percent < 80) return theme.warning
    return theme.error
  })
  
  useKeyboard((evt) => {
    if (evt.name === "escape" || evt.name === "q") {
      dialog.clear()
    }
  })
  
  // Progress bar component
  const ProgressBar = (props: { percent: number; width: number }) => {
    const filled = Math.round((props.percent / 100) * props.width)
    const empty = props.width - filled
    
    return (
      <box flexDirection="row">
        <text fg={progressColor()}>
          {"█".repeat(filled)}
        </text>
        <text fg={theme.border}>
          {"░".repeat(empty)}
        </text>
        <text fg={theme.textMuted} marginLeft={1}>
          {props.percent}%
        </text>
      </box>
    )
  }
  
  // Stat row component
  const StatRow = (props: { label: string; value: string; color?: RGBA }) => (
    <box flexDirection="row" justifyContent="space-between" padding={1}>
      <text fg={theme.textMuted}>{props.label}</text>
      <text fg={props.color || theme.text} attributes={TextAttributes.BOLD}>
        {props.value}
      </text>
    </box>
  )
  
  return (
    <box flexDirection="column" minWidth={70} padding={2}>
      {/* Header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        marginBottom={1}
      >
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Context & Usage
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc/q to close
        </text>
      </box>
      
      {/* Context Window Usage */}
      <box
        flexDirection="column"
        padding={1}
        border={["bottom"]}
        borderColor={theme.border}
        marginBottom={1}
      >
        <text fg={theme.text} marginBottom={1}>
          Context Window Usage
        </text>
        <ProgressBar percent={usagePercent()} width={50} />
        <box flexDirection="row" gap={2} marginTop={1}>
          <text fg={theme.textMuted}>
            {stats().totalTokens.toLocaleString()} / {contextLimit().toLocaleString()} tokens
          </text>
        </box>
      </box>
      
      {/* Session Stats */}
      <box
        flexDirection="column"
        padding={1}
        border={["bottom"]}
        borderColor={theme.border}
        marginBottom={1}
      >
        <text fg={theme.text} marginBottom={1}>
          Session Stats
        </text>
        <StatRow 
          label="Total Messages" 
          value={`${stats().messageCount}`} 
        />
        <StatRow 
          label="Your Messages" 
          value={`${stats().userMessages}`} 
        />
        <StatRow 
          label="AI Responses" 
          value={`${stats().assistantMessages}`} 
        />
        <Show when={session()?.time?.created}>
          {(created) => (
            <StatRow 
              label="Started" 
              value={Locale.time(created())} 
            />
          )}
        </Show>
      </box>
      
      {/* Token Breakdown */}
      <box
        flexDirection="column"
        padding={1}
        border={["bottom"]}
        borderColor={theme.border}
        marginBottom={1}
      >
        <text fg={theme.text} marginBottom={1}>
          Token Breakdown
        </text>
        <StatRow 
          label="Input Tokens" 
          value={stats().inputTokens.toLocaleString()} 
        />
        <StatRow 
          label="Output Tokens" 
          value={stats().outputTokens.toLocaleString()} 
        />
        <StatRow 
          label="Total Tokens" 
          value={stats().totalTokens.toLocaleString()} 
          color={theme.accent}
        />
        <StatRow 
          label="Avg per Message" 
          value={stats().avgTokensPerMessage.toLocaleString()} 
        />
      </box>
      
      {/* Cost */}
      <Show when={stats().totalCost > 0}>
        <box
          flexDirection="column"
          padding={1}
          border={["bottom"]}
          borderColor={theme.border}
          marginBottom={1}
        >
          <text fg={theme.text} marginBottom={1}>
            Cost
          </text>
          <StatRow 
            label="Total Cost" 
            value={`$${stats().totalCost.toFixed(4)}`}
            color={theme.success}
          />
        </box>
      </Show>
      
      {/* Tips */}
      <box flexDirection="column" padding={1}>
        <text fg={theme.textMuted} attributes={TextAttributes.ITALIC}>
          Tips:
        </text>
        <Show when={usagePercent() > 80}>
          <text fg={theme.warning}>
            Context window is getting full. Consider starting a new session.
          </text>
        </Show>
        <Show when={usagePercent() <= 80}>
          <text fg={theme.textMuted}>
            Type /compact to reduce context usage
          </text>
        </Show>
      </box>
    </box>
  )
}
