import { useSync } from "@/cli/ui/tui/context/sync"
import { createMemo, createSignal, For, Show, Switch, Match, onMount, createResource } from "solid-js"
import { createStore } from "solid-js/store"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { Locale } from "@/shared/util/locale"
import path from "path"
import type { AssistantMessage } from "@a2r/sdk/v2"
import { Global } from "@/runtime/context/global"
import { Installation } from "@/shared/installation"
import { useKeybind } from "@/cli/ui/tui/context/keybind"
import { useDirectory } from "@/cli/ui/tui/context/directory"
import { useKV } from "@/cli/ui/tui/context/kv"
import { TodoItem } from "@/cli/ui/tui/component/todo-item"
import { GIZZICopy, GIZZIBrand, sanitizeBrandSurface } from "@/shared/brand"
import type { McpStatus } from "@a2r/sdk/v2"
import { SessionUsage } from "@/runtime/session/usage"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { DialogUsage } from "@/cli/ui/tui/component/dialog-usage"
import { GuardPolicy } from "@/runtime/tools/guard"
import { LayerExplorer, type LayerId } from "@/cli/ui/tui/component/layer-explorer"
import * as AgentWorkspaceBridge from "@/runtime/kernel/bridge"

function mcpStatusText(item: McpStatus): string {
  switch (item.status) {
    case "connected":
      return GIZZICopy.sidebar.connected
    case "failed":
      return sanitizeBrandSurface(toDisplayText(item.error)) || GIZZICopy.sidebar.failed
    case "disabled":
      return GIZZICopy.sidebar.disabled
    case "needs_auth":
      return GIZZICopy.sidebar.needsAuth
    case "needs_client_registration":
      return GIZZICopy.sidebar.needsClientID
    default:
      return GIZZICopy.sidebar.unknown
  }
}

export function Sidebar(props: { sessionID: string; overlay?: boolean }) {
  const sync = useSync()
  const { theme } = useTheme()
  const session = createMemo(() => sync.session.get(props.sessionID)!)
  const diff = createMemo(() => sync.data.session_diff[props.sessionID] ?? [])
  const todo = createMemo(() => sync.data.todo[props.sessionID] ?? [])
  const messages = createMemo(() => sync.data.message[props.sessionID] ?? [])

  const [expanded, setExpanded] = createStore({
    mcp: true,
    diff: true,
    todo: true,
    lsp: true,
    usage: false,
    workspace: true,
  })

  const [sessionUsage, setSessionUsage] = createSignal<SessionUsage.SessionUsageSummary | null>(null)
  const dialog = useDialog()

  onMount(async () => {
    const usage = await SessionUsage.getSessionUsage(props.sessionID)
    if (usage) setSessionUsage(usage)
  })

  // Sort MCP servers alphabetically for consistent display order
  const mcpEntries = createMemo(() => Object.entries(sync.data.mcp).sort(([a], [b]) => a.localeCompare(b)))

  // Count connected and error MCP servers for collapsed header display
  const connectedMcpCount = createMemo(() => mcpEntries().filter(([_, item]) => item.status === "connected").length)
  const errorMcpCount = createMemo(
    () =>
      mcpEntries().filter(
        ([_, item]) =>
          item.status === "failed" || item.status === "needs_auth" || item.status === "needs_client_registration",
      ).length,
  )

  const cost = createMemo(() => {
    const total = messages().reduce((sum, x) => sum + (x.role === "assistant" ? x.cost : 0), 0)
    return total
  })

  const context = createMemo(() => {
    const last = messages().findLast((x) => x.role === "assistant" && x.tokens.output > 0) as AssistantMessage
    if (!last) return
    const total =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = sync.data.provider.find((x) => x.id === last.providerID)?.models[last.modelID]
    return {
      tokens: total,
      percentage: model?.limit.context ? Math.round((total / model.limit.context) * 100) : null,
      limit: model?.limit.context,
    }
  })

  // Guard state computation
  const guardState = createMemo(() => {
    const ctx = context()
    if (!ctx?.percentage) return { state: "OK" as const, color: theme.success }
    
    const ratio = ctx.percentage / 100
    if (ratio >= GuardPolicy.THRESHOLDS.HANDOFF) {
      return { state: "HANDOFF" as const, color: theme.error }
    }
    if (ratio >= GuardPolicy.THRESHOLDS.COMPACT) {
      return { state: "COMPACT" as const, color: theme.warning }
    }
    if (ratio >= GuardPolicy.THRESHOLDS.WARN) {
      return { state: "WARN" as const, color: theme.warning }
    }
    return { state: "OK" as const, color: theme.success }
  })

  const directory = useDirectory()
  const kv = useKV()
  
  // Workspace path for agent workspace integration
  const workspacePath = createMemo(() => sync.data.path.directory || process.cwd())
  
  // Detect workspace context
  const [workspaceInfo] = createResource(
    () => workspacePath(),
    (path) => AgentWorkspaceBridge.detectWorkspace(path)
  )
  
  // Handle file selection from LayerExplorer
  const handleFileSelect = (filePath: string, _layer: LayerId) => {
    const editor = process.env.EDITOR || process.env.VISUAL || "vi"
    const fullPath = path.resolve(workspacePath(), filePath)
    try {
      Bun.spawn([editor, fullPath], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      })
    } catch {
      // If editor launch fails, fall back to reading file content as a toast
      Bun.file(fullPath)
        .text()
        .then((content) => {
          const preview = content.slice(0, 500)
          const dialog = useDialog()
          dialog.alert(`${filePath}\n\n${preview}${content.length > 500 ? "\n..." : ""}`)
        })
        .catch(() => {})
    }
  }

  const hasProviders = createMemo(() =>
    sync.data.provider.some((x) => (x.id !== "gizzi" && x.id !== "gizzi") || Object.values(x.models).some((y) => y.cost?.input !== 0)),
  )
  const gettingStartedDismissed = createMemo(() => kv.get("dismissed_getting_started", false))

  return (
    <Show when={session()}>
      <box
        backgroundColor={theme.backgroundPanel}
        width={42}
        height="100%"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        position={props.overlay ? "absolute" : "relative"}
      >
        <scrollbox
          flexGrow={1}
          verticalScrollbarOptions={{
            trackOptions: {
              backgroundColor: theme.background,
              foregroundColor: theme.borderActive,
            },
          }}
        >
          <box flexShrink={0} gap={1} paddingRight={1}>
            <box paddingRight={1}>
              <text fg={theme.text}>
                <b>{session().title}</b>
              </text>
              <Show when={session().share?.url}>
                <text fg={theme.textMuted}>{session().share!.url}</text>
              </Show>
            </box>
            
            {/* Workspace Context Indicator */}
            <Show when={workspaceInfo() && !workspaceInfo.loading}>
              <box 
                flexDirection="row" 
                gap={1} 
                padding={1}
                backgroundColor={theme.backgroundElement}
              >
                <text fg={workspaceInfo()?.type === "openclaw" ? theme.accent : theme.success}>
                  {workspaceInfo()?.type === "openclaw" ? "◈" : "◉"}
                </text>
                <box flexDirection="column">
                  <text fg={theme.text}>
                    <b>{workspaceInfo()?.identity?.name || workspaceInfo()?.type}</b>
                  </text>
                  <text fg={theme.textMuted}>
                    {workspaceInfo()?.type} workspace
                  </text>
                </box>
              </box>
            </Show>
            
            {/* Agent Workspace - Layer Explorer */}
            <box>
              <box
                flexDirection="row"
                gap={1}
                onMouseDown={() => setExpanded("workspace", !expanded.workspace)}
              >
                <text fg={theme.text}>{expanded.workspace ? "▼" : "▶"}</text>
                <text fg={theme.text}>
                  <b>Workspace</b>
                </text>
              </box>
              
              <Show when={expanded.workspace}>
                <box paddingLeft={2}>
                  <LayerExplorer
                    workspacePath={workspacePath()}
                    onFileSelect={handleFileSelect}
                  />
                </box>
              </Show>
            </box>
            
            {/* Usage Section - Collapsible with Visual Bars */}
            <box>
              <box
                flexDirection="row"
                gap={1}
                onMouseDown={() => setExpanded("usage", !expanded.usage)}
              >
                <text fg={theme.text}>{expanded.usage ? "▼" : "▶"}</text>
                <text fg={theme.text}>
                  <b>Usage</b>
                </text>
                <Show when={!expanded.usage}>
                  <text fg={theme.accent}>{SessionUsage.formatCost(cost())}</text>
                </Show>
              </box>
              
              <Show when={expanded.usage}>
                <box flexDirection="column" gap={1} paddingLeft={2}>
                  {/* Cost Card */}
                  <box
                    flexDirection="row"
                    gap={2}
                    padding={1}
                    backgroundColor={theme.backgroundElement}
                    onMouseUp={() => dialog.replace(() => <DialogUsage sessionID={props.sessionID} />)}
                  >
                    <box flexDirection="column">
                      <text fg={theme.accent}>
                        <span style={{ bold: true }}>{SessionUsage.formatCost(cost())}</span>
                      </text>
                      <text fg={theme.textMuted}>spent</text>
                    </box>
                    <box flexDirection="column">
                      <text fg={theme.info}>
                        <span style={{ bold: true }}>{sessionUsage()?.messageCount ?? messages().filter(m => m.role === "assistant").length}</span>
                      </text>
                      <text fg={theme.textMuted}>messages</text>
                    </box>
                  </box>

                  {/* Context Progress Bar */}
                  <Show when={context()}>
                    <box flexDirection="column" gap={1}>
                      <box flexDirection="row" justifyContent="space-between">
                        <text fg={theme.textMuted}>Context</text>
                        <text fg={theme.textMuted}>{context()?.percentage ?? 0}%</text>
                      </box>
                      <ContextProgressBar
                        percentage={context()?.percentage ?? 0}
                        tokens={context()?.tokens ?? 0}
                        limit={context()?.limit}
                      />
                      <text fg={theme.textMuted}>
                        {SessionUsage.formatTokens(context()?.tokens ?? 0)} / {SessionUsage.formatTokens(context()?.limit ?? 0)} tokens
                      </text>
                    </box>
                  </Show>

                  {/* Guard State Indicator */}
                  <box
                    flexDirection="row"
                    gap={1}
                    padding={1}
                    backgroundColor={theme.backgroundElement}
                  >
                    <text fg={theme.textMuted}>Guard:</text>
                    <text fg={guardState().color}>
                      <span style={{ bold: true }}>{guardState().state}</span>
                    </text>
                    <Show when={guardState().state !== "OK"}>
                      <text fg={theme.textMuted}>
                        (Press <span style={{ fg: theme.accent }}>C</span> to compact)
                      </text>
                    </Show>
                  </box>

                  {/* Token Breakdown */}
                  <Show when={sessionUsage()}>
                    <box flexDirection="column" gap={1}>
                      <text fg={theme.textMuted}>This Session</text>
                      <TokenBreakdown usage={sessionUsage()!} />
                    </box>
                  </Show>

                  <text fg={theme.textMuted}>
                    Press <span style={{ fg: theme.accent }}>$</span> for details
                  </text>
                </box>
              </Show>
            </box>
            <Show when={mcpEntries().length > 0}>
              <box>
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={() => mcpEntries().length > 2 && setExpanded("mcp", !expanded.mcp)}
                >
                  <Show when={mcpEntries().length > 2}>
                    <text fg={theme.text}>{expanded.mcp ? "▼" : "▶"}</text>
                  </Show>
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.text}>
                      <b>{GIZZICopy.sidebar.adapters}</b>
                    </text>
                    <Show when={!expanded.mcp}>
                      <text fg={theme.textMuted}>
                        {GIZZICopy.sidebar.mcpSummary({
                          connected: connectedMcpCount(),
                          errors: errorMcpCount(),
                        })}
                      </text>
                    </Show>
                  </box>
                </box>
                <Show when={mcpEntries().length <= 2 || expanded.mcp}>
                  <For each={mcpEntries()}>
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
                              } as Record<string, typeof theme.success>
                            )[item.status],
                          }}
                        >
                          •
                        </text>
                        <box flexDirection="column" flexGrow={1}>
                          <text fg={theme.text} wrapMode="word">
                            {key}
                          </text>
                          <text fg={theme.textMuted} wrapMode="word">
                            {mcpStatusText(item)}
                          </text>
                        </box>
                      </box>
                    )}
                  </For>
                </Show>
              </box>
            </Show>
            <box>
              <box
                flexDirection="row"
                gap={1}
                onMouseDown={() => sync.data.lsp.length > 2 && setExpanded("lsp", !expanded.lsp)}
              >
                <Show when={sync.data.lsp.length > 2}>
                  <text fg={theme.text}>{expanded.lsp ? "▼" : "▶"}</text>
                </Show>
                <text fg={theme.text}>
                  <b>{GIZZICopy.sidebar.runtime}</b>
                </text>
              </box>
              <Show when={sync.data.lsp.length <= 2 || expanded.lsp}>
                <Show when={sync.data.lsp.length === 0}>
                  <text fg={theme.textMuted}>
                    {sync.data.config.lsp === false
                      ? GIZZICopy.sidebar.runtimeDisabled
                      : GIZZICopy.sidebar.runtimeActivate}
                  </text>
                </Show>
                <For each={sync.data.lsp}>
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
                      <text fg={theme.textMuted}>
                        {item.id} {item.root}
                      </text>
                    </box>
                  )}
                </For>
              </Show>
            </box>
            <Show when={todo().length > 0 && todo().some((t) => t.status !== "completed")}>
              <box>
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={() => todo().length > 2 && setExpanded("todo", !expanded.todo)}
                >
                  <Show when={todo().length > 2}>
                    <text fg={theme.text}>{expanded.todo ? "▼" : "▶"}</text>
                  </Show>
                  <text fg={theme.text}>
                    <b>{GIZZICopy.sidebar.workItems}</b>
                  </text>
                </box>
                <Show when={todo().length <= 2 || expanded.todo}>
                  <For each={todo()}>{(todo) => <TodoItem status={todo.status} content={todo.content} />}</For>
                </Show>
              </box>
            </Show>
            <Show when={diff().length > 0}>
              <box>
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={() => diff().length > 2 && setExpanded("diff", !expanded.diff)}
                >
                  <Show when={diff().length > 2}>
                    <text fg={theme.text}>{expanded.diff ? "▼" : "▶"}</text>
                  </Show>
                  <text fg={theme.text}>
                    <b>{GIZZICopy.sidebar.workspaceDelta}</b>
                  </text>
                </box>
                <Show when={diff().length <= 2 || expanded.diff}>
                  <For each={diff() || []}>
                    {(item) => {
                      return (
                        <box flexDirection="row" gap={1} justifyContent="space-between">
                          <text fg={theme.textMuted} wrapMode="none">
                            {item.file}
                          </text>
                          <box flexDirection="row" gap={1} flexShrink={0}>
                            <Show when={item.additions}>
                              <text fg={theme.diffAdded}>+{item.additions}</text>
                            </Show>
                            <Show when={item.deletions}>
                              <text fg={theme.diffRemoved}>-{item.deletions}</text>
                            </Show>
                          </box>
                        </box>
                      )
                    }}
                  </For>
                </Show>
              </box>
            </Show>
          </box>
        </scrollbox>

        <box flexShrink={0} gap={1} paddingTop={1}>
          <Show when={!hasProviders() && !gettingStartedDismissed()}>
            <box
              backgroundColor={theme.backgroundElement}
              paddingTop={1}
              paddingBottom={1}
              paddingLeft={2}
              paddingRight={2}
              flexDirection="row"
              gap={1}
            >
              <text flexShrink={0} fg={theme.text}>
                ⬖
              </text>
              <box flexGrow={1} gap={1}>
                <box flexDirection="row" justifyContent="space-between">
                  <text fg={theme.text}>
                    <b>{GIZZICopy.sidebar.onboardingTitle}</b>
                  </text>
                  <text fg={theme.textMuted} onMouseDown={() => kv.set("dismissed_getting_started", true)}>
                    ✕
                  </text>
                </box>
                <text fg={theme.textMuted}>{GIZZICopy.sidebar.onboardingBodyPrimary}</text>
                <text fg={theme.textMuted}>{GIZZICopy.sidebar.onboardingBodySecondary}</text>
                <box flexDirection="row" gap={1} justifyContent="space-between">
                  <text fg={theme.text}>{GIZZICopy.sidebar.connectProviders}</text>
                  <text fg={theme.textMuted}>/connect</text>
                </box>
              </box>
            </box>
          </Show>
          <text>
            <span style={{ fg: theme.textMuted }}>{directory().split("/").slice(0, -1).join("/")}/</span>
            <span style={{ fg: theme.text }}>{directory().split("/").at(-1)}</span>
          </text>
          <text fg={theme.textMuted}>
            <span style={{ fg: theme.success }}>•</span> <b>{GIZZIBrand.name}</b>
            <span style={{ fg: theme.text }}>
              <b>{GIZZIBrand.productLine}</b>
            </span>{" "}
            <span>{Installation.VERSION}</span>
          </text>
        </box>
      </box>
    </Show>
  )
}

function toDisplayText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value)
  }
  if (value instanceof Error) return value.message || String(value)
  if (Array.isArray(value)) return value.map((item) => toDisplayText(item)).join(", ")
  try {
    const json = JSON.stringify(value)
    if (json && json !== "{}") return json
  } catch {}
  try {
    const rendered = String(value)
    if (rendered && rendered !== "[object Object]") return rendered
  } catch {}
  return ""
}

// Visual progress bar for context usage
function ContextProgressBar(props: {
  percentage: number
  tokens: number
  limit?: number
}) {
  const { theme } = useTheme()
  const width = 28
  
  const color = () => {
    if (props.percentage >= 90) return theme.error
    if (props.percentage >= 75) return theme.warning
    return theme.success
  }
  
  const filled = () => Math.round((Math.min(props.percentage, 100) / 100) * width)
  const empty = () => width - filled()
  
  return (
    <box flexDirection="row">
      <text fg={color()}>
        {"█".repeat(filled())}
      </text>
      <text fg={theme.backgroundElement}>
        {"█".repeat(empty())}
      </text>
    </box>
  )
}

// Token breakdown by type
function TokenBreakdown(props: {
  usage: SessionUsage.SessionUsageSummary
}) {
  const { theme } = useTheme()
  const usage = props.usage
  
  // Calculate breakdown from all messages
  const total = usage.total.tokens
  
  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.textMuted}>Total tokens</text>
        <text fg={theme.text}>{SessionUsage.formatTokens(total)}</text>
      </box>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.textMuted}>Messages</text>
        <text fg={theme.text}>{usage.messageCount}</text>
      </box>
      <For each={Object.entries(usage.byModel).slice(0, 3)}>
        {([model, data]) => (
          <box flexDirection="row" justifyContent="space-between">
            <text fg={theme.textMuted}>{model.split('/').pop()?.slice(0, 15)}</text>
            <text fg={theme.accent}>{SessionUsage.formatCost(data.cost)}</text>
          </box>
        )}
      </For>
    </box>
  )
}


