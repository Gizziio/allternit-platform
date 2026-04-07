import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { Clipboard } from "@/cli/ui/tui/util/clipboard"
import { Log } from "@/runtime/util/log"

const log = Log.create({ service: "tui.app" })

import { Selection } from "@/cli/ui/tui/util/selection"
import { MouseButton, TextAttributes } from "@opentui/core"
import { RouteProvider, useRoute } from "@/cli/ui/tui/context/route"
import type { Accessor } from "solid-js"
import { Switch, Match, createEffect, createMemo, onCleanup, untrack, ErrorBoundary, createSignal, onMount, Show, on } from "solid-js"
import { win32DisableProcessedInput, win32FlushInputBuffer, win32InstallCtrlCGuard } from "@/cli/ui/tui/win32"
import { Installation } from "@/runtime/installation/installation"
import { DialogProvider, useDialog } from "@/cli/ui/tui/ui/dialog"
import { DialogProvider as DialogProviderList } from "@/cli/ui/tui/component/dialog-provider"
import { SDKProvider, useSDK } from "@/cli/ui/tui/context/sdk"
import { SyncProvider, useSync } from "@/cli/ui/tui/context/sync"
import { LocalProvider, useLocal } from "@/cli/ui/tui/context/local"
import { DialogModel, useConnected } from "@/cli/ui/tui/component/dialog-model"
import { DialogMcp } from "@/cli/ui/tui/component/dialog-mcp"
import { DialogStatus } from "@/cli/ui/tui/component/dialog-status"
import { DialogThemeList } from "@/cli/ui/tui/component/dialog-theme-list"
import { DialogHelp } from "@/cli/ui/tui/ui/dialog-help"
import { CommandProvider, useCommandDialog } from "@/cli/ui/tui/component/dialog-command"
import { DialogAgent } from "@/cli/ui/tui/component/dialog-agent"
import { DialogAgentManager } from "@/cli/ui/tui/component/dialog-agent-manager"
import { DialogCronList } from "@/cli/ui/tui/component/dialog-cron-list"
import { DialogSessionList } from "@/cli/ui/tui/component/dialog-session-list"
import { KeybindProvider } from "@/cli/ui/tui/context/keybind"
import { ThemeProvider, useTheme } from "@/cli/ui/tui/context/theme"
import { Home } from "@/cli/ui/tui/routes/home"
import { Session } from "@/cli/ui/tui/routes/session"
import { AgentMode } from "@/cli/ui/tui/routes/agent-mode"
import { BackgroundTasks } from "@/cli/ui/tui/routes/background-tasks"
import { PromptHistoryProvider } from "@/cli/ui/tui/component/prompt/history"
import { FrecencyProvider } from "@/cli/ui/tui/component/prompt/frecency"
import { PromptStashProvider } from "@/cli/ui/tui/component/prompt/stash"
import { DialogAlert } from "@/cli/ui/tui/ui/dialog-alert"
import { ToastProvider, useToast } from "@/cli/ui/tui/ui/toast"
import { ExitProvider, useExit } from "@/cli/ui/tui/context/exit"
import { Session as SessionApi } from "@/runtime/session/session"
import type { Session as SessionType } from "@allternit/sdk"
import { TuiEvent } from "@/cli/ui/tui/event"
import { KVProvider, useKV } from "@/cli/ui/tui/context/kv"
import { Provider } from "@/runtime/providers/provider"
import { ArgsProvider, useArgs, type Args } from "@/cli/ui/tui/context/args"
import open from "open"
import { writeHeapSnapshot } from "v8"
import { PromptRefProvider, usePromptRef } from "@/cli/ui/tui/context/prompt"
import { GIZZI_BRAND, ShimmeringBanner } from "@/cli/ui/components/gizzi"
import { GIZZICopy, GIZZIFlag } from "@/runtime/brand/brand"
import { AnimationProvider } from "@/cli/ui/components/animation"
import { isStartupFlowActive } from "@/cli/ui/tui/component/startup-flow-state"
import { RGBA } from "@opentui/core"

type SessionErrorShape = {
  name?: unknown
  message?: unknown
  data?: { message?: unknown } | unknown
  error?: { message?: unknown } | unknown
}

const ANIMATION_SPEED_STEPS = [4, 8, 12, 20] as const

function defaultAnimationTickRate() {
  const profile = (process.env.GIZZI_TUI_ANIMATION_PROFILE ?? "calm").trim().toLowerCase()
  if (profile === "minimal") return 4
  if (profile === "full") return 16
  return 8
}

async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
  // can't set raw mode if not a TTY
  if (!process.stdin.isTTY) return "dark"

  return new Promise((resolve) => {
    let timeout: NodeJS.Timeout

    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.removeListener("data", handler)
      clearTimeout(timeout)
    }

    const handler = (data: Buffer) => {
      const str = data.toString()
      const match = str.match(/\x1b]11;([^\x07\x1b]+)/)
      if (match) {
        cleanup()
        const color = match[1]
        // Parse RGB values from color string
        // Formats: rgb:RR/GG/BB or #RRGGBB or rgb(R,G,B)
        let r = 0,
          g = 0,
          b = 0

        if (color.startsWith("rgb:")) {
          const parts = color.substring(4).split("/")
          r = parseInt(parts[0], 16) >> 8 // Convert 16-bit to 8-bit
          g = parseInt(parts[1], 16) >> 8 // Convert 16-bit to 8-bit
          b = parseInt(parts[2], 16) >> 8 // Convert 16-bit to 8-bit
        } else if (color.startsWith("#")) {
          r = parseInt(color.substring(1, 3), 16)
          g = parseInt(color.substring(3, 5), 16)
          b = parseInt(color.substring(5, 7), 16)
        } else if (color.startsWith("rgb(")) {
          const parts = color.substring(4, color.length - 1).split(",")
          r = parseInt(parts[0])
          g = parseInt(parts[1])
          b = parseInt(parts[2])
        }

        // Calculate luminance using relative luminance formula
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

        // Determine if dark or light based on luminance threshold
        resolve(luminance > 0.5 ? "light" : "dark")
      }
    }

    process.stdin.setRawMode(true)
    process.stdin.on("data", handler)
    process.stdout.write("\x1b]11;?\x07")

    timeout = setTimeout(() => {
      cleanup()
      resolve("dark")
    }, 1000)
  })
}

import type { EventSource } from "@/cli/ui/tui/context/sdk"

export function tui(input: {
  url: string
  args: Args
  directory?: string
  fetch?: typeof fetch
  headers?: RequestInit["headers"]
  events?: EventSource
  onExit?: () => Promise<void>
}) {
  Log.Default.info("tui: entry point called")
  // promise to prevent immediate exit
  return new Promise<void>(async (resolve) => {
    const unguard = win32InstallCtrlCGuard()
    win32DisableProcessedInput()

    Log.Default.info("tui: detecting terminal background color")
    const mode = await getTerminalBackgroundColor()
    Log.Default.info("tui: terminal background color detected", { mode })

    // Re-clear after getTerminalBackgroundColor() — setRawMode(false) restores
    // the original console mode which re-enables ENABLE_PROCESSED_INPUT.
    win32DisableProcessedInput()

    // Boot animation: covers the screen for 7 seconds while providers/sync load
    const [booting, setBooting] = createSignal(true)
    setTimeout(() => setBooting(false), 7000)

    const onExit = async () => {
      unguard?.()
      await input.onExit?.()
      resolve()
    }
    const targetFps = (() => {
      const parsed = Number.parseInt(process.env.GIZZI_TUI_TARGET_FPS ?? "30", 10)
      if (!Number.isFinite(parsed)) return 30
      return Math.max(20, Math.min(60, parsed))
    })()

    render(
      () => {
        Log.Default.info("tui: render function called")
        return (
          <ErrorBoundary
            fallback={(error, reset) => <ErrorComponent error={error} reset={reset} onExit={onExit} mode={mode} />}
          >
            {/* Boot animation overlay — solid background covers all content until ready */}
            <Show when={booting()}>
              <box
                position="absolute"
                top={0}
                left={0}
                width="100%"
                height="100%"
                backgroundColor={RGBA.fromInts(10, 10, 15)}
                alignItems="center"
                justifyContent="center"
                zIndex={9999}
              >
                <ShimmeringBanner />
              </box>
            </Show>
            <ArgsProvider {...input.args}>
              <ExitProvider onExit={onExit}>
                <KVProvider>
                  <AnimationProvider
                    tickRate={() => {
                      const kv = useKV()
                      return kv.get("animations_tick_rate", defaultAnimationTickRate())
                    }}
                    enabled={() => {
                      const kv = useKV()
                      return kv.get("animations_enabled", true)
                    }}
                  >
                  <ToastProvider>
                    <RouteProvider>
                      <SDKProvider
                        url={input.url}
                        directory={input.directory}
                        fetch={input.fetch}
                        headers={input.headers}
                        events={input.events}
                      >
                        <SyncProvider>
                          <ThemeProvider mode={mode}>
                            <ProviderTree>
                              <App />
                            </ProviderTree>
                          </ThemeProvider>
                        </SyncProvider>
                      </SDKProvider>
                    </RouteProvider>
                  </ToastProvider>
                  </AnimationProvider>
                </KVProvider>
              </ExitProvider>
            </ArgsProvider>
          </ErrorBoundary>
        )
      },
      {
        targetFps,
        gatherStats: false,
        exitOnCtrlC: false,
        useKittyKeyboard: {},
        autoFocus: false,
        openConsoleOnError: false,
        consoleOptions: {
          keyBindings: [{ name: "y", ctrl: true, action: "copy-selection" }],
          onCopySelection: (text) => {
            Clipboard.copy(text).catch((error) => {
              log.debug("Failed to copy console selection to clipboard", { error })
            })
          },
        },
      },
    )
  })
}

function App() {
  const route = useRoute()
  const sync = useSync()
  const themeContext = useTheme()
  const { theme, mode, setMode } = themeContext
  Log.Default.info("tui: App component executing", {
    route: route.data.type,
    sync: (sync as any).status,
    themeReady: themeContext.ready,
  })
  const dimensions = useTerminalDimensions()
  const renderer = useRenderer()
  // Keep stdout interception enabled so background logs cannot paint
  // over the live TUI surface.
  const dialog = useDialog()
  const local = useLocal()
  const kv = useKV()
  const command = useCommandDialog()
  const sdk = useSDK()
  const toast = useToast()
  const exit = useExit()
  const promptRef = usePromptRef()
  const startupWorkspace = createMemo(() => sync.data.path.directory || process.cwd())
  const startupFlowActive = createMemo(() =>
    isStartupFlowActive({
      kv,
      syncStatus: sync.status,
      workspace: startupWorkspace(),
    }),
  )

  createEffect(
    on(
      () => {
        if (route.data.type === "session") return `session:${route.data.sessionID}`
        return route.data.type
      },
      () => {
        renderer.currentRenderBuffer.clear()
        renderer.requestRender()
      },
    ),
  )

  createEffect(
    on(
      () => `${dimensions().width}x${dimensions().height}`,
      () => {
        renderer.currentRenderBuffer.clear()
        renderer.requestRender()
        const settlePassA = setTimeout(() => {
          renderer.currentRenderBuffer.clear()
          renderer.requestRender()
        }, 80)
        const settlePassB = setTimeout(() => {
          renderer.currentRenderBuffer.clear()
          renderer.requestRender()
        }, 220)
        onCleanup(() => {
          clearTimeout(settlePassA)
          clearTimeout(settlePassB)
        })
      },
    ),
  )

  const hasLiveSessionStatus = createMemo(() =>
    Object.values(sync.data.session_status).some((status: any) => status.type === "busy" || status.type === "retry"),
  )

  // During live streaming, opportunistically clear the render buffer to avoid
  // stale glyph tails when lines shrink between frames in narrow/resize states.
  createEffect(() => {
    if (!hasLiveSessionStatus()) return
    const timer = setInterval(() => {
      renderer.currentRenderBuffer.clear()
      renderer.requestRender()
    }, 320)
    onCleanup(() => clearInterval(timer))
  })

  useKeyboard((evt) => {
    if (!GIZZIFlag.EXPERIMENTAL_DISABLE_COPY_ON_SELECT) return
    if (!renderer.getSelection()) return

    // Windows Terminal-like behavior:
    // - Ctrl+C copies and dismisses selection
    // - Esc dismisses selection
    // - Most other key input dismisses selection and is passed through
    if (evt.ctrl && evt.name === "c") {
      if (!Selection.copy(renderer, toast)) {
        renderer.clearSelection()
        return
      }

      evt.preventDefault()
      evt.stopPropagation()
      return
    }

    if (evt.name === "escape") {
      renderer.clearSelection()
      evt.preventDefault()
      evt.stopPropagation()
      return
    }

    renderer.clearSelection()
  })

  // Wire up console copy-to-clipboard via opentui's onCopySelection callback
  renderer.console.onCopySelection = async (text: string) => {
    if (!text || text.length === 0) return

    await Clipboard.copy(text)
      .then(() => toast.show({ message: GIZZICopy.toast.clipboardCopied, variant: "info" }))
      .catch(toast.error)

    renderer.clearSelection()
  }
  const [terminalTitleEnabled, setTerminalTitleEnabled] = createSignal(kv.get("terminal_title_enabled", true))
  let lastErrorToast: { message: string; time: number } | undefined

  // Update terminal window title based on current route and session
  createEffect(() => {
    if (!terminalTitleEnabled() || GIZZIFlag.DISABLE_TERMINAL_TITLE) return

    if (route.data.type === "home") {
      renderer.setTerminalTitle(GIZZI_BRAND.product)
      return
    }

    if (route.data.type === "session") {
      const session = (sync as any).session?.get?.(route.data.sessionID) || 
        (sync.data.session as any[]).find((s: any) => s.id === (route.data as any).sessionID)
      if (!session || SessionApi.isDefaultTitle(session.title)) {
        renderer.setTerminalTitle(GIZZI_BRAND.product)
        return
      }

      // Truncate title to 40 chars max
      const title = session.title.length > 40 ? session.title.slice(0, 37) + "..." : session.title
      renderer.setTerminalTitle(`${GIZZI_BRAND.name} | ${title}`)
    }
  })

  const args = useArgs()
  onMount(() => {
    // Handle --session without --fork immediately (fork is handled in createEffect below)
    if (args.sessionID && !args.fork) {
      route.navigate({
        type: "session",
        sessionID: args.sessionID,
      })
    }
  })

  let argsSelectionApplied = false
  createEffect(() => {
    if (argsSelectionApplied) return
    if (sync.data.agent.length === 0 || sync.data.provider.length === 0) return
    argsSelectionApplied = true
    const resolveAgentName = (value: string) => {
      const trimmed = value.trim()
      const agents = local.agent.list() as any[]
      const exact = agents.find((agent: any) => agent.name === trimmed)
      if (exact) return exact.name
      const normalized = trimmed.toLowerCase()
      const ci = agents.find((agent: any) => agent.name.toLowerCase() === normalized)
      if (ci) return ci.name
      const partial = agents.find((agent: any) => agent.name.toLowerCase().includes(normalized))
      return partial?.name
    }

    const selectedAgentName = args.agent ? resolveAgentName(args.agent) : undefined

    if (args.agent && !selectedAgentName) {
      toast.show({
        variant: "warning",
        message: `Agent not found: ${args.agent}`,
        duration: 3000,
      })
    }

    if (selectedAgentName) {
      local.agent.set(selectedAgentName)
    }

    if (args.model) {
      const { providerID, modelID } = Provider.parseModel(args.model)
      if (!providerID || !modelID)
        return toast.show({
          variant: "warning",
          message: GIZZICopy.toast.invalidModelFormat({ value: args.model }),
          duration: 3000,
        })
      local.model.set(
        { providerID, modelID },
        {
          recent: true,
          agentName: selectedAgentName,
        },
      )
    }
  })

  let continued = false
  createEffect(() => {
    // When using -c, session list is loaded in blocking phase, so we can navigate at "partial"
    if (continued || (sync as any).status === "loading" || !args.continue) return
    const sessions = sync.data.session as any[]
    const match = sessions
      .toSorted((a: any, b: any) => b.time.updated - a.time.updated)
      .find((x: any) => x.parentID === undefined)?.id
    if (match) {
      continued = true
      if (args.fork) {
        sdk.client.session.fork({ path: { sessionID: match } }).then((result: any) => {
          if (result.data?.id) {
            route.navigate({ type: "session", sessionID: result.data.id })
          } else {
            toast.show({ message: "Failed to fork session", variant: "error" })
          }
        })
      } else {
        route.navigate({ type: "session", sessionID: match })
      }
    }
  })

  // Handle --session with --fork: wait for sync to be fully complete before forking
  // (session list loads in non-blocking phase for --session, so we must wait for "complete"
  // to avoid a race where reconcile overwrites the newly forked session)
  let forked = false
  createEffect(() => {
    if (forked || (sync as any).status !== "complete" || !args.sessionID || !args.fork) return
    forked = true
    sdk.client.session.fork({ path: { sessionID: args.sessionID } }).then((result: any) => {
      if (result.data?.id) {
        route.navigate({ type: "session", sessionID: result.data.id })
      } else {
        toast.show({ message: "Failed to fork session", variant: "error" })
      }
    })
  })

  createEffect(
    on(
      () => sync.status === "complete" && sync.data.provider.length === 0 && !startupFlowActive(),
      (isEmpty, wasEmpty) => {
        // only trigger when we transition into an empty-provider state
        if (!isEmpty || wasEmpty) return
        dialog.replace(() => <DialogProviderList />)
      },
    ),
  )

  const connected = useConnected()
  command.register(() => [
    {
      title: "Switch session",
      value: "session.list",
      keybind: "session_list",
      category: "Session",
      suggested: sync.data.session.length > 0,
      slash: {
        name: "sessions",
        aliases: ["resume", "continue"],
      },
      onSelect: () => {
        dialog.replace(() => <DialogSessionList />)
      },
    },
    {
      title: "New session",
      suggested: route.data.type === "session",
      value: "session.new",
      keybind: "session_new",
      category: "Session",
      slash: {
        name: "new",
        aliases: ["clear"],
      },
      onSelect: () => {
        const current = promptRef.current
        // Don't require focus - if there's any text, preserve it
        const currentPrompt = current?.current?.input ? current.current : undefined
        route.navigate({
          type: "home",
          initialPrompt: currentPrompt,
        })
        dialog.clear()
      },
    },
    {
      title: "Switch model",
      value: "model.list",
      keybind: "model_list",
      suggested: true,
      category: "Agent",
      slash: {
        name: "models",
      },
      onSelect: () => {
        dialog.replace(() => <DialogModel />)
      },
    },
    {
      title: "Model cycle",
      value: "model.cycle_recent",
      keybind: "model_cycle_recent",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.model.cycle(1)
      },
    },
    {
      title: "Model cycle reverse",
      value: "model.cycle_recent_reverse",
      keybind: "model_cycle_recent_reverse",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.model.cycle(-1)
      },
    },
    {
      title: "Favorite cycle",
      value: "model.cycle_favorite",
      keybind: "model_cycle_favorite",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.model.cycleFavorite(1)
      },
    },
    {
      title: "Favorite cycle reverse",
      value: "model.cycle_favorite_reverse",
      keybind: "model_cycle_favorite_reverse",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.model.cycleFavorite(-1)
      },
    },
    {
      title: "Switch agent",
      value: "agent.list",
      keybind: "agent_list",
      category: "Agent",
      slash: {
        name: "agents",
      },
      onSelect: () => {
        dialog.replace(() => <DialogAgent />)
      },
    },
    {
      title: "Manage agents",
      value: "agent.manage",
      category: "Agent",
      slash: {
        name: "agent-manage",
      },
      onSelect: () => {
        dialog.replace(() => <DialogAgentManager />)
      },
    },
    {
      title: "Cron jobs",
      value: "cron.list",
      category: "Agent",
      slash: {
        name: "cron",
      },
      onSelect: () => {
        dialog.replace(() => <DialogCronList />)
      },
    },
    {
      title: "Toggle MCPs",
      value: "mcp.list",
      category: "Agent",
      slash: {
        name: "mcps",
      },
      onSelect: () => {
        dialog.replace(() => <DialogMcp />)
      },
    },
    {
      title: "Agent cycle",
      value: "agent.cycle",
      keybind: "agent_cycle",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.agent.move(1)
      },
    },
    {
      title: "Variant cycle",
      value: "variant.cycle",
      keybind: "variant_cycle",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.model.variant.cycle()
      },
    },
    {
      title: "Agent cycle reverse",
      value: "agent.cycle.reverse",
      keybind: "agent_cycle_reverse",
      category: "Agent",
      hidden: true,
      onSelect: () => {
        local.agent.move(-1)
      },
    },
    {
      title: "Agent Mode",
      value: "agent.mode",
      category: "Agent",
      slash: {
        name: "agent-mode",
        aliases: ["mode"],
      },
      onSelect: () => {
        route.navigate({ type: "agent-mode" })
        dialog.clear()
      },
    },
    {
      title: "Background Tasks",
      value: "background.tasks",
      category: "System",
      slash: {
        name: "tasks",
        aliases: ["bg", "background"],
      },
      onSelect: () => {
        route.navigate({ type: "background-tasks" })
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.command.connectProvider,
      value: "provider.connect",
      suggested: !connected(),
      slash: {
        name: "connect",
      },
      onSelect: () => {
        dialog.replace(() => <DialogProviderList />)
      },
      category: "Provider",
    },
    {
      title: "View status",
      keybind: "status_view",
      value: "gizzi-code.status",
      slash: {
        name: "status",
      },
      onSelect: () => {
        dialog.replace(() => <DialogStatus />)
      },
      category: "System",
    },
    {
      title: "Switch theme",
      value: "theme.switch",
      keybind: "theme_list",
      slash: {
        name: "themes",
      },
      onSelect: () => {
        dialog.replace(() => <DialogThemeList />)
      },
      category: "System",
    },
    {
      title: "Toggle appearance",
      value: "theme.switch_mode",
      onSelect: (dialog) => {
        setMode(mode() === "dark" ? "light" : "dark")
        dialog.clear()
      },
      category: "System",
    },
    {
      title: "Help",
      value: "help.show",
      slash: {
        name: "help",
      },
      onSelect: () => {
        dialog.replace(() => <DialogHelp />)
      },
      category: "System",
    },
    {
      title: "Open docs",
      value: "docs.open",
      onSelect: () => {
        open("https://docs.gizzi.io").catch(() => {})
        dialog.clear()
      },
      category: "System",
    },
    {
      title: "Exit the app",
      value: "app.exit",
      slash: {
        name: "exit",
        aliases: ["quit", "q"],
      },
      onSelect: () => exit(),
      category: "System",
    },
    {
      title: "Toggle debug panel",
      category: "System",
      value: "app.debug",
      onSelect: (dialog) => {
        renderer.toggleDebugOverlay()
        dialog.clear()
      },
    },
    {
      title: "Toggle console",
      category: "System",
      value: "app.console",
      onSelect: (dialog) => {
        renderer.console.toggle()
        dialog.clear()
      },
    },
    {
      title: "Write heap snapshot",
      category: "System",
      value: "app.heap_snapshot",
      onSelect: (dialog) => {
        const path = writeHeapSnapshot()
        toast.show({
          variant: "info",
          message: `Heap snapshot written to ${path}`,
          duration: 5000,
        })
        dialog.clear()
      },
    },
    {
      title: "Suspend terminal",
      value: "terminal.suspend",
      keybind: "terminal_suspend",
      category: "System",
      hidden: true,
      onSelect: () => {
        process.once("SIGCONT", () => {
          renderer.resume()
        })

        renderer.suspend()
        // pid=0 means send the signal to all processes in the process group
        process.kill(0, "SIGTSTP")
      },
    },
    {
      title: terminalTitleEnabled() ? "Disable terminal title" : "Enable terminal title",
      value: "terminal.title.toggle",
      keybind: "terminal_title_toggle",
      category: "System",
      onSelect: (dialog) => {
        setTerminalTitleEnabled((prev) => {
          const next = !prev
          kv.set("terminal_title_enabled", next)
          if (!next) renderer.setTerminalTitle("")
          return next
        })
        dialog.clear()
      },
    },
    {
      title: kv.get("animations_enabled", true) ? "Disable animations" : "Enable animations",
      value: "app.toggle.animations",
      category: "System",
      onSelect: (dialog) => {
        kv.set("animations_enabled", !kv.get("animations_enabled", true))
        dialog.clear()
      },
    },
    {
      title: `Animation speed: ${kv.get("animations_tick_rate", defaultAnimationTickRate())} TPS`,
      value: "app.animations.speed",
      category: "System",
      onSelect: (dialog) => {
        const rates = [...ANIMATION_SPEED_STEPS]
        const current = kv.get("animations_tick_rate", defaultAnimationTickRate())
        const next = rates[(rates.indexOf(current) + 1) % rates.length]
        kv.set("animations_tick_rate", next)
        dialog.clear()
      },
    },
    {
      title: kv.get("diff_wrap_mode", "word") === "word" ? "Disable diff wrapping" : "Enable diff wrapping",
      value: "app.toggle.diffwrap",
      category: "System",
      onSelect: (dialog) => {
        const current = kv.get("diff_wrap_mode", "word")
        kv.set("diff_wrap_mode", current === "word" ? "none" : "word")
        dialog.clear()
      },
    },
    {
      title: "Think (extended reasoning)",
      value: "thinking.think",
      category: "Agent",
      slash: {
        name: "think",
        aliases: ["think hard"],
      },
      description: "Set thinking variant to high",
      onSelect: (dialog) => {
        local.model.variant.set("high")
        toast.show({ message: "Thinking: high", variant: "info" })
        dialog.clear()
      },
    },
    {
      title: "Ultrathink (max reasoning)",
      value: "thinking.ultrathink",
      category: "Agent",
      slash: {
        name: "ultrathink",
        aliases: ["megathink"],
      },
      description: "Set thinking variant to max",
      onSelect: (dialog) => {
        local.model.variant.set("max")
        toast.show({ message: "Thinking: max", variant: "info" })
        dialog.clear()
      },
    },
    {
      title: "Default thinking",
      value: "thinking.default",
      category: "Agent",
      slash: {
        name: "think off",
      },
      description: "Reset thinking to default variant",
      onSelect: (dialog) => {
        local.model.variant.set(undefined)
        toast.show({ message: "Thinking: default", variant: "info" })
        dialog.clear()
      },
    },
  ])

  createEffect(() => {
    const currentModel = local.model.current()
    if (!currentModel) return
    if (currentModel.providerID === "openrouter" && !kv.get("openrouter_warning", false)) {
      untrack(() => {
        DialogAlert.show(
          dialog,
          "Warning",
          "While openrouter is a convenient way to access LLMs your request will often be routed to subpar providers that do not work well in our testing.\n\nFor reliable access to models check out GIZZI.IO ZEN\nhttps://gizzi.io/zen",
        ).then(() => kv.set("openrouter_warning", true))
      })
    }
  })

  sdk.event.on(TuiEvent.CommandExecute.type, (evt) => {
    command.trigger(evt.properties.command)
  })

  sdk.event.on(TuiEvent.ToastShow.type, (evt) => {
    toast.show({
      title: evt.properties.title,
      message: evt.properties.message,
      variant: evt.properties.variant,
      duration: evt.properties.duration,
    })
  })

  sdk.event.on(TuiEvent.SessionSelect.type, async (evt) => {
    const sessionID = evt.properties.sessionID
    try {
      if (sync.session.get(sessionID)) {
        route.navigate({
          type: "session",
          sessionID,
        })
        return
      }

      const lookup = await sdk.client.session.get({ path: { sessionID } })
      if (lookup.data?.id) {
        route.navigate({
          type: "session",
          sessionID,
        })
        return
      }
    } catch (error) {
      log.debug("Session select lookup failed", { error })
    }
    toast.show({
      variant: "error",
      message: `Session not found: ${sessionID}`,
      duration: 3500,
    })
    route.navigate({
      type: "home",
    })
  })

  sdk.event.on(SessionApi.Event.Deleted.type, (evt) => {
    if (route.data.type === "session" && route.data.sessionID === evt.properties.info.id) {
      route.navigate({ type: "home" })
      toast.show({
        variant: "info",
        message: "The current session was deleted",
      })
    }
  })

  sdk.event.on(SessionApi.Event.Error.type, (evt) => {
    const error = evt.properties.error
    const typed = (error && typeof error === "object" ? (error as SessionErrorShape) : undefined) ?? undefined
    if (typed?.name === "MessageAbortedError") return
    const message = (() => {
      if (!error) return "An error occurred"

      if (typeof error === "string") return error

      if (error instanceof Error && error.message) return error.message

      if (typed) {
        const dataMessage = typed.data && typeof typed.data === "object" ? (typed.data as any).message : undefined
        if (typeof dataMessage === "string" && dataMessage.length > 0) return dataMessage

        const nestedErrorMessage =
          typed.error && typeof typed.error === "object" ? (typed.error as any).message : undefined
        if (typeof nestedErrorMessage === "string" && nestedErrorMessage.length > 0) return nestedErrorMessage

        if (typeof typed.message === "string" && typed.message.length > 0) return typed.message
      }

      return String(error)
    })()

    const now = Date.now()
    if (lastErrorToast && lastErrorToast.message === message && now - lastErrorToast.time < 3000) return
    lastErrorToast = { message, time: now }

    toast.show({
      variant: "error",
      message,
      duration: 5000,
    })
  })

  sdk.event.on(Installation.Event.UpdateAvailable.type, (evt) => {
    toast.show({
      variant: "info",
      title: "Update Available",
      message: `GIZZI Code v${evt.properties.version} is available. Run 'gizzi-code upgrade' to update manually.`,
      duration: 10000,
    })
  })

  return (
    <box
      flexDirection="column"
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={theme.background}
      onMouseDown={(evt) => {
        if (!GIZZIFlag.EXPERIMENTAL_DISABLE_COPY_ON_SELECT) return
        if (evt.button !== MouseButton.RIGHT) return

        if (!Selection.copy(renderer, toast)) return
        evt.preventDefault()
        evt.stopPropagation()
      }}
      onMouseUp={GIZZIFlag.EXPERIMENTAL_DISABLE_COPY_ON_SELECT ? undefined : () => Selection.copy(renderer, toast)}
    >
      <Switch>
        <Match when={route.data.type === "home"}>
          <Home />
        </Match>
        <Match when={route.data.type === "session"}>
          <Session />
        </Match>
        <Match when={route.data.type === "agent-mode"}>
          <AgentMode />
        </Match>
        <Match when={route.data.type === "background-tasks"}>
          <BackgroundTasks />
        </Match>
        <Match when={true}>
          <box padding={2}>
            <text fg={theme.error}>Unhandled route: {route.data.type}</text>
          </box>
        </Match>
      </Switch>
    </box>
  )
}

function ErrorComponent(props: {
  error: Error
  reset: () => void
  onExit: () => Promise<void>
  mode?: "dark" | "light"
}) {
  const term = useTerminalDimensions()
  const renderer = useRenderer()

  const handleExit = async () => {
    renderer.setTerminalTitle("")
    renderer.destroy()
    win32FlushInputBuffer()
    await props.onExit()
  }

  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      handleExit()
    }
  })
  const [copied, setCopied] = createSignal(false)

  const issueURL = new URL("https://github.com/gizziio/gizzi-code/issues/new?template=bug-report.yml")

  // Choose safe fallback colors per mode since theme context may not be available
  const isLight = props.mode === "light"
  const colors = {
    bg: isLight ? "#ffffff" : "#0a0a0a",
    text: isLight ? "#1a1a1a" : "#eeeeee",
    muted: isLight ? "#8a8a8a" : "#808080",
    primary: isLight ? "#3b7dd8" : "#fab283",
  }

  if (props.error.message) {
    issueURL.searchParams.set("title", `opentui: fatal: ${props.error.message}`)
  }

  if (props.error.stack) {
    issueURL.searchParams.set(
      "description",
      "```\n" + props.error.stack.substring(0, 6000 - issueURL.toString().length) + "...\n```",
    )
  }

  issueURL.searchParams.set("gizzi-code-version", Installation.VERSION)

  const copyIssueURL = () => {
    Clipboard.copy(issueURL.toString()).then(() => {
      setCopied(true)
    })
  }

  return (
    <box flexDirection="column" gap={1} backgroundColor={colors.bg}>
      <box flexDirection="row" gap={1} alignItems="center">
        <text attributes={TextAttributes.BOLD} fg={colors.text}>
          Please report an issue.
        </text>
        <box onMouseUp={copyIssueURL} backgroundColor={colors.primary} padding={1}>
          <text attributes={TextAttributes.BOLD} fg={colors.bg}>
            Copy issue URL (exception info pre-filled)
          </text>
        </box>
        {copied() && <text fg={colors.muted}>Successfully copied</text>}
      </box>
      <box flexDirection="row" gap={2} alignItems="center">
        <text fg={colors.text}>A fatal error occurred!</text>
        <box onMouseUp={props.reset} backgroundColor={colors.primary} padding={1}>
          <text fg={colors.bg}>Reset TUI</text>
        </box>
        <box onMouseUp={handleExit} backgroundColor={colors.primary} padding={1}>
          <text fg={colors.bg}>Exit</text>
        </box>
      </box>
      <scrollbox height={Math.floor(term().height * 0.7)}>
        <text fg={colors.muted}>{props.error.stack}</text>
      </scrollbox>
      <text fg={colors.text}>{props.error.message}</text>
      </box>
      )
      }

      function ProviderTree(props: { children: any }) {
      return (
      <LocalProvider>
      <KeybindProvider>
      <PromptStashProvider>
        <DialogProvider>
          <CommandProvider>
            <FrecencyProvider>
              <PromptHistoryProvider>
                <PromptRefProvider>
                  {props.children}
                </PromptRefProvider>
              </PromptHistoryProvider>
            </FrecencyProvider>
          </CommandProvider>
        </DialogProvider>
      </PromptStashProvider>
      </KeybindProvider>
      </LocalProvider>
      )
      }
