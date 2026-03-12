import { Prompt, type PromptRef } from "@/cli/ui/tui/component/prompt"
import { createEffect, createMemo, createSignal, Match, onMount, Show, Switch } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { Log } from "@/shared/util/log"
import { Logo } from "@/cli/ui/tui/component/logo"
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
import { useTerminalDimensions } from "@opentui/solid"
import { WelcomeScreen } from "@/cli/ui/tui/component/welcome"
import { StartupFlow } from "@/cli/ui/tui/component/startup-flow"
import { isStartupFlowActive } from "@/cli/ui/tui/component/startup-flow-state"
import { ModeSwitcher, useMode } from "@/cli/ui/tui/component/mode-switcher"
import { AgentToggle, useAgent } from "@/cli/ui/tui/component/agent-toggle"

// Track whether initial prompt has been applied (persists across re-renders)
let initialPromptApplied = false

export function Home() {
  Log.Default.info("tui: Home component executing")
  const sync = useSync()
  const kv = useKV()
  const { theme } = useTheme()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const command = useCommandDialog()
  const dimensions = useTerminalDimensions()
  const { mode, setMode } = useMode()
  const { enabled: agentEnabled, toggle: toggleAgent } = useAgent()
  const mcp = createMemo(() => Object.keys(sync.data.mcp).length > 0)
  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((x) => x.status === "failed")
  })
  const startupWorkspace = createMemo(() => sync.data.path.directory || process.cwd())
  const startupActive = createMemo(() =>
    isStartupFlowActive({
      kv,
      syncStatus: sync.status,
      workspace: startupWorkspace(),
    }),
  )

  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length
  })

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

  if (startupActive()) {
    return (
      <>
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
      </>
    )
  }

  return (
    <>
      {/* HEADER BAR - TOP with Mode Switcher & Agent Toggle */}
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
        <box gap={1} flexDirection="row" flexShrink={0}>
          <Show when={mcp()}>
            <text fg={theme.text}>
              <Switch>
                <Match when={mcpError()}>
                  <span style={{ fg: theme.error }}>⊙ </span>
                </Match>
                <Match when={true}>
                  <span style={{ fg: connectedMcpCount() > 0 ? theme.success : theme.textMuted }}>⊙ </span>
                </Match>
              </Switch>
              {connectedMcpCount()} MCP
            </text>
            <text fg={theme.textMuted}>/status</text>
          </Show>
        </box>
        <box flexGrow={1} />
        <box flexDirection="row" gap={2} alignItems="center">
          <ModeSwitcher 
            activeMode={mode} 
            onModeChange={(newMode) => {
              setMode(newMode)
              if (newMode === "cowork") {
                route.navigate({ type: "cowork" })
              } else {
                route.navigate({ type: "home" })
              }
            }} 
            size="small" 
            showLabels={true} 
          />
          <AgentToggle 
            enabled={agentEnabled} 
            onToggle={toggleAgent} 
            size="small" 
          />
        </box>
        <box flexShrink={0}>
          <text fg={theme.textMuted}>{Installation.VERSION}</text>
        </box>
      </box>
      
      {/* MAIN CONTENT */}
      <box flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
        <box flexGrow={1} minHeight={0} />
        <box height={4} minHeight={0} flexShrink={1} />
        <box flexShrink={0}>
          <Logo />
        </box>
        <box height={1} minHeight={0} flexShrink={1} />
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
