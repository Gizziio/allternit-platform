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
import type {
  AssistantMessage,
  CompactionPart,
  Part,
  SessionStatus,
  ToolPart,
  UserMessage,
  TextPart,
  ReasoningPart,
} from "@a2r/sdk/v2"
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
import { DialogUsage } from "@/cli/ui/tui/component/dialog-usage"
import { DialogHelp } from "@/cli/ui/tui/component/dialog-help"
import { DialogMessageActions } from "@/cli/ui/tui/component/dialog-message-actions"
import { DialogJump } from "@/cli/ui/tui/component/dialog-jump"
import { DialogFileRefs } from "@/cli/ui/tui/component/dialog-file-refs"
import { DialogPinned } from "@/cli/ui/tui/component/dialog-pinned"
import { DialogExport } from "@/cli/ui/tui/component/dialog-export"
import { DialogMcp } from "@/cli/ui/tui/component/dialog-mcp"
import { Sidebar } from "@/cli/ui/tui/routes/session/sidebar"
import { LANGUAGE_EXTENSIONS } from "@/runtime/integrations/lsp/language"
import parsers from "../../../../../../parsers-config.ts"
import { Clipboard } from "@/cli/ui/tui/util/clipboard"
import { Toast, useToast } from "@/cli/ui/tui/ui/toast"
import { useKV } from "@/cli/ui/tui/context/kv.tsx"
import { Editor } from "@/cli/ui/tui/util/editor"
import stripAnsi from "strip-ansi"
import { Footer } from "@/cli/ui/tui/routes/session/footer.tsx"
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
  const session = createMemo(() => sync.session.get(route.sessionID))
  const children = createMemo(() => {
    const currentSession = session()
    if (!currentSession) return []
    const parentID = currentSession.parentID ?? currentSession.id
    return sync.data.session
      .filter((x) => x.parentID === parentID || x.id === parentID)
      .toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  })
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])
  const permissions = createMemo(() => {
    if (session()?.parentID) return []
    return children().flatMap((x) => sync.data.permission[x.id] ?? [])
  })
  const questions = createMemo(() => {
    if (session()?.parentID) return []
    return children().flatMap((x) => sync.data.question[x.id] ?? [])
  })

  const pending = createMemo(() => {
    const activeAssistant = messages().findLast((x) => x.role === "assistant" && !x.time.completed)
    if (activeAssistant) return activeAssistant.id
    const sessionStatus = sync.data.session_status?.[route.sessionID]
    const last = messages().at(-1)
    if ((sessionStatus?.type === "busy" || sessionStatus?.type === "retry") && last?.role === "user") {
      return last.id
    }
    return undefined
  })

  const lastAssistant = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant")
  })

  const activeAssistant = createMemo(() =>
    messages().findLast(
      (message): message is AssistantMessage => message.role === "assistant" && !message.time.completed,
    ),
  )

  // Define activeTools early to avoid reference issues
  const activeTools = createMemo(() => {
    const assistant = activeAssistant()
    if (!assistant) return [] as string[]
    const parts = sync.data.part[assistant.id] ?? []
    return parts
      .filter(
        (part): part is Extract<Part, { type: "tool" }> =>
          part.type === "tool" && (part.state.status === "running" || part.state.status === "pending"),
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

    const activeParts = activeAssistant() ? (sync.data.part[activeAssistant()!.id] ?? []) : []
    const hasRunningTool = activeTools().length > 0
    if (hasRunningTool) return "executing"

    const hasVisibleText = activeParts.some(
      (part): part is Extract<Part, { type: "text" }> => part.type === "text" && part.text.trim().length > 0,
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
  const search = useSearch(messages, (messageID) => sync.data.part[messageID] ?? [])

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
    const tui = sync.data.config.tui
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
              const lookup = await sdk.client.session.get({ sessionID })
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

  createEffect(() => {
    const title = Locale.truncate(session()?.title ?? "", 50)
    const pad = (text: string) => text.padEnd(10, " ")
    const weak = (text: string) => UI.Style.TEXT_DIM + pad(text) + UI.Style.TEXT_NORMAL
    const logo = UI.logo("  ").split(/\r?\n/)
    return exit.message.set(
      [
        ``,
        `${logo[0] ?? ""}`,
        `${logo[1] ?? ""}`,
        `${logo[2] ?? ""}`,
        `${logo[3] ?? ""}`,
        ``,
        `  ${weak("Session")}${UI.Style.TEXT_NORMAL_BOLD}${title}${UI.Style.TEXT_NORMAL}`,
        `  ${weak("Continue")}${UI.Style.TEXT_NORMAL_BOLD}gizzi-code -s ${session()?.id}${UI.Style.TEXT_NORMAL}`,
        ``,
      ].join("\n"),
    )
  })

  useKeyboard((evt) => {
    if (!session()?.parentID) return
    if (keybind.match("app_exit", evt)) {
      exit()
    }
    // Copy code block with 'y'
    if (evt.name === "y") {
      const currentAssistant = lastAssistant()
      if (currentAssistant) {
        const parts = sync.data.part[currentAssistant.id] ?? []
        const textPart = parts.find((p): p is Extract<Part, { type: "text" }> => p.type === "text" && p.text.trim().length > 0)
        if (textPart && hasCodeBlocks(textPart.text)) {
          const codeBlock = getFirstCodeBlock(textPart.text)
          if (codeBlock) {
            Clipboard.copy(codeBlock.code).then(() => {
              toast.show({ message: "Code block copied!", variant: "success", duration: 2000 })
            })
          }
        } else {
          // No code block found, copy entire message text
          const fullText = parts.filter((p): p is Extract<Part, { type: "text" }> => p.type === "text").map(p => p.text).join("\n")
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
      const runManualCompact = async () => {
        try {
          toast.show({ message: "Compacting session...", variant: "info", duration: 2000 })
          
          // Initialize GIZZI structure if needed
          await GuardArtifacts.initialize(Instance.directory)
          
          // Get current session data
          const msgs = messages()
          const parts = msgs.flatMap(m => sync.data.part[m.id] ?? [])
          
          // Get receipts (placeholder - in real implementation would read from receipts)
          const receipts: object[] = []
          
          // Get usage summary
          const { SessionUsage } = await import("@/runtime/session/usage")
          const usageSummary = await SessionUsage.getSessionUsage(route.sessionID)
          
          // Get last assistant message for model info
          const lastAssistant = msgs.findLast(m => m.role === "assistant") as AssistantMessage | undefined
          
          // Emit compaction
          const result = await GuardCompaction.emit({
            session_id: route.sessionID,
            run_id: `run_${Date.now()}`,
            workspace: Instance.directory,
            messages: msgs.map(m => ({ info: m as any, parts: sync.data.part[m.id] ?? [] })),
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
      
      runManualCompact()
    }
    
    // Guard: Manual handoff with 'H'
    if (evt.name === "H") {
      evt.preventDefault()
      dialog.replace(() => (
        <DialogConfirm
          title="Handoff Session"
          message="Switch to alternative runner? This will compact and create a handoff baton."
          onConfirm={async () => {
            dialog.clear()
            try {
              toast.show({ message: "Preparing handoff...", variant: "info", duration: 2000 })
              
              // First compact
              await GuardArtifacts.initialize(Instance.directory)
              
              const msgs = messages()
              const lastAssistant = msgs.findLast(m => m.role === "assistant") as AssistantMessage | undefined
              const { SessionUsage } = await import("@/runtime/session/usage")
              const usageSummary = await SessionUsage.getSessionUsage(route.sessionID)
              
              const result = await GuardCompaction.emit({
                session_id: route.sessionID,
                run_id: `run_${Date.now()}`,
                workspace: Instance.directory,
                messages: msgs.map(m => ({ info: m as any, parts: sync.data.part[m.id] ?? [] })),
                receipts: [],
                usage_summary: usageSummary ?? null,
                objective: undefined,
                model: lastAssistant?.modelID ?? "unknown",
                provider: lastAssistant?.providerID ?? "unknown",
                runner: "gizzi_shell"
              })
              
              // Trigger handoff event
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

        return parts.some((part) => part && part.type === "text" && !part.synthetic && !part.ignored)
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
    let next = children().findIndex((x) => x.id === session()?.id) + direction
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
          const parts = sync.data.part[currentAssistant.id] ?? []
          const textPart = parts.find((p): p is Extract<Part, { type: "text" }> => p.type === "text" && p.text.trim().length > 0)
          if (textPart && hasCodeBlocks(textPart.text)) {
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
      enabled: sync.data.config.share !== "disabled",
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
            sessionID: route.sessionID,
          })
          .then((res) => copy(res.data!.share!.url))
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
          sessionID: route.sessionID,
          modelID: selectedModel.modelID,
          providerID: selectedModel.providerID,
        })
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
        await sdk.client.session
          .unshare({
            sessionID: route.sessionID,
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
        const status = sync.data.session_status?.[route.sessionID]
        if (status?.type !== "idle") await sdk.client.session.abort({ sessionID: route.sessionID }).catch(() => {})
        const revert = session()?.revert?.messageID
        const message = messages().findLast((x) => (!revert || x.id < revert) && x.role === "user")
        if (!message) return
        sdk.client.session
          .revert({
            sessionID: route.sessionID,
            messageID: message.id,
          })
          .then(() => {
            toBottom()
          })
        const parts = sync.data.part[message.id]
        prompt.set(
          parts.reduce(
            (agg, part) => {
              if (part.type === "text") {
                if (!part.synthetic) agg.input += part.text
              }
              if (part.type === "file") agg.parts.push(part)
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
        const message = messages().find((x) => x.role === "user" && x.id > messageID)
        if (!message) {
          sdk.client.session.unrevert({
            sessionID: route.sessionID,
          })
          prompt.set({ input: "", parts: [] })
          return
        }
        sdk.client.session.revert({
          sessionID: route.sessionID,
          messageID: message.id,
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
        const messages = sync.data.message[route.sessionID]
        if (!messages || !messages.length) return

        // Find the most recent user message with non-ignored, non-synthetic text parts
        for (let i = messages.length - 1; i >= 0; i--) {
          const message = messages[i]
          if (!message || message.role !== "user") continue

          const parts = sync.data.part[message.id]
          if (!parts || !Array.isArray(parts)) continue

          const hasValidTextPart = parts.some(
            (part) => part && part.type === "text" && !part.synthetic && !part.ignored,
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
          (msg) => msg.role === "assistant" && (!revertID || msg.id < revertID),
        )
        if (!lastAssistantMessage) {
          toast.show({ message: GIZZICopy.toast.noAssistantMessages, variant: "error" })
          dialog.clear()
          return
        }

        const parts = sync.data.part[lastAssistantMessage.id] ?? []
        const textParts = parts.filter((part) => part.type === "text")
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
            sessionData,
            sessionMessages.map((msg) => ({ info: msg, parts: sync.data.part[msg.id] ?? [] })),
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
            sessionData,
            sessionMessages.map((msg) => ({ info: msg, parts: sync.data.part[msg.id] ?? [] })),
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
        const providers = sync.data.provider
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
        const mcp = sync.data.mcp
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
        const lsp = sync.data.lsp
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
    // Plugin management
    {
      title: "Manage plugins",
      value: "session.plugins",
      category: "System",
      slash: { name: "plugins" },
      onSelect: async (dialog) => {
        const lines: string[] = ["# Installed Plugins\n"]
        const config = sync.data.config
        const plugins = (config as any).plugin ?? []
        if (plugins.length === 0) {
          lines.push("No plugins configured.\n")
          lines.push("Add plugins to gizzi.json:")
          lines.push('  "plugin": ["plugin-name@version"]')
        } else {
          for (const p of plugins) {
            lines.push(`  - ${p}`)
          }
        }
        lines.push("")
        lines.push("## Search plugins")
        lines.push("Use `gizzi-code plugin search <query>` to find plugins")
        lines.push("Use `gizzi-code plugin install <name>` to install")
        await Editor.open({ value: lines.join("\n"), renderer })
        dialog.clear()
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
    // Loop — run a prompt on a recurring interval (creates a cron job)
    {
      title: "Loop a prompt on interval",
      value: "session.loop",
      category: "Automation",
      slash: { name: "loop" },
      onSelect: async (dialog) => {
        const { DialogPrompt } = await import("@/cli/ui/tui/ui/dialog-prompt")

        // Step 1: Get interval
        const intervalInput = await DialogPrompt.show(dialog, "Interval (e.g., 5m, 1h, 30s)", {
          placeholder: "10m",
        })
        if (!intervalInput) {
          dialog.clear()
          return
        }

        const match = intervalInput.trim().match(/^(\d+)(s|m|h)$/)
        if (!match) {
          toast.show({ message: "Invalid interval. Use format: 5m, 1h, 30s", variant: "error", duration: 3000 })
          dialog.clear()
          return
        }

        const val = parseInt(match[1])
        const unit = match[2]
        const intervalMs = unit === "s" ? val * 1000 : unit === "m" ? val * 60000 : val * 3600000

        // Step 2: Get prompt
        const promptText = await DialogPrompt.show(dialog, "Prompt or slash command to run", {
          placeholder: "/commit or check deploy status",
        })
        if (!promptText) {
          dialog.clear()
          return
        }

        // Convert interval to a cron schedule
        const intervalSec = Math.round(intervalMs / 1000)
        let schedule: string
        if (intervalSec < 60) {
          schedule = "* * * * *"
        } else if (intervalSec < 3600) {
          const mins = Math.round(intervalSec / 60)
          schedule = `*/${mins} * * * *`
        } else {
          const hours = Math.round(intervalSec / 3600)
          schedule = `0 */${hours} * * *`
        }

        const durationLabel = unit === "s" ? `${val}s` : unit === "m" ? `${val}m` : `${val}h`

        try {
          await sdk.client.cron.create({
            name: `loop: ${promptText.slice(0, 40)}`,
            schedule,
            prompt: promptText,
            wakeMode: "main",
          })
          toast.show({
            message: `Loop started: "${promptText.slice(0, 30)}" every ${durationLabel}`,
            variant: "success",
            duration: 3000,
          })
        } catch (e) {
          toast.show({
            message: `Failed to create loop`,
            variant: "error",
            duration: 3000,
          })
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
        // Trigger the C hotkey handler manually
        const event = { name: "C", preventDefault: () => {} } as any
        // Find and call the keyboard handler
        const keyboardHandler = (evt: any) => {
          if (evt.name === "C") {
            // This will be handled by the useKeyboard handler
          }
        }
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
    return messages().filter((x) => x.id >= messageID && x.role === "user")
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
          return isHeightConstrained()
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
        <box flexGrow={1} width="100%" minWidth={0} paddingBottom={1}>
          <GIZZIFrame isHeightConstrained={isHeightConstrained()}>
            <Show when={session() && showHeader() && (!sidebarVisible() || !wide())}>
              <Header />
            </Show>
            <scrollbox
              ref={(r) => (scroll = r)}
              width="100%"
              minWidth={0}
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
              flexGrow={1}
              scrollAcceleration={scrollAcceleration()}
            >
              <GIZZIMessageList>
                <Show when={!session()}>
                  <box marginTop={1} marginLeft={1}>
                    <text fg={theme.textMuted}>Loading session…</text>
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
                                            <text fg={theme.text}>{file.filename}</text>
                                            <Show when={file.additions > 0}>
                                              <text fg={theme.diffAdded}>+{file.additions}</text>
                                            </Show>
                                            <Show when={file.deletions > 0}>
                                              <text fg={theme.diffRemoved}>-{file.deletions}</text>
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
                            message={message as UserMessage}
                            parts={sync.data.part[message.id] ?? []}
                            pending={pending()}
                          />
                        </Match>
                        <Match when={message.role === "assistant"}>
                          <AssistantMessage
                            last={lastAssistant()?.id === message.id}
                            message={message as AssistantMessage}
                            parts={sync.data.part[message.id] ?? []}
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
              <Show when={permissions().length === 0 && questions().length === 0}>
                <box flexDirection="row" gap={2} paddingLeft={2} paddingBottom={1} alignItems="flex-end">
                  <GIZZIMascot
                    state={sessionMascotState()}
                    compact={false}
                    color={sessionMascotState() === "idle" ? theme.textMuted : theme.primary}
                  />
                  <box paddingBottom={isHeightConstrained() ? 0 : 1}>
                    <text fg={theme.textMuted} wrapMode="none">
                      {sessionMascotHint()}
                    </text>
                  </box>
                </box>
              </Show>
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
  const color = createMemo(() => local.agent.color(props.message.agent))
  const queuedFg = createMemo(() => selectedForeground(theme, color()))
  const metadataVisible = createMemo(() => queued() || ctx.showTimestamps())

  const compaction = createMemo(() => {
    return props.parts.find((part): part is CompactionPart => part.type === "compaction")
  })

  const margin = () => (ctx.isHeightConstrained ? tone().space.xs : tone().space.sm)

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
            <text fg={theme.text}>{displayText()}</text>
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
                      if (file.mime.startsWith("image/")) return theme.accent
                      if (file.mime === "application/pdf") return theme.primary
                      return theme.secondary
                    })
                    return (
                      <text fg={theme.text}>
                        <span style={{ bg: bg(), fg: theme.background }}> {MIME_BADGE[file.mime] ?? file.mime} </span>
                        <span style={{ bg: theme.backgroundElement, fg: theme.textMuted }}> {file.filename} </span>
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
                      {Locale.todayTimeOrDateTime(props.message.time.created)}
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
  const status = createMemo<SessionStatus>(() => sync.data.session_status?.[props.message.sessionID] ?? { type: "idle" })
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
      next: currentStatus.next,
      now: now(),
    })
  })
  const summaryLine = createMemo(() => {
    let line = `${Locale.titlecase(props.message.mode)} | ${sanitizeBrandSurface(props.message.modelID)}`
    if (duration()) line += ` | ${Locale.duration(duration())}`
    const tokens = props.message.tokens
    if (tokens) {
      const parts: string[] = []
      if (tokens.reasoning > 0) parts.push(`${Locale.number(tokens.reasoning)} thinking`)
      if (tokens.input > 0) parts.push(`${Locale.number(tokens.input)} in`)
      if (tokens.output > 0) parts.push(`${Locale.number(tokens.output)} out`)
      if (tokens.cache?.read > 0) parts.push(`${Locale.number(tokens.cache.read)} cached`)
      if (parts.length > 0) line += ` | ${parts.join(", ")}`
    }
    if (props.message.cost > 0) line += ` | $${props.message.cost.toFixed(4)}`
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

  const margin = () => (ctx.isHeightConstrained ? tone().space.xs : tone().space.sm)

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
                  {fitInline(`${liveHint()} ${heartbeat()} ${tone().glyph.separator} ${elapsedSeconds()}s`, Math.max(16, ctx.width - 22))}
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
            isHeightConstrained={ctx.isHeightConstrained}
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
      (props.width >= 64 || props.isHeightConstrained) &&
      props.animationProfile === "full" &&
      (props.focus || props.showLaneHistory || props.isHeightConstrained),
  )
  const hintLine = createMemo(() => {
    const base = sanitizeBrandSurface(props.hint)
    if (props.animationProfile !== "full" || props.narrow) return base
    return `${base} ${tone().glyph.separator} ${liveModePulse(props.mode, props.frameTick)}`
  })
  const lineLimit = createMemo(() => Math.max(props.narrow ? 24 : 34, props.width - (props.narrow ? 32 : 56)))
  const runLine = createMemo(() =>
    fitInline(
      `${liveModeLabel(props.mode)} ${tone().glyph.separator} ${GIZZICopy.session.deckRun} #${props.runID} ${tone().glyph.separator} ${props.elapsedSeconds}s`,
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
        gap={tone().space.sm}
        width="100%"
        minWidth={0}
      >
          <box flexDirection="column" gap={tone().space.xs} flexGrow={1} minWidth={0}>
            <box flexDirection="row" gap={1} width="100%" minWidth={0}>
              <GIZZISpinner color={props.color} variant="schematic" />
              <Show when={!micro()}>
                <text fg={props.color} wrapMode="none">
                  <span style={{ bold: true }}>{runLine()}</span>
                </text>
              </Show>
              <Show when={micro()}>
                 <text fg={props.color} wrapMode="none">
                  <span style={{ bold: true }}>{props.mode.toUpperCase()}</span>
                </text>
              </Show>
            </box>
            <text fg={theme.textMuted} wrapMode="none">
              {fitInline(hintLine(), lineLimit())}
            </text>
            <Show when={props.showReceipts} fallback={<text fg={theme.textMuted}>{GIZZICopy.session.receiptsHidden}</text>}>
              <text fg={theme.textMuted} wrapMode="none">
                <span style={{ fg: props.color }}>{tone().glyph.tool}</span> {fitInline(toolSummary(), lineLimit())}
              </text>
            </Show>
          </box>
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
                  <text fg={color()}>{card.icon}</text>
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
  if (id === "read" || id === "write" || id === "edit") {
    return sanitizeBrandSurface(normalizePath(toInlineText(payload.filePath || payload.path)))
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
              onClick={() => setCollapsed((prev) => !prev)}
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
                `${streamPulse()} ${tone().glyph.separator} ${content().length} chars`,
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
    get permission() {
      const permissions = sync.data.permission[props.message.sessionID] ?? []
      const permissionIndex = permissions.findIndex((x) => x.tool?.callID === props.part.callID)
      return permissions[permissionIndex]
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
  const maxLines = 3
  const overflow = createMemo(() => lines().length > maxLines)
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return output()
    return [...lines().slice(0, maxLines), "…"].join("\n")
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
            <text fg={theme.textMuted}>{expanded() ? GIZZICopy.tool.collapse : GIZZICopy.tool.expand}</text>
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
    const callID = sync.data.permission[ctx.sessionID]?.at(0)?.tool?.callID
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
      <box paddingLeft={tone().space.sm}>
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
  const overflow = createMemo(() => lines().length > 10)
  const limited = createMemo(() => {
    if (expanded() || !overflow()) return output()
    return [...lines().slice(0, 10), "…"].join("\n")
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
            <text fg={theme.text}>$ {props.input.command}</text>
            <Show when={output()}>
              <text fg={theme.text}>{limited()}</text>
            </Show>
            <Show when={overflow()}>
              <text fg={theme.textMuted}>{expanded() ? GIZZICopy.tool.collapse : GIZZICopy.tool.expand}</text>
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
  return (
    <InlineTool icon="✱" pending={GIZZICopy.tool.pending.glob} complete={props.input.pattern} part={props.part}>
      {GIZZICopy.tool.labels.glob} "{props.input.pattern}" <Show when={props.input.path}>in {normalizePath(props.input.path)} </Show>
      <Show when={props.metadata.count}>
        ({GIZZICopy.tool.matches({ count: props.metadata.count ?? 0 })})
      </Show>
    </InlineTool>
  )
}

function Read(props: ToolProps<typeof ReadTool>) {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const loaded = createMemo(() => {
    if (props.part.state.status !== "completed") return []
    if (props.part.state.time.compacted) return []
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
  return (
    <InlineTool icon="✱" pending={GIZZICopy.tool.pending.grep} complete={props.input.pattern} part={props.part}>
      {GIZZICopy.tool.labels.grep} "{props.input.pattern}" <Show when={props.input.path}>in {normalizePath(props.input.path)} </Show>
      <Show when={props.metadata.matches}>
        ({GIZZICopy.tool.matches({ count: props.metadata.matches ?? 0 })})
      </Show>
    </InlineTool>
  )
}

function List(props: ToolProps<typeof ListTool>) {
  const dir = createMemo(() => {
    if (props.input.path) {
      return normalizePath(props.input.path)
    }
    return ""
  })
  return (
    <InlineTool icon="→" pending={GIZZICopy.tool.pending.list} complete={props.input.path !== undefined} part={props.part}>
      {GIZZICopy.tool.labels.list} {dir()}
    </InlineTool>
  )
}

function WebFetch(props: ToolProps<typeof WebFetchTool>) {
  const input = props.input as any
  const url = toInlineText(input.url)
  return (
    <InlineTool icon="%" pending={GIZZICopy.tool.pending.webFetch} complete={url} part={props.part}>
      {url ? `Fetched web content from ${url}` : "Fetched web content"}
    </InlineTool>
  )
}

function CodeSearch(props: ToolProps<any>) {
  const input = props.input as any
  const metadata = props.metadata as any
  const query = toInlineText(input.query)
  const results = toInlineText(metadata.results)
  const suffix = results ? ` (${results} results)` : ""
  return (
    <InlineTool icon="◇" pending={GIZZICopy.tool.pending.codeSearch} complete={query} part={props.part}>
      {query ? `Searched code for "${query}"${suffix}` : `Searched code${suffix}`}
    </InlineTool>
  )
}

function WebSearch(props: ToolProps<any>) {
  const input = props.input as any
  const metadata = props.metadata as any
  const query = toInlineText(input.query)
  const results = toInlineText(metadata.numResults)
  const suffix = results ? ` (${results} results)` : ""
  return (
    <InlineTool icon="@" pending={GIZZICopy.tool.pending.webSearch} complete={query} part={props.part}>
      {query ? `Searched web for "${query}"${suffix}` : `Searched web${suffix}`}
    </InlineTool>
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
        .filter((part): part is ToolPart => part.type === "tool")
        .map((part) => ({ tool: part.tool, state: part.state })),
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
    const diffStyle = ctx.sync.data.config.tui?.diff_style
    if (diffStyle === "stacked") return "unified"
    // Default to "auto" behavior
    return ctx.width > 120 ? "split" : "unified"
  })

  const ft = createMemo(() => filetype(props.input.filePath))

  const diffContent = createMemo(() => props.metadata.diff)

  const diagnostics = createMemo(() => {
    const filePath = Filesystem.normalizePath(props.input.filePath ?? "")
    const arr = props.metadata.diagnostics?.[filePath] ?? []
    return arr.filter((x) => x.severity === 1).slice(0, 3)
  })

  return (
    <Switch>
      <Match when={props.metadata.diff !== undefined}>
        <BlockTool title={"← " + GIZZICopy.tool.labels.edit + " " + normalizePath(props.input.filePath!)} part={props.part}>
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

function ApplyPatch(props: ToolProps<typeof ApplyPatchTool>) {
  const ctx = use()
  const { theme, syntax } = useTheme()
  const tone = useGIZZITheme()

  const files = createMemo(() => props.metadata.files ?? [])

  const view = createMemo(() => {
    const diffStyle = ctx.sync.data.config.tui?.diff_style
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
                    -{file.deletions} line{file.deletions !== 1 ? "s" : ""}
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
  const tone = useGIZZITheme()
  return (
    <Switch>
      <Match when={props.metadata.todos?.length}>
        <BlockTool title={"# " + GIZZICopy.tool.labels.todos} part={props.part}>
          <box gap={tone().space.sm}>
            <For each={props.input.todos ?? []}>
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
  return (
    <InlineTool icon="→" pending={GIZZICopy.tool.pending.skill} complete={props.input.name} part={props.part}>
      {GIZZICopy.tool.labels.skill} "{props.input.name}"
    </InlineTool>
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
