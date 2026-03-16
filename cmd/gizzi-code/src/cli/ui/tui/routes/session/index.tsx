
// Note: This file uses SDK types that are now exported as 'unknown'.
// Full migration would require defining ~50+ local interfaces.
// Type checking is disabled to allow the codebase to compile while maintaining functionality.

import {
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  on,
  Show,
  Switch,
  useContext,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import path from "path"
import { useRoute, useRouteData } from "@/cli/ui/tui/context/route"
import { useSync } from "@/cli/ui/tui/context/sync"
import { SplitBorder } from "@/cli/ui/tui/component/border"
import { selectedForeground, useTheme } from "@/cli/ui/tui/context/theme"
import {
  BoxRenderable,
  ScrollBoxRenderable,
  addDefaultParsers,
  MacOSScrollAccel,
  type ScrollAcceleration,
  TextAttributes,
  RGBA,
} from "@opentui/core"
import { Prompt, type PromptRef } from "@/cli/ui/tui/component/prompt"
import { SessionMount } from "@/cli/ui/tui/component/session-mount"

// SDK types are exported as 'unknown' - defining local types for type safety
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySDKType = any

type SessionStatus = 
  | { type: "idle" }
  | { type: "busy" }
  | { type: "retry"; message: string; attempt: number; next: string }
  | { type: "waiting" }
  | { type: "completed" }
  | { type: "failed" }
  | { type: "compacting" }

// Extend Filesystem with ensureDir
interface FilesystemWithEnsureDir {
  exists(p: string): Promise<boolean>
  ensureDir(p: string): Promise<void>
  readText(p: string): Promise<string>
  write(p: string, content: string): Promise<void>
  isDir(p: string): Promise<boolean>
  mkdir(p: string, options?: { recursive?: boolean }): Promise<void>
}

declare module "@/shared/util/filesystem" {
  namespace Filesystem {
    function ensureDir(p: string): Promise<void>
  }
}

// Type helpers for sync data
type SyncSession = {
  id: string
  parentID?: string
  title?: string
  share?: { url?: string }
  revert?: { messageID?: string; diff?: string }
  time?: { created: number }
}

type SyncMessage = {
  id: string
  sessionID: string
  role: "user" | "assistant" | "system"
  parentID?: string
  time: { created: number; completed?: number }
  agent?: string
  modelID?: string
  providerID?: string
  cost?: number
  tokens?: {
    input: number
    output: number
    total: number
    reasoning?: number
    cache?: { read: number }
  }
  finish?: string
  mode?: string
  error?: { name: string; data?: { message?: string } }
}

type SyncPart = 
  | { id: string; type: "text"; text: string; synthetic?: boolean; ignored?: boolean }
  | { id: string; type: "tool"; tool: string; callID: string; sessionID: string; state: { status: string; input?: Record<string, unknown> } }
  | { id: string; type: "reasoning"; text: string }
  | { id: string; type: "file"; mime?: string; filename?: string }
  | { id: string; type: "compaction"; auto: boolean }
  | { type: string; id?: string }

type SyncConfig = {
  tui?: { scroll_acceleration?: { enabled: boolean }; scroll_speed?: number; diff_style?: string }
  lsp?: boolean
  share?: string
}

interface TimeInfo {
  created: number
  updated?: number
  completed?: number
}

interface Message {
  id: string
  sessionID: string
  role: "user" | "assistant" | "system"
  parentID?: string
  time: TimeInfo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface UserMessage extends Message {
  role: "user"
  agent?: string
}

interface AssistantMessage extends Message {
  role: "assistant"
  modelID?: string
  providerID?: string
  tokens?: {
    input: number
    output: number
    total: number
    reasoning?: number
    cache?: { read: number }
  }
  cost?: number
  finish?: string
  mode?: string
  error?: {
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any
  }
}

interface ToolState {
  status: "pending" | "running" | "completed" | "error"
  input?: Record<string, unknown>
  output?: string
  error?: string
  metadata?: Record<string, unknown>
  time?: {
    created?: number
    started?: number
    completed?: number
    compacted?: boolean
  }
}

interface ToolPart {
  id: string
  type: "tool"
  tool: string
  callID: string
  sessionID: string
  state: ToolState
}

interface TextPart {
  id: string
  type: "text"
  text: string
  synthetic?: boolean
  ignored?: boolean
}

interface ReasoningPart {
  id: string
  type: "reasoning"
  text: string
}

interface CompactionPart {
  id: string
  type: "compaction"
  auto: boolean
}

type Part = TextPart | ToolPart | ReasoningPart | CompactionPart | AnySDKType
import { useLocal } from "@/cli/ui/tui/context/local"
import { Locale } from "@/shared/util/locale"
import type { Tool } from "@/runtime/tools/builtins/tool"
import type { ReadTool } from "@/runtime/tools/builtins/read"
import type { WriteTool } from "@/runtime/tools/builtins/write"
import { BashTool } from "@/runtime/tools/builtins/bash"
import type { GlobTool } from "@/runtime/tools/builtins/glob"
import { TodoWriteTool } from "@/runtime/tools/builtins/todo"
import type { GrepTool } from "@/runtime/tools/builtins/grep"
import type { ListTool } from "@/runtime/tools/builtins/ls"
import type { EditTool } from "@/runtime/tools/builtins/edit"
import type { ApplyPatchTool } from "@/runtime/tools/builtins/apply_patch"
import type { WebFetchTool } from "@/runtime/tools/builtins/webfetch"
import type { TaskTool } from "@/runtime/tools/builtins/task"
import type { QuestionTool } from "@/runtime/tools/builtins/question"
import type { SkillTool } from "@/runtime/tools/builtins/skill"
import type { MultiEditTool } from "@/runtime/tools/builtins/multiedit"
import { useKeyboard, useRenderer, useTerminalDimensions, type JSX } from "@opentui/solid"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useCommandDialog } from "@/cli/ui/tui/component/dialog-command"
import { useKeybind } from "@/cli/ui/tui/context/keybind"
import { useMessageState } from "@/cli/ui/tui/hooks/useMessageState"
import { useScrollMemory } from "@/cli/ui/tui/hooks/useScrollMemory"
import { useBookmarks } from "@/cli/ui/tui/hooks/useBookmarks"
import { useSearch } from "@/cli/ui/tui/hooks/useSearch"
import { usePinned } from "@/cli/ui/tui/hooks/usePinned"
import { getFirstCodeBlock, hasCodeBlocks } from "@/shared/util/code-blocks"
import { Header } from "@/cli/ui/tui/routes/session/header"
import { parsePatch } from "diff"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { TodoItem } from "@/cli/ui/tui/component/todo-item"
import { DialogMessage } from "@/cli/ui/tui/routes/session/dialog-message"
import type { PromptInfo } from "@/cli/ui/tui/component/prompt/history"
import { DialogConfirm } from "@/cli/ui/tui/ui/dialog-confirm"
import { DialogTimeline } from "@/cli/ui/tui/routes/session/dialog-timeline"
import { DialogForkFromTimeline } from "@/cli/ui/tui/routes/session/dialog-fork-from-timeline"
import { DialogSessionRename } from "@/cli/ui/tui/component/dialog-session-rename"
import { DialogBookmarks } from "@/cli/ui/tui/component/dialog-bookmarks"
import { DialogSearch } from "@/cli/ui/tui/component/dialog-search"
import { DialogFileSearch } from "@/cli/ui/tui/component/dialog-file-search"
import { DialogUsage } from "@/cli/ui/tui/component/dialog-usage"
import { DialogHelp } from "@/cli/ui/tui/component/dialog-help"
import { DialogMessageActions } from "@/cli/ui/tui/component/dialog-message-actions"
import { DialogJump } from "@/cli/ui/tui/component/dialog-jump"
import { DialogFileRefs } from "@/cli/ui/tui/component/dialog-file-refs"
import { DialogPinned } from "@/cli/ui/tui/component/dialog-pinned"
import { DialogExport } from "@/cli/ui/tui/component/dialog-export"
import { DialogMcp } from "@/cli/ui/tui/component/dialog-mcp"
import { DialogPluginMarketplace } from "@/cli/ui/tui/component/dialog-plugin-marketplace"
import { DialogMemoryExplorer } from "@/cli/ui/tui/component/dialog-memory-explorer"
import { DialogSkillEval } from "@/cli/ui/tui/component/dialog-skill-eval"
import { DialogGwsSetup } from "@/cli/ui/tui/component/dialog-gws-setup"
import { DialogVerificationStatus } from "@/cli/ui/tui/component/dialog-verification-status"
import { DialogAcpRelay } from "@/cli/ui/tui/component/dialog-acp-relay"
import { DialogSwarmTree } from "@/cli/ui/tui/component/dialog-swarm-tree"
import { Sidebar } from "@/cli/ui/tui/routes/session/sidebar"
import { LANGUAGE_EXTENSIONS } from "@/runtime/integrations/lsp/language"
import parsers from "../../../../../../parsers-config.ts"
import { Clipboard } from "@/cli/ui/tui/util/clipboard"
import { Toast, useToast } from "@/cli/ui/tui/ui/toast"
import { useKV } from "@/cli/ui/tui/context/kv.tsx"
import { Editor } from "@/cli/ui/tui/util/editor"
import stripAnsi from "strip-ansi"
import { Footer } from "@/cli/ui/tui/routes/session/footer.tsx"
import { SessionHeader } from "@/cli/ui/tui/routes/session/session-header.tsx"
import { usePromptRef } from "@/cli/ui/tui/context/prompt"
import { useExit } from "@/cli/ui/tui/context/exit"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "tui.session" })
import { Filesystem } from "@/shared/util/filesystem"
import { Global } from "@/runtime/context/global"
import { PermissionPrompt } from "@/cli/ui/tui/routes/session/permission"
import { QuestionPrompt } from "@/cli/ui/tui/routes/session/question"
import { MonolithPulse } from "@/cli/ui/components/gizzi/monolith-pulse"
import { GuardPolicy, GuardArtifacts, GuardCompaction, GuardMetrics } from "@/runtime/tools/guard"
import { Instance } from "@/runtime/context/project/instance"
import { DialogExportOptions } from "@/cli/ui/tui/ui/dialog-export-options"
import { formatTranscript } from "@/cli/ui/tui/util/transcript"
import { UI } from "@/cli/ui"
import { SessionUsage } from "@/runtime/session/usage"
import {
  GIZZIFrame,
  GIZZIInlineBlock,
  GIZZIMessageList,
  GIZZIMascot,
  GIZZISpinner,
  useGIZZITheme,
} from "@/cli/ui/components/gizzi"
import { useAnimation } from "@/cli/ui/components/animation"
import { GIZZICopy, GIZZIFlag, sanitizeBrandSurface } from "@/shared/brand"
import { isWebToolName } from "@/cli/ui/components/gizzi/runtime-mode"
import {
  describeProviderError,
  formatRetryStatus,
  isRetryLimitReached,
} from "@/shared/util/provider-error"
import {
  deriveRuntimeLaneCards,
  type RuntimeLaneCard,
  type RuntimeLaneStatus,
  type RuntimeLaneToolSnapshot,
} from "@/cli/ui/components/gizzi/runtime-lane"

addDefaultParsers(parsers.parsers)

class CustomSpeedScroll implements ScrollAcceleration {
  constructor(private speed: number) {}

  tick(_now?: number): number {
    return this.speed
  }

  reset(): void {}
}

const context = createContext<{
  width: number
  height: number
  isHeightConstrained: () => boolean
  sessionID: string
  conceal: () => boolean
  showThinking: () => boolean
  showRuntimeTrace: () => boolean
  showReceipts: () => boolean
  showCards: () => boolean
  showLaneHistory: () => boolean
  focusRuntime: () => boolean
  showTimestamps: () => boolean
  showDetails: () => boolean
  showGenericToolOutput: () => boolean
  diffWrapMode: () => "word" | "none"
  sync: ReturnType<typeof useSync>
  messageState: {
    isCollapsed: (messageID: string) => boolean
    toggle: (messageID: string) => void
    expand: (messageID: string) => void
    collapse: (messageID: string) => void
    expandAll: () => void
    collapseAll: (messageIDs: string[]) => void
  }
  bookmarks: {
    isBookmarked: (messageID: string) => boolean
    toggle: (messageID: string) => void
    count: () => number
  }
}>()

function use() {
  const ctx = useContext(context)
  if (!ctx) throw new Error("useContext must be used within a Session component")
  return ctx
}

export function Session() {
  const route = useRouteData("session")
  const { navigate } = useRoute()
  const sync = useSync()
  const kv = useKV()
  const { theme } = useTheme()
  const promptRef = usePromptRef()
  const session = createMemo(() => (sync.data.session as SyncSession[]).find(s => s.id === route.sessionID))
  const children = createMemo(() => {
    const currentSession = session()
    if (!currentSession) return []
    const parentID = currentSession.parentID ?? currentSession.id
    return (sync.data.session as SyncSession[])
      .filter((x) => x.parentID === parentID || x.id === parentID)
      .slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  })
  const messages = createMemo(() => (sync.data.message[route.sessionID] ?? []) as SyncMessage[])
  const permissions = createMemo(() => {
    if (session()?.parentID) return []
    return children().flatMap((x) => (sync.data.permission[x.id] ?? []) as AnySDKType[])
  })
  const questions = createMemo(() => {
    if (session()?.parentID) return []
    return children().flatMap((x) => (sync.data.question[x.id] ?? []) as AnySDKType[])
  })

  const pending = createMemo(() => {
    const activeAssistant = messages().findLast((x) => x.role === "assistant" && !x.time.completed)
    if (activeAssistant) return activeAssistant.id
    const sessionStatus = (sync.data.session_status?.[route.sessionID] ?? { type: "idle" }) as unknown as SessionStatus
    const last = messages().at(-1)
    if ((sessionStatus.type === "busy" || sessionStatus.type === "retry") && last?.role === "user") {
      return last.id
    }
    return undefined
  })

  const lastAssistant = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant") as SyncMessage | undefined
  })

  const activeAssistant = createMemo(() =>
    messages().findLast(
      (message): message is SyncMessage => message.role === "assistant" && !message.time.completed,
    ) as SyncMessage | undefined
  )

  // Define activeTools early to avoid reference issues
  const activeTools = createMemo(() => {
    const assistant = activeAssistant()
    if (!assistant) return [] as string[]
    const parts = (sync.data.part[assistant.id] ?? []) as SyncPart[]
    return parts
      .filter(
        (part): part is Extract<SyncPart, { type: "tool" }> =>
          part.type === "tool" && ((part as any).state?.status === "running" || (part as any).state?.status === "pending"),
      )
      .map((part) => part.tool)
  })

  const sessionMascotState = createMemo<"idle" | "curious" | "proud" | "pleased" | "steady" | "executing" | "responding" | "thinking">(() => {
    if (!pending()) {
      const count = messages().length
      if (count === 0) return "idle"
      if (count > 20) return "proud"
      if (count > 8) return "pleased"
      return "steady"
    }

    const activeParts = activeAssistant() ? ((sync.data.part[activeAssistant()!.id] ?? []) as SyncPart[]) : []
    const hasRunningTool = activeTools().length > 0
    if (hasRunningTool) return "executing"

    const hasVisibleText = activeParts.some(
      (part): part is Extract<SyncPart, { type: "text" }> => part.type === "text" && "text" in part && part.text.trim().length > 0,
    )
    if (hasVisibleText) return "responding"

    return "thinking"
  })
  const sessionMascotHint = createMemo(() => {
    const state = sessionMascotState()
    if (state === "executing") {
      const active = activeTools()[0]
      return active ? `Gizzi using ${active}` : "Gizzi running tools"
    }
    if (state === "responding") return "Gizzi responding"
    if (state === "thinking") return "Gizzi thinking"
    if (state === "idle") return "Gizzi ready"
    if (state === "curious") return "Gizzi is curious"
    if (state === "proud") return "Gizzi is proud"
    if (state === "pleased") return "Gizzi is pleased"
    if (state === "steady") return "Gizzi is steady"
    return "Gizzi ready"
  })

  const messageState = useMessageState(route.sessionID)
  const bookmarks = useBookmarks(route.sessionID)
  const search = useSearch(messages as () => any[], (messageID) => (sync.data.part[messageID] ?? []) as any[])

  // Scroll position memory
  let scroll: ScrollBoxRenderable
  const scrollMemory = useScrollMemory(route.sessionID, () => scroll)

  // Navigate to a message by ID
  function navigateToMessage(messageID: string) {
    const children = scroll?.getChildren()
    if (!children) return
    const child = children.find((c) => c.id === messageID)
    if (child) {
      scroll.scrollBy(child.y - scroll.y - 1)
    }
  }

  const dimensions = useTerminalDimensions()
  const [sidebar, setSidebar] = kv.signal<"auto" | "hide">("sidebar", "auto")
  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  const [conceal, setConceal] = createSignal(true)
  const [showThinking, setShowThinking] = kv.signal("thinking_visibility", true)
  const [showRuntimeTrace, setShowRuntimeTrace] = kv.signal("runtime_trace_visibility", true)
  const [showReceipts, setShowReceipts] = kv.signal("runtime_receipts_visibility", true)
  const [vimMode, setVimMode] = kv.signal("vim_mode", false)
  const [showCards, setShowCards] = kv.signal("runtime_cards_visibility", true)
  const [showLaneHistory, setShowLaneHistory] = kv.signal("runtime_lane_history_visibility", false)
  const [focusRuntime, setFocusRuntime] = kv.signal("runtime_focus_mode", true)
  const [timestamps, setTimestamps] = kv.signal<"hide" | "show">("timestamps", "hide")
  const [showDetails, setShowDetails] = kv.signal("tool_details_visibility", true)
  const [showAssistantMetadata, setShowAssistantMetadata] = kv.signal("assistant_metadata_visibility", true)
  const [showScrollbar, setShowScrollbar] = kv.signal("scrollbar_visible", false)
  const [showHeader, setShowHeader] = kv.signal("header_visible", true)
  const [diffWrapMode] = kv.signal<"word" | "none">("diff_wrap_mode", "word")
  const [animationsEnabled, setAnimationsEnabled] = kv.signal("animations_enabled", true)
  const [showGenericToolOutput, setShowGenericToolOutput] = kv.signal("generic_tool_output_visibility", false)

  const wide = createMemo(() => dimensions().width > 120)
  const sidebarVisible = createMemo(() => {
    if (session()?.parentID) return false
    if (sidebarOpen()) return true
    if (sidebar() === "auto" && wide()) return true
    return false
  })
  const showTimestamps = createMemo(() => timestamps() === "show")
  const contentWidth = createMemo(() => Math.max(24, dimensions().width - (sidebarVisible() ? 42 : 0) - 4))
  const isHeightConstrained = createMemo(() => dimensions().height < 28)

  const scrollAcceleration = createMemo(() => {
    const tui = (sync.data.config as SyncConfig).tui
    if (tui?.scroll_acceleration?.enabled) {
      return new MacOSScrollAccel()
    }
    if (tui?.scroll_speed) {
      return new CustomSpeedScroll(tui.scroll_speed)
    }

    return new CustomSpeedScroll(3)
  })

  let activeSyncRequest = 0
  createEffect(
    on(
      () => route.sessionID,
      async (sessionID) => {
        const requestID = ++activeSyncRequest
        const isStaleRequest = () => requestID !== activeSyncRequest || route.sessionID !== sessionID
        const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
        const readStatusCode = (error: unknown) =>
          Number(
            (error as any)?.status ??
              (error as any)?.statusCode ??
              (error as any)?.response?.status ??
              (error as any)?.cause?.status ??
              NaN,
          )
        const classifyMissingFromError = (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          const lower = message.toLowerCase()
          const statusCode = readStatusCode(error)
          return (
            statusCode === 404 ||
            lower.includes("session not found") ||
            (lower.includes("not found") && lower.includes("session")) ||
            (lower.includes("404") && lower.includes("session"))
          )
        }
        const checkSessionExistence = async () => {
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              const lookup = await sdk.client.session.get({ path: { sessionID } })
              if (lookup.data?.id) return "exists" as const
              if (attempt < 3) await pause(250 * (attempt + 1))
            } catch (lookupError) {
              if (classifyMissingFromError(lookupError)) {
                if (attempt < 3) {
                  await pause(250 * (attempt + 1))
                  continue
                }
                return "missing" as const
              }
              return "unknown" as const
            }
          }
          return "missing" as const
        }
        try {
          await sync.session.sync(sessionID)
          if (isStaleRequest()) return
          if (scroll) scroll.scrollBy(100_000)
          return
        } catch (e) {
          if (isStaleRequest()) return
          log.debug("Session sync failed", { error: e })
          const existence = await checkSessionExistence()
          if (isStaleRequest()) return
          if (existence === "exists") {
            try {
              await pause(250)
              await sync.session.sync(sessionID)
              if (isStaleRequest()) return
              if (scroll) scroll.scrollBy(100_000)
              return
            } catch (retryError) {
              if (isStaleRequest()) return
              log.debug("Session sync retry failed", { error: retryError })
            }
          }

          if (existence === "missing") {
            toast.show({
              message: `Session not found: ${sessionID}`,
              variant: "error",
            })
            navigate({ type: "home" })
            return
          }

          toast.show({
            message: `Failed to load session: ${sessionID}`,
            variant: "error",
          })
          navigate({ type: "home" })
        }
      },
      { defer: true },
    ),
  )

  const toast = useToast()
  const sdk = useSDK()

  // Handle initial prompt from fork
  createEffect(() => {
    if (route.initialPrompt && prompt) {
      prompt.set(route.initialPrompt)
    }
  })

  let lastSwitch: string | undefined = undefined
  sdk.event.on("message.part.updated", (evt) => {
    const part = evt.properties.part
    if (part.type !== "tool") return
    if (part.sessionID !== route.sessionID) return
    if (part.state.status !== "completed") return
    if (part.id === lastSwitch) return

    if (part.tool === "plan_exit") {
      local.agent.set("build")
      lastSwitch = part.id
    } else if (part.tool === "plan_enter") {
      local.agent.set("plan")
      lastSwitch = part.id
    }
  })

  let prompt: PromptRef
  const keybind = useKeybind()

  // Allow exit when in child session (prompt is hidden)
  const exit = useExit()
  const sessionStartTime = Date.now()
  
  // Track usage for exit message
  const [sessionUsage, setSessionUsage] = createSignal<SessionUsage.SessionUsageSummary | null>(null)
  
  // Load usage data periodically
  createEffect(() => {
    const id = route.sessionID
    if (!id) return
    
    const loadUsage = async () => {
      const { SessionUsage } = await import("@/runtime/session/usage")
      const usage = await SessionUsage.getSessionUsage(id)
      if (usage) setSessionUsage(usage)
    }
    
    loadUsage()
    const interval = setInterval(loadUsage, 30000) // Update every 30s
    return () => clearInterval(interval)
  })

  // Build the exit message with latest telemetry
  const buildExitMessage = async () => {
    const currentSession = session()
    if (!currentSession) return ""
    
    const title = Locale.truncate(currentSession.title ?? "", 48)
    const id = currentSession.id
    
    // Get latest usage data at exit time
    const { SessionUsage } = await import("@/runtime/session/usage")
    const usage = await SessionUsage.getSessionUsage(id)
    
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000)
    const durationStr = duration < 60 ? `${duration}s` : `${Math.floor(duration / 60)}m ${duration % 60}s`
    
    const sand = UI.Style.TEXT_NORMAL // Sand color
    const dim = UI.Style.TEXT_DIM
    const bold = UI.Style.TEXT_NORMAL_BOLD
    const reset = UI.Style.TEXT_NORMAL
    
    // Box drawing characters
    const h = "═"
    const v = "║"
    const tl = "╔"
    const tr = "╗"
    const bl = "╚"
    const br = "╝"
    const ml = "╠"
    const mr = "╣"
    
    const width = 66
    const pad = (label: string, value: string) => {
      const labelStr = `${dim}${label.padEnd(10)}${reset}${v} `
      const valueStr = `${sand}${value}${reset}`
      const totalLen = 10 + 2 + value.length // label + "│ " + value
      const padding = " ".repeat(Math.max(0, width - totalLen - 4))
      return `${v} ${labelStr}${valueStr}${padding}${v}`
    }
    
    const top = `${tl}${h.repeat(width - 2)}${tr}`
    const mid = `${ml}${h.repeat(width - 2)}${mr}`
    const bot = `${bl}${h.repeat(width - 2)}${br}`
    const empty = `${v}${" ".repeat(width - 2)}${v}`
    
    const lines = [
      "",
      top,
      empty,
      `${v}  ${bold}SESSION SUMMARY${reset}${" ".repeat(width - 18)}${v}`,
      empty,
      pad("Session", title),
      pad("Resume", `gizzi-code -s ${id.slice(0, 20)}...`),
      pad("Duration", durationStr),
      ...(usage ? [
        pad("Messages", String(usage.messageCount)),
        pad("Tokens", SessionUsage.formatTokens(usage.total.tokens)),
        pad("Cost", SessionUsage.formatCost(usage.total.cost)),
      ] : []),
      empty,
      bot,
      "",
      `  ${dim}Thank you for using${reset} ${bold}Gizzi Code${reset} ${dim}— See you next time!${reset}`,
      "",
    ]
    
    return lines.join("\n")
  }
  
  // Set up exit message that captures fresh data
  createEffect(() => {
    const currentSession = session()
    if (!currentSession) return
    
    // Pre-build the message so it's ready
    buildExitMessage().then(message => {
      exit.message.set(message)
    })
    
    return () => {
      // On cleanup (exit), refresh with latest data
      buildExitMessage().then(message => {
        exit.message.set(message)
      })
    }
  })

  const runManualCompact = async () => {
    try {
      toast.show({ message: "Compacting session...", variant: "info", duration: 2000 })
      await GuardArtifacts.initialize(Instance.directory)
      const msgs = messages()
      const receipts = await GuardArtifacts.readReceipts(Instance.directory)
      const { SessionUsage } = await import("@/runtime/session/usage")
      const usageSummary = await SessionUsage.getSessionUsage(route.sessionID)
      const lastAssistant = msgs.findLast(m => m.role === "assistant") as AssistantMessage | undefined
      const result = await GuardCompaction.emit({
        session_id: route.sessionID,
        run_id: `run_${Date.now()}`,
        workspace: Instance.directory,
        messages: msgs.map(m => ({ info: m as any, parts: sync.data.part[m.id] ?? [] })) as any,
        receipts,
        usage_summary: usageSummary ?? null,
        objective: undefined,
        model: lastAssistant?.modelID ?? "unknown",
        provider: lastAssistant?.providerID ?? "unknown",
        runner: "gizzi_shell"
      })
      toast.show({
        message: `Compacted! Baton: ${result.baton_path.split("/").pop()}`,
        variant: "success",
        duration: 3000
      })
    } catch (e) {
      toast.show({
        message: `Compaction failed: ${e}`,
        variant: "error",
        duration: 5000
      })
    }
  }

  const runHandoffDialog = () => {
    dialog.replace(() => (
      <DialogConfirm
        title="Handoff Session"
        message="Switch to alternative runner? This will compact and create a handoff baton."
        onConfirm={async () => {
          dialog.clear()
          try {
            toast.show({ message: "Preparing handoff...", variant: "info", duration: 2000 })
            await GuardArtifacts.initialize(Instance.directory)
            const msgs = messages()
            const lastAssistant = msgs.findLast(m => m.role === "assistant") as SyncMessage | undefined
            const { SessionUsage } = await import("@/runtime/session/usage")
            const usageSummary = await SessionUsage.getSessionUsage(route.sessionID)
            const receipts = await GuardArtifacts.readReceipts(Instance.directory)
            const result = await GuardCompaction.emit({
              session_id: route.sessionID,
              run_id: `run_${Date.now()}`,
              workspace: Instance.directory,
              messages: msgs.map(m => ({ info: m as any, parts: (sync.data.part[m.id] ?? []) as any[] })) as any,
              receipts,
              usage_summary: usageSummary ?? null,
              objective: undefined,
              model: lastAssistant?.modelID ?? "unknown",
              provider: lastAssistant?.providerID ?? "unknown",
              runner: "gizzi_shell"
            })
            GuardPolicy.failClosed(
              {
                context_ratio: 0.92,
                quota_ratio: 0,
                tokens_input: usageSummary?.total.tokens ?? 0,
                tokens_output: 0,
                tokens_total: usageSummary?.total.tokens ?? 0,
                context_window: 200000,
                throttle_count: 0
              },
              {
                session_id: route.sessionID,
                run_id: `run_${Date.now()}`,
                model: lastAssistant?.modelID ?? "unknown",
                provider: lastAssistant?.providerID ?? "unknown",
                runner: "gizzi_shell",
                workspace: Instance.directory
              },
              "Manual handoff requested"
            )
            toast.show({
              message: `Handoff ready! Baton: ${result.baton_path.split("/").pop()}`,
              variant: "warning",
              duration: 5000
            })
          } catch (e) {
            toast.show({
              message: `Handoff failed: ${e}`,
              variant: "error",
              duration: 5000
            })
          }
        }}
        onCancel={() => dialog.clear()}
      />
    ))
  }

  // Ctrl+C / Ctrl+D exit handler for root sessions (child sessions use app_exit to go back to parent)
  useKeyboard((evt) => {
    if (session()?.parentID) {
      // Child session: app_exit goes back to parent
      if (keybind.match("app_exit", evt)) {
        exit()
      }
      return
    }
    // Root session: Ctrl+C / Ctrl+D exits the whole app
    if (keybind.match("app_exit", evt)) {
      const sessionStatus = (sync.data.session_status?.[route.sessionID] ?? { type: "idle" }) as unknown as SessionStatus
      const isIdle = sessionStatus.type === "idle"
      if (!isIdle) {
        // Session is running: Ctrl+C aborts first, user must press again to exit
        sdk.client.session.abort({ path: { sessionID: route.sessionID } }).catch(() => {})
        evt.preventDefault()
        return
      }
      exit()
      evt.preventDefault()
    }
    // Copy code block with 'y'
    if (evt.name === "y") {
      const currentAssistant = lastAssistant()
      if (currentAssistant) {
        const parts = (sync.data.part[currentAssistant.id] ?? []) as SyncPart[]
        const textPart = parts.find((p): p is Extract<SyncPart, { type: "text" }> => p.type === "text" && "text" in p && p.text.trim().length > 0)
        if (textPart && "text" in textPart && hasCodeBlocks(textPart.text)) {
          const codeBlock = getFirstCodeBlock(textPart.text)
          if (codeBlock) {
            Clipboard.copy(codeBlock.code).then(() => {
              toast.show({ message: "Code block copied!", variant: "success", duration: 2000 })
            })
          }
        } else {
          // No code block found, copy entire message text
          const fullText = parts.filter((p): p is Extract<SyncPart, { type: "text" }> => p.type === "text" && "text" in p).map(p => "text" in p ? p.text : "").join("\n")
          if (fullText) {
            Clipboard.copy(fullText).then(() => {
              toast.show({ message: "Message copied!", variant: "success", duration: 2000 })
            })
          }
        }
      }
    }
    // Toggle bookmark with 'm'
    if (evt.name === "m") {
      const targetMessage = lastAssistant()
      if (targetMessage) {
        const isNowBookmarked = !bookmarks.isBookmarked(targetMessage.id)
        bookmarks.toggle(targetMessage.id)
        toast.show({
          message: isNowBookmarked ? "Message bookmarked" : "Bookmark removed",
          variant: "info",
          duration: 2000,
        })
      }
    }
    // Search with '/'
    if (evt.name === "/") {
      evt.preventDefault()
      dialog.replace(() => (
        <DialogSearch
          sessionID={route.sessionID}
          onNavigate={navigateToMessage}
        />
      ))
    }
    // View usage with '$'
    if (evt.name === "$") {
      evt.preventDefault()
      dialog.replace(() => <DialogUsage sessionID={route.sessionID} />)
    }
    // Next/prev search result with n/N
    if (evt.name === "n" && search.hasResults()) {
      search.nextResult()
      const result = search.currentResult()
      if (result) {
        navigateToMessage(result.messageID)
        toast.show({
          message: `Result ${search.currentIndex() + 1}/${search.resultCount()}`,
          variant: "info",
          duration: 1500,
        })
      }
    }
    if (evt.name === "N" && search.hasResults()) {
      search.prevResult()
      const result = search.currentResult()
      if (result) {
        navigateToMessage(result.messageID)
        toast.show({
          message: `Result ${search.currentIndex() + 1}/${search.resultCount()}`,
          variant: "info",
          duration: 1500,
        })
      }
    }
    // Help dialog with '?'
    if (evt.name === "?") {
      evt.preventDefault()
      dialog.replace(() => <DialogHelp />)
    }
    // Jump to message with ':'
    if (evt.name === ":") {
      evt.preventDefault()
      dialog.replace(() => (
        <DialogJump
          totalMessages={messages().length}
          currentIndex={0}
          onJump={(index) => {
            const msg = messages()[index]
            if (msg) navigateToMessage(msg.id)
          }}
        />
      ))
    }
    // File references with 'f'
    if (evt.name === "f") {
      evt.preventDefault()
      dialog.replace(() => <DialogFileRefs sessionID={route.sessionID} />)
    }
    // Pinned messages with 'P' (shift+p)
    if (evt.name === "P") {
      evt.preventDefault()
      dialog.replace(() => (
        <DialogPinned
          sessionID={route.sessionID}
          onNavigate={navigateToMessage}
        />
      ))
    }
    // Guard: Manual compact with 'C'
    if (evt.name === "C") {
      evt.preventDefault()
      runManualCompact()
    }
    
    // Guard: Manual handoff with 'H'
    if (evt.name === "H") {
      evt.preventDefault()
      runHandoffDialog()
    }
  })

  // Helper: Find next visible message boundary in direction
  const findNextVisibleMessage = (direction: "next" | "prev"): string | null => {
    const children = scroll.getChildren()
    const messagesList = messages()
    const scrollTop = scroll.y

    // Get visible messages sorted by position, filtering for valid non-synthetic, non-ignored content
    const visibleMessages = children
      .filter((c) => {
        if (!c.id) return false
        const message = messagesList.find((m) => m.id === c.id)
        if (!message) return false

        // Check if message has valid non-synthetic, non-ignored text parts
        const parts = sync.data.part[message.id]
        if (!parts || !Array.isArray(parts)) return false

        return (parts as SyncPart[]).some((part) => part && part.type === "text" && "synthetic" in part && !part.synthetic && "ignored" in part && !part.ignored)
      })
      .sort((a, b) => a.y - b.y)

    if (visibleMessages.length === 0) return null

    if (direction === "next") {
      // Find first message below current position
      return visibleMessages.find((c) => c.y > scrollTop + 10)?.id ?? null
    }
    // Find last message above current position
    return [...visibleMessages].reverse().find((c) => c.y < scrollTop - 10)?.id ?? null
  }

  // Helper: Scroll to message in direction or fallback to page scroll
  const scrollToMessage = (direction: "next" | "prev", dialog: ReturnType<typeof useDialog>) => {
    const targetID = findNextVisibleMessage(direction)

    if (!targetID) {
      scroll.scrollBy(direction === "next" ? scroll.height : -scroll.height)
      dialog.clear()
      return
    }

    const child = scroll.getChildren().find((c) => c.id === targetID)
    if (child) scroll.scrollBy(child.y - scroll.y - 1)
    dialog.clear()
  }

  function toBottom() {
    setTimeout(() => {
      if (!scroll || scroll.isDestroyed) return
      scroll.scrollTo(scroll.scrollHeight)
    }, 50)
  }

  const local = useLocal()

  function moveChild(direction: number) {
    if (children().length === 1) return
    let next = children().findIndex((x: SyncSession) => x.id === session()?.id) + direction
    if (next >= children().length) next = 0
    if (next < 0) next = children().length - 1
    if (children()[next]) {
      navigate({
        type: "session",
        sessionID: children()[next].id,
      })
    }
  }

  const command = useCommandDialog()
  command.register(() => [
    {
      title: "Copy last code block",
      value: "messages.copy_code",
      keybind: "copy_code",
      category: "Messages",
      slash: { name: "copy-code" },
      onSelect: (dialog) => {
        const currentAssistant = lastAssistant()
        if (currentAssistant) {
          const parts = (sync.data.part[currentAssistant.id] ?? []) as SyncPart[]
          const textPart = parts.find((p): p is Extract<SyncPart, { type: "text" }> => p.type === "text" && "text" in p && p.text.trim().length > 0)
          if (textPart && "text" in textPart && hasCodeBlocks(textPart.text)) {
            const codeBlock = getFirstCodeBlock(textPart.text)
            if (codeBlock) {
              Clipboard.copy(codeBlock.code).then(() => {
                toast.show({ message: "Code block copied!", variant: "success", duration: 2000 })
              })
            }
          } else {
            toast.show({ message: "No code block found", variant: "warning", duration: 2000 })
          }
        }
        dialog.clear()
      },
    },
    {
      title: "Search messages",
      value: "messages.search",
      keybind: "search_messages",
      category: "Messages",
      slash: { name: "search" },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogSearch
            sessionID={route.sessionID}
            onNavigate={navigateToMessage}
          />
        ))
      },
    },
    {
      title: "View bookmarks",
      value: "messages.bookmarks",
      keybind: "view_bookmarks",
      category: "Messages",
      slash: { name: "bookmarks" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogBookmarks sessionID={route.sessionID} />)
      },
    },
    {
      title: "View usage",
      value: "messages.usage",
      keybind: "view_usage",
      category: "Messages",
      slash: { name: "usage" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogUsage sessionID={route.sessionID} />)
      },
    },
    {
      title: "Clear scroll memory for this session",
      value: "scroll.clear_session",
      category: "View",
      onSelect: (dialog) => {
        scrollMemory.clear()
        toast.show({ message: "Scroll memory cleared", variant: "info", duration: 2000 })
        dialog.clear()
      },
    },
    {
      title: "Collapse all messages",
      value: "messages.collapse_all",
      category: "Messages",
      onSelect: (dialog) => {
        const assistantMessages = messages().filter((m) => m.role === "assistant").map((m) => m.id)
        messageState.collapseAll(assistantMessages)
        dialog.clear()
      },
    },
    {
      title: "Expand all messages",
      value: "messages.expand_all",
      category: "Messages",
      onSelect: (dialog) => {
        messageState.expandAll()
        dialog.clear()
      },
    },
    {
      title: session()?.share?.url ? GIZZICopy.palette.copyShareLink : GIZZICopy.palette.shareSession,
      value: "session.share",
      suggested: route.type === "session",
      keybind: "session_share",
      category: GIZZICopy.prompt.categorySession,
      enabled: (sync.data.config as SyncConfig).share !== "disabled",
      slash: {
        name: "share",
      },
      onSelect: async (dialog) => {
        const copy = (url: string) =>
          Clipboard.copy(url)
            .then(() => toast.show({ message: GIZZICopy.toast.shareUrlCopied, variant: "success" }))
            .catch(() => toast.show({ message: GIZZICopy.toast.shareUrlCopyFailed, variant: "error" }))
        const url = session()?.share?.url
        if (url) {
          await copy(url)
          dialog.clear()
          return
        }
        await sdk.client.session
          .share({
            path: { sessionID: route.sessionID },
          })
          .then((res: any) => copy(res.data!.share!.url))
          .catch(() => toast.show({ message: GIZZICopy.toast.shareSessionFailed, variant: "error" }))
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.renameSession,
      value: "session.rename",
      keybind: "session_rename",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "rename",
      },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogSessionRename session={route.sessionID} />)
      },
    },
    {
      title: GIZZICopy.palette.jumpToMessage,
      value: "session.timeline",
      keybind: "session_timeline",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "timeline",
      },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogTimeline
            onMove={(messageID) => {
              const child = scroll.getChildren().find((child) => {
                return child.id === messageID
              })
              if (child) scroll.scrollBy(child.y - scroll.y - 1)
            }}
            sessionID={route.sessionID}
            setPrompt={(promptInfo) => prompt.set(promptInfo)}
          />
        ))
      },
    },
    {
      title: GIZZICopy.palette.forkFromMessage,
      value: "session.fork",
      keybind: "session_fork",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "fork",
      },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogForkFromTimeline
            onMove={(messageID) => {
              const child = scroll.getChildren().find((child) => {
                return child.id === messageID
              })
              if (child) scroll.scrollBy(child.y - scroll.y - 1)
            }}
            sessionID={route.sessionID}
          />
        ))
      },
    },
    {
      title: GIZZICopy.session.createCheckpoint,
      value: "session.compact",
      keybind: "session_compact",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "compact",
        aliases: ["summarize"],
      },
      onSelect: (dialog) => {
        const selectedModel = local.model.current()
        if (!selectedModel) {
          toast.show({
            variant: "warning",
            message: GIZZICopy.session.checkpointProviderHint,
            duration: 3000,
          })
          return
        }
        sdk.client.session.summarize({
          path: { sessionID: route.sessionID },
          body: { modelID: selectedModel.modelID, providerID: selectedModel.providerID },
        } as any)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.unshareSession,
      value: "session.unshare",
      keybind: "session_unshare",
      category: GIZZICopy.prompt.categorySession,
      enabled: !!session()?.share?.url,
      slash: {
        name: "unshare",
      },
      onSelect: async (dialog) => {
        await (sdk.client.session as any)
          .unshare({
            path: { sessionID: route.sessionID },
          })
          .then(() => toast.show({ message: GIZZICopy.toast.unsharedSuccess, variant: "success" }))
          .catch(() => toast.show({ message: GIZZICopy.toast.unsharedFailed, variant: "error" }))
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.undoPreviousMessage,
      value: "session.undo",
      keybind: "messages_undo",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "undo",
      },
      onSelect: async (dialog) => {
        const status = (sync.data.session_status?.[route.sessionID] ?? { type: "idle" }) as unknown as SessionStatus
        if (status.type !== "idle") await sdk.client.session.abort({ path: { sessionID: route.sessionID } }).catch(() => {})
        const revert = session()?.revert?.messageID
        const message = messages().findLast((x) => (!revert || x.id < revert) && x.role === "user")
        if (!message) return
        sdk.client.session
          .revert({
            path: { sessionID: route.sessionID },
            body: { messageID: message.id },
          })
          .then(() => {
            toBottom()
          })
        const parts = (sync.data.part[message.id] ?? []) as SyncPart[]
        prompt.set(
          parts.reduce(
            (agg: { input: string; parts: PromptInfo["parts"] }, part: SyncPart) => {
              if (part.type === "text" && "text" in part) {
                if (!("synthetic" in part) || !part.synthetic) agg.input += part.text
              }
              if (part.type === "file") agg.parts.push(part as AnySDKType)
              return agg
            },
            { input: "", parts: [] as PromptInfo["parts"] },
          ),
        )
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.redo,
      value: "session.redo",
      keybind: "messages_redo",
      category: GIZZICopy.prompt.categorySession,
      enabled: !!session()?.revert?.messageID,
      slash: {
        name: "redo",
      },
      onSelect: (dialog) => {
        dialog.clear()
        const messageID = session()?.revert?.messageID
        if (!messageID) return
        const message = messages().find((x: SyncMessage) => x.role === "user" && x.id > messageID)
        if (!message) {
          sdk.client.session.unrevert({
            path: { sessionID: route.sessionID },
          })
          prompt.set({ input: "", parts: [] })
          return
        }
        sdk.client.session.revert({
          path: { sessionID: route.sessionID },
          body: { messageID: message.id },
        })
      },
    },
    {
      title: sidebarVisible() ? GIZZICopy.palette.hideSidebar : GIZZICopy.palette.showSidebar,
      value: "session.sidebar.toggle",
      keybind: "sidebar_toggle",
      category: GIZZICopy.prompt.categorySession,
      onSelect: (dialog) => {
        batch(() => {
          const isVisible = sidebarVisible()
          setSidebar(() => (isVisible ? "hide" : "auto"))
          setSidebarOpen(!isVisible)
        })
        dialog.clear()
      },
    },
    {
      title: conceal() ? GIZZICopy.palette.disableCodeConcealment : GIZZICopy.palette.enableCodeConcealment,
      value: "session.toggle.conceal",
      keybind: "messages_toggle_conceal",
      category: GIZZICopy.prompt.categorySession,
      onSelect: (dialog) => {
        setConceal((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showTimestamps() ? GIZZICopy.palette.hideTimestamps : GIZZICopy.palette.showTimestamps,
      value: "session.toggle.timestamps",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "timestamps",
        aliases: ["toggle-timestamps"],
      },
      onSelect: (dialog) => {
        setTimestamps((prev) => (prev === "show" ? "hide" : "show"))
        dialog.clear()
      },
    },
    {
      title: showThinking() ? GIZZICopy.palette.hideThinking : GIZZICopy.palette.showThinking,
      value: "session.toggle.thinking",
      keybind: "display_thinking",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "thinking",
        aliases: ["toggle-thinking"],
      },
      onSelect: (dialog) => {
        setShowThinking((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: "Think",
      value: "session.think",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "think",
      },
      onSelect: (dialog) => {
        local.model.variant.set("medium")
        toast.show({ message: "Thinking enabled (medium)", variant: "success" })
        dialog.clear()
      },
    },
    {
      title: "Think hard",
      value: "session.think_hard",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "think-hard",
        aliases: ["think hard", "think-hard"],
      },
      onSelect: (dialog) => {
        local.model.variant.set("high")
        toast.show({ message: "Think hard enabled (high)", variant: "success" })
        dialog.clear()
      },
    },
    {
      title: "Ultrathink",
      value: "session.ultrathink",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "ultrathink",
        aliases: ["megathink"],
      },
      onSelect: (dialog) => {
        local.model.variant.set("max")
        toast.show({ message: "Ultrathink enabled (max)", variant: "success" })
        dialog.clear()
      },
    },
    {
      title: showRuntimeTrace() ? GIZZICopy.palette.hideRuntimeTrace : GIZZICopy.palette.showRuntimeTrace,
      value: "session.toggle.runtime_trace",
      keybind: "display_runtime_trace",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "runtime-trace",
      },
      onSelect: (dialog) => {
        setShowRuntimeTrace((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showReceipts() ? GIZZICopy.palette.hideReceipts : GIZZICopy.palette.showReceipts,
      value: "session.toggle.receipts",
      keybind: "display_receipts",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "receipts",
      },
      onSelect: (dialog) => {
        setShowReceipts((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showCards() ? GIZZICopy.palette.hidePreviewCards : GIZZICopy.palette.showPreviewCards,
      value: "session.toggle.preview_cards",
      keybind: "display_cards",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "preview-cards",
      },
      onSelect: (dialog) => {
        setShowCards((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showLaneHistory() ? GIZZICopy.palette.hideLaneHistory : GIZZICopy.palette.showLaneHistory,
      value: "session.toggle.lane_history",
      keybind: "display_lane_history",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "lane-history",
      },
      onSelect: (dialog) => {
        setShowLaneHistory((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: focusRuntime() ? GIZZICopy.palette.disableRuntimeFocus : GIZZICopy.palette.enableRuntimeFocus,
      value: "session.toggle.runtime_focus",
      keybind: "runtime_focus_mode",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "runtime-focus",
      },
      onSelect: (dialog) => {
        setFocusRuntime((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showDetails() ? GIZZICopy.palette.hideToolDetails : GIZZICopy.palette.showToolDetails,
      value: "session.toggle.actions",
      keybind: "tool_details",
      category: GIZZICopy.prompt.categorySession,
      onSelect: (dialog) => {
        setShowDetails((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.toggleSessionScrollbar,
      value: "session.toggle.scrollbar",
      keybind: "scrollbar_toggle",
      category: GIZZICopy.prompt.categorySession,
      onSelect: (dialog) => {
        setShowScrollbar((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showHeader() ? GIZZICopy.palette.hideHeader : GIZZICopy.palette.showHeader,
      value: "session.toggle.header",
      category: GIZZICopy.prompt.categorySession,
      onSelect: (dialog) => {
        setShowHeader((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: showGenericToolOutput() ? GIZZICopy.palette.hideGenericToolOutput : GIZZICopy.palette.showGenericToolOutput,
      value: "session.toggle.generic_tool_output",
      category: GIZZICopy.prompt.categorySession,
      onSelect: (dialog) => {
        setShowGenericToolOutput((prev) => !prev)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.pageUp,
      value: "session.page.up",
      keybind: "messages_page_up",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollBy(-scroll.height / 2)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.pageDown,
      value: "session.page.down",
      keybind: "messages_page_down",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollBy(scroll.height / 2)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.lineUp,
      value: "session.line.up",
      keybind: "messages_line_up",
      category: GIZZICopy.prompt.categorySession,
      disabled: true,
      onSelect: (dialog) => {
        scroll.scrollBy(-1)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.lineDown,
      value: "session.line.down",
      keybind: "messages_line_down",
      category: GIZZICopy.prompt.categorySession,
      disabled: true,
      onSelect: (dialog) => {
        scroll.scrollBy(1)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.halfPageUp,
      value: "session.half.page.up",
      keybind: "messages_half_page_up",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollBy(-scroll.height / 4)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.halfPageDown,
      value: "session.half.page.down",
      keybind: "messages_half_page_down",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollBy(scroll.height / 4)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.firstMessage,
      value: "session.first",
      keybind: "messages_first",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollTo(0)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.lastMessage,
      value: "session.last",
      keybind: "messages_last",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => {
        scroll.scrollTo(scroll.scrollHeight)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.jumpToLastUserMessage,
      value: "session.messages_last_user",
      keybind: "messages_last_user",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: () => {
        const messages = (sync.data.message[route.sessionID] ?? []) as SyncMessage[]
        if (!messages || !messages.length) return

        // Find the most recent user message with non-ignored, non-synthetic text parts
        for (let i = messages.length - 1; i >= 0; i--) {
          const message = messages[i] as SyncMessage
          if (!message || message.role !== "user") continue

          const parts = (sync.data.part[message.id] ?? []) as SyncPart[]
          if (!parts || !Array.isArray(parts)) continue

          const hasValidTextPart = parts.some(
            (part: SyncPart) => part && part.type === "text" && "synthetic" in part && !part.synthetic && "ignored" in part && !part.ignored,
          )

          if (hasValidTextPart) {
            const child = scroll.getChildren().find((child) => {
              return child.id === message.id
            })
            if (child) scroll.scrollBy(child.y - scroll.y - 1)
            break
          }
        }
      },
    },
    {
      title: GIZZICopy.palette.nextMessage,
      value: "session.message.next",
      keybind: "messages_next",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => scrollToMessage("next", dialog),
    },
    {
      title: GIZZICopy.palette.previousMessage,
      value: "session.message.previous",
      keybind: "messages_previous",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => scrollToMessage("prev", dialog),
    },
    {
      title: GIZZICopy.palette.copyLastAssistantMessage,
      value: "messages.copy",
      keybind: "messages_copy",
      category: GIZZICopy.prompt.categorySession,
      onSelect: (dialog) => {
        const revertID = session()?.revert?.messageID
        const lastAssistantMessage = messages().findLast(
          (msg: SyncMessage) => msg.role === "assistant" && (!revertID || msg.id < revertID),
        )
        if (!lastAssistantMessage) {
          toast.show({ message: GIZZICopy.toast.noAssistantMessages, variant: "error" })
          dialog.clear()
          return
        }

        const parts = (sync.data.part[lastAssistantMessage.id] ?? []) as SyncPart[]
        const textParts = parts.filter((part): part is Extract<SyncPart, { type: "text" }> => part.type === "text" && "text" in part)
        if (textParts.length === 0) {
          toast.show({ message: GIZZICopy.toast.noAssistantTextParts, variant: "error" })
          dialog.clear()
          return
        }

        const text = textParts
          .map((part) => part.text)
          .join("\n")
          .trim()
        if (!text) {
          toast.show({
            message: GIZZICopy.toast.noAssistantTextContent,
            variant: "error",
          })
          dialog.clear()
          return
        }

        Clipboard.copy(text)
          .then(() => toast.show({ message: GIZZICopy.toast.messageCopied, variant: "success" }))
          .catch(() => toast.show({ message: GIZZICopy.toast.messageCopyFailed, variant: "error" }))
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.copySessionTranscript,
      value: "session.copy",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "copy",
      },
      onSelect: async (dialog) => {
        try {
          const sessionData = session()
          if (!sessionData) return
          const sessionMessages = messages()
          const transcript = formatTranscript(
            sessionData as AnySDKType,
            sessionMessages.map((msg) => ({ info: msg as any, parts: (sync.data.part[msg.id] ?? []) as any[] })) as any[],
            {
              thinking: showThinking(),
              toolDetails: showDetails(),
              assistantMetadata: showAssistantMetadata(),
            },
          )
          await Clipboard.copy(transcript)
          toast.show({ message: GIZZICopy.toast.transcriptCopied, variant: "success" })
        } catch (error) {
          toast.show({ message: GIZZICopy.toast.transcriptCopyFailed, variant: "error" })
        }
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.exportSessionTranscript,
      value: "session.export",
      keybind: "session_export",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "export",
      },
      onSelect: async (dialog) => {
        try {
          const sessionData = session()
          if (!sessionData) return
          const sessionMessages = messages()

          const defaultFilename = `session-${sessionData.id.slice(0, 8)}.md`

          const options = await DialogExportOptions.show(
            dialog,
            defaultFilename,
            showThinking(),
            showDetails(),
            showAssistantMetadata(),
            false,
          )

          if (options === null) return

          const transcript = formatTranscript(
            sessionData as AnySDKType,
            sessionMessages.map((msg) => ({ info: msg as any, parts: (sync.data.part[msg.id] ?? []) as any[] })) as any[],
            {
              thinking: options.thinking,
              toolDetails: options.toolDetails,
              assistantMetadata: options.assistantMetadata,
            },
          )

          if (options.openWithoutSaving) {
            // Just open in editor without saving
            await Editor.open({ value: transcript, renderer })
          } else {
            const exportDir = process.cwd()
            const filename = options.filename.trim()
            const filepath = path.join(exportDir, filename)

            await Bun.write(filepath, transcript)

            // Open with EDITOR if available
            const result = await Editor.open({ value: transcript, renderer })
            if (result !== undefined) {
              await Bun.write(filepath, result)
            }

            toast.show({ message: GIZZICopy.toast.exported({ filename }), variant: "success" })
          }
        } catch (error) {
          toast.show({ message: GIZZICopy.toast.exportFailed, variant: "error" })
        }
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.nextChildSession,
      value: "session.child.next",
      keybind: "session_child_cycle",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => {
        moveChild(1)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.previousChildSession,
      value: "session.child.previous",
      keybind: "session_child_cycle_reverse",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => {
        moveChild(-1)
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.palette.goToParentSession,
      value: "session.parent",
      keybind: "session_parent",
      category: GIZZICopy.prompt.categorySession,
      hidden: true,
      onSelect: (dialog) => {
        const parentID = session()?.parentID
        if (parentID) {
          navigate({
            type: "session",
            sessionID: parentID,
          })
        }
        dialog.clear()
      },
    },
    // New TUI enhancement commands
    {
      title: "Keyboard shortcuts help",
      value: "session.help",
      keybind: "show_help",
      category: "General",
      slash: { name: "help" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogHelp />)
      },
    },
    {
      title: "Jump to message",
      value: "session.jump",
      keybind: "jump_to_message",
      category: "Navigation",
      slash: { name: "jump" },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogJump
            totalMessages={messages().length}
            currentIndex={0}
            onJump={(index) => {
              const msg = messages()[index]
              if (msg) navigateToMessage(msg.id)
            }}
          />
        ))
      },
    },
    {
      title: "View file references",
      value: "session.files",
      keybind: "view_files",
      category: "Session",
      slash: { name: "files" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogFileRefs sessionID={route.sessionID} />)
      },
    },
    {
      title: "View pinned messages",
      value: "session.pinned",
      keybind: "view_pinned",
      category: "Messages",
      slash: { name: "pinned" },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogPinned
            sessionID={route.sessionID}
            onNavigate={navigateToMessage}
          />
        ))
      },
    },
    {
      title: "Export session",
      value: "session.export",
      keybind: "export_session",
      category: "Session",
      slash: { name: "export" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogExport sessionID={route.sessionID} />)
      },
    },
    // Memory commands
    {
      title: "View/edit workspace memory",
      value: "session.memory",
      category: "Memory",
      slash: { name: "memory" },
      onSelect: async (dialog) => {
        const memoryPath = path.join(Instance.directory, ".gizzi", "L1-COGNITIVE", "memory", "MEMORY.md")
        const exists = await Filesystem.exists(memoryPath)
        if (!exists) {
          await Filesystem.ensureDir(path.dirname(memoryPath))
          await Filesystem.write(memoryPath, "# Workspace Memory\n\nAdd persistent notes, patterns, and decisions here.\n")
        }
        const content = await Filesystem.readText(memoryPath).catch(() => "")
        const result = await Editor.open({ value: content, renderer })
        if (result !== undefined && result !== content) {
          await Filesystem.write(memoryPath, result)
          toast.show({ message: "Memory updated", variant: "success" })
        }
        dialog.clear()
      },
    },
    {
      title: "Clear workspace memory",
      value: "session.forget",
      category: "Memory",
      slash: { name: "forget" },
      onSelect: async (dialog) => {
        const memoryPath = path.join(Instance.directory, ".gizzi", "L1-COGNITIVE", "memory", "MEMORY.md")
        const exists = await Filesystem.exists(memoryPath)
        if (!exists) {
          toast.show({ message: "No memory file found", variant: "warning" })
          dialog.clear()
          return
        }
        await Filesystem.write(memoryPath, "# Workspace Memory\n")
        toast.show({ message: "Memory cleared", variant: "success" })
        dialog.clear()
      },
    },
    // Git commands
    {
      title: "Show git diff",
      value: "session.diff",
      category: "Git",
      slash: { name: "diff" },
      onSelect: async (dialog) => {
        try {
          const proc = Bun.spawn(["git", "diff"], { cwd: Instance.directory, stdout: "pipe", stderr: "pipe" })
          const output = await new Response(proc.stdout).text()
          if (!output.trim()) {
            toast.show({ message: "No changes", variant: "info" })
            dialog.clear()
            return
          }
          await Editor.open({ value: output, renderer })
        } catch {
          toast.show({ message: "git diff failed", variant: "error" })
        }
        dialog.clear()
      },
    },
    {
      title: "Create git commit",
      value: "session.commit",
      category: "Git",
      slash: { name: "commit" },
      onSelect: async (dialog) => {
        dialog.clear()
        // Insert /commit as a prompt so the agent generates a commit message
        prompt.set({ input: "/commit ", parts: [] })
      },
    },
    // Config management commands
    {
      title: "View config",
      value: "session.config",
      category: "System",
      slash: { name: "config" },
      onSelect: async (dialog) => {
        try {
          const configPaths = [
            path.join(sync.data.path.directory || process.cwd(), "gizzi.json"),
            path.join(sync.data.path.directory || process.cwd(), "gizzi.jsonc"),
          ]
          let configPath = ""
          for (const p of configPaths) {
            if (await Filesystem.exists(p)) { configPath = p; break }
          }
          if (!configPath) {
            toast.show({ message: "No project config found", variant: "info" })
            dialog.clear()
            return
          }
          const content = await Filesystem.readText(configPath).catch(() => "{}")
          const result = await Editor.open({ value: content, renderer })
          if (result !== undefined && result !== content) {
            await Filesystem.write(configPath, result)
            toast.show({ message: "Config updated", variant: "success" })
          }
        } catch {
          toast.show({ message: "Failed to open config", variant: "error" })
        }
        dialog.clear()
      },
    },
    // Doctor / health check
    {
      title: "System health check",
      value: "session.doctor",
      category: "System",
      slash: { name: "doctor" },
      onSelect: async (dialog) => {
        const lines: string[] = ["# System Health\n"]

        // Providers
        const providers = sync.data.provider as { name: string; id: string }[]
        lines.push("## Providers")
        if (providers.length === 0) {
          lines.push("  No providers configured\n")
        } else {
          for (const p of providers) {
            lines.push(`  ${p.name}: ${p.id}`)
          }
          lines.push("")
        }

        // MCP servers
        const mcp = sync.data.mcp as Record<string, { status?: string }>
        const mcpKeys = Object.keys(mcp)
        lines.push("## MCP Servers")
        if (mcpKeys.length === 0) {
          lines.push("  No MCP servers configured\n")
        } else {
          for (const key of mcpKeys) {
            const status = mcp[key]
            lines.push(`  ${key}: ${status?.status ?? "unknown"}`)
          }
          lines.push("")
        }

        // LSP
        const lsp = sync.data.lsp as unknown as { name: string; status: string }[]
        lines.push("## LSP Servers")
        if (lsp.length === 0) {
          lines.push("  No LSP servers\n")
        } else {
          for (const l of lsp) {
            lines.push(`  ${l.name}: ${l.status}`)
          }
          lines.push("")
        }

        // Config
        lines.push("## Config")
        lines.push(`  Project dir: ${sync.data.path.directory || "unknown"}`)
        lines.push(`  Worktree: ${sync.data.path.worktree || "none"}`)
        lines.push("")

        await Editor.open({ value: lines.join("\n"), renderer })
        dialog.clear()
      },
    },
    // Permissions viewer
    {
      title: "View permission rules",
      value: "session.permissions",
      category: "System",
      slash: { name: "permissions" },
      onSelect: async (dialog) => {
        const lines: string[] = ["# Permission Rules\n"]
        const config = sync.data.config
        const permissions = (config as any).permissions ?? (config as any).permission ?? {}
        const keys = Object.keys(permissions)
        if (keys.length === 0) {
          lines.push("No permission rules configured.")
          lines.push("")
          lines.push("Add rules to gizzi.json under \"permissions\":")
          lines.push("  { \"bash\": { \"~/projects/*\": \"allow\" } }")
        } else {
          for (const [tool, value] of Object.entries(permissions)) {
            if (typeof value === "string") {
              lines.push(`  ${tool}: ${value}`)
            } else if (typeof value === "object" && value !== null) {
              lines.push(`  ${tool}:`)
              for (const [pattern, action] of Object.entries(value as Record<string, string>)) {
                lines.push(`    ${pattern}: ${action}`)
              }
            }
          }
        }
        lines.push("")
        await Editor.open({ value: lines.join("\n"), renderer })
        dialog.clear()
      },
    },
    // Hooks viewer
    {
      title: "View hook configuration",
      value: "session.hooks",
      category: "System",
      slash: { name: "hooks" },
      onSelect: async (dialog) => {
        const lines: string[] = ["# Hook Configuration\n"]
        const config = sync.data.config
        const hooks = (config as any).hooks
        if (!hooks) {
          lines.push("No hooks configured.")
          lines.push("")
          lines.push("Add hooks to gizzi.json:")
          lines.push('  "hooks": {')
          lines.push('    "command": [{ "command": "echo $GIZZI_HOOK_EVENT", "events": ["tool.*"] }]')
          lines.push("  }")
        } else {
          if (hooks.http?.length) {
            lines.push("## HTTP Hooks")
            for (const h of hooks.http) {
              lines.push(`  URL: ${h.url}`)
              lines.push(`  Events: ${h.events.join(", ")}`)
              if (h.matchers?.length) lines.push(`  Matchers: ${h.matchers.join(", ")}`)
              lines.push("")
            }
          }
          if (hooks.command?.length) {
            lines.push("## Command Hooks")
            for (const h of hooks.command) {
              lines.push(`  Command: ${h.command}`)
              lines.push(`  Events: ${h.events.join(", ")}`)
              if (h.matchers?.length) lines.push(`  Matchers: ${h.matchers.join(", ")}`)
              if (h.timeout) lines.push(`  Timeout: ${h.timeout}ms`)
              lines.push("")
            }
          }
        }
        await Editor.open({ value: lines.join("\n"), renderer })
        dialog.clear()
      },
    },
    // Vim mode toggle
    {
      title: vimMode() ? "Disable vim keybindings" : "Enable vim keybindings",
      value: "session.vim",
      category: "Input",
      slash: { name: "vim" },
      onSelect: (dialog) => {
        setVimMode((prev) => !prev)
        toast.show({
          message: vimMode() ? "Vim mode enabled (j/k/g/G navigation active)" : "Vim mode disabled",
          variant: "info",
          duration: 2000,
        })
        dialog.clear()
      },
    },
    // Plugin marketplace
    {
      title: "Plugin Marketplace",
      value: "session.plugins",
      category: "System",
      slash: { name: "plugins" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogPluginMarketplace />)
      },
    },
    {
      title: "Plugin Marketplace",
      value: "session.marketplace",
      category: "System",
      slash: { name: "marketplace" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogPluginMarketplace />)
      },
    },
    // File search
    {
      title: "Search file contents",
      value: "session.file-search",
      category: "Search",
      slash: { name: "grep" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogFileSearch sessionID={route.sessionID} />)
      },
    },
    // MCP management
    {
      title: "Manage MCP servers",
      value: "session.mcps",
      category: "System",
      slash: { name: "mcps" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogMcp />)
      },
    },
    // Agent swarm — subagent orchestration tree
    {
      title: "View agent swarm tree",
      value: "session.swarm-tree",
      category: "Agents",
      slash: { name: "swarm" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogSwarmTree sessionID={route.sessionID} />)
      },
    },
    // ACP relay status
    {
      title: "View ACP relay status",
      value: "session.acp-relay",
      category: "System",
      slash: { name: "acp" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogAcpRelay sessionID={route.sessionID} />)
      },
    },
    // Verification status
    {
      title: "View verification status",
      value: "session.verification-status",
      category: "System",
      slash: { name: "verify" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogVerificationStatus sessionID={route.sessionID} />)
      },
    },
    // Memory explorer
    {
      title: "Explore agent memory (L1/L2)",
      value: "session.memory-explorer",
      category: "System",
      slash: { name: "memory" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogMemoryExplorer />)
      },
    },
    // Sandbox — wrap all bash subprocesses in bwrap/sandbox-exec
    {
      title: "Toggle shell sandbox (bwrap / sandbox-exec)",
      value: "session.sandbox",
      category: "System",
      slash: { name: "sandbox" },
      onSelect: async (dialog) => {
        dialog.clear()
        const sessionId = session()?.id
        if (!sessionId) {
          toast.show({ message: "No active session", variant: "error", duration: 2000 })
          return
        }
        try {
          const res = await fetch(`${sdk.url}/v1/sandbox/${encodeURIComponent(sessionId)}/toggle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
            toast.show({ message: err?.error ?? "Failed to toggle sandbox", variant: "error", duration: 3000 })
            return
          }
          const state = await res.json() as { enabled: boolean; driver: string }
          toast.show({
            message: state.enabled
              ? `Sandbox ON (${state.driver}) — bash subprocesses are now isolated`
              : "Sandbox OFF — bash runs unsandboxed",
            variant: state.enabled ? "success" : "info",
            duration: 4000,
          })
        } catch {
          toast.show({ message: "Sandbox toggle failed", variant: "error", duration: 3000 })
        }
      },
    },
    // VM Session — provision / destroy a full VM for the agent session
    {
      title: "Toggle VM session (full VM isolation)",
      value: "session.vm",
      category: "System",
      slash: { name: "vm" },
      onSelect: async (dialog) => {
        dialog.clear()
        const sessionId = session()?.id
        if (!sessionId) {
          toast.show({ message: "No active session", variant: "error", duration: 2000 })
          return
        }
        try {
          const res = await fetch(`${sdk.url}/v1/vm-session/${encodeURIComponent(sessionId)}/toggle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
            toast.show({ message: err?.error ?? "Failed to toggle VM session", variant: "error", duration: 3000 })
            return
          }
          const state = await res.json() as { enabled: boolean; vm_backed: boolean }
          toast.show({
            message: state.enabled
              ? `VM session ON${state.vm_backed ? " (real microVM)" : " (process fallback)"} — bash runs inside VM`
              : "VM session OFF — bash runs locally",
            variant: state.enabled ? "success" : "info",
            duration: 4000,
          })
        } catch {
          toast.show({ message: "VM session toggle failed", variant: "error", duration: 3000 })
        }
      },
    },
    // Loop — session-scoped recurring prompt (CC2.0 /loop parity)
    {
      title: "Loop a prompt on interval",
      value: "session.loop",
      category: "Automation",
      slash: { name: "loop" },
      onSelect: async (dialog) => {
        const { DialogPrompt } = await import("@/cli/ui/tui/ui/dialog-prompt")

        // Single NL input: "every 10 minutes check my inbox" or "in 5 minutes remind me..."
        const input = await DialogPrompt.show(dialog, "Loop (natural language)", {
          placeholder: "every 10 minutes check my inbox",
          description: () => (
            <text fg={theme.textMuted}>
              Examples: "every 5m check deploys" · "every hour summarize emails" · "in 30m remind me to review PR"
            </text>
          ) as any,
        })
        if (!input) { dialog.clear(); return }

        // Parse: extract leading schedule phrase vs trailing prompt
        // Patterns: "every N unit X", "in N unit X", "daily X", "hourly X"
        const nlScheduleRe = /^(every\s+\d+\s*(?:s|sec|second|m|min|minute|h|hr|hour|d|day|w|week)s?|in\s+\d+\s*(?:s|sec|second|m|min|minute|h|hr|hour|d|day)s?|every\s+(?:day|hour|minute|morning|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|hourly|weekly)\s+/i
        const scheduleMatch = input.match(nlScheduleRe)

        let scheduleStr: string
        let promptText: string

        if (scheduleMatch) {
          scheduleStr = scheduleMatch[0].trim()
          promptText = input.slice(scheduleMatch[0].length).trim()
        } else {
          // Fallback: ask for schedule separately
          const sep = await DialogPrompt.show(dialog, "Schedule (e.g. every 10m)", { placeholder: "every 10m" })
          if (!sep) { dialog.clear(); return }
          scheduleStr = sep
          promptText = input
        }

        if (!promptText) { dialog.clear(); return }

        // Convert NL schedule to cron expression (reuse parser patterns)
        let schedule: string
        const everyNUnit = scheduleStr.match(/(?:every\s+)?(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour|d|day|w|week)s?/i)
        const inN = scheduleStr.match(/in\s+(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour)s?/i)

        if (everyNUnit) {
          const n = parseInt(everyNUnit[1])
          const u = everyNUnit[2].toLowerCase()
          if (u.startsWith("s")) schedule = `* * * * *`          // sub-minute → every minute
          else if (u.startsWith("m")) schedule = `*/${n} * * * *`
          else if (u.startsWith("h")) schedule = `0 */${n} * * *`
          else if (u.startsWith("d")) schedule = `0 9 */${n} * *`
          else if (u.startsWith("w")) schedule = `0 9 * * 1`
          else schedule = `*/${n} * * * *`
        } else if (inN) {
          const n = parseInt(inN[1])
          const u = inN[2].toLowerCase()
          const ms = u.startsWith("s") ? n * 1000 : u.startsWith("m") ? n * 60000 : n * 3600000
          // One-shot: use maxRuns=1 with a near-future interval
          const mins = Math.max(1, Math.round(ms / 60000))
          schedule = `*/${mins} * * * *`
          // Will create with maxRuns: 1 below
        } else if (/daily|every\s+day/i.test(scheduleStr)) {
          schedule = "0 9 * * *"
        } else if (/hourly|every\s+hour/i.test(scheduleStr)) {
          schedule = "0 * * * *"
        } else if (/weekly|every\s+week/i.test(scheduleStr)) {
          schedule = "0 9 * * 1"
        } else {
          schedule = scheduleStr // pass raw to cron parser
        }

        const isOneShot = inN !== null
        const sessionId = session()?.id
        const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

        try {
          await sdk.client.cron.create({
            name: `loop: ${promptText.slice(0, 40)}`,
            schedule,
            prompt: promptText,
            wakeMode: "main",
            ...(isOneShot ? { maxRuns: 1 } : {}),
            scope: "session",
            sessionId,
            expiresAt,
          } as any)
          toast.show({
            message: `Loop started: "${promptText.slice(0, 30)}" · expires in 3 days`,
            variant: "success",
            duration: 3000,
          })
        } catch {
          toast.show({ message: `Failed to create loop`, variant: "error", duration: 3000 })
        }
        dialog.clear()
      },
    },
    // Guard commands
    {
      title: "Compact session (Guard)",
      value: "guard.compact",
      keybind: "guard_compact",
      category: "Guard",
      slash: { name: "compact" },
      onSelect: (dialog) => {
        dialog.clear()
        runManualCompact()
      },
    },
    {
      title: "Handoff session (Guard)",
      value: "guard.handoff",
      keybind: "guard_handoff",
      category: "Guard",
      slash: { name: "handoff" },
      onSelect: (dialog) => {
        dialog.clear()
        runHandoffDialog()
      },
    },
    {
      title: "Logout / Exit session",
      value: "session.logout",
      category: GIZZICopy.prompt.categorySession,
      slash: {
        name: "logout",
        aliases: ["exit", "quit"],
      },
      onSelect: async (dialog) => {
        dialog.clear()
        // Build fresh exit message with latest telemetry before exiting
        const message = await buildExitMessage()
        exit.message.set(message)
        exit()
      },
    },
    // Skills 2.0 — add skill from URL
    {
      title: "Add skill from URL",
      value: "skills.add",
      category: "Skills",
      slash: { name: "skills-add" },
      onSelect: async (dialog) => {
        const { DialogPrompt } = await import("@/cli/ui/tui/ui/dialog-prompt")
        const url = await DialogPrompt.show(dialog, "Skill index URL", {
          placeholder: "https://skills.example.com/index.json",
          description: () => (
            <text fg={theme.textMuted}>URL to a skills index.json (see Discovery format)</text>
          ) as any,
        })
        if (!url) { dialog.clear(); return }
        try {
          const res = await fetch(`${sdk.url}/v1/skill/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          })
          if (!res.ok) throw new Error(`${res.status}`)
          const data = await res.json() as { added: number }
          toast.show({
            message: `Added ${data.added} skill${data.added !== 1 ? "s" : ""} from URL`,
            variant: "success",
            duration: 3000,
          })
        } catch {
          toast.show({ message: "Failed to add skills", variant: "error", duration: 3000 })
        }
        dialog.clear()
      },
    },
    // Skills 2.0 — evaluate a skill
    {
      title: "Evaluate skill (Skills 2.0)",
      value: "skills.eval",
      category: "Skills",
      slash: { name: "skills-eval" },
      onSelect: async (dialog) => {
        // Pick a skill first, then open eval dialog
        const { DialogSkill } = await import("@/cli/ui/tui/component/dialog-skill")
        dialog.replace(() => (
          <DialogSkill
            onSelect={(name) => {
              dialog.replace(() => <DialogSkillEval skillName={name} />)
            }}
          />
        ))
      },
    },
    // Google Workspace CLI setup wizard
    {
      title: "Google Workspace setup",
      value: "skills.gws",
      category: "Skills",
      slash: { name: "gws" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogGwsSetup />)
      },
    },
  ])

  const revertInfo = createMemo(() => session()?.revert)
  const revertMessageID = createMemo(() => revertInfo()?.messageID)

  const revertDiffFiles = createMemo(() => {
    const diffText = revertInfo()?.diff ?? ""
    if (!diffText) return []

    try {
      const patches = parsePatch(diffText)
      return patches.map((patch) => {
        const filename = patch.newFileName || patch.oldFileName || "unknown"
        const cleanFilename = filename.replace(/^[ab]\//, "")
        return {
          filename: cleanFilename,
          additions: patch.hunks.reduce(
            (sum, hunk) => sum + hunk.lines.filter((line) => line.startsWith("+")).length,
            0,
          ),
          deletions: patch.hunks.reduce(
            (sum, hunk) => sum + hunk.lines.filter((line) => line.startsWith("-")).length,
            0,
          ),
        }
      })
    } catch (error) {
      return []
    }
  })

  const revertRevertedMessages = createMemo(() => {
    const messageID = revertMessageID()
    if (!messageID) return []
    return messages().filter((x: SyncMessage) => x.id >= messageID && x.role === "user")
  })

  const revert = createMemo(() => {
    const info = revertInfo()
    if (!info) return
    if (!info.messageID) return
    return {
      messageID: info.messageID,
      reverted: revertRevertedMessages(),
      diff: info.diff,
      diffFiles: revertDiffFiles(),
    }
  })

  const dialog = useDialog()
  const renderer = useRenderer()
  
  // Memoized values for SessionMount
  const sessionMountTools = createMemo(() => activeTools())

  // Most recent todo list from the last todowrite tool call (any status)
  const currentTodos = createMemo(() => {
    const msgs = messages()
    for (let i = msgs.length - 1; i >= 0; i--) {
      const parts = (sync.data.part[msgs[i]!.id] ?? []) as SyncPart[]
      for (let j = parts.length - 1; j >= 0; j--) {
        const p = parts[j] as any
        if (
          p?.type === "tool" &&
          p?.tool === "todowrite" &&
          Array.isArray(p?.state?.input?.todos) &&
          p.state.input.todos.length > 0
        ) {
          return p.state.input.todos as Array<{ content: string; status: string }>
        }
      }
    }
    return [] as Array<{ content: string; status: string }>
  })

  const sessionMountStatus = createMemo<"idle" | "thinking" | "executing" | "responding" | "compacting">(() => {
    if (!pending()) return "idle"
    const status = sync.data.session_status?.[route.sessionID] ?? { type: "idle" }
    if ((status as any).type === "compacting" || (status as any).type === "compact") return "compacting"
    if (activeTools().length > 0) return "executing"
    // Detect if active assistant is generating visible text (responding phase)
    const assistant = activeAssistant()
    if (assistant) {
      const parts = (sync.data.part[assistant.id] ?? []) as SyncPart[]
      const hasText = parts.some((p) => p.type === "text" && "text" in p && (p as any).text?.trim().length > 0)
      if (hasText) return "responding"
    }
    return "thinking"
  })

  // Clean up session-scoped cron loops, sandbox state, and VM when session unmounts
  onCleanup(() => {
    const sessionId = session()?.id
    if (!sessionId) return
    fetch(`${sdk.url}/v1/cron/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" }).catch(() => {})
    fetch(`${sdk.url}/v1/sandbox/${encodeURIComponent(sessionId)}/disable`, { method: "POST" }).catch(() => {})
    // Destroy the VM session if one was provisioned — tears down the microVM
    fetch(`${sdk.url}/v1/vm-session/${encodeURIComponent(sessionId)}`, { method: "DELETE" }).catch(() => {})
  })

  // Session-level elapsed time (from session creation or first message)
  const [sessionNow, setSessionNow] = createSignal(Date.now())
  createEffect(() => {
    const timer = setInterval(() => setSessionNow(Date.now()), 1000)
    onCleanup(() => clearInterval(timer))
  })
  const sessionCreatedAt = createMemo(() => {
    const sess = session()
    if (!sess?.time?.created) return undefined
    return sess.time.created
  })
  const sessionElapsedSeconds = createMemo(() => {
    const created = sessionCreatedAt()
    if (!created) return 0
    return Math.max(0, Math.floor((sessionNow() - created) / 1000))
  })

  // Session token count from last assistant message
  const sessionTokens = createMemo(() => {
    const last = lastAssistant() as any
    if (!last?.tokens) return 0
    const t = last.tokens
    return (t.input ?? 0) + (t.output ?? 0) + (t.cache?.read ?? 0)
  })

  // Thought (reasoning) seconds from last assistant parts
  const thoughtSeconds = createMemo(() => {
    const last = lastAssistant()
    if (!last) return 0
    const parts = (sync.data.part[last.id] ?? []) as SyncPart[]
    const reasoningParts = parts.filter((p): p is Extract<SyncPart, { type: "reasoning" }> => p.type === "reasoning" && "text" in p)
    // Rough estimate: count reasoning chars / 50 chars per second
    const totalChars = reasoningParts.reduce((sum, p) => sum + (p.text?.length ?? 0), 0)
    return Math.round(totalChars / 50)
  })

  // Last run duration in ms for completion phrase
  const [lastRunMs, setLastRunMs] = createSignal<number>(0)
  let lastRunStart: number | undefined
  createEffect(() => {
    const isNowPending = pending()
    if (isNowPending && lastRunStart === undefined) {
      lastRunStart = Date.now()
    } else if (!isNowPending && lastRunStart !== undefined) {
      setLastRunMs(Date.now() - lastRunStart)
      lastRunStart = undefined
    }
  })

  // snap to bottom when session changes
  createEffect(on(() => route.sessionID, toBottom))

  return (
    <context.Provider
      value={{
        get width() {
          return contentWidth()
        },
        get height() {
          return dimensions().height
        },
        get isHeightConstrained() {
          return () => isHeightConstrained()
        },
        sessionID: route.sessionID,
        conceal,
        showThinking,
        showRuntimeTrace,
        showReceipts,
        showCards,
        showLaneHistory,
        focusRuntime,
        showTimestamps,
        showDetails,
        showGenericToolOutput,
        diffWrapMode,
        sync,
        messageState,
        bookmarks: {
          isBookmarked: bookmarks.isBookmarked,
          toggle: bookmarks.toggle,
          count: bookmarks.count,
        },
      }}
    >
      <box flexDirection="row" width="100%" height="100%">
        <box flexGrow={1} width="100%" minWidth={0} paddingBottom={1} flexDirection="column">
          {/* Top Header - Session info (moves with scroll) */}
          <SessionHeader />
          <GIZZIFrame isHeightConstrained={isHeightConstrained()}>
            <Show when={session() && showHeader() && (!sidebarVisible() || !wide())}>
              <Header />
            </Show>
            <scrollbox
              ref={(r) => (scroll = r)}
              width="100%"
              minWidth={0}
              flexGrow={1}
              flexShrink={1}
              backgroundColor={theme.background}
              viewportOptions={{
                paddingRight: showScrollbar() ? 1 : 0,
              }}
              verticalScrollbarOptions={{
                paddingLeft: 1,
                visible: showScrollbar(),
                trackOptions: {
                  backgroundColor: theme.backgroundElement,
                  foregroundColor: theme.border,
                },
              }}
              stickyScroll={true}
              stickyStart="bottom"
              scrollAcceleration={scrollAcceleration()}
            >
              <GIZZIMessageList>
                <Show when={!session()}>
                  <box marginTop={1} marginLeft={1}>
                    <text fg={theme.textMuted}>Loading session…</text>
                  </box>
                </Show>
                <Show when={session() && messages().length === 0}>
                  <box marginTop={2} marginLeft={2}>
                    <text fg={theme.textMuted}>No messages yet. Start typing below!</text>
                  </box>
                </Show>
                <For each={messages()}>
                    {(message, index) => (
                      <Switch>
                        <Match when={message.id === revert()?.messageID}>
                          {(function () {
                            const command = useCommandDialog()
                            const [hover, setHover] = createSignal(false)
                            const dialog = useDialog()

                            const handleUnrevert = async () => {
                            const confirmed = await DialogConfirm.show(
                              dialog,
                              GIZZICopy.session.confirmRedoTitle,
                              GIZZICopy.session.confirmRedoBody,
                            )
                              if (confirmed) {
                                command.trigger("session.redo")
                              }
                            }

                            return (
                              <box
                                onMouseOver={() => setHover(true)}
                                onMouseOut={() => setHover(false)}
                                onMouseUp={handleUnrevert}
                                marginTop={1}
                                flexShrink={0}
                                border={["left"]}
                                customBorderChars={SplitBorder.customBorderChars}
                                borderColor={theme.backgroundPanel}
                              >
                                <box
                                  paddingTop={1}
                                  paddingBottom={1}
                                  paddingLeft={2}
                                  backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
                                >
                                  <text fg={theme.textMuted}>
                                    {GIZZICopy.session.revertedMessages({ count: revert()!.reverted.length })}
                                  </text>
                                  <text fg={theme.textMuted}>
                                    <span style={{ fg: theme.text }}>{keybind.print("messages_redo")}</span>{" "}
                                    {GIZZICopy.session.restoreHint}
                                  </text>
                                  <Show when={revert()!.diffFiles?.length}>
                                    <box marginTop={1}>
                                      <For each={revert()!.diffFiles}>
                                        {(file) => (
                                          <box flexDirection="row" gap={1}>
                                            <text fg={theme.text}>{String(file.filename ?? "")}</text>
                                            <Show when={file.additions > 0}>
                                              <text fg={theme.diffAdded}>+{String(file.additions ?? 0)}</text>
                                            </Show>
                                            <Show when={file.deletions > 0}>
                                              <text fg={theme.diffRemoved}>-{String(file.deletions ?? 0)}</text>
                                            </Show>
                                          </box>
                                        )}
                                      </For>
                                    </box>
                                  </Show>
                                </box>
                              </box>
                            )
                          })()}
                        </Match>
                        <Match when={revert()?.messageID && message.id >= revert()!.messageID}>
                          <></>
                        </Match>
                        <Match when={message.role === "user"}>
                          <UserMessage
                            index={index()}
                            onMouseUp={() => {
                              if (renderer.getSelection()?.getSelectedText()) return
                              dialog.replace(() => (
                                <DialogMessage
                                  messageID={message.id}
                                  sessionID={route.sessionID}
                                  setPrompt={(promptInfo) => prompt.set(promptInfo)}
                                />
                              ))
                            }}
                            message={message as unknown as UserMessage}
                            parts={(sync.data.part[message.id] ?? []) as Part[]}
                            pending={pending()}
                          />
                        </Match>
                        <Match when={message.role === "assistant"}>
                          <AssistantMessage
                            last={lastAssistant()?.id === message.id}
                            message={message as unknown as AssistantMessage}
                            parts={(sync.data.part[message.id] ?? []) as Part[]}
                          />
                        </Match>
                      </Switch>
                    )}
                </For>
              </GIZZIMessageList>
            </scrollbox>
            <box flexShrink={0}>
              <Show when={permissions().length > 0}>
                <PermissionPrompt request={permissions()[0]} />
              </Show>
              <Show when={permissions().length === 0 && questions().length > 0}>
                <QuestionPrompt request={questions()[0]} />
              </Show>
              {/* Session Mount - Live status + stats + tips above input */}
              <SessionMount
                isHeightConstrained={isHeightConstrained()}
                activeTools={sessionMountTools()}
                sessionStatus={sessionMountStatus()}
                sessionElapsedSeconds={sessionElapsedSeconds()}
                sessionTokens={sessionTokens()}
                thoughtSeconds={thoughtSeconds()}
                lastRunMs={lastRunMs()}
                todos={currentTodos()}
              />
              <Prompt
                visible={(session() ? !session()?.parentID : true) && permissions().length === 0 && questions().length === 0}
                ref={(r) => {
                  prompt = r
                  promptRef.set(r)
                  // Apply initial prompt when prompt component mounts (e.g., from fork)
                  if (route.initialPrompt) {
                    r.set(route.initialPrompt)
                  }
                }}
                disabled={permissions().length > 0 || questions().length > 0}
                onSubmit={() => {
                  toBottom()
                }}
                sessionID={route.sessionID}
              />
            </box>
          </GIZZIFrame>
          <Footer 
            mascotState={sessionMascotState()}
            mascotHint={sessionMascotHint()}
            contextUsed={lastAssistant()?.tokens?.total || 0}
            contextTotal={262144}
          />
          <Toast />
        </box>
        <Show when={sidebarVisible()}>
          <Switch>
            <Match when={wide()}>
              <Sidebar sessionID={route.sessionID} />
            </Match>
            <Match when={!wide()}>
              <box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                alignItems="flex-end"
                backgroundColor={RGBA.fromInts(0, 0, 0, 70)}
              >
                <Sidebar sessionID={route.sessionID} />
              </box>
            </Match>
          </Switch>
        </Show>
      </box>
    </context.Provider>
  )
}

const MIME_BADGE: Record<string, string> = {
  "text/plain": "txt",
  "image/png": "img",
  "image/jpeg": "img",
  "image/gif": "img",
  "image/webp": "img",
  "application/pdf": "pdf",
  "application/x-directory": "dir",
}

function UserMessage(props: {
  message: UserMessage
  parts: Part[]
  onMouseUp: () => void
  index: number
  pending?: string
}) {
  const ctx = use()
  const local = useLocal()
  const text = createMemo(() => props.parts.flatMap((x) => (x.type === "text" && !x.synthetic ? [x] : []))[0])
  const files = createMemo(() => props.parts.flatMap((x) => (x.type === "file" ? [x] : [])))
  const sync = useSync()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const [hover, setHover] = createSignal(false)
  const displayText = createMemo(() => formatUserPromptPreview(collapseSearchModeText(text()?.text ?? ""), ctx.width))
  const queued = createMemo(() => !!props.pending && props.message.id >= props.pending)
  const color = createMemo(() => local.agent.color(props.message.agent ?? "default"))
  const queuedFg = createMemo(() => selectedForeground(theme, color()))
  const metadataVisible = createMemo(() => queued() || ctx.showTimestamps())

  const compaction = createMemo(() => {
    return props.parts.find((part): part is CompactionPart => part.type === "compaction")
  })

  const margin = () => (ctx.isHeightConstrained() ? tone().space.xs : tone().space.sm)

  return (
    <>
      <Show when={text()}>
        <box
          id={props.message.id}
          border={["left"]}
          borderColor={color()}
          customBorderChars={SplitBorder.customBorderChars}
          marginTop={props.index === 0 ? tone().space.xs : margin()}
        >
          <box
            onMouseOver={() => {
              setHover(true)
            }}
            onMouseOut={() => {
              setHover(false)
            }}
            onMouseUp={props.onMouseUp}
            paddingTop={tone().space.sm}
            paddingBottom={tone().space.sm}
            paddingLeft={tone().space.md}
            backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
            flexShrink={0}
          >
            <box flexDirection="row" gap={1}>
              <text fg={color()}><span style={{ bold: true }}>›</span></text>
              <text fg={theme.text} wrapMode="word">{displayText()}</text>
            </box>
            <Show when={files().length}>
              <box
                flexDirection="row"
                paddingBottom={metadataVisible() ? tone().space.sm : tone().space.xs}
                paddingTop={tone().space.sm}
                gap={tone().space.sm}
                flexWrap="wrap"
              >
                <For each={files()}>
                  {(file) => {
                    const bg = createMemo(() => {
                      const mime = file.mime ?? ""
                      if (mime.startsWith("image/")) return theme.accent
                      if (mime === "application/pdf") return theme.primary
                      return theme.secondary
                    })
                    return (
                      <text fg={theme.text}>
                        <span style={{ bg: bg(), fg: theme.background }}> {String(MIME_BADGE[file.mime ?? ""] ?? file.mime ?? "unknown")} </span>
                        <span style={{ bg: theme.backgroundElement, fg: theme.textMuted }}> {String(file.filename ?? "unnamed")} </span>
                      </text>
                    )
                  }}
                </For>
              </box>
            </Show>
            <Show
              when={queued()}
              fallback={
                <Show when={ctx.showTimestamps()}>
                  <text fg={theme.textMuted}>
                    <span style={{ fg: theme.textMuted }}>
                      {String(Locale.todayTimeOrDateTime(props.message.time.created) ?? "")}
                    </span>
                  </text>
                </Show>
              }
            >
              <text fg={theme.textMuted}>
                <span style={{ bg: color(), fg: queuedFg(), bold: true }}> {GIZZICopy.session.queueBadge} </span>
              </text>
            </Show>
          </box>
        </box>
      </Show>
      <Show when={compaction()}>
        <box marginTop={tone().space.sm}>
          <GIZZIInlineBlock
            mode="block"
            kind="checkpoint"
            title={compaction()!.auto ? GIZZICopy.session.checkpointAuto : GIZZICopy.session.checkpointManual}
            fg={theme.textMuted}
          >
            <text fg={theme.textMuted}>{GIZZICopy.session.checkpointFooter}</text>
          </GIZZIInlineBlock>
        </box>
      </Show>
    </>
  )
}

function AssistantMessage(props: { message: AssistantMessage; parts: Part[]; last: boolean }) {
  const ctx = use()
  const local = useLocal()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const sync = useSync()
  const [now, setNow] = createSignal(Date.now())
  const collapsed = createMemo(() => ctx.messageState.isCollapsed(props.message.id))
  const messages = createMemo(() => sync.data.message[props.message.sessionID] ?? [])
  const hasVisibleText = createMemo(() =>
    props.parts.some((part): part is Extract<Part, { type: "text" }> => part.type === "text" && part.text.trim().length > 0),
  )
  const hasReasoning = createMemo(() =>
    props.parts.some(
      (part): part is Extract<Part, { type: "reasoning" }> => part.type === "reasoning" && part.text.trim().length > 0,
    ),
  )
  const status = createMemo<SessionStatus>(() => (sync.data.session_status?.[props.message.sessionID] as any) ?? { type: "idle" })
  const activeTools = createMemo(() =>
    props.parts
      .filter((part): part is Extract<Part, { type: "tool" }> => part.type === "tool")
      .filter((part) => part.state.status === "pending" || part.state.status === "running")
      .map((part) => part.tool),
  )
  const hasRunningTools = createMemo(() => activeTools().length > 0)
  const hasRunningWebTools = createMemo(() => activeTools().some((tool) => isWebToolName(tool)))

  const final = createMemo(() => {
    return props.message.finish && !["tool-calls", "unknown"].includes(props.message.finish)
  })

  const duration = createMemo(() => {
    if (!final()) return 0
    if (!props.message.time.completed) return 0
    const user = messages().find((x) => x.role === "user" && x.id === props.message.parentID)
    if (!user || !user.time) return 0
    return props.message.time.completed - user.time.created
  })
  const retryStatus = createMemo(() => {
    const currentStatus = status()
    if (currentStatus.type !== "retry") return undefined
    return formatRetryStatus({
      message: currentStatus.message,
      attempt: currentStatus.attempt,
      next: Number(currentStatus.next),
      now: now(),
    })
  })
  const summaryLine = createMemo(() => {
    let line = `${Locale.titlecase(props.message.mode ?? "")} | ${sanitizeBrandSurface(props.message.modelID ?? "")}`
    if (duration()) line += ` | ${Locale.duration(duration())}`
    const tokens = props.message.tokens
    if (tokens) {
      const parts: string[] = []
      if (tokens.reasoning && tokens.reasoning > 0) parts.push(`${Locale.number(tokens.reasoning)} thinking`)
      if (tokens.input > 0) parts.push(`${Locale.number(tokens.input)} in`)
      if (tokens.output > 0) parts.push(`${Locale.number(tokens.output)} out`)
      if (tokens.cache?.read && tokens.cache.read > 0) parts.push(`${Locale.number(tokens.cache.read)} cached`)
      if (parts.length > 0) line += ` | ${parts.join(", ")}`
    }
    if (props.message.cost !== undefined) {
      line += ` | ${props.message.cost > 0 ? `$${props.message.cost.toFixed(4)}` : "$0.00"}`
    }
    if (props.message.error?.name === "MessageAbortedError") line += ` | ${GIZZICopy.session.interrupted}`
    return truncateInline(line, Math.max(24, ctx.width - 14))
  })
  const completionNote = createMemo(() =>
    truncateInline(
      `${GIZZICopy.session.runtimeTraceCaptured} ${tone().glyph.separator} ${GIZZICopy.session.checkpointFooter}`,
      Math.max(32, ctx.width - 28),
    ),
  )

  const liveBarVisible = createMemo(() => props.last && !final() && !props.message.error)
  const liveMode = createMemo<LiveMode>(() => {
    if (status().type === "retry") return "connecting"
    if (hasRunningWebTools()) return "web"
    if (hasRunningTools()) return "tools"
    if (hasReasoning() && !hasVisibleText()) return "thinking"
    if (hasVisibleText()) return "responding"
    return "connecting"
  })
  const liveModeColor = createMemo(() => {
    const mode = liveMode()
    if (mode === "connecting") return tone().status.connecting
    if (mode === "thinking") return tone().status.planning
    if (mode === "web") return tone().status.executing
    if (mode === "tools") return tone().status.executing
    return tone().status.responding
  })
  const liveModeLabel = createMemo(() => {
    const mode = liveMode()
    if (mode === "connecting") return retryStatus()?.label ?? GIZZICopy.session.modeQueued
    if (mode === "thinking") return GIZZICopy.session.modeThinking
    if (mode === "web") return GIZZICopy.session.modeWeb
    if (mode === "tools") return GIZZICopy.session.modeTools
    return GIZZICopy.session.modeResponding
  })
  const liveHint = createMemo(() => {
    const mode = liveMode()
    if (mode === "connecting" && retryStatus()) return retryStatus()!.detail
    if (mode === "connecting") {
      const elapsed = Math.max(0, Math.floor((now() - props.message.time.created) / 1000))
      if (elapsed < 6) return GIZZICopy.session.queuedLiveHint
      return GIZZICopy.session.hintQueued
    }
    if (mode === "thinking") return GIZZICopy.session.hintThinking
    if (mode === "web") return GIZZICopy.session.hintWeb
    if (mode === "tools") return GIZZICopy.session.hintTools
    return GIZZICopy.session.hintResponding
  })
  const animationProfile = createMemo<RuntimeAnimationProfile>(() => runtimeAnimationProfile())
  const animationTickMs = createMemo(() => {
    if (animationProfile() === "full") return 320
    if (animationProfile() === "minimal") return 1800
    return 1200
  })
  const heartbeatStepMs = createMemo(() => {
    if (animationProfile() === "full") return 320
    if (animationProfile() === "minimal") return 2200
    return 1500
  })
  const frameTickStepMs = createMemo(() => {
    if (animationProfile() === "full") return 120
    if (animationProfile() === "minimal") return 1600
    return 900
  })
  const errorPanel = createMemo(() =>
    formatProviderErrorPanel(props.message.error?.data?.message, ctx.width, props.message.providerID),
  )
  const heartbeat = createMemo(() => {
    if (animationProfile() === "minimal") return "."
    const frames = animationProfile() === "full" ? ([".", "..", "...", "...."] as const) : ([".", ".."] as const)
    return frames[Math.floor(now() / heartbeatStepMs()) % frames.length]
  })
  const elapsedSeconds = createMemo(() => Math.max(0, Math.floor((now() - props.message.time.created) / 1000)))
  const frameTick = createMemo(() => Math.floor(now() / frameTickStepMs()))
  const toolParts = createMemo(() =>
    props.parts.filter((part): part is Extract<Part, { type: "tool" }> => part.type === "tool"),
  )
  const liveRunID = createMemo(() => props.message.id.slice(-6))
  const narrow = createMemo(() => ctx.width < 94)
  const micro = createMemo(() => ctx.width < 74)
  const focusActive = createMemo(
    () =>
      ctx.focusRuntime() &&
      liveBarVisible() &&
      elapsedSeconds() >= 8 &&
      (liveMode() === "web" || liveMode() === "tools"),
  )

  createEffect(() => {
    if (!liveBarVisible()) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), animationTickMs())
    onCleanup(() => clearInterval(timer))
  })

  const firstTextPart = createMemo(() =>
    props.parts.find((part): part is Extract<Part, { type: "text" }> => part.type === "text" && part.text.trim().length > 0),
  )

  const collapsedPreview = createMemo(() => {
    const text = firstTextPart()?.text ?? ""
    const preview = text.slice(0, 60).replace(/\s+/g, " ").trim()
    return preview + (text.length > 60 ? "..." : "")
  })

  function handleToggle() {
    ctx.messageState.toggle(props.message.id)
  }

  const margin = () => (ctx.isHeightConstrained() ? tone().space.xs : tone().space.sm)

  return (
    <>
      {/* Fold indicator and collapsed preview */}
      <Show when={!liveBarVisible() || collapsed()}>
        <box
          flexDirection="row"
          gap={1}
          paddingLeft={tone().space.lg}
          marginTop={margin()}
        >
          <text
            fg={theme.textMuted}
            onMouseUp={handleToggle}
          >
            {collapsed() ? "▶" : "▼"}
          </text>
          <Show when={collapsed()}>
            <text fg={theme.textMuted}>
              {collapsedPreview() || "(collapsed message)"}
            </text>
          </Show>
        </box>
      </Show>

      <Show when={liveBarVisible()}>
        <Show
          when={!micro()}
          fallback={
            <box paddingLeft={tone().space.lg} marginTop={margin()} flexDirection="column" gap={tone().space.xs}>
              <box flexDirection="row" gap={1}>
                <GIZZISpinner color={liveModeColor()} variant="dots" />
                <text fg={liveModeColor()}>
                  <span style={{ bold: true }}>{liveModeLabel()}</span>
                </text>
              </box>
              <box paddingLeft={1}>
                <text fg={theme.textMuted} wrapMode="none">
                  {fitInline(`${liveHint()} ${heartbeat()} ${tone().glyph.separator} ${fmtElapsed(elapsedSeconds())}`, Math.max(16, ctx.width - 22))}
                </text>
              </box>
            </box>
          }
        >
          <LiveRuntimeDeck
            runID={liveRunID()}
            mode={liveMode()}
            color={liveModeColor()}
            hint={liveHint()}
            elapsedSeconds={elapsedSeconds()}
            frameTick={frameTick()}
            heartbeat={heartbeat()}
            toolParts={toolParts()}
            width={ctx.width}
            height={ctx.height}
            isHeightConstrained={ctx.isHeightConstrained()}
            narrow={narrow()}
            showReceipts={ctx.showReceipts()}
            showCards={ctx.showCards()}
            showLaneHistory={ctx.showLaneHistory()}
            focus={focusActive()}
            animationProfile={animationProfile()}
          />
        </Show>
      </Show>
      <Show when={!collapsed()}>
        <For each={props.parts}>
          {(part, index) => {
            const hiddenByFocus = createMemo(
              () => focusActive() && (part.type === "tool" || part.type === "reasoning"),
            )
            const component = createMemo(() => PART_MAPPING[part.type as keyof typeof PART_MAPPING])
            return (
              <Show when={component() && !hiddenByFocus()}>
                <Dynamic
                  last={index() === props.parts.length - 1}
                  component={component()}
                  part={part as any}
                  message={props.message}
                />
              </Show>
            )
          }}
        </For>
      </Show>
      <Show when={props.message.error && props.message.error.name !== "MessageAbortedError"}>
        <box
          border={["left"]}
          paddingTop={tone().space.sm}
          paddingBottom={tone().space.sm}
          paddingLeft={tone().space.md}
          marginTop={tone().space.sm}
          backgroundColor={theme.backgroundPanel}
          customBorderChars={SplitBorder.customBorderChars}
          borderColor={theme.error}
          gap={tone().space.xs}
        >
          <text fg={theme.error} wrapMode="none">
            <span style={{ bold: true }}>{errorPanel().title}</span>
          </text>
          <text fg={theme.textMuted}>{errorPanel().detail}</text>
          <Show when={errorPanel().hint}>
            <text fg={theme.textMuted} wrapMode="none">
              {errorPanel().hint}
            </text>
          </Show>
        </box>
      </Show>
      <Switch>
        <Match when={props.last || final() || props.message.error?.name === "MessageAbortedError"}>
          <box paddingLeft={tone().space.lg}>
            <box marginTop={tone().space.sm} flexDirection="row" gap={1}>
              <text
                fg={
                  props.message.error?.name === "MessageAbortedError"
                    ? theme.textMuted
                    : local.agent.color(props.message.agent)
                }
              >
                #
              </text>
              <text fg={theme.textMuted}>{summaryLine()}</text>
              <Show when={ctx.bookmarks.isBookmarked(props.message.id)}>
                <text fg={theme.warning}>🔖</text>
              </Show>
            </box>
            <Show when={final() && !props.message.error}>
              <box
                marginTop={tone().space.xs}
                border={["left"]}
                paddingLeft={tone().space.md}
                paddingTop={tone().space.xs}
                paddingBottom={tone().space.xs}
                backgroundColor={theme.backgroundPanel}
                customBorderChars={SplitBorder.customBorderChars}
                borderColor={theme.success}
              >
                <text fg={theme.success}>
                  <span style={{ bold: true }}>
                    {GIZZICopy.session.deckRun} #{props.message.id.slice(-6)} {GIZZICopy.session.deckSealed}
                  </span>{" "}
                  <span style={{ fg: theme.textMuted }}>
                    {tone().glyph.separator} {GIZZICopy.session.deckComplete}
                    {duration() ? ` ${tone().glyph.separator} ${Locale.duration(duration())}` : ""}
                  </span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  {completionNote()}
                </text>
              </box>
            </Show>
          </box>
        </Match>
      </Switch>
    </>
  )
}

function LiveRuntimeDeck(props: {
  runID: string
  mode: LiveMode
  color: RGBA
  hint: string
  elapsedSeconds: number
  frameTick: number
  heartbeat: string
  toolParts: ToolPart[]
  width: number
  height: number
  isHeightConstrained: boolean
  narrow: boolean
  showReceipts: boolean
  showCards: boolean
  showLaneHistory: boolean
  focus: boolean
  animationProfile: RuntimeAnimationProfile
}) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()

  const thread = createMemo(() => props.toolParts.slice(-6))
  const laneTools = createMemo<RuntimeLaneToolSnapshot[]>(() =>
    props.toolParts.map((part) => ({
      callID: part.callID,
      tool: part.tool,
      status: toRuntimeLaneStatus(part.state.status),
      label: toolThreadLabel(part.tool),
      detail: toolThreadDetail(part) || undefined,
      meta: toolThreadMetadata(part) || undefined,
      web: isWebToolName(part.tool),
    })),
  )

  const laneCards = createMemo<RuntimeLaneCard[]>(() =>
    deriveRuntimeLaneCards({
      tools: laneTools(),
      modeLabel: liveModeLabel(props.mode),
      modeHint: truncateInline(sanitizeBrandSurface(props.hint), props.narrow ? 34 : 54),
      modeStatus: modeToLaneStatus(props.mode),
      runID: props.runID,
      elapsedSeconds: props.elapsedSeconds,
      pulse: props.animationProfile === "full" ? liveModePulse(props.mode, props.frameTick) : "...",
      heartbeat: props.animationProfile === "full" ? props.heartbeat : "",
      separator: tone().glyph.separator,
      glyphTool: tone().glyph.tool,
      includeHistory: props.showLaneHistory,
      historyLimit: props.narrow ? 1 : 3,
      maxCards: props.narrow ? 3 : props.showLaneHistory ? 5 : 4,
      defaultExecutingHint: GIZZICopy.session.hintExecuting,
    }).map((card) => ({
      ...card,
      title: sanitizeBrandSurface(card.title),
      body: truncateInline(sanitizeBrandSurface(card.body), props.narrow ? 34 : 54),
      meta: card.meta ? truncateInline(sanitizeBrandSurface(card.meta), props.narrow ? 34 : 54) : undefined,
    })),
  )
  const lastThree = createMemo(() => laneCards().slice(-3))
  const laneCompact = createMemo(() => props.narrow || props.width < 96 || props.isHeightConstrained)
  const micro = createMemo(() => props.width < 74)
  const animateLane = createMemo(() => props.animationProfile === "full")
  const laneVisible = createMemo(
    () =>
      props.showReceipts &&
      props.showCards &&
      laneCards().length > 0 &&
      props.width >= 64 &&
      (props.focus || props.showLaneHistory),
  )
  const hintLine = createMemo(() => {
    const base = sanitizeBrandSurface(props.hint)
    if (props.animationProfile !== "full" || props.narrow) return base
    return `${base} ${tone().glyph.separator} ${liveModePulse(props.mode, props.frameTick)}`
  })
  const lineLimit = createMemo(() => Math.max(props.narrow ? 24 : 34, props.width - (props.narrow ? 32 : 56)))
  const runLine = createMemo(() =>
    fitInline(
      `${liveModeLabel(props.mode)} ${tone().glyph.separator} ${fmtElapsed(props.elapsedSeconds)}`,
      lineLimit(),
    ),
  )
  const toolSummary = createMemo(() => {
    if (thread().length === 0) return GIZZICopy.session.hintQueued
    const compact = thread()
      .slice(-3)
      .map((part) => `${toolStateGlyph(part.state.status)} ${toolThreadLabel(part.tool)}`)
      .join(` ${tone().glyph.separator} `)
    const latest = thread()[thread().length - 1]
    const detail = latest ? toolThreadDetail(latest) : ""
    const meta = latest ? toolThreadMetadata(latest) : ""
    if (!detail && !meta) return compact
    const suffix = [detail, meta].filter(Boolean).join(` ${tone().glyph.separator} `)
    return `${compact} ${tone().glyph.separator} ${suffix}`
  })

  const margin = () => (props.isHeightConstrained ? tone().space.xs : tone().space.sm)

  // Inline tool lines — always visible regardless of animation profile
  const inlineTools = createMemo(() => {
    const tools = thread()
    if (tools.length === 0) return []
    // Show last 4 tool calls
    return tools.slice(-4).map((part) => {
      const status = part.state.status
      const glyph = status === "running" ? "⊕" : status === "completed" ? "✓" : status === "error" ? "✗" : "○"
      const label = toolThreadLabel(part.tool)
      const detail = toolThreadDetail(part)
      return { glyph, label, detail, status, color: toolStateColor(status, theme) }
    })
  })

  return (
    <box paddingLeft={tone().space.lg} marginTop={margin()} width="100%" minWidth={0}>
      <box
        border={["left"]}
        borderColor={props.color}
        customBorderChars={SplitBorder.customBorderChars}
        paddingTop={tone().space.sm}
        paddingBottom={tone().space.sm}
        paddingLeft={tone().space.md}
        backgroundColor={theme.backgroundPanel}
        gap={tone().space.xs}
        width="100%"
        minWidth={0}
      >
        {/* Run header: spinner + mode + elapsed */}
        <box flexDirection="row" gap={1} width="100%" minWidth={0}>
          <GIZZISpinner color={props.color} variant="schematic" />
          <text fg={props.color} wrapMode="none">
            <span style={{ bold: true }}>{runLine()}</span>
          </text>
        </box>

        {/* Hint line (thinking/connecting/responding detail) */}
        <Show when={props.mode !== "tools" && props.mode !== "web"}>
          <text fg={theme.textMuted} wrapMode="none">
            {fitInline(hintLine(), lineLimit())}
          </text>
        </Show>

        {/* Inline tool call lines — always shown when there are tools */}
        <Show when={props.showReceipts && inlineTools().length > 0}>
          <box flexDirection="column" gap={0} minWidth={0}>
            <For each={inlineTools()}>
              {(tool) => (
                <text wrapMode="none">
                  <span style={{ fg: tool.color, bold: true }}>{tool.glyph}</span>
                  <span style={{ fg: theme.text }}>{" "}{tool.label}</span>
                  <Show when={tool.detail}>
                    <span style={{ fg: theme.textMuted }}>{" "}{fitInline(tool.detail, Math.max(20, lineLimit() - tool.label.length - 4))}</span>
                  </Show>
                </text>
              )}
            </For>
          </box>
        </Show>
        <Show when={!props.showReceipts}>
          <text fg={theme.textMuted} wrapMode="none">{GIZZICopy.session.receiptsHidden}</text>
        </Show>

        {/* Full lane cards when focused/lane history enabled */}
        <Show when={laneVisible()}>
          <RuntimeTaskLane
            cards={props.isHeightConstrained ? lastThree() : laneCards()}
            frameTick={props.frameTick}
            width={props.width}
            compact={laneCompact()}
            animate={animateLane()}
          />
        </Show>
      </box>
    </box>
  )
}

function RuntimeTaskLane(props: {
  cards: RuntimeLaneCard[]
  frameTick: number
  width: number
  compact: boolean
  animate: boolean
}) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const maxLine = createMemo(() => {
    const budget = props.compact ? props.width - 60 : props.width - 54
    const min = props.compact ? 14 : 22
    const max = props.compact ? 34 : 64
    return Math.max(min, Math.min(max, budget))
  })
  return (
    <box flexDirection="column" gap={tone().space.xs} width="100%" minWidth={0}>
      <text fg={theme.textMuted} wrapMode="none">
        {GIZZICopy.session.deckCards}
      </text>
      <For each={props.cards}>
        {(card) => {
          const color = createMemo(() => toolStateColor(card.status, theme))
          const chip = createMemo(() => runtimeLaneChip(card.status))
          const progress = createMemo(() =>
            runtimeLaneProgress(card.status, props.frameTick, props.compact ? 10 : 14, props.animate),
          )
          const compactLine = createMemo(() =>
            fitInline(`${card.title} ${tone().glyph.separator} ${card.body}`, maxLine()),
          )
          const titleLine = createMemo(() => fitInline(card.title, maxLine()))
          const bodyLine = createMemo(() => fitInline(card.body, maxLine()))
          const metaLine = createMemo(() => (card.meta ? fitInline(card.meta, maxLine()) : ""))
          const compactLabel = createMemo(() => fitInline(`${card.icon} ${chip()} ${compactLine()}`, maxLine()))
          const titleLabel = createMemo(() => fitInline(`${chip()} ${titleLine()}`, maxLine()))
          return (
            <box
              border={["left"]}
              borderColor={color()}
              customBorderChars={SplitBorder.customBorderChars}
              paddingLeft={tone().space.sm}
              gap={0}
              width="100%"
              minWidth={0}
            >
              <box flexDirection="row" gap={1}>
                <Show when={card.pulse && props.animate}>
                  <text>
                    <MonolithPulse color={color()} state="executing" />
                  </text>
                </Show>
                <Show when={!card.pulse || !props.animate}>
                  <text fg={color()}>{String(card.icon ?? "")}</text>
                </Show>
                <Show
                  when={!props.compact}
                  fallback={
                    <text fg={theme.text} wrapMode="none">
                      {chip()} {compactLine()}
                    </text>
                  }
                >
                  <text fg={theme.text} wrapMode="none">
                    {titleLabel()}
                  </text>
                </Show>
              </box>
              <Show when={!props.compact}>
                <text fg={theme.textMuted} wrapMode="none">
                  {bodyLine()}
                </text>
              </Show>
              <Show when={card.status === "running" || card.status === "pending"}>
                <text fg={color()} wrapMode="none">
                  {progress()}
                </text>
              </Show>
              <Show when={card.meta}>
                <text fg={theme.textMuted} wrapMode="none">
                  {metaLine()}
                </text>
              </Show>
            </box>
          )
        }}
      </For>
    </box>
  )
}

const PART_MAPPING = {
  text: TextPart,
  tool: ToolPart,
  reasoning: ReasoningPart,
}

type LiveMode = "connecting" | "thinking" | "web" | "tools" | "responding"
type RuntimeAnimationProfile = "full" | "calm" | "minimal"

const LIVE_CONNECTING_FRAMES = ["⣠ ", "⣠⣄", " ⣄", "  "] as const
const LIVE_THINKING_FRAMES = ["⣠⣄", "⣻⢿", "⣿⣿", "⣻⢿"] as const
const LIVE_WEB_FRAMES = ["▗", "▝", "▗", "▝"] as const
const LIVE_TOOLS_FRAMES = ["▘", "▝", "▗", "▖"] as const
const LIVE_RESPONDING_FRAMES = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"] as const

function liveModeLabel(mode: LiveMode): string {
  if (mode === "connecting") return GIZZICopy.session.modeConnecting
  if (mode === "thinking") return GIZZICopy.session.modeThinking
  if (mode === "web") return GIZZICopy.session.modeWeb
  if (mode === "tools") return GIZZICopy.session.modeTools
  return GIZZICopy.session.modeResponding
}

function runtimeAnimationProfile(): RuntimeAnimationProfile {
  const raw = (process.env.GIZZI_TUI_ANIMATION_PROFILE ?? "calm").trim().toLowerCase()
  if (raw === "full" || raw === "minimal") return raw
  return "calm"
}

function liveModePulse(mode: LiveMode, tick: number): string {
  const frames =
    mode === "connecting"
      ? LIVE_CONNECTING_FRAMES
      : mode === "thinking"
        ? LIVE_THINKING_FRAMES
        : mode === "web"
          ? LIVE_WEB_FRAMES
          : mode === "tools"
            ? LIVE_TOOLS_FRAMES
            : LIVE_RESPONDING_FRAMES
  return frames[tick % frames.length]
}

function toolStateGlyph(status: string): string {
  if (status === "running") return "*"
  if (status === "completed") return "v"
  if (status === "error") return "x"
  return "o"
}

function toolStateColor(status: string, theme: any): RGBA {
  if (status === "pending") return theme.primary
  if (status === "running") return theme.warning
  if (status === "completed") return theme.textMuted
  if (status === "error") return theme.error
  return theme.textMuted
}

function runtimeLaneChip(status: RuntimeLaneCard["status"]): string {
  if (status === "pending") return "Queued"
  if (status === "running") return "Active"
  if (status === "completed") return "Done"
  return "Error"
}

function modeToLaneStatus(mode: LiveMode): RuntimeLaneStatus {
  if (mode === "connecting") return "pending"
  if (mode === "responding") return "completed"
  return "running"
}

function toRuntimeLaneStatus(value: string): RuntimeLaneStatus {
  if (value === "running") return "running"
  if (value === "completed") return "completed"
  if (value === "error") return "error"
  return "pending"
}

function runtimeLaneProgress(status: RuntimeLaneStatus, tick: number, width: number, animate: boolean): string {
  const safeWidth = Math.max(8, width)
  if (!animate) {
    if (status === "pending") {
      const track = ".".repeat(safeWidth)
      return `[${track}]`
    }
    if (status === "running") {
      const fill = Math.max(1, Math.floor(safeWidth * 0.4))
      const track = "#".repeat(fill) + ".".repeat(Math.max(0, safeWidth - fill))
      return `[${track}]`
    }
    return ""
  }
  if (status === "pending") {
    const head = Math.floor(tick / 2) % safeWidth
    const track = Array.from({ length: safeWidth }, (_, index) => (index === head ? "*" : ".")).join("")
    return `[${track}]`
  }
  if (status === "running") {
    const head = tick % (safeWidth + 3)
    const track = Array.from({ length: safeWidth }, (_, index) => {
      const distance = head - index
      if (distance === 0) return "#"
      if (distance === 1 || distance === -1) return "="
      if (distance === 2 || distance === -2) return "-"
      return "."
    }).join("")
    return `[${track}]`
  }
  return ""
}

function toolThreadLabel(tool: string): string {
  const id = tool.trim().toLowerCase()
  if (id === "websearch") return "websearch"
  if (id === "webfetch") return "webfetch"
  if (id === "codesearch") return "codesearch"
  if (id === "google_search") return "google_search"
  if (id === "grep_app_searchgithub") return "grep_app"
  if (id === "bash") return "bash"
  if (id === "read") return "read"
  if (id === "write") return "write"
  if (id === "edit") return "edit"
  if (id === "apply_patch") return "patch"
  return tool
}

function toolThreadDetail(part: ToolPart): string {
  const payload = (part.state as any).input ?? {}
  const id = part.tool.trim().toLowerCase()
  if (id === "websearch" || id === "codesearch" || id === "google_search") {
    const query = sanitizeBrandSurface(toInlineText(payload.query))
    return query ? `"${query}"` : ""
  }
  if (id === "webfetch") {
    return sanitizeBrandSurface(toInlineText(payload.url))
  }
  if (id === "read" || id === "write" || id === "edit" || id === "multiedit") {
    return sanitizeBrandSurface(normalizePath(toInlineText(payload.filePath || payload.path)))
  }
  if (id === "list") {
    return sanitizeBrandSurface(normalizePath(toInlineText(payload.path ?? "")))
  }
  if (id === "bash") {
    const command = sanitizeBrandSurface(toInlineText(payload.command))
    return command ? `$ ${command}` : ""
  }
  const summary = sanitizeBrandSurface(input(payload, ["content", "instructions", "patch", "diff"]))
  return summary
}

function toolThreadMetadata(part: ToolPart): string {
  const data = (part.state as any).metadata ?? {}
  const results = sanitizeBrandSurface(toInlineText(data.numResults ?? data.results))
  if (results) return `${results} results`
  const count = sanitizeBrandSurface(toInlineText(data.count ?? data.matches))
  if (count) return `${count} items`
  const output = sanitizeBrandSurface(toInlineText((part.state as any).output))
  if (output && output.length < 40) return output
  return ""
}



function formatProviderErrorPanel(
  raw: unknown,
  width: number,
  providerID?: string,
): { title: string; detail: string; hint?: string } {
  const source = typeof raw === "string" ? raw : toInlineText(raw)
  const parsed = describeProviderError({ raw: source, providerID })
  const title = sanitizeBrandSurface(parsed.title)
  const detail = truncateInline(sanitizeBrandSurface(parsed.message || parsed.title), Math.max(28, width - 12))
  const maxHint = Math.max(24, width - 12)
  const retryLimit = isRetryLimitReached(source)

  if (retryLimit) {
    return {
      title,
      detail,
      hint: truncateInline("Retry budget exhausted for this run. Switch provider/model and retry.", maxHint),
    }
  }
  const hint = parsed.hint ? truncateInline(sanitizeBrandSurface(parsed.hint), maxHint) : undefined
  return { title, detail, hint }
}

function fmtElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function truncateInline(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  if (max <= 1) return normalized.slice(0, max)
  return normalized.slice(0, max - 1) + "…"
}

function fitInline(value: string, max: number): string {
  return truncateInline(value, max)
}

function ReasoningPart(props: { last: boolean; part: ReasoningPart; message: AssistantMessage }) {
  const { theme, subtleSyntax } = useTheme()
  const tone = useGIZZITheme()
  const ctx = use()
  const animation = useAnimation()
  const [collapsed, setCollapsed] = createSignal(false)
  const active = createMemo(() => !props.message.time.completed)
  const content = createMemo(() => {
    // Filter out redacted reasoning chunks from OpenRouter
    // OpenRouter sends encrypted reasoning data that appears as [REDACTED]
    return sanitizeBrandSurface(props.part.text.replace("[REDACTED]", "").trim())
  })
  const lineCount = createMemo(() => content().split("\n").length)
  const trace = createMemo(() => {
    const value = content()
    if (!active()) return value
    const lines = value.split("\n")
    const maxLines = 10
    if (lines.length <= maxLines) return value
    return ["…", ...lines.slice(-maxLines)].join("\n")
  })

  // Shimmer color pulse: sine-wave between textMuted and accent
  const shimmerColor = createMemo(() => {
    if (!active()) return theme.textMuted
    const tick = Number(animation.tick() % 20n)
    const t = (Math.sin(tick * Math.PI / 10) + 1) / 2
    const m = theme.textMuted, a = tone().accent
    // RGBA .r/.g/.b are 0-1 floats; fromInts expects 0-255
    const r = m.r + (a.r - m.r) * t
    const g = m.g + (a.g - m.g) * t
    const b = m.b + (a.b - m.b) * t
    return RGBA.fromInts(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255))
  })

  const shimmerBar = createMemo(() => active() ? animation.frame("gizzi.thinking.shimmer") : "")
  const thinkingLabel = createMemo(() => active() ? animation.frame("gizzi.thinking.label") : "")

  return (
    <Show when={content() && ctx.showThinking() && ctx.showRuntimeTrace()}>
      <box id={"text-" + props.part.id} marginTop={tone().space.sm} flexDirection="column" paddingLeft={tone().space.lg}>
        <Show
          when={active()}
          fallback={
            <text
              fg={theme.textMuted}
              onMouseUp={() => { setCollapsed((prev) => !prev); }}
            >
              <span style={{ fg: tone().accent }}>{collapsed() ? "▶" : "▼"}</span>{" "}
              {GIZZICopy.session.runtimeTraceCaptured}
              {collapsed() ? ` (${lineCount()} lines)` : ""}
            </text>
          }
        >
          <box flexDirection="row" gap={1}>
            <text fg={shimmerColor()}>{shimmerBar()}</text>
            <text fg={shimmerColor()}>{thinkingLabel()}</text>
          </box>
        </Show>
        <Show when={!collapsed()}>
          <box paddingLeft={tone().space.sm}>
            <code
              filetype="markdown"
              drawUnstyledText={false}
              streaming={true}
              syntaxStyle={subtleSyntax()}
              content={trace()}
              conceal={ctx.conceal()}
              fg={theme.textMuted}
            />
          </box>
        </Show>
      </box>
    </Show>
  )
}

function TextPart(props: { last: boolean; part: TextPart; message: AssistantMessage }) {
  const ctx = use()
  const { theme, syntax } = useTheme()
  const tone = useGIZZITheme()
  const animation = useAnimation()
  const sync = useSync()
  const content = createMemo(() => sanitizeBrandSurface(props.part.text))
  const textParts = createMemo(() =>
    (sync.data.part[props.message.id] ?? []).filter(
      (part): part is Extract<Part, { type: "text" }> => part.type === "text" && part.text.trim().length > 0,
    ),
  )
  const isTrailingText = createMemo(() => textParts().at(-1)?.id === props.part.id)
  const isStreaming = createMemo(() => !props.message.time.completed && isTrailingText())
  const streamPulseFrames = ["drafting", "drafting.", "drafting..", "drafting..."] as const
  const streamPulse = createMemo(() => {
    const index = Number((animation.tick() / 8n) % BigInt(streamPulseFrames.length))
    return streamPulseFrames[index]
  })
  const streamCursorFrames = ["▍", "▌", "▋", "▊", "▉", "█", "▉", "▊", "▋", "▌"] as const
  const streamCursor = createMemo(() => {
    if (!isStreaming()) return ""
    const index = Number((animation.tick() / 2n) % BigInt(streamCursorFrames.length))
    return streamCursorFrames[index]
  })
  return (
    <Show when={content().length > 0}>
      <box
        id={"text-" + props.part.id}
        paddingLeft={tone().space.lg}
        marginTop={tone().space.sm}
        flexShrink={0}
        flexDirection="column"
        gap={tone().space.xs}
      >
        <Switch>
          <Match when={GIZZIFlag.EXPERIMENTAL_MARKDOWN}>
            <markdown
              syntaxStyle={syntax()}
              streaming={true}
              content={content()}
              conceal={ctx.conceal()}
            />
          </Match>
          <Match when={!GIZZIFlag.EXPERIMENTAL_MARKDOWN}>
            <code
              filetype="markdown"
              drawUnstyledText={false}
              streaming={true}
              syntaxStyle={syntax()}
              content={content()}
              conceal={ctx.conceal()}
              fg={theme.text}
            />
          </Match>
        </Switch>
        <Show when={isStreaming()}>
          <box flexDirection="row" gap={1} paddingLeft={tone().space.sm}>
            <text fg={tone().accent}>
              <span style={{ bold: true }}>{streamCursor()}</span>
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              {fitInline(
                `${streamPulse()} ${tone().glyph.separator} ${String(content().length ?? 0)} chars`,
                Math.max(22, ctx.width - 20),
              )}
            </text>
          </box>
        </Show>
      </box>
    </Show>
  )
}

// Pending messages moved to individual tool pending functions

function ToolPart(props: { last: boolean; part: ToolPart; message: AssistantMessage }) {
  const ctx = use()
  const sync = useSync()

  // Hide tool if showDetails is false and tool completed successfully
  const shouldHide = createMemo(() => {
    if (!ctx.showReceipts()) return true
    if (ctx.showDetails()) return false
    if (props.part.state.status !== "completed") return false
    return true
  })

  const toolprops = {
    get metadata() {
      return props.part.state.status === "pending" ? {} : (props.part.state.metadata ?? {})
    },
    get input() {
      return props.part.state.input ?? {}
    },
    get output() {
      return props.part.state.status === "completed" ? props.part.state.output : undefined
    },
    get permission(): Record<string, any> {
      const permissions = (sync.data.permission[props.message.sessionID] ?? []) as any[]
      const permissionIndex = permissions.findIndex((x: any) => x.tool?.callID === props.part.callID)
      return permissions[permissionIndex] ?? {}
    },
    get tool() {
      return props.part.tool
    },
    get part() {
      return props.part
    },
  }

  return (
    <Show when={!shouldHide()}>
      <Switch>
        <Match when={props.part.tool === "bash"}>
          <Bash {...toolprops} />
        </Match>
        <Match when={props.part.tool === "glob"}>
          <Glob {...toolprops} />
        </Match>
        <Match when={props.part.tool === "read"}>
          <Read {...toolprops} />
        </Match>
        <Match when={props.part.tool === "grep"}>
          <Grep {...toolprops} />
        </Match>
        <Match when={props.part.tool === "list"}>
          <List {...toolprops} />
        </Match>
        <Match when={props.part.tool === "webfetch"}>
          <WebFetch {...toolprops} />
        </Match>
        <Match when={props.part.tool === "codesearch"}>
          <CodeSearch {...toolprops} />
        </Match>
        <Match when={props.part.tool === "websearch"}>
          <WebSearch {...toolprops} />
        </Match>
        <Match when={props.part.tool === "write"}>
          <Write {...toolprops} />
        </Match>
        <Match when={props.part.tool === "edit"}>
          <Edit {...toolprops} />
        </Match>
        <Match when={props.part.tool === "task"}>
          <Task {...toolprops} />
        </Match>
        <Match when={props.part.tool === "apply_patch"}>
          <ApplyPatch {...toolprops} />
        </Match>
        <Match when={props.part.tool === "todowrite"}>
          <TodoWrite {...toolprops} />
        </Match>
        <Match when={props.part.tool === "question"}>
          <Question {...toolprops} />
        </Match>
        <Match when={props.part.tool === "skill"}>
          <Skill {...toolprops} />
        </Match>
        <Match when={props.part.tool === "multiedit"}>
          <MultiEdit {...toolprops} />
        </Match>
        <Match when={true}>
          <GenericTool {...toolprops} />
        </Match>
      </Switch>
    </Show>
  )
}

type ToolProps<T extends Tool.Info> = {
  input: Partial<Tool.InferParameters<T>>
  metadata: Partial<Tool.InferMetadata<T>>
  permission: Record<string, any>
  tool: string
  output?: string
  part: ToolPart
}
function GenericTool(props: ToolProps<any>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const ctx = use()
  const output = createMemo(() => props.output?.trim() ?? "")
  const [expanded, setExpanded] = createSignal(false)
  const lines = createMemo(() => output().split("\n"))
  const maxLines = 5
  const overflow = createMemo(() => lines().length > maxLines)
  const overflowCount = createMemo(() => lines().length - maxLines)
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return output()
    return lines().slice(0, maxLines).join("\n")
  })

  return (
    <Show
      when={props.output && ctx.showGenericToolOutput()}
      fallback={
        <InlineTool icon="⚙" pending={GIZZICopy.tool.pending.receipt} complete={true} part={props.part}>
          {props.tool} {input(props.input)}
        </InlineTool>
      }
    >
      <BlockTool
        title={`# ${props.tool} ${input(props.input)}`}
        part={props.part}
        onClick={overflow() ? () => setExpanded((prev) => !prev) : undefined}
      >
        <box gap={tone().space.sm}>
          <text fg={theme.text}>{limited()}</text>
          <Show when={overflow()}>
            <text fg={theme.textMuted}>
              {expanded() ? GIZZICopy.tool.collapse : `… +${overflowCount()} lines ${GIZZICopy.tool.expand}`}
            </text>
          </Show>
        </box>
      </BlockTool>
    </Show>
  )
}

function InlineTool(props: {
  icon: string
  iconColor?: RGBA
  complete: any
  pending: string
  children: JSX.Element
  part: ToolPart
}) {
  const [margin, setMargin] = createSignal(0)
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const ctx = use()
  const sync = useSync()

  const permission = createMemo(() => {
    const callID = (sync.data.permission[ctx.sessionID] as any)?.at(0)?.tool?.callID
    if (!callID) return false
    return callID === props.part.callID
  })

  const fg = createMemo(() => {
    if (permission()) return theme.warning
    if (props.part.state.status === "pending" || props.part.state.status === "running") return theme.text
    return theme.textMuted
  })

  const isPending = createMemo(() => props.part.state.status === "pending" || props.part.state.status === "running")

  const error = createMemo(() => (props.part.state.status === "error" ? toInlineText(props.part.state.error) : ""))

  const denied = createMemo(() => {
    const message = error()
    return (
      message.includes("rejected permission") ||
      message.includes("specified a rule") ||
      message.includes("user dismissed")
    )
  })

  const durationMs = createMemo(() => {
    const t = props.part.state.time
    if (!t?.completed || !t.started) return 0
    return t.completed - t.started
  })

  const durationLabel = createMemo(() => {
    const ms = durationMs()
    if (ms <= 0 || isPending()) return ""
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  })

  return (
    <box
      marginTop={margin()}
      paddingLeft={tone().space.md}
      renderBefore={function () {
        const el = this as BoxRenderable
        const parent = el.parent
        if (!parent) {
          return
        }
        if (el.height > 1) {
          setMargin(tone().space.sm)
          return
        }
        const children = parent.getChildren()
        const index = children.indexOf(el)
        const previous = children[index - 1]
        if (!previous) {
          setMargin(tone().space.xs)
          return
        }
        if (previous.height > 1 || previous.id.startsWith("text-")) {
          setMargin(tone().space.sm)
          return
        }
      }}
    >
      <box paddingLeft={tone().space.sm} flexDirection="row" gap={1} alignItems="center">
        <GIZZIInlineBlock
          mode="inline"
          kind="receipt"
          icon={props.icon}
          iconColor={props.iconColor}
          pending={isPending()}
          pendingLabel={props.pending}
          spinnerComponent={<MonolithPulse color={fg()} state="thinking" />}
          fg={fg()}
          attributes={denied() ? TextAttributes.STRIKETHROUGH : undefined}
          error={denied() ? undefined : error()}
        >
          {props.children}
        </GIZZIInlineBlock>
        <Show when={!!durationLabel()}>
          <text fg={theme.textMuted}>{durationLabel()}</text>
        </Show>
      </box>
    </box>
  )
}

function BlockTool(props: {
  title: string
  children: JSX.Element
  onClick?: () => void
  part?: ToolPart
  spinner?: boolean
}) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const renderer = useRenderer()
  const [hover, setHover] = createSignal(false)
  const error = createMemo(() => (props.part?.state.status === "error" ? toInlineText(props.part.state.error) : ""))
  return (
    <box
      border={["left"]}
      paddingTop={tone().space.sm}
      paddingBottom={tone().space.sm}
      paddingLeft={tone().space.md}
      marginTop={tone().space.sm}
      gap={tone().space.sm}
      backgroundColor={hover() ? theme.backgroundMenu : theme.backgroundPanel}
      customBorderChars={SplitBorder.customBorderChars}
      borderColor={theme.background}
      onMouseOver={() => props.onClick && setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => {
        if (renderer.getSelection()?.getSelectedText()) return
        props.onClick?.()
      }}
    >
      <GIZZIInlineBlock
        mode="block"
        kind="receipt"
        spinner={props.spinner}
        fg={theme.textMuted}
        title={props.title.replace(/^# /, "")}
        error={error()}
      >
        {props.children}
      </GIZZIInlineBlock>
    </box>
  )
}

function Bash(props: ToolProps<typeof BashTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const sync = useSync()
  const isRunning = createMemo(() => props.part.state.status === "running")
  const output = createMemo(() => stripAnsi(props.metadata.output?.trim() ?? ""))
  const [expanded, setExpanded] = createSignal(false)
  const lines = createMemo(() => output().split("\n"))
  const MAX_BASH_LINES = 10
  const overflow = createMemo(() => lines().length > MAX_BASH_LINES)
  const overflowCount = createMemo(() => lines().length - MAX_BASH_LINES)
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return output()
    return lines().slice(0, MAX_BASH_LINES).join("\n")
  })

  const workdirDisplay = createMemo(() => {
    const workdir = props.input.workdir
    if (!workdir || workdir === ".") return undefined

    const base = sync.data.path.directory
    if (!base) return undefined

    const absolute = path.resolve(base, workdir)
    if (absolute === base) return undefined

    const home = Global.Path.home
    if (!home) return absolute

    const match = absolute === home || absolute.startsWith(home + path.sep)
    return match ? absolute.replace(home, "~") : absolute
  })

  const exitCode = createMemo(() => {
    const code = (props.metadata as any).exit
    if (code === undefined || code === null || code === 0) return null
    return code as number
  })

  const title = createMemo(() => {
    const desc = props.input.description ?? GIZZICopy.tool.shellDefault
    const wd = workdirDisplay()
    if (!wd) return `# ${desc}`
    if (desc.includes(wd)) return `# ${desc}`
    return `# ${desc} in ${wd}`
  })

  return (
    <Switch>
      <Match when={props.metadata.output !== undefined}>
        <BlockTool
          title={title()}
          part={props.part}
          spinner={isRunning()}
          onClick={overflow() ? () => setExpanded((prev) => !prev) : undefined}
        >
          <box gap={tone().space.sm}>
            <text fg={theme.text}>$ {String(props.input.command ?? "")}</text>
            <Show when={output()}>
              <text fg={theme.text}>{limited()}</text>
            </Show>
            <Show when={overflow()}>
              <text fg={theme.textMuted}>
                {expanded() ? GIZZICopy.tool.collapse : `… +${overflowCount()} lines ${GIZZICopy.tool.expand}`}
              </text>
            </Show>
            <Show when={exitCode() !== null}>
              <text fg={theme.error}>exit {String(exitCode())}</text>
            </Show>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="$" pending={GIZZICopy.tool.pending.bash} complete={props.input.command} part={props.part}>
          {props.input.command}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Write(props: ToolProps<typeof WriteTool>) {
  const { theme, syntax } = useTheme()
  const code = createMemo(() => {
    if (!props.input.content) return ""
    return props.input.content
  })

  const diagnostics = createMemo(() => {
    const filePath = Filesystem.normalizePath(props.input.filePath ?? "")
    return props.metadata.diagnostics?.[filePath] ?? []
  })

  return (
    <Switch>
      <Match when={props.metadata.diagnostics !== undefined}>
        <BlockTool title={"# " + GIZZICopy.tool.labels.wrote + " " + normalizePath(props.input.filePath!)} part={props.part}>
          <line_number fg={theme.textMuted} minWidth={3} paddingRight={1}>
            <code
              conceal={false}
              fg={theme.text}
              filetype={filetype(props.input.filePath!)}
              syntaxStyle={syntax()}
              content={code()}
            />
          </line_number>
          <Show when={diagnostics().length}>
            <For each={diagnostics()}>
              {(diagnostic) => (
                <text fg={theme.error}>
                  Error [{diagnostic.range.start.line}:{diagnostic.range.start.character}]: {diagnostic.message}
                </text>
              )}
            </For>
          </Show>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="←" pending={GIZZICopy.tool.pending.write} complete={props.input.filePath} part={props.part}>
          {GIZZICopy.tool.labels.write} {normalizePath(props.input.filePath!)}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Glob(props: ToolProps<typeof GlobTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const MAX_PREVIEW = 5
  const previewFiles = createMemo(() => {
    if (!props.output) return []
    return props.output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("(Results"))
      .slice(0, MAX_PREVIEW)
      .map((f) => normalizePath(f))
  })
  const hasPreview = createMemo(() => previewFiles().length > 0)

  return (
    <Switch>
      <Match when={hasPreview()}>
        <BlockTool
          title={`# ${GIZZICopy.tool.labels.glob} "${props.input.pattern}"${props.metadata.count ? `  ${props.metadata.count} files` : ""}`}
          part={props.part}
        >
          <box gap={tone().space.sm}>
            <For each={previewFiles()}>
              {(file) => <text fg={theme.textMuted}>{file}</text>}
            </For>
            <Show when={(props.metadata.count ?? 0) > MAX_PREVIEW}>
              <text fg={theme.textMuted}>… +{(props.metadata.count ?? 0) - MAX_PREVIEW} more</text>
            </Show>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="✱" pending={GIZZICopy.tool.pending.glob} complete={props.input.pattern} part={props.part}>
          {GIZZICopy.tool.labels.glob} "{props.input.pattern}" <Show when={props.input.path}>in {normalizePath(props.input.path)} </Show>
          <Show when={props.metadata.count}>
            ({GIZZICopy.tool.matches({ count: props.metadata.count ?? 0 })})
          </Show>
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Read(props: ToolProps<typeof ReadTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const loaded = createMemo(() => {
    if (props.part.state.status !== "completed") return []
    if (props.part.state.time?.compacted) return []
    const value = props.metadata.loaded
    if (!value || !Array.isArray(value)) return []
    return value.filter((p): p is string => typeof p === "string")
  })
  return (
    <>
      <InlineTool icon="→" pending={GIZZICopy.tool.pending.read} complete={props.input.filePath} part={props.part}>
        {GIZZICopy.tool.labels.read} {normalizePath(props.input.filePath!)} {input(props.input, ["filePath"])}
      </InlineTool>
      <For each={loaded()}>
        {(filepath) => (
          <box paddingLeft={tone().space.md}>
            <text paddingLeft={tone().space.sm} fg={theme.textMuted}>
              ↳ {GIZZICopy.tool.labels.loaded} {normalizePath(filepath)}
            </text>
          </box>
        )}
      </For>
    </>
  )
}

function Grep(props: ToolProps<typeof GrepTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const MAX_PREVIEW = 5
  const previewFiles = createMemo(() => {
    if (!props.output) return []
    // Grep output: "Found N matches\n<filepath>:<line>: content\n..."
    return props.output
      .split("\n")
      .filter((l) => l && !l.startsWith("Found ") && !l.startsWith("(Results"))
      .slice(0, MAX_PREVIEW)
  })
  const hasPreview = createMemo(() => previewFiles().length > 0)

  return (
    <Switch>
      <Match when={hasPreview()}>
        <BlockTool
          title={`# ${GIZZICopy.tool.labels.grep} "${props.input.pattern}"${props.metadata.matches ? `  ${props.metadata.matches} matches` : ""}`}
          part={props.part}
        >
          <box gap={tone().space.sm}>
            <For each={previewFiles()}>
              {(line) => <text fg={theme.textMuted}>{line}</text>}
            </For>
            <Show when={(props.metadata.matches ?? 0) > MAX_PREVIEW}>
              <text fg={theme.textMuted}>… +{(props.metadata.matches ?? 0) - MAX_PREVIEW} more</text>
            </Show>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="✱" pending={GIZZICopy.tool.pending.grep} complete={props.input.pattern} part={props.part}>
          {GIZZICopy.tool.labels.grep} "{props.input.pattern}" <Show when={props.input.path}>in {normalizePath(props.input.path)} </Show>
          <Show when={props.metadata.matches}>
            ({GIZZICopy.tool.matches({ count: props.metadata.matches ?? 0 })})
          </Show>
        </InlineTool>
      </Match>
    </Switch>
  )
}

function List(props: ToolProps<typeof ListTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const MAX_PREVIEW = 6
  const dir = createMemo(() => (props.input.path ? normalizePath(props.input.path) : ""))
  const previewLines = createMemo(() => {
    if (!props.output) return []
    return props.output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l)
      .slice(0, MAX_PREVIEW)
  })
  const totalLines = createMemo(() => props.output?.split("\n").filter((l) => l.trim()).length ?? 0)

  return (
    <Switch>
      <Match when={previewLines().length > 0}>
        <BlockTool
          title={`# ${GIZZICopy.tool.labels.list} ${dir()}  ${totalLines()} items`}
          part={props.part}
        >
          <box gap={tone().space.sm}>
            <For each={previewLines()}>
              {(line) => <text fg={theme.textMuted}>{line}</text>}
            </For>
            <Show when={totalLines() > MAX_PREVIEW}>
              <text fg={theme.textMuted}>… +{totalLines() - MAX_PREVIEW} more</text>
            </Show>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="→" pending={GIZZICopy.tool.pending.list} complete={props.input.path !== undefined} part={props.part}>
          {GIZZICopy.tool.labels.list} {dir()}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function WebFetch(props: ToolProps<typeof WebFetchTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const input = props.input as any
  const url = toInlineText(input.url)
  const preview = createMemo(() => {
    if (!props.output) return ""
    // Show first ~120 chars of output as a content preview
    const text = props.output.replace(/\s+/g, " ").trim()
    return text.length > 120 ? text.slice(0, 119) + "…" : text
  })

  return (
    <Switch>
      <Match when={!!preview()}>
        <BlockTool title={`# Fetched ${url || "web content"}`} part={props.part}>
          <text fg={theme.textMuted}>{preview()}</text>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="%" pending={GIZZICopy.tool.pending.webFetch} complete={url} part={props.part}>
          {url ? `Fetched web content from ${url}` : "Fetched web content"}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function CodeSearch(props: ToolProps<any>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const input = props.input as any
  const metadata = props.metadata as any
  const query = toInlineText(input.query)
  const resultCount = metadata.results
  const MAX_PREVIEW = 4
  const previewLines = createMemo(() => {
    if (!props.output) return []
    return props.output
      .split("\n")
      .filter((l: string) => l.trim())
      .slice(0, MAX_PREVIEW)
  })

  return (
    <Switch>
      <Match when={previewLines().length > 0}>
        <BlockTool
          title={`# Searched code for "${query}"${resultCount ? `  ${resultCount} results` : ""}`}
          part={props.part}
        >
          <box gap={tone().space.sm}>
            <For each={previewLines()}>
              {(line: string) => <text fg={theme.textMuted}>{line}</text>}
            </For>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="◇" pending={GIZZICopy.tool.pending.codeSearch} complete={query} part={props.part}>
          {query ? `Searched code for "${query}"${resultCount ? ` (${resultCount} results)` : ""}` : `Searched code`}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function WebSearch(props: ToolProps<any>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const input = props.input as any
  const metadata = props.metadata as any
  const query = toInlineText(input.query)
  const numResults = metadata.numResults
  const MAX_PREVIEW = 4
  const previewLines = createMemo(() => {
    if (!props.output) return []
    return props.output
      .split("\n")
      .filter((l: string) => l.trim())
      .slice(0, MAX_PREVIEW)
  })

  return (
    <Switch>
      <Match when={previewLines().length > 0}>
        <BlockTool
          title={`# Searched web for "${query}"${numResults ? `  ${numResults} results` : ""}`}
          part={props.part}
        >
          <box gap={tone().space.sm}>
            <For each={previewLines()}>
              {(line: string) => <text fg={theme.textMuted}>{line}</text>}
            </For>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="@" pending={GIZZICopy.tool.pending.webSearch} complete={query} part={props.part}>
          {query ? `Searched web for "${query}"${numResults ? ` (${numResults} results)` : ""}` : `Searched web`}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Task(props: ToolProps<typeof TaskTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const keybind = useKeybind()
  const { navigate } = useRoute()
  const local = useLocal()
  const sync = useSync()

  const tools = createMemo(() => {
    const sessionID = props.metadata.sessionId
    const msgs = sync.data.message[sessionID ?? ""] ?? []
    return msgs.flatMap((msg) =>
      (sync.data.part[msg.id] ?? [])
        .filter((part): part is any => part.type === "tool")
        .map((part: any) => ({ tool: part.tool, state: part.state })),
    )
  })

  const current = createMemo(() => tools().findLast((x) => x.state.status !== "pending"))

  const isRunning = createMemo(() => props.part.state.status === "running")

  return (
    <Switch>
      <Match when={props.input.description || props.input.subagent_type}>
        <BlockTool
          title={
            "# " +
            Locale.titlecase(props.input.subagent_type ?? GIZZICopy.tool.unknown) +
            " " +
            GIZZICopy.tool.labels.task
          }
          onClick={
            props.metadata.sessionId
              ? () => navigate({ type: "session", sessionID: props.metadata.sessionId! })
              : undefined
          }
          part={props.part}
          spinner={isRunning()}
        >
          <box gap={tone().space.sm}>
            <text style={{ fg: theme.textMuted }}>
              {props.input.description} ({GIZZICopy.tool.toolCalls({ count: tools().length })})
            </text>
            <Show when={current()}>
              {(item) => {
                const title = item().state.status === "completed" ? (item().state as any).title : ""
                return (
                  <text style={{ fg: item().state.status === "error" ? theme.error : theme.textMuted }}>
                    └ {Locale.titlecase(item().tool)} {title}
                  </text>
                )
              }}
            </Show>
          </box>
          <Show when={props.metadata.sessionId}>
            <text fg={theme.text}>
              {keybind.print("session_child_cycle")}
              <span style={{ fg: theme.textMuted }}> {GIZZICopy.tool.viewSubagents}</span>
            </text>
          </Show>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="#" pending={GIZZICopy.tool.pending.task} complete={props.input.subagent_type} part={props.part}>
          {props.input.subagent_type} {GIZZICopy.tool.labels.task} {props.input.description}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Edit(props: ToolProps<typeof EditTool>) {
  const ctx = use()
  const { theme, syntax } = useTheme()
  const tone = useGIZZITheme()

  const view = createMemo(() => {
    const diffStyle = (ctx.sync.data.config.tui as any)?.diff_style
    if (diffStyle === "stacked") return "unified"
    // Default to "auto" behavior
    return ctx.width > 120 ? "split" : "unified"
  })

  const ft = createMemo(() => filetype(props.input.filePath))

  const diffContent = createMemo(() => props.metadata.diff)

  const diffStats = createMemo(() => {
    const fd = (props.metadata as any).filediff
    if (!fd) return ""
    const added = fd.additions ?? 0
    const removed = fd.deletions ?? 0
    const parts: string[] = []
    if (added > 0) parts.push(`+${added}`)
    if (removed > 0) parts.push(`-${removed}`)
    return parts.join(" ")
  })

  const diagnostics = createMemo(() => {
    const filePath = Filesystem.normalizePath(props.input.filePath ?? "")
    const arr = props.metadata.diagnostics?.[filePath] ?? []
    return arr.filter((x) => x.severity === 1).slice(0, 3)
  })

  return (
    <Switch>
      <Match when={props.metadata.diff !== undefined}>
        <BlockTool title={"← " + GIZZICopy.tool.labels.edit + " " + normalizePath(props.input.filePath!) + (diffStats() ? `  ${diffStats()}` : "")} part={props.part}>
          <box paddingLeft={tone().space.sm}>
            <diff
              diff={diffContent()}
              view={view()}
              filetype={ft()}
              syntaxStyle={syntax()}
              showLineNumbers={true}
              width="100%"
              wrapMode={ctx.diffWrapMode()}
              fg={theme.text}
              addedBg={theme.diffAddedBg}
              removedBg={theme.diffRemovedBg}
              contextBg={theme.diffContextBg}
              addedSignColor={theme.diffHighlightAdded}
              removedSignColor={theme.diffHighlightRemoved}
              lineNumberFg={theme.diffLineNumber}
              lineNumberBg={theme.diffContextBg}
              addedLineNumberBg={theme.diffAddedLineNumberBg}
              removedLineNumberBg={theme.diffRemovedLineNumberBg}
            />
          </box>
          <Show when={diagnostics().length}>
            <box>
              <For each={diagnostics()}>
                {(diagnostic) => (
                  <text fg={theme.error}>
                    Error [{diagnostic.range.start.line + 1}:{diagnostic.range.start.character + 1}]{" "}
                    {diagnostic.message}
                  </text>
                )}
              </For>
            </box>
          </Show>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="←" pending={GIZZICopy.tool.pending.edit} complete={props.input.filePath} part={props.part}>
          {GIZZICopy.tool.labels.edit} {normalizePath(props.input.filePath!)} {input({ replaceAll: props.input.replaceAll })}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function MultiEdit(props: ToolProps<typeof MultiEditTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const edits = createMemo(() => (props.input as any).edits ?? [])
  const completed = createMemo(() => props.part.state.status === "completed")

  return (
    <Switch>
      <Match when={edits().length > 0}>
        <BlockTool
          title={`← ${GIZZICopy.tool.labels.multiEdit} ${normalizePath((props.input as any).filePath ?? "")}  ${edits().length} edits`}
          part={props.part}
        >
          <box gap={tone().space.sm}>
            <For each={edits()}>
              {(edit: any, i) => (
                <text fg={completed() ? theme.success : theme.textMuted}>
                  {String(i() + 1)}. {edit.oldString ? truncateInline(edit.oldString, 40) : "(empty)"} → {edit.newString ? truncateInline(edit.newString, 40) : "(empty)"}
                </text>
              )}
            </For>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="←" pending={GIZZICopy.tool.pending.multiEdit} complete={(props.input as any).filePath} part={props.part}>
          {GIZZICopy.tool.labels.multiEdit} {normalizePath((props.input as any).filePath ?? "")}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function ApplyPatch(props: ToolProps<typeof ApplyPatchTool>) {
  const ctx = use()
  const { theme, syntax } = useTheme()
  const tone = useGIZZITheme()

  const files = createMemo(() => props.metadata.files ?? [])

  const view = createMemo(() => {
    const diffStyle = (ctx.sync.data.config.tui as any)?.diff_style
    if (diffStyle === "stacked") return "unified"
    return ctx.width > 120 ? "split" : "unified"
  })

  function Diff(p: { diff: string; filePath: string }) {
    return (
      <box paddingLeft={tone().space.sm}>
        <diff
          diff={p.diff}
          view={view()}
          filetype={filetype(p.filePath)}
          syntaxStyle={syntax()}
          showLineNumbers={true}
          width="100%"
          wrapMode={ctx.diffWrapMode()}
          fg={theme.text}
          addedBg={theme.diffAddedBg}
          removedBg={theme.diffRemovedBg}
          contextBg={theme.diffContextBg}
          addedSignColor={theme.diffHighlightAdded}
          removedSignColor={theme.diffHighlightRemoved}
          lineNumberFg={theme.diffLineNumber}
          lineNumberBg={theme.diffContextBg}
          addedLineNumberBg={theme.diffAddedLineNumberBg}
          removedLineNumberBg={theme.diffRemovedLineNumberBg}
        />
      </box>
    )
  }

  function title(file: { type: string; relativePath: string; filePath: string; deletions: number }) {
    if (file.type === "delete") return "# " + GIZZICopy.tool.labels.deleted + " " + file.relativePath
    if (file.type === "add") return "# " + GIZZICopy.tool.labels.created + " " + file.relativePath
    if (file.type === "move")
      return "# " + GIZZICopy.tool.labels.moved + " " + normalizePath(file.filePath) + " → " + file.relativePath
    return "← " + GIZZICopy.tool.labels.patched + " " + file.relativePath
  }

  return (
    <Switch>
      <Match when={files().length > 0}>
        <For each={files()}>
          {(file) => (
            <BlockTool title={title(file)} part={props.part}>
              <Show
                when={file.type !== "delete"}
                fallback={
                  <text fg={theme.diffRemoved}>
                    -{String(file.deletions ?? 0)} line{file.deletions !== 1 ? "s" : ""}
                  </text>
                }
              >
                <Diff diff={file.diff} filePath={file.filePath} />
              </Show>
            </BlockTool>
          )}
        </For>
      </Match>
      <Match when={true}>
        <InlineTool icon="%" pending={GIZZICopy.tool.pending.patch} complete={false} part={props.part}>
          {GIZZICopy.tool.labels.patch}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function TodoWrite(props: ToolProps<typeof TodoWriteTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const todos = createMemo(() => props.input.todos ?? props.metadata.todos ?? [])
  const doneCount = createMemo(() => todos().filter((t) => t.status === "completed").length)
  const totalCount = createMemo(() => todos().length)
  const title = createMemo(() => {
    const base = "# " + GIZZICopy.tool.labels.todos
    if (totalCount() === 0) return base
    return `${base}  ${doneCount()}/${totalCount()}`
  })
  return (
    <Switch>
      <Match when={todos().length > 0}>
        <BlockTool title={title()} part={props.part}>
          <box gap={tone().space.sm}>
            <For each={todos()}>
              {(todo) => <TodoItem status={todo.status} content={todo.content} />}
            </For>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="⚙" pending={GIZZICopy.tool.pending.todos} complete={false} part={props.part}>
          {GIZZICopy.tool.pending.todos}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Question(props: ToolProps<typeof QuestionTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const count = createMemo(() => props.input.questions?.length ?? 0)

  function format(answer?: string[]) {
    if (!answer?.length) return GIZZICopy.tool.noAnswer
    return answer.join(", ")
  }

  return (
    <Switch>
      <Match when={props.metadata.answers}>
        <BlockTool title={"# " + GIZZICopy.tool.labels.questions} part={props.part}>
          <box gap={tone().space.sm}>
            <For each={props.input.questions ?? []}>
              {(q, i) => (
                <box flexDirection="column">
                  <text fg={theme.textMuted}>{q.question}</text>
                  <text fg={theme.text}>{format(props.metadata.answers?.[i()])}</text>
                </box>
              )}
            </For>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="→" pending={GIZZICopy.tool.pending.question} complete={count()} part={props.part}>
          {GIZZICopy.tool.askedQuestions({ count: count() })}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Skill(props: ToolProps<typeof SkillTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const MAX_LINES = 6
  const outputLines = createMemo(() => {
    if (!props.output) return []
    return props.output.split("\n").filter((l) => l.trim()).slice(0, MAX_LINES)
  })

  return (
    <Switch>
      <Match when={outputLines().length > 0}>
        <BlockTool title={`# ${GIZZICopy.tool.labels.skill} "${props.input.name ?? ""}"`} part={props.part}>
          <box gap={tone().space.sm}>
            <For each={outputLines()}>
              {(line) => <text fg={theme.textMuted}>{line}</text>}
            </For>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="→" pending={GIZZICopy.tool.pending.skill} complete={props.input.name} part={props.part}>
          {GIZZICopy.tool.labels.skill} "{props.input.name}"
        </InlineTool>
      </Match>
    </Switch>
  )
}

function collapseSearchModeText(text: string): string {
  const raw = text.trim()
  if (!raw) return text
  if (!raw.toLowerCase().startsWith("[search-mode]")) return text
  const segments = raw.split(/\n-{3,}\n/)
  const tail = segments.at(-1)?.trim()
  if (tail) return `[search] ${tail}`
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean)
  const fallback = lines.at(-1) ?? raw
  return `[search] ${fallback}`
}

function sanitizeMultilineText(value: string): string {
  return stripAnsi(value)
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\t/g, " ").replace(/\s+/g, " ").trimEnd())
    .join("\n")
    .trim()
}

function formatUserPromptPreview(value: string, width: number): string {
  const cleaned = sanitizeMultilineText(value)
  if (!cleaned) return ""
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return ""

  const maxLine = Math.max(28, width - 16)
  const shouldCompact = cleaned.length > 260 || lines.length > 4
  if (!shouldCompact) {
    return lines.map((line) => truncateInline(line, maxLine)).join("\n")
  }

  const maxLines = width < 96 ? 2 : 4
  const compact = lines.slice(0, maxLines).map((line) => truncateInline(line, maxLine))
  if (lines.length > maxLines) compact.push("…")
  return compact.join("\n")
}

function normalizePath(input?: string) {
  if (!input) return ""
  if (path.isAbsolute(input)) {
    return path.relative(process.cwd(), input) || "."
  }
  return input
}

function input(input: Record<string, any>, omit?: string[]): string {
  const primitives = Object.entries(input).filter(([key, value]) => {
    if (omit?.includes(key)) return false
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  })
  if (primitives.length === 0) return ""
  return `[${primitives.map(([key, value]) => `${key}=${value}`).join(", ")}]`
}

function toInlineText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return sanitizeBrandSurface(sanitizeInlineText(String(value)))
  }
  if (Array.isArray(value)) return sanitizeBrandSurface(sanitizeInlineText(value.map((item) => toInlineText(item)).join(", ")))
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value)
      if (json && json !== "{}") return sanitizeBrandSurface(sanitizeInlineText(json))
    } catch {}
    try {
      const rendered = String(value)
      if (rendered && rendered !== "[object Object]") return sanitizeBrandSurface(sanitizeInlineText(rendered))
    } catch {}
    return ""
  }
  return ""
}

function sanitizeInlineText(value: string): string {
  return stripAnsi(value)
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function filetype(input?: string) {
  if (!input) return "none"
  const ext = path.extname(input)
  const language = LANGUAGE_EXTENSIONS[ext]
  if (["typescriptreact", "javascriptreact", "javascript"].includes(language)) return "typescript"
  return language
}
// Force recompile Sat Mar 14 17:35:15 CDT 2026
