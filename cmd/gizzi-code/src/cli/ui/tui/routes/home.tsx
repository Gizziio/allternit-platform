
import { Prompt, type PromptRef } from "@/cli/ui/tui/component/prompt"
import { createEffect, createMemo, createSignal, For, Match, onMount, Show, Switch } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { Log } from "@/shared/util/log"
import { GIZZIMascot } from "@/cli/ui/components/gizzi/mascot"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { Tips } from "@/cli/ui/tui/component/tips"
import { Locale } from "@/shared/util/locale"
import { useSync } from "@/cli/ui/tui/context/sync"
import { Toast } from "@/cli/ui/tui/ui/toast"
import { useArgs } from "@/cli/ui/tui/context/args"
import { useDirectory } from "@/cli/ui/tui/context/directory"
import { useRouteData } from "@/cli/ui/tui/context/route"
import { usePromptRef } from "@/cli/ui/tui/context/prompt"
import { Installation } from "@/shared/installation"
import { useKV } from "@/cli/ui/tui/context/kv"
import { useCommandDialog } from "@/cli/ui/tui/component/dialog-command"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { DialogWorkspace } from "@/cli/ui/tui/component/dialog-workspace"
import { useTerminalDimensions } from "@opentui/solid"
import { RGBA, TextAttributes } from "@opentui/core"
import { WelcomeScreen } from "@/cli/ui/tui/component/welcome"
import { StartupFlow } from "@/cli/ui/tui/component/startup-flow"
import { isStartupFlowActive } from "@/cli/ui/tui/component/startup-flow-state"
import { ModeSwitcher, useMode } from "@/cli/ui/tui/component/mode-switcher"
import { AgentToggle, useAgent } from "@/cli/ui/tui/component/agent-toggle"
import { DiscretionaryScreen } from "@/cli/ui/tui/component/discretionary-screen"
import { DialogSessionList } from "@/cli/ui/tui/component/dialog-session-list"
import { useRoute } from "@/cli/ui/tui/context/route"
import { useLocal } from "@/cli/ui/tui/context/local"

// Track whether initial prompt has been applied (persists across re-renders)
let initialPromptApplied = false
// Track whether discretionary screen has been shown this boot session
// FORCE SHOW: Set to false so screen shows every boot for testing
let shownThisSession: boolean = false

// Claude Code Style Welcome Header - Full Width at Top (Compact)
function HomeWelcome() {
  const { theme } = useTheme()
  const sync = useSync()
  const local = useLocal()
  const dialog = useDialog()
  const accent = RGBA.fromInts(212, 176, 140)
  const sand = RGBA.fromInts(212, 176, 140)
  const gizziCyan = RGBA.fromInts(86, 182, 194)
  const workspaceColor = RGBA.fromInts(167, 139, 250) // purple for workspace

  // Get user info from sync data (Clerk + Settings)
  const userInfo = createMemo(() => {
    if (!sync?.data) return { firstName: "", email: "", org: "Personal", isLoggedIn: false }
    const user = sync.data.user
    const firstName = user?.firstName || user?.name?.split(' ')[0]
    return {
      firstName: firstName || "",
      email: user?.email || "",
      org: user?.organization || "Personal",
      isLoggedIn: !!user?.email
    }
  })

  // Workspace identity (from .gizzi/ or .openclaw/)
  const workspace = createMemo(() => sync.data.workspace)
  const agentName = createMemo(() => workspace()?.name ?? workspace()?.emoji ?? null)

  // Get currently selected model from local context (respects /model selection, config, and defaults)
  const currentModel = createMemo(() => {
    const parsed = local.model.parsed()
    return `${String(parsed.provider || "Unknown")}: ${String(parsed.model || "Unknown")}`
  })

  // Recent sessions - limit to 5
  const recentActivity = createMemo(() => {
    if (!sync?.data) return []
    const sessions = sync.data.session
    if (!sessions || !Array.isArray(sessions)) return []
    return [...sessions]
      .filter((s: any) => !s.parentID)
      .sort((a: any, b: any) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0))
      .slice(0, 5)
      .map((s: any) => ({
        time: formatTimeAgo(s.time?.updated),
        label: String(s.title || s.name || "Untitled Session"),
        id: String(s.id || "")
      }))
  })

  // What's new
  const whatsNew = createMemo(() => [
    {
      title: "GizziClaw Workspace",
      description: "Agent identity via .gizzi/ (OpenClaw-compatible)",
      type: "feature"
    },
    {
      title: "Full tool list",
      description: "List, MultiEdit, WebSearch, CodeSearch, PlanMode",
      type: "feature"
    }
  ])

  // Personalized welcome message — prefer agent name from workspace
  const welcomeMessage = createMemo(() => {
    if (agentName()) return `${agentName()} is ready`
    const firstName = userInfo().firstName
    if (firstName) return `Welcome back, ${firstName}!`
    if (userInfo().email) return `Welcome back!`
    return "Welcome to Gizzi Code"
  })

  function openWorkspaceDialog() {
    dialog.replace(() => <DialogWorkspace />)
  }

  return (
    <box 
      flexDirection="column" 
      width="100%"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
    >
      {/* Compact Welcome Card - Full Width */}
      <box
        borderStyle="single"
        borderColor={accent}
        paddingX={2}
        paddingY={1}
        flexDirection="row"
        gap={3}
        width="100%"
      >
        {/* Left: GIZZI Mascot + User/Agent Info */}
        <box flexDirection="column" gap={0} width={30} alignItems="center">
          <GIZZIMascot state="idle" compact={false} />
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            {welcomeMessage()}
          </text>
          {/* Workspace identity badge */}
          <Show when={workspace()}>
            {(ws) => (
              <box
                flexDirection="row"
                gap={1}
                borderStyle="single"
                borderColor={RGBA.fromInts(167, 139, 250, 80)}
                paddingX={1}
                onMouseUp={openWorkspaceDialog}
              >
                <Show when={ws().emoji}>
                  <text fg={workspaceColor}>{ws().emoji}</text>
                </Show>
                <text fg={workspaceColor}>
                  {ws().type === "openclaw"
                    ? "openclaw"
                    : (ws() as any).layered
                      ? "a2r workspace"
                      : "gizzi"}
                </text>
                <text fg={theme.textMuted}>
                  {(ws() as any).layered ? "5-layer" : "workspace"}
                </text>
              </box>
            )}
          </Show>
          <Show when={!workspace()}>
            <text fg={theme.textMuted} onMouseUp={openWorkspaceDialog}>
              [no workspace]
            </text>
          </Show>
          <Show when={userInfo().email}>
            <text fg={gizziCyan}>
              {userInfo().email}
            </text>
          </Show>
          <text fg={theme.textMuted}>
            {userInfo().org}
          </text>
          <text fg={sand}>
            {currentModel()}
          </text>
        </box>

        {/* Vertical Divider */}
        <box 
          width={1} 
          borderStyle="single" 
          borderColor={RGBA.fromInts(212, 176, 140, 100)}
        />

        {/* Right: Recent Activity + What's New */}
        <box flexDirection="column" gap={1} flexGrow={1}>
          {/* Recent Activity */}
          <box flexDirection="column" gap={0}>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
              Recent activity
            </text>
            <For each={recentActivity()}>
              {(item) => (
                <text fg={theme.text}>
                  {item.time}  {item.label}
                </text>
              )}
            </For>
            <Show when={recentActivity().length === 0}>
              <text fg={theme.textMuted}>
                No recent sessions - Start with /new
              </text>
            </Show>
          </box>

          {/* Horizontal Divider */}
          <box 
            height={1} 
            borderStyle="single" 
            borderColor={RGBA.fromInts(212, 176, 140, 50)}
            marginY={1}
          />

          {/* What's New */}
          <box flexDirection="column" gap={0}>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
              What's new
            </text>
            <For each={whatsNew()}>
              {(item) => (
                <box flexDirection="row" gap={1}>
                  <text 
                    fg={item.type === "feature" ? theme.success : theme.text} 
                    attributes={TextAttributes.BOLD}
                  >
                    {item.type === "feature" ? "+" : "•"}
                  </text>
                  <text fg={theme.text}>
                    {item.title}
                  </text>
                </box>
              )}
            </For>
          </box>
        </box>
      </box>
    </box>
  )
}

// Helper: Format timestamp as time ago
function formatTimeAgo(timestamp: number | undefined): string {
  if (!timestamp || typeof timestamp !== 'number') return "Unknown"
  const now = Date.now()
  const diff = now - timestamp
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function Home() {
  Log.Default.info("tui: Home component executing")
  const sync = useSync()
  const kv = useKV()
  const { theme } = useTheme()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const command = useCommandDialog()
  const dialog = useDialog()
  const dimensions = useTerminalDimensions()
  const { mode, setMode } = useMode()
  const navigation = useRoute()
  const { enabled: agentEnabled, toggle: toggleAgent } = useAgent()
  const startupWorkspace = createMemo(() => sync.data.path.directory || process.cwd())
  const startupActive = createMemo(() =>
    isStartupFlowActive({
      kv,
      syncStatus: sync.data.status,
      workspace: startupWorkspace(),
    }),
  )

  const [discretionaryActive, setDiscretionaryActive] = createSignal(false)

  // Show discretionary screen once per boot after sync is ready and startup flow is not active
  createEffect(() => {
    const syncStatus = sync.data.status
    const isStartupActive = startupActive()

    if (syncStatus === "loading") return
    if (isStartupActive) return
    if (shownThisSession) return

    setDiscretionaryActive(true)
  })

  const handleDiscretionaryAccept = (action: string) => {
    shownThisSession = true
    setDiscretionaryActive(false)

    if (action === "resume") {
      // Open session list dialog to choose which session to resume
      Log.Default.info("tui: Home - Opening session list dialog")
      dialog.replace(() => <DialogSessionList />)
    } else if (action === "code") {
      setMode("code")
    } else if (action === "cowork") {
      navigation.navigate({ type: "cowork" })
    } else if (action === "new") {
      // Stay on home, prompt will be focused
    }
  }

  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((s: any) => s?.status === "error")
  })
  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((s: any) => s?.status === "connected").length
  })
  const mcp = createMemo(() => Object.keys(sync.data.mcp).length > 0)

  const isFirstTimeUser = createMemo(() => sync.data.session.length === 0)
  const hasNoProviders = createMemo(() => sync.data.provider.length === 0)
  const showWelcome = createMemo(() => isFirstTimeUser() && hasNoProviders())
  const tipsHidden = createMemo(() => kv.get("tips_hidden", false))
  const showTips = createMemo(() => {
    // Don't show tips for first-time users or when welcome is shown
    if (isFirstTimeUser() || showWelcome()) return false
    return !tipsHidden()
  })

  command.register(() => [
    {
      title: tipsHidden() ? "Show tips" : "Hide tips",
      value: "tips.toggle",
      keybind: "tips_toggle",
      category: "System",
      onSelect: (dialog) => {
        kv.set("tips_hidden", !tipsHidden())
        dialog.clear()
      },
    },
    {
      title: sync.data.workspace ? "Manage workspace" : "Initialize workspace",
      value: "workspace.open",
      category: "Workspace",
      onSelect: (d) => {
        d.clear()
        dialog.replace(() => <DialogWorkspace />)
      },
    },
  ])

  const Hint = (
    <Show when={connectedMcpCount() > 0}>
      <box flexShrink={0} flexDirection="row" gap={1}>
        <text fg={theme.text}>
          <Switch>
            <Match when={mcpError()}>
              <span style={{ fg: theme.error }}>•</span> mcp errors{" "}
              <span style={{ fg: theme.textMuted }}>ctrl+x s</span>
            </Match>
            <Match when={true}>
              <span style={{ fg: theme.success }}>•</span>{" "}
              {Locale.pluralize(connectedMcpCount(), "{} mcp server", "{} mcp servers")}
            </Match>
          </Switch>
        </text>
      </box>
    </Show>
  )

  let prompt: PromptRef
  const args = useArgs()
  const [autoSubmitPending, setAutoSubmitPending] = createSignal(false)

  const readyForAutoSubmit = createMemo(() => {
    return sync.data.agent.length > 0 && sync.data.provider.length > 0
  })

  onMount(() => {
    if (initialPromptApplied) return
    if (route.initialPrompt) {
      prompt.set(route.initialPrompt)
      initialPromptApplied = true
    } else if (args.prompt) {
      prompt.set({ input: args.prompt, parts: [] })
      initialPromptApplied = true
      setAutoSubmitPending(true)
    }
  })

  createEffect(() => {
    if (!autoSubmitPending()) return
    if (!readyForAutoSubmit()) return
    setAutoSubmitPending(false)
    queueMicrotask(() => prompt.submit())
  })
  const directory = useDirectory()
  const footerReserve = createMemo(() => {
    let reserve = Installation.VERSION.length + 6
    if (mcp()) reserve += `${connectedMcpCount()} MCP`.length + 10
    return reserve
  })
  const directoryLabel = createMemo(() => {
    const limit = Math.max(16, dimensions().width - footerReserve() - 4)
    return truncateMiddle(directory(), limit)
  })

  return (
    <Switch>
      <Match when={startupActive()}>
        <box flexGrow={1} alignItems="stretch" paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
          <StartupFlow />
        </box>
        <box
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          paddingRight={2}
          flexDirection="row"
          flexShrink={0}
          gap={2}
        >
          <text fg={theme.textMuted} wrapMode="none">
            {directoryLabel()}
          </text>
          <box flexGrow={1} />
          <text fg={theme.textMuted}>Setup Mode</text>
          <box flexGrow={1} />
          <text fg={theme.textMuted}>{Installation.VERSION}</text>
        </box>
      </Match>

      <Match when={discretionaryActive()}>
        <DiscretionaryScreen onAccept={handleDiscretionaryAccept} />
      </Match>

      <Match when={true}>
        <>
          {/* TOP SECTION - Full Width Claude Code Style Welcome */}
          <HomeWelcome />

          {/* MAIN CONTENT */}
          <box flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
            <box flexGrow={1} minHeight={0} />
            <box width="100%" maxWidth={75} zIndex={1000} paddingTop={1} flexShrink={0}>
              <Prompt
                ref={(r) => {
                  prompt = r
                  promptRef.set(r)
                }}
                hint={Hint}
              />
            </box>
            <box height={4} minHeight={0} width="100%" maxWidth={75} alignItems="center" paddingTop={3} flexShrink={1}>
              <Show when={showWelcome()}>
                <WelcomeScreen />
              </Show>
              <Show when={showTips()}>
                <Tips />
              </Show>
            </box>
            <box flexGrow={1} minHeight={0} />
            <Toast />
          </box>
        </>
      </Match>
    </Switch>
  )
}

function truncateMiddle(value: string, max: number) {
  if (max <= 0) return ""
  if (value.length <= max) return value
  if (max === 1) return "…"
  const left = Math.ceil((max - 1) / 2)
  const right = Math.floor((max - 1) / 2)
  return `${value.slice(0, left)}…${value.slice(-right)}`
}
