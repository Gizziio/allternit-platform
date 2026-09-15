import { TextAttributes } from "@opentui/core"
import { fileURLToPath } from "bun"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useSync } from "@/cli/ui/tui/context/sync"
import { For, Match, Switch, Show, createMemo } from "solid-js"
import { GIZZICopy } from "@/shared/brand"
import { useLocal } from "@/cli/ui/tui/context/local"
import { useRoute } from "@/cli/ui/tui/context/route"
import type { RGBA } from "@opentui/core"

export type DialogStatusProps = {}

// Local type definitions (SDK exports as unknown)
interface SessionStatus {
  type: "idle" | "busy" | "retry" | "error"
}

interface ToolPart {
  type: "tool"
  state: {
    status: "pending" | "running" | "completed" | "failed"
  }
}

type Part = ToolPart | { type: string }

interface MessageTokens {
  input: number
  output: number
  reasoning: number
  cache: {
    read: number
    write: number
  }
  total?: number
}

interface AssistantMessage {
  role: "assistant"
  tokens: MessageTokens
  cost: number
}

interface FormatterStatus {
  name: string
  enabled: boolean
}

interface LspStatus {
  id: string
  status: "connected" | "error"
  root: string
}

interface McpStatus {
  status: "connected" | "failed" | "disabled" | "needs_auth" | "needs_client_registration"
  error?: string
}

export function DialogStatus() {
  const sync = useSync()
  const { theme } = useTheme()
  const dialog = useDialog()
  const local = useLocal()
  const route = useRoute()

  const enabledFormatters = createMemo(() => (sync.data.formatter as FormatterStatus[]).filter((f) => f.enabled))
  const parsedModel = createMemo(() => local.model.parsed())
  const busySessions = createMemo(
    () => Object.values(sync.data.session_status as unknown as Record<string, SessionStatus>).filter((status) => status.type === "busy").length,
  )
  const retryingSessions = createMemo(
    () => Object.values(sync.data.session_status as unknown as Record<string, SessionStatus>).filter((status) => status.type === "retry").length,
  )
  const activeTools = createMemo(() =>
    Object.values(sync.data.part as unknown as Record<string, Part[]>).reduce((count, parts) => {
      const running = parts.filter(
        (part): part is ToolPart => part.type === "tool" && ((part as ToolPart).state.status === "pending" || (part as ToolPart).state.status === "running"),
      )
      return count + running.length
    }, 0),
  )
  const currentSessionID = createMemo(() => (route.data.type === "session" ? route.data.sessionID : undefined))
  const latestAssistant = createMemo(() => {
    const sessionID = currentSessionID()
    if (!sessionID) return undefined
    const messages = sync.data.message[sessionID] ?? []
    return (messages as unknown as AssistantMessage[]).findLast(
      (message): message is AssistantMessage =>
        message.role === "assistant",
    )
  })
  const latestTurnMetrics = createMemo(() => {
    const assistant = latestAssistant()
    if (!assistant) return undefined
    const contextTokens = assistant.tokens.input + assistant.tokens.cache.read
    const totalTokens =
      assistant.tokens.total ??
      assistant.tokens.input +
        assistant.tokens.output +
        assistant.tokens.reasoning +
        assistant.tokens.cache.read +
        assistant.tokens.cache.write
    return {
      contextTokens,
      totalTokens,
      cost: assistant.cost,
    }
  })

  const plugins = createMemo(() => {
    const list = (sync.data.config as { plugin?: string[] }).plugin ?? []
    const result = list.map((value: string) => {
      if (value.startsWith("file://")) {
        const path = fileURLToPath(value)
        const parts = path.split("/")
        const filename = parts.pop() || path
        if (!filename.includes(".")) return { name: filename }
        const basename = filename.split(".")[0]
        if (basename === "index") {
          const dirname = parts.pop()
          const name = dirname || basename
          return { name }
        }
        return { name: basename }
      }
      const index = value.lastIndexOf("@")
      if (index <= 0) return { name: value, version: "latest" }
      const name = value.substring(0, index)
      const version = value.substring(index + 1)
      return { name, version }
    })
    return result.slice().sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          {GIZZICopy.dialog.statusTitle}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <box>
        <text fg={theme.text}>{GIZZICopy.dialog.runtimeSummaryTitle}</text>
        <box flexDirection="row" gap={2} flexWrap="wrap">
          <text fg={theme.text}>
            <span style={{ fg: theme.textMuted }}>{GIZZICopy.dialog.runtimeModel}</span>{" "}
            <span style={{ fg: theme.text }}>{parsedModel().model}</span>
          </text>
          <text fg={theme.text}>
            <span style={{ fg: theme.textMuted }}>{GIZZICopy.dialog.runtimeProvider}</span>{" "}
            <span style={{ fg: theme.text }}>{parsedModel().provider}</span>
          </text>
          <text fg={theme.text}>
            <span style={{ fg: theme.textMuted }}>{GIZZICopy.dialog.runtimeBusySessions}</span>{" "}
            <span style={{ fg: theme.text }}>{String(busySessions())}</span>
          </text>
          <text fg={theme.text}>
            <span style={{ fg: theme.textMuted }}>{GIZZICopy.dialog.runtimeRetryingSessions}</span>{" "}
            <span style={{ fg: retryingSessions() > 0 ? theme.warning : theme.text }}>{String(retryingSessions())}</span>
          </text>
          <text fg={theme.text}>
            <span style={{ fg: theme.textMuted }}>{GIZZICopy.dialog.runtimeActiveTools}</span>{" "}
            <span style={{ fg: activeTools() > 0 ? theme.accent : theme.text }}>{String(activeTools())}</span>
          </text>
          <Show when={latestTurnMetrics()}>
            {(metrics) => (
              <>
                <text fg={theme.text}>
                  <span style={{ fg: theme.textMuted }}>{GIZZICopy.dialog.runtimeContextTokens}</span>{" "}
                  <span style={{ fg: theme.text }}>{metrics().contextTokens.toLocaleString()}</span>
                </text>
                <text fg={theme.text}>
                  <span style={{ fg: theme.textMuted }}>{GIZZICopy.dialog.runtimeTotalTokens}</span>{" "}
                  <span style={{ fg: theme.text }}>{metrics().totalTokens.toLocaleString()}</span>
                </text>
                <text fg={theme.text}>
                  <span style={{ fg: theme.textMuted }}>{GIZZICopy.dialog.runtimeCost}</span>{" "}
                  <span style={{ fg: theme.text }}>${metrics().cost.toFixed(4)}</span>
                </text>
              </>
            )}
          </Show>
        </box>
      </box>
      <Show when={Object.keys(sync.data.mcp).length > 0} fallback={<text fg={theme.text}>{GIZZICopy.dialog.noAdapters}</text>}>
        <box>
          <text fg={theme.text}>{GIZZICopy.dialog.adapters({ count: Object.keys(sync.data.mcp).length })}</text>
          <For each={Object.entries(sync.data.mcp)}>
            {([key, item]) => (
              <box flexDirection="row" gap={1}>
                <text
                  flexShrink={0}
                  style={{
                    fg: (
                      {
                        connected: theme.success,
                        failed: theme.error,
                        disabled: theme.textMuted,
                        needs_auth: theme.warning,
                        needs_client_registration: theme.error,
                      } as Record<string, RGBA>
                    )[(item as McpStatus).status],
                  }}
                >
                  •
                </text>
                <text fg={theme.text} wrapMode="word">
                  <b>{key}</b>{" "}
                  <span style={{ fg: theme.textMuted }}>
                    <Switch fallback={(item as McpStatus).status}>
                      <Match when={(item as McpStatus).status === "connected"}>{GIZZICopy.sidebar.connected}</Match>
                      <Match when={(item as McpStatus).status === "failed" && item}>{(val) => (val() as McpStatus).error}</Match>
                      <Match when={(item as McpStatus).status === "disabled"}>{GIZZICopy.dialog.mcpDisabled}</Match>
                      <Match when={(item as McpStatus).status === "needs_auth"}>
                        {GIZZICopy.dialog.mcpNeedsAuth({ name: key })}
                      </Match>
                      <Match when={(item as McpStatus).status === "needs_client_registration" && item}>
                        {(val) => (val() as McpStatus).error}
                      </Match>
                    </Switch>
                  </span>
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>
      {sync.data.lsp.length > 0 && (
        <box>
          <text fg={theme.text}>{GIZZICopy.dialog.lspServers({ count: sync.data.lsp.length })}</text>
          <For each={sync.data.lsp as LspStatus[]}>
            {(item) => (
              <box flexDirection="row" gap={1}>
                <text
                  flexShrink={0}
                  style={{
                    fg: {
                      connected: theme.success,
                      error: theme.error,
                    }[item.status],
                  }}
                >
                  •
                </text>
                <text fg={theme.text} wrapMode="word">
                  <b>{item.id}</b> <span style={{ fg: theme.textMuted }}>{item.root}</span>
                </text>
              </box>
            )}
          </For>
        </box>
      )}
      <Show when={enabledFormatters().length > 0} fallback={<text fg={theme.text}>{GIZZICopy.dialog.noFormatters}</text>}>
        <box>
          <text fg={theme.text}>{GIZZICopy.dialog.formatters({ count: enabledFormatters().length })}</text>
          <For each={enabledFormatters()}>
            {(item) => (
              <box flexDirection="row" gap={1}>
                <text
                  flexShrink={0}
                  style={{
                    fg: theme.success,
                  }}
                >
                  •
                </text>
                <text wrapMode="word" fg={theme.text}>
                  <b>{item.name}</b>
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>
      <Show when={plugins().length > 0} fallback={<text fg={theme.text}>{GIZZICopy.dialog.noPlugins}</text>}>
        <box>
          <text fg={theme.text}>{GIZZICopy.dialog.plugins({ count: plugins().length })}</text>
          <For each={plugins()}>
            {(item) => (
              <box flexDirection="row" gap={1}>
                <text
                  flexShrink={0}
                  style={{
                    fg: theme.success,
                  }}
                >
                  •
                </text>
                <text wrapMode="word" fg={theme.text}>
                  <b>{item.name}</b>
                  {item.version && <span style={{ fg: theme.textMuted }}> @{item.version}</span>}
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  )
}
