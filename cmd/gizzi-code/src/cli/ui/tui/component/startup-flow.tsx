import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { useAnimation } from "@/cli/ui/components/animation"
import { GIZZIMascot, GIZZIBanner } from "@/cli/ui/components/gizzi"
import { useCommandDialog } from "@/cli/ui/tui/component/dialog-command"
import { DialogMcp } from "@/cli/ui/tui/component/dialog-mcp"
import { DialogProvider } from "@/cli/ui/tui/component/dialog-provider"
import { DialogSessionList } from "@/cli/ui/tui/component/dialog-session-list"
import { DialogStatus } from "@/cli/ui/tui/component/dialog-status"
import { DialogThemeList } from "@/cli/ui/tui/component/dialog-theme-list"
import {
  STARTUP_FLOW_VERSION,
  STARTUP_FLOW_VERSION_KEY,
  startupFlowStateKey,
  workspaceTrustKey,
} from "@/cli/ui/tui/component/startup-flow-state"
import { useDirectory } from "@/cli/ui/tui/context/directory"
import { useKV } from "@/cli/ui/tui/context/kv"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useRoute } from "@/cli/ui/tui/context/route"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { DialogPrompt } from "@/cli/ui/tui/ui/dialog-prompt"
import { GIZZIBrand } from "@/shared/brand"
import { Installation } from "@/shared/installation"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "startup-flow" })

type StepID = "workspace" | "theme" | "account" | "provider" | "terminal" | "mcp" | "ready"

type StepAction = {
  id: string
  label: string
  description: string
  disabled?: boolean
  run: () => void | Promise<void>
}

type StepInfo = {
  id: StepID
  title: string
  summary: string
  detail: string[]
  actions: StepAction[]
}

const THEME_DONE_KEY = startupFlowStateKey("theme_done")
const ACCOUNT_DONE_KEY = startupFlowStateKey("account_done")
const ACCOUNT_SKIPPED_KEY = startupFlowStateKey("account_skipped")
const ACCOUNT_URL_KEY = startupFlowStateKey("account_url")
const PROVIDER_SKIPPED_KEY = startupFlowStateKey("provider_skipped")
const TERMINAL_DONE_KEY = startupFlowStateKey("terminal_done")
const MCP_DONE_KEY = startupFlowStateKey("mcp_done")

function stepIcon(input: { complete: boolean; active: boolean }) {
  if (input.complete) return "[x]"
  if (input.active) return "[>]"
  return "[ ]"
}

function normalizePlatformURL(value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error("A platform URL is required")

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new Error("Invalid platform URL")
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Platform URL must use http:// or https://")
  }

  parsed.search = ""
  parsed.hash = ""
  parsed.pathname = parsed.pathname.replace(/\/+$/, "")

  const normalized = parsed.toString()
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

type ClerkStartResponse = {
  sessionID: string
  status: "pending" | "completed" | "claimed" | "failed" | "expired"
  platformURL: string
  browserURL: string
  callbackURL: string
  expiresAt: number
  claimedAt?: number
  error?: string
  openError?: string
  opened: boolean
  pollIntervalMs: number
}

type ClerkPollResponse = {
  sessionID: string
  status: "pending" | "completed" | "claimed" | "failed" | "expired"
  platformURL: string
  browserURL: string
  callbackURL: string
  expiresAt: number
  claimedAt?: number
  error?: string
  openError?: string
}

type ClerkClaimResponse = {
  sessionID: string
  providerID: string
  envKey: string
  status: "claimed"
}

async function readJSON<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: unknown
      error?: unknown
    }
    if (typeof body.message === "string" && body.message.trim()) return body.message
    if (typeof body.error === "string" && body.error.trim()) return body.error
  } catch (e) {
    log.debug("Failed to parse HTTP error response body", { error: e })
  }
  return `${response.status} ${response.statusText || "request failed"}`
}

export function StartupFlow() {
  const { theme, mode, setMode, selected } = useTheme()
  const sync = useSync()
  const sdk = useSDK()
  const kv = useKV()
  const command = useCommandDialog()
  const dialog = useDialog()
  const route = useRoute()
  const directory = useDirectory()
  const dimensions = useTerminalDimensions()
  const animation = useAnimation()

  const [selectedActionIndex, setSelectedActionIndex] = createSignal(0)
  const [runningActionID, setRunningActionID] = createSignal<string | null>(null)
  const [accountBusy, setAccountBusy] = createSignal(false)
  const [accountError, setAccountError] = createSignal<string>()
  const [accountStatus, setAccountStatus] = createSignal<string>()

  const workspace = createMemo(() => sync.data.path.directory || process.cwd())
  const trustKey = createMemo(() => workspaceTrustKey(workspace()))
  const isNarrow = createMemo(() => dimensions().width < 130)

  const trustedWorkspace = createMemo(() => kv.get(trustKey(), false) === true)
  const themeDone = createMemo(() => kv.get(THEME_DONE_KEY, false) === true)
  const accountDone = createMemo(() => kv.get(ACCOUNT_DONE_KEY, false) === true)
  const accountSkipped = createMemo(() => kv.get(ACCOUNT_SKIPPED_KEY, false) === true)
  const accountURL = createMemo(() => String(kv.get(ACCOUNT_URL_KEY, "") ?? ""))
  const terminalDone = createMemo(() => kv.get(TERMINAL_DONE_KEY, false) === true)
  const mcpDone = createMemo(() => kv.get(MCP_DONE_KEY, false) === true)
  const providerSkipped = createMemo(() => kv.get(PROVIDER_SKIPPED_KEY, false) === true)

  const providerNameByID = createMemo(() => new Map(sync.data.provider_next.all.map((provider) => [provider.id, provider.name])))
  const connectedProviderNames = createMemo(() => {
    const ids = new Set<string>()
    for (const providerID of sync.data.provider_next.connected) ids.add(providerID)
    for (const provider of sync.data.provider) ids.add(provider.id)
    return [...ids].map((id) => providerNameByID().get(id) ?? id)
  })
  const connectedProviderCount = createMemo(() => connectedProviderNames().length)

  createEffect(() => {
    if (connectedProviderCount() === 0) return
    if (!providerSkipped()) return
    kv.set(PROVIDER_SKIPPED_KEY, false)
  })

  createEffect(() => {
    if (!accountDone()) return
    if (!accountSkipped()) return
    kv.set(ACCOUNT_SKIPPED_KEY, false)
  })

  const mcpSummary = createMemo(() => {
    let connected = 0
    let disabled = 0
    let needsAuth = 0
    let failed = 0
    for (const status of Object.values(sync.data.mcp)) {
      if (status.status === "connected") connected++
      if (status.status === "disabled") disabled++
      if (status.status === "needs_auth" || status.status === "needs_client_registration") needsAuth++
      if (status.status === "failed") failed++
    }
    return { total: Object.keys(sync.data.mcp).length, connected, disabled, needsAuth, failed }
  })

  const status = createMemo(() => ({
    workspace: trustedWorkspace(),
    theme: themeDone(),
    account: accountDone() || accountSkipped(),
    provider: connectedProviderCount() > 0 || providerSkipped(),
    terminal: terminalDone(),
    mcp: mcpDone(),
  }))

  const activeStepID = createMemo<StepID>(() => {
    const current = status()
    if (!current.workspace) return "workspace"
    if (!current.theme) return "theme"
    if (!current.account) return "account"
    if (!current.provider) return "provider"
    if (!current.terminal) return "terminal"
    if (!current.mcp) return "mcp"
    return "ready"
  })

  const progress = createMemo(() => {
    const current = status()
    const active = activeStepID()
    return [
      { id: "workspace", title: "Workspace Trust", complete: current.workspace, active: active === "workspace" },
      { id: "theme", title: "Appearance", complete: current.theme, active: active === "theme" },
      { id: "account", title: "Clerk Account", complete: current.account, active: active === "account" },
      { id: "provider", title: "Provider Auth", complete: current.provider, active: active === "provider" },
      { id: "terminal", title: "Terminal Setup", complete: current.terminal, active: active === "terminal" },
      { id: "mcp", title: "MCP Health", complete: current.mcp, active: active === "mcp" },
      {
        id: "ready",
        title: "Ready",
        complete: current.workspace && current.theme && current.account && current.provider && current.terminal && current.mcp,
        active: active === "ready",
      },
    ] as const
  })

  const activeStepIndex = createMemo(() => Math.max(0, progress().findIndex((step) => step.active)))

  createEffect(
    on(activeStepID, () => {
      setSelectedActionIndex(0)
    }),
  )

  function completeStartupFlow() {
    kv.set(STARTUP_FLOW_VERSION_KEY, STARTUP_FLOW_VERSION)
    kv.set(startupFlowStateKey("completed_at"), Date.now())
  }

  function openProviderDialog() {
    dialog.replace(() => <DialogProvider />)
  }

  function openThemeDialog() {
    dialog.replace(() => <DialogThemeList />)
  }

  function openStatusDialog() {
    dialog.replace(() => <DialogStatus />)
  }

  function openMcpDialog() {
    dialog.replace(() => <DialogMcp />)
  }

  function openSessionListDialog() {
    queueMicrotask(() => {
      command.trigger("session.list")
      queueMicrotask(() => {
        if (dialog.stack.length > 0) return
        dialog.replace(() => <DialogSessionList />)
      })
    })
  }

  async function openNewSession() {
    const created = await sdk.client.session.create({})
    const sessionID = created.data?.id
    completeStartupFlow()
    if (sessionID) {
      route.navigate({
        type: "session",
        sessionID,
      })
      return
    }
    openSessionListDialog()
  }

  async function refreshMcpStatus() {
    const result = await sdk.client.mcp.status()
    if (result.data) sync.set("mcp", result.data)
  }

  async function connectPlatformAccount(urlInput: string) {
    if (accountBusy()) return

    setAccountBusy(true)
    setAccountError(undefined)

    try {
      const platformURL = normalizePlatformURL(urlInput)
      setAccountStatus(`Starting Clerk login for ${platformURL}`)

      const startResponse = await fetch(`${sdk.url}/auth/terminal/clerk/start`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          platformURL,
        }),
      })
      if (!startResponse.ok) {
        throw new Error(await responseError(startResponse))
      }

      const start = await readJSON<ClerkStartResponse>(startResponse)
      const loginWindow = start.opened
        ? "Browser opened to Clerk sign in."
        : `Open this URL in your browser: ${start.browserURL}`
      setAccountStatus(`${loginWindow} Waiting for completion...`)

      const pollInterval = Math.max(start.pollIntervalMs || 1200, 500)
      const pollDeadline = Date.now() + 5 * 60_000
      let finalStatus: ClerkPollResponse | undefined

      while (Date.now() < pollDeadline) {
        await Bun.sleep(pollInterval)

        const pollResponse = await fetch(`${sdk.url}/auth/terminal/clerk/poll/${encodeURIComponent(start.sessionID)}`)
        if (!pollResponse.ok) {
          throw new Error(await responseError(pollResponse))
        }

        const poll = await readJSON<ClerkPollResponse>(pollResponse)
        finalStatus = poll

        if (poll.status === "pending") continue
        if (poll.status === "completed" || poll.status === "claimed") break
        throw new Error(poll.error || `Login ${poll.status}`)
      }

      if (!finalStatus || (finalStatus.status !== "completed" && finalStatus.status !== "claimed")) {
        throw new Error("Timed out waiting for Clerk login completion")
      }

      if (finalStatus.status !== "claimed") {
        setAccountStatus("Login detected. Mounting account config...")
        const claimResponse = await fetch(`${sdk.url}/auth/terminal/clerk/claim/${encodeURIComponent(start.sessionID)}`, {
          method: "POST",
        })
        if (!claimResponse.ok) {
          throw new Error(await responseError(claimResponse))
        }
        await readJSON<ClerkClaimResponse>(claimResponse)
      }

      kv.set(ACCOUNT_URL_KEY, platformURL)
      kv.set(ACCOUNT_DONE_KEY, true)
      kv.set(ACCOUNT_SKIPPED_KEY, false)
      kv.set(startupFlowStateKey("account_connected_at"), Date.now())
      setAccountStatus(`Connected ${platformURL}`)

      await sdk.client.instance.dispose()
      await sync.bootstrap()
    } catch (error) {
      setAccountError(errorMessage(error))
      setAccountStatus(undefined)
    } finally {
      setAccountBusy(false)
    }
  }

  async function promptPlatformAccount() {
    const value = await DialogPrompt.show(dialog, "Connect Clerk Account", {
      value: accountURL() || "https://gizzi.io",
      placeholder: "https://your-platform.example",
      description: () => (
        <box gap={0} flexDirection="column">
          <text fg={theme.textMuted}>Opens browser sign-in with Clerk and waits for callback to this terminal.</text>
          <text fg={theme.textMuted}>After sign-in, account config and VPS profiles are mounted into {GIZZIBrand.product}.</text>
        </box>
      ),
    })
    if (value == null) return
    await connectPlatformAccount(value)
  }

  const activeStep = createMemo<StepInfo>(() => {
    const mcp = mcpSummary()
    const active = activeStepID()

    if (active === "workspace") {
      return {
        id: active,
        title: "Trust Workspace",
        summary: "Confirm this working directory before running agent actions.",
        detail: [
          `Workspace: ${directory()}`,
          `Config: ${sync.data.path.config || "(loading)"}`,
          `State: ${sync.data.path.state || "(loading)"}`,
        ],
        actions: [
          {
            id: "workspace.trust",
            label: "Trust this workspace",
            description: "Persist trust for this path.",
            run: () => kv.set(trustKey(), true),
          },
          {
            id: "workspace.status",
            label: "Open status",
            description: "Inspect runtime and adapter state.",
            run: openStatusDialog,
          },
          {
            id: "workspace.help",
            label: "Open help",
            description: "Review commands and shortcuts.",
            run: () => command.trigger("help.show"),
          },
        ],
      }
    }

    if (active === "theme") {
      return {
        id: active,
        title: "Choose Appearance",
        summary: "Set your default theme and mode.",
        detail: [`Theme: ${selected}`, `Mode: ${mode()}`, "You can change this later via /themes."],
        actions: [
          {
            id: "theme.toggle-mode",
            label: "Toggle dark/light",
            description: "Switch visual mode.",
            run: () => setMode(mode() === "dark" ? "light" : "dark"),
          },
          {
            id: "theme.open-picker",
            label: "Open theme picker",
            description: "Select from installed themes.",
            run: openThemeDialog,
          },
          {
            id: "theme.continue",
            label: "Continue",
            description: "Lock in appearance for now and continue.",
            run: () => kv.set(THEME_DONE_KEY, true),
          },
        ],
      }
    }

    if (active === "account") {
      return {
        id: active,
        title: "Connect Clerk Account",
        summary: "Sign in your platform account to mount cloud and VPS-backed config.",
        detail: [
          accountURL() ? `Last platform URL: ${accountURL()}` : "No platform URL saved yet.",
          "Starts browser Clerk sign-in and polls until callback completes.",
          "Then writes terminal auth and mounts cloud/VPS config from platform.",
        ],
        actions: [
          {
            id: "account.connect",
            label: accountBusy() ? "Connecting..." : "Sign in with Clerk",
            description: "Open browser login and mount account config after callback.",
            disabled: accountBusy(),
            run: promptPlatformAccount,
          },
          {
            id: "account.reconnect",
            label: "Reconnect saved account",
            description: "Reuse last platform URL and refresh mounted config.",
            disabled: accountBusy() || !accountURL(),
            run: () => connectPlatformAccount(accountURL()),
          },
          {
            id: "account.skip",
            label: "Use local-only config",
            description: "Skip cloud login for now and continue setup.",
            disabled: accountBusy(),
            run: () => {
              kv.set(ACCOUNT_SKIPPED_KEY, true)
              setAccountStatus("Using local-only config")
              setAccountError(undefined)
            },
          },
        ],
      }
    }

    if (active === "provider") {
      return {
        id: active,
        title: "Connect a Provider",
        summary: "Authenticate at least one model provider to send prompts.",
        detail: [
          "OAuth and API-key flows are both supported.",
          "Connect now, or continue without auth and connect later.",
          "Use /connect any time.",
        ],
        actions: [
          {
            id: "provider.connect",
            label: "Connect provider",
            description: "Open provider auth dialog.",
            run: openProviderDialog,
          },
          {
            id: "provider.skip",
            label: "Continue without auth",
            description: "Skip this step for now.",
            run: () => kv.set(PROVIDER_SKIPPED_KEY, true),
          },
          {
            id: "provider.status",
            label: "Open status",
            description: "View connected providers.",
            run: openStatusDialog,
          },
        ],
      }
    }

    if (active === "terminal") {
      return {
        id: active,
        title: "Terminal Behavior",
        summary: "Configure terminal defaults before the first session.",
        detail: [
          `Terminal title: ${kv.get("terminal_title_enabled", true) ? "enabled" : "disabled"}`,
          `Animations: ${kv.get("animations_enabled", true) ? "enabled" : "disabled"}`,
          "Both can be changed later from the command palette.",
        ],
        actions: [
          {
            id: "terminal.toggle-title",
            label: "Toggle terminal title",
            description: "Enable or disable terminal title updates.",
            run: () => kv.set("terminal_title_enabled", !kv.get("terminal_title_enabled", true)),
          },
          {
            id: "terminal.toggle-animations",
            label: "Toggle animations",
            description: "Enable or disable UI animations.",
            run: () => kv.set("animations_enabled", !kv.get("animations_enabled", true)),
          },
          {
            id: "terminal.continue",
            label: "Continue",
            description: "Confirm terminal defaults and continue.",
            run: () => kv.set(TERMINAL_DONE_KEY, true),
          },
        ],
      }
    }

    if (active === "mcp") {
      return {
        id: active,
        title: "MCP Health Check",
        summary: "Review MCP adapter readiness before coding.",
        detail: [
          `Servers: ${mcp.total} total, ${mcp.connected} connected, ${mcp.disabled} disabled`,
          `Needs auth: ${mcp.needsAuth}`,
          `Failures: ${mcp.failed}`,
        ],
        actions: [
          {
            id: "mcp.manage",
            label: "Manage MCP servers",
            description: "Open MCP toggles and statuses.",
            run: openMcpDialog,
          },
          {
            id: "mcp.refresh",
            label: "Refresh MCP status",
            description: "Pull latest MCP state from runtime.",
            run: refreshMcpStatus,
          },
          {
            id: "mcp.continue",
            label: "Continue",
            description: "Confirm MCP review and continue.",
            run: () => kv.set(MCP_DONE_KEY, true),
          },
        ],
      }
    }

    return {
      id: "ready",
      title: `${GIZZIBrand.product} Setup Complete`,
      summary: "Everything is configured. Open a session and start coding.",
      detail: [
        `Version: ${Installation.VERSION}`,
        connectedProviderCount() > 0 ? `Providers: ${connectedProviderNames().join(", ")}` : "Providers: none connected",
        `Session history: ${sync.data.session.length}`,
      ],
      actions: [
        {
          id: "ready.start",
          label: "Start coding",
          description: "Finish setup and open a new session now.",
          run: openNewSession,
        },
        {
          id: "ready.sessions",
          label: "Open sessions",
          description: "Finish setup and open the session list now.",
          run: () => {
            completeStartupFlow()
            openSessionListDialog()
          },
        },
        {
          id: "ready.providers",
          label: "Connect providers",
          description: "Finish setup and open provider auth.",
          run: () => {
            completeStartupFlow()
            openProviderDialog()
          },
        },
      ],
    }
  })

  createEffect(() => {
    const actions = activeStep().actions
    if (actions.length === 0) {
      setSelectedActionIndex(0)
      return
    }
    if (selectedActionIndex() < 0) setSelectedActionIndex(0)
    if (selectedActionIndex() >= actions.length) setSelectedActionIndex(actions.length - 1)
  })

  const selectedAction = createMemo(() => activeStep().actions[selectedActionIndex()])

  function moveSelection(delta: number) {
    const actions = activeStep().actions
    if (actions.length === 0) return

    let index = selectedActionIndex()
    for (let tries = 0; tries < actions.length; tries++) {
      index = (index + delta + actions.length) % actions.length
      if (!actions[index]?.disabled) {
        setSelectedActionIndex(index)
        return
      }
    }
  }

  async function runAction(action?: StepAction) {
    if (!action) return
    if (action.disabled) return
    if (runningActionID()) return

    setRunningActionID(action.id)
    try {
      await action.run()
    } finally {
      setRunningActionID(null)
    }
  }

  useKeyboard((evt) => {
    if (dialog.stack.length > 0) return
    if (evt.defaultPrevented) return
    if (evt.ctrl || evt.meta) return
    if (!evt.name) return

    const key = evt.name.toLowerCase()

    if (key === "up" || key === "k") {
      evt.preventDefault()
      moveSelection(-1)
      return
    }

    if (key === "down" || key === "j") {
      evt.preventDefault()
      moveSelection(1)
      return
    }

    if (key === "home") {
      evt.preventDefault()
      setSelectedActionIndex(0)
      return
    }

    if (key === "end") {
      evt.preventDefault()
      setSelectedActionIndex(Math.max(activeStep().actions.length - 1, 0))
      return
    }

    if (key === "enter" || key === "return" || key === "right") {
      evt.preventDefault()
      void runAction(selectedAction())
    }
  })

  const active = createMemo(() => activeStep())
  const sceneID = createMemo(() => `gizzi.setup.${active().id}`)
  const sceneFrame = createMemo(() => animation.frame(sceneID()))
  const sceneLines = createMemo(() => sceneFrame().split("\n"))
  const mascotState = createMemo<GIZZIMascotState>(() => {
    if (runningActionID()) return "executing"
    
    const id = active().id
    if (id === "workspace") return "curious"
    if (id === "theme") return "pleased"
    if (id === "account") return "thinking"
    if (id === "provider") return "alert"
    if (id === "terminal") return "focused"
    if (id === "mcp") return "steady"
    if (id === "ready") return "proud"
    
    return "idle"
  })

  return (
    <box
      flexGrow={1}
      minHeight={0}
      width="100%"
      borderStyle="single"
      borderColor={theme.border}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
    >
      <box flexDirection="row" gap={1}>
        <text fg={theme.text}>
          <span style={{ bold: true }}>{GIZZIBrand.product} Setup</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.textMuted}>
          Step {activeStepIndex() + 1} / {progress().length}
        </text>
      </box>

      <box flexDirection={isNarrow() ? "column" : "row"} gap={1}>
        <For each={progress()}>
          {(step) => (
            <text fg={step.complete ? theme.success : step.active ? theme.accent : theme.textMuted}>
              {stepIcon(step)} {step.title}
            </text>
          )}
        </For>
      </box>

      <box
        borderStyle="single"
        borderColor={theme.border}
        backgroundColor={theme.backgroundElement}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        minHeight={16}
        alignItems="center"
        justifyContent="center"
      >
        <box flexDirection="column" alignItems="center" gap={0}>
          <For each={sceneLines()}>{(line) => <text fg={theme.accent}>{line}</text>}</For>
          <box paddingTop={1}>
            <GIZZIMascot state={mascotState()} color={theme.accent} compact={false} />
          </box>
          <box paddingTop={1}>
            <GIZZIBanner />
          </box>
        </box>
      </box>

      <text fg={theme.text}>
        <span style={{ bold: true }}>{active().title}</span>
      </text>
      <text fg={theme.textMuted} wrapMode="word">
        {active().summary}
      </text>

      <box flexDirection="column" gap={0}>
        <For each={active().detail}>
          {(line) => (
            <text fg={theme.textMuted} wrapMode="word">
              - {line}
            </text>
          )}
        </For>
      </box>

      <Show when={accountStatus() || accountError()}>
        <box
          borderStyle="single"
          borderColor={accountError() ? theme.error : theme.border}
          paddingLeft={1}
          paddingRight={1}
          paddingTop={0}
          paddingBottom={0}
          gap={0}
        >
          <Show when={accountStatus()}>
            <text fg={theme.textMuted}>{accountStatus()}</text>
          </Show>
          <Show when={accountError()}>
            <text fg={theme.error}>{accountError()}</text>
          </Show>
        </box>
      </Show>

      <box flexDirection="column" gap={0} paddingTop={1}>
        <For each={active().actions}>
          {(action, index) => {
            const selected = createMemo(() => index() === selectedActionIndex())
            const running = createMemo(() => runningActionID() === action.id)
            return (
              <box
                flexDirection="column"
                paddingLeft={0}
                paddingRight={0}
                onMouseMove={() => setSelectedActionIndex(index())}
                onMouseUp={() => void runAction(action)}
              >
                <text fg={action.disabled ? theme.textMuted : theme.text}>
                  <span style={{ fg: selected() ? theme.accent : theme.textMuted, bold: true }}>{selected() ? ">" : " "}</span> <span style={{ bold: selected() }}>{action.label}</span>
                  <Show when={action.disabled}>
                    <span style={{ fg: theme.textMuted }}> (disabled)</span>
                  </Show>
                </text>
                <Show when={selected()}>
                  <text fg={theme.textMuted} wrapMode="word">
                    {running() ? "Running..." : action.description}
                  </text>
                </Show>
              </box>
            )
          }}
        </For>
      </box>

      <box flexDirection="row" gap={2}>
        <text fg={theme.textMuted} wrapMode="word">
          Use up/down arrows to move, Enter or right-arrow to select.
        </text>
        <text fg={theme.textMuted}>Cursor navigation only</text>
      </box>
    </box>
  )
}
