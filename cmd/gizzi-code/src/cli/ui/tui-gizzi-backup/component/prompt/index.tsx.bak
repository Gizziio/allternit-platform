// Note: SDK types are now exported as 'unknown'. Local types are defined below,
// but sync.tsx context still uses SDK types causing type propagation issues.
// Full migration requires updating sync.tsx first.

import { BoxRenderable, TextareaRenderable, MouseEvent, PasteEvent, t, dim, fg } from "@opentui/core"
import { createEffect, createMemo, createSignal, type JSX, onMount, onCleanup, on, For, Show, Switch, Match } from "solid-js"
import "opentui-spinner/solid"
import path from "path"
import { Filesystem } from "@/runtime/util/filesystem"
import { useLocal } from "@/cli/ui/tui/context/local"
import { selectedForeground, useTheme } from "@/cli/ui/tui/context/theme"
import { EmptyBorder } from "@/cli/ui/tui/component/border"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useRoute } from "@/cli/ui/tui/context/route"
import { useSync } from "@/cli/ui/tui/context/sync"
import { Identifier } from "@/shared/id/id"
import { createStore, produce } from "solid-js/store"
import { useKeybind } from "@/cli/ui/tui/context/keybind"
import { usePromptHistory, type PromptInfo } from "@/cli/ui/tui/component/prompt/history"
import { usePromptStash } from "@/cli/ui/tui/component/prompt/stash"
import { DialogStash } from "@/cli/ui/tui/component/dialog-stash"
import { type AutocompleteRef, Autocomplete } from "@/cli/ui/tui/component/prompt/autocomplete"
import { useCommandDialog } from "@/cli/ui/tui/component/dialog-command"
import { useRenderer, useTerminalDimensions } from "@opentui/solid"
import { Editor } from "@/cli/ui/tui/util/editor"
import { useExit } from "@/cli/ui/tui/context/exit"
import { Clipboard } from "@/cli/ui/tui/util/clipboard"
import type { FilePart, Part } from "@allternit/sdk"
import { TuiEvent } from "@/cli/ui/tui/event"
import { iife } from "@/runtime/util/iife"
import { Locale } from "@/runtime/util/locale"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { DialogProvider as DialogProviderConnect } from "@/cli/ui/tui/component/dialog-provider"
import { useToast } from "@/cli/ui/tui/ui/toast"
import { useTextareaKeybindings } from "@/cli/ui/tui/component/textarea-keybindings"
import { DialogSkill } from "@/cli/ui/tui/component/dialog-skill"
import { GIZZIStatusBar } from "@/cli/ui/components/gizzi"
import { isWebToolName } from "@/cli/ui/components/gizzi/runtime-mode"
import { Log } from "@/runtime/util/log"

const log = Log.create({ service: "tui.prompt" })
import { GIZZICopy } from "@/runtime/brand/brand"
import { Provider } from "@/runtime/providers/provider"
// Using local SessionStatus type instead of SDK's unknown type
type SessionStatus = SessionStatusInfo

export type PromptProps = {
  sessionID?: string
  visible?: boolean
  disabled?: boolean
  onSubmit?: () => void
  ref?: (ref: PromptRef) => void
  hint?: JSX.Element
  showPlaceholder?: boolean
}

export type PromptRef = {
  focused: boolean
  current: PromptInfo
  set(prompt: PromptInfo): void
  reset(): void
  blur(): void
  focus(): void
  submit(): void
}

const PLACEHOLDERS = ["Fix a TODO in the codebase", "What is the tech stack of this project?", "Fix broken tests"]
const SHELL_PLACEHOLDERS = ["ls -la", "git status", "pwd"]

type PromptTimeline = {
  id: string
  submitAt: number
  firstStatusAt?: number
  firstPartAt?: number
  firstToolAt?: number
  firstTextAt?: number
}

type RuntimeMode = "idle" | "queued" | "connecting" | "thinking" | "web" | "tools" | "responding"

// Local type definitions for SDK types that are exported as 'unknown'
// These match the expected runtime types
interface SessionStatusInfo {
  type: "idle" | "busy" | "retry"
  attempt?: number
  message?: string
  next?: number
}

interface MessageData {
  id: string
  role: "user" | "assistant" | "system"
  agent?: string
  model?: string
  variant?: string
  time: {
    created: number
    completed?: number
  }
}

interface PartBase {
  type: "file" | "agent" | "text" | "tool" | "reasoning"
}

interface ToolPart extends PartBase {
  type: "tool"
  tool?: string
  state?: {
    status: "pending" | "running" | "completed" | "failed"
  }
}

interface TextPart extends PartBase {
  type: "text"
  text: string
  source?: {
    text?: {
      start: number
      end: number
      value: string
    }
  }
}

interface ReasoningPart extends PartBase {
  type: "reasoning"
  text: string
}

interface FilePartLocal extends PartBase {
  type: "file"
  mime?: string
  filename?: string
  url?: string
  source?: {
    type?: string
    path?: string
    text?: {
      start: number
      end: number
      value: string
    }
  }
}

interface AgentPartLocal extends PartBase {
  type: "agent"
  name?: string
  source?: {
    start: number
    end: number
    value: string
  }
}

type PartData = ToolPart | TextPart | ReasoningPart | FilePartLocal | AgentPartLocal

// Helper type for agent data in sync
interface AgentData {
  name: string
}

function parseFixtureDelay() {
  const raw = Number(process.env.GIZZI_TUI_UX_FIXTURE_DELAY_MS)
  if (!Number.isFinite(raw) || raw < 1000) return 22_000
  return Math.round(raw)
}

export function Prompt(props: PromptProps) {
  let input: TextareaRenderable
  let anchor: BoxRenderable
  let autocomplete: AutocompleteRef

  const keybind = useKeybind()
  const local = useLocal()
  const sdk = useSDK()
  const route = useRoute()
  const sync = useSync()
  const dialog = useDialog()
  const toast = useToast()
  const status = createMemo<SessionStatusInfo>(() => 
    (sync.data.session_status?.[props.sessionID ?? ""] as unknown as SessionStatusInfo | undefined) ?? { type: "idle" }
  )
  const history = usePromptHistory()
  const stash = usePromptStash()
  const command = useCommandDialog()
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const { theme, syntax } = useTheme()
  const terminalWidth = createMemo(() => dimensions().width)
  const controlLayout = createMemo<"full" | "compact" | "minimal">(() => {
    if (terminalWidth() < 104) return "minimal"
    if (terminalWidth() < 136) return "compact"
    return "full"
  })

  function promptModelWarning() {
    toast.show({
      variant: "warning",
      message: GIZZICopy.prompt.connectProviderToSend,
      duration: 3000,
    })
    if (sync.data.provider.length === 0) {
      dialog.replace(() => <DialogProviderConnect />)
    }
  }

  const textareaKeybindings = useTextareaKeybindings()

  const fileStyleId = syntax().getStyleId("extmark.file")!
  const agentStyleId = syntax().getStyleId("extmark.agent")!
  const pasteStyleId = syntax().getStyleId("extmark.paste")!
  let promptPartTypeId = 0

  sdk.event.on(TuiEvent.PromptAppend.type, (evt) => {
    if (!input || input.isDestroyed) return
    input.insertText(evt.properties.text)
    queueMicrotask(() => {
      if (!input || input.isDestroyed) return
      input.getLayoutNode().markDirty()
      input.gotoBufferEnd()
      renderer.requestRender()
    })
  })

  createEffect(() => {
    if (props.disabled) input.cursorColor = theme.backgroundElement
    if (!props.disabled) input.cursorColor = theme.text
  })

  createEffect(
    on(
      () => store.prompt.input,
      (value) => {
        if (!value || store.prompt.parts.length > 0) return
        const normalized = normalizeSearchModePrompt(value)
        if (normalized === value) return
        setStore("prompt", "input", normalized)
        if (!input || input.isDestroyed) return
        input.setText(normalized)
        input.gotoBufferEnd()
        renderer.requestRender()
      },
      { defer: true },
    ),
  )

  // Clear runId when session goes back to idle (run completed)
  createEffect(() => {
    if (status().type === "idle" && store.runId) {
      setStore("runId", undefined)
    }
  })

  const lastUserMessage = createMemo(() => {
    if (!props.sessionID) return undefined
    const messages = sync.data.message[props.sessionID] as unknown as MessageData[] | undefined
    if (!messages) return undefined
    return messages.findLast((m) => m.role === "user")
  })

  const activeParts = createMemo<PartData[]>(() => {
    if (!props.sessionID) return []
    const messages = sync.data.message[props.sessionID] as unknown as MessageData[] | undefined
    const message = (messages ?? []).findLast((item) => {
      if (item.role !== "assistant") return false
      return !item.time.completed
    })
    if (!message) return []
    return (sync.data.part[message.id] as PartData[] | undefined) ?? []
  })
  const [timeline, setTimeline] = createSignal<PromptTimeline | undefined>()
  const metricsEnabled = () => process.env.GIZZI_TUI_UX_METRICS === "1"
  const fixtureMode = () => (process.env.GIZZI_TUI_UX_FIXTURE ?? "").trim().toLowerCase()
  const fixtureDelayMs = parseFixtureDelay()
  const queuedSince = createMemo(() => {
    const current = timeline()
    if (!current) return undefined
    if (status().type !== "idle") return undefined
    if (activeParts().length > 0) return undefined
    return current.submitAt
  })
  const statusVisible = createMemo(() => status().type !== "idle" || !!timeline())
  const effectiveStatus = createMemo<SessionStatusInfo>(() => {
    if (timeline() && status().type === "idle") return { type: "busy" }
    return status()
  })
  const runtimeMode = createMemo<RuntimeMode>(() => {
    const parts = activeParts()
    if (timeline() && status().type === "idle" && parts.length === 0) return "queued"
    if (status().type === "retry") return "connecting"
    const hasRunningTools = parts.some(
      (part) => {
        if (part.type !== "tool") return false
        const toolPart = part as ToolPart
        return toolPart.state?.status === "pending" || toolPart.state?.status === "running"
      },
    )
    const hasRunningWebTools = parts.some(
      (part) => {
        if (part.type !== "tool") return false
        const toolPart = part as ToolPart
        const status = toolPart.state?.status
        return (status === "pending" || status === "running") && !!toolPart.tool && isWebToolName(toolPart.tool)
      },
    )
    if (hasRunningWebTools) return "web"
    if (hasRunningTools) return "tools"
    const hasReasoning = parts.some((part) => {
      if (part.type !== "reasoning") return false
      return (part as ReasoningPart).text?.trim().length > 0
    })
    const hasVisibleText = parts.some((part) => {
      if (part.type !== "text") return false
      return (part as TextPart).text?.trim().length > 0
    })
    if (hasReasoning && !hasVisibleText) return "thinking"
    if (hasVisibleText) return "responding"
    if (status().type === "busy") return "connecting"
    return "idle"
  })
  const runtimeModeLabel = createMemo(() => {
    const mode = runtimeMode()
    if (mode === "idle") return GIZZICopy.session.modeIdle
    if (mode === "queued") return GIZZICopy.session.modeQueued
    if (mode === "connecting") return GIZZICopy.session.modeConnecting
    if (mode === "thinking") return GIZZICopy.session.modeThinking
    if (mode === "web") return GIZZICopy.session.modeWeb
    if (mode === "tools") return GIZZICopy.session.modeTools
    return GIZZICopy.session.modeResponding
  })
  const runtimeModeColor = createMemo(() => {
    const mode = runtimeMode()
    if (mode === "queued") return theme.secondary
    if (mode === "connecting") return theme.info
    if (mode === "thinking") return theme.warning
    if (mode === "web") return theme.primary
    if (mode === "tools") return theme.primary
    if (mode === "responding") return theme.accent
    return theme.border
  })
  const runtimeModeFg = createMemo(() => selectedForeground(theme, runtimeModeColor()))
  const activeRun = createMemo(() => statusVisible() && runtimeMode() !== "idle")
  const showControlHints = createMemo(() => {
    if (terminalWidth() < 78) return false
    if (status().type === "retry") return false
    if (activeRun()) return terminalWidth() >= 132
    return true
  })
  const showRuntimeBadge = createMemo(() => !activeRun() && runtimeMode() !== "idle" && controlLayout() === "full")
  const showVariantHint = createMemo(
    () => !activeRun() && controlLayout() === "full" && local.model.variant.list().length > 0,
  )
  const showAgentHint = createMemo(() => !activeRun() && controlLayout() !== "minimal")
  const showCommandHint = createMemo(
    () => controlLayout() !== "minimal" && (!activeRun() || terminalWidth() >= 132),
  )

  const patchTimeline = (patch: Partial<PromptTimeline>) => {
    setTimeline((current) => (current ? { ...current, ...patch } : current))
  }

  const emitTimeline = (current: PromptTimeline, completedAt: number) => {
    if (!metricsEnabled()) return
    const since = (value?: number) => (value ? value - current.submitAt : undefined)
    const duration = completedAt - current.submitAt
    const values = [
      `turn=${current.id.slice(-6)}`,
      `duration=${duration}ms`,
      `first_status=${since(current.firstStatusAt) ?? "-"}ms`,
      `first_part=${since(current.firstPartAt) ?? "-"}ms`,
      `first_tool=${since(current.firstToolAt) ?? "-"}ms`,
      `first_text=${since(current.firstTextAt) ?? "-"}ms`,
    ]
    console.info(`[GIZZI UX] ${values.join(" ")}`)
  }

  createEffect(() => {
    const current = timeline()
    if (!current) return
    const nextStatus = status()
    if (!current.firstStatusAt && nextStatus.type !== "idle") {
      patchTimeline({ firstStatusAt: Date.now() })
      return
    }
    if (current.firstStatusAt && nextStatus.type === "idle") {
      emitTimeline(current, Date.now())
      setTimeline(undefined)
    }
  })

  createEffect(() => {
    const current = timeline()
    if (!current) return
    const parts = activeParts()
    if (!parts.length) return
    if (!current.firstPartAt) patchTimeline({ firstPartAt: Date.now() })
    if (!current.firstToolAt && parts.some((part) => part.type === "tool")) {
      patchTimeline({ firstToolAt: Date.now() })
    }
    if (!current.firstTextAt && parts.some((part) => part.type === "text" && part.text.trim().length > 0)) {
      patchTimeline({ firstTextAt: Date.now() })
    }
  })

  const [store, setStore] = createStore<{
    prompt: PromptInfo
    mode: "normal" | "shell"
    extmarkToPartIndex: Map<number, number>
    interrupt: number
    placeholder: number
    runId: string | undefined
  }>({
    placeholder: Math.floor(Math.random() * PLACEHOLDERS.length),
    prompt: {
      input: "",
      parts: [],
    },
    mode: "normal",
    extmarkToPartIndex: new Map(),
    interrupt: 0,
    runId: undefined,
  })

  createEffect(
    on(
      () => props.sessionID,
      () => {
        setStore("placeholder", Math.floor(Math.random() * PLACEHOLDERS.length))
      },
      { defer: true },
    ),
  )

  // Rotate placeholder every 8s while input is empty
  const placeholderTimer = setInterval(() => {
    if (!store.prompt.input) {
      setStore("placeholder", (i) => (i + 1) % PLACEHOLDERS.length)
    }
  }, 8000)
  onCleanup(() => clearInterval(placeholderTimer))

  // Initialize agent/model/variant from last user message when session changes
  let syncedSessionID: string | undefined
  createEffect(() => {
    const sessionID = props.sessionID
    const msg = lastUserMessage()

    if (sessionID !== syncedSessionID) {
      if (!sessionID || !msg) return

      syncedSessionID = sessionID

      // Only set agent if it's a primary agent (not a subagent)
      const isPrimaryAgent = local.agent.list().some((x) => x.name === msg.agent)
      if (msg.agent && isPrimaryAgent) {
        local.agent.set(msg.agent)
        if (msg.model) {
          const parsed = Provider.parseModel(msg.model)
          local.model.set(parsed)
        }
        if (msg.variant) local.model.variant.set(msg.variant)
      }
    }
  })

  command.register(() => {
    return [
      {
        title: GIZZICopy.prompt.clearPrompt,
        value: "prompt.clear",
        category: GIZZICopy.prompt.categoryPrompt,
        hidden: true,
        onSelect: (dialog) => {
          input.extmarks.clear()
          input.clear()
          dialog.clear()
        },
      },
      {
        title: GIZZICopy.prompt.submitPrompt,
        value: "prompt.submit",
        keybind: "input_submit",
        category: GIZZICopy.prompt.categoryPrompt,
        hidden: true,
        onSelect: (dialog) => {
          if (!input.focused) return
          submit()
          dialog.clear()
        },
      },
      {
        title: GIZZICopy.prompt.paste,
        value: "prompt.paste",
        keybind: "input_paste",
        category: GIZZICopy.prompt.categoryPrompt,
        hidden: true,
        onSelect: async () => {
          const content = await Clipboard.read()
          if (content?.mime.startsWith("image/")) {
            await pasteImage({
              filename: "clipboard",
              mime: content.mime,
              content: content.data,
            })
          }
        },
      },
      {
        title: GIZZICopy.prompt.interruptSession,
        value: "session.interrupt",
        keybind: "session_interrupt",
        category: GIZZICopy.prompt.categorySession,
        hidden: true,
        enabled: status().type !== "idle",
        onSelect: (dialog) => {
          if (autocomplete.visible) return
          if (!input.focused) return
          // Interrupt: single press pauses, double press within 5s aborts
          if (store.mode === "shell") {
            setStore("mode", "normal")
            return
          }
          if (!props.sessionID) return

          setStore("interrupt", store.interrupt + 1)

          setTimeout(() => {
            setStore("interrupt", 0)
          }, 5000)

          if (store.interrupt >= 2) {
            sdk.client.session.abort({
              path: { sessionID: props.sessionID },
            })
            setStore("interrupt", 0)
          }
          dialog.clear()
        },
      },
      {
        title: GIZZICopy.prompt.openEditor,
        category: GIZZICopy.prompt.categorySession,
        keybind: "editor_open",
        value: "prompt.editor",
        slash: {
          name: "editor",
        },
        onSelect: async (dialog) => {
          dialog.clear()

          // replace summarized text parts with the actual text
          const text = store.prompt.parts
            .filter((p) => p.type === "text")
            .reduce((acc, p) => {
              if (!p.source) return acc
              return acc.replace(p.source.text.value, p.text)
            }, store.prompt.input)

          const nonTextParts = store.prompt.parts.filter((p) => p.type !== "text")

          const value = text
          const content = await Editor.open({ value, renderer })
          if (!content) return

          input.setText(content)

          // Update positions for nonTextParts based on their location in new content
          // Filter out parts whose virtual text was deleted
          // this handles a case where the user edits the text in the editor
          // such that the virtual text moves around or is deleted
          const updatedNonTextParts = nonTextParts
            .map((part) => {
              let virtualText = ""
              if (part.type === "file" && part.source?.text) {
                virtualText = part.source.text.value
              } else if (part.type === "agent" && part.source) {
                virtualText = part.source.value
              }

              if (!virtualText) return part

              const newStart = content.indexOf(virtualText)
              // if the virtual text is deleted, remove the part
              if (newStart === -1) return null

              const newEnd = newStart + virtualText.length

              if (part.type === "file" && part.source?.text) {
                return {
                  ...part,
                  source: {
                    ...part.source,
                    text: {
                      ...part.source.text,
                      start: newStart,
                      end: newEnd,
                    },
                  },
                }
              }

              if (part.type === "agent" && part.source) {
                return {
                  ...part,
                  source: {
                    ...part.source,
                    start: newStart,
                    end: newEnd,
                  },
                }
              }

              return part
            })
            .filter((part) => part !== null)

          setStore("prompt", {
            input: content,
            // keep only the non-text parts because the text parts were
            // already expanded inline
            parts: updatedNonTextParts,
          })
          restoreExtmarksFromParts(updatedNonTextParts)
          input.cursorOffset = Bun.stringWidth(content)
        },
      },
      {
        title: GIZZICopy.prompt.skills,
        value: "prompt.skills",
        category: GIZZICopy.prompt.categoryPrompt,
        slash: {
          name: "skills",
        },
        onSelect: () => {
          dialog.replace(() => (
            <DialogSkill
              onSelect={(skill) => {
                input.setText(`/${skill} `)
                setStore("prompt", {
                  input: `/${skill} `,
                  parts: [],
                })
                input.gotoBufferEnd()
              }}
            />
          ))
        },
      },
    ]
  })

  const ref: PromptRef = {
    get focused() {
      return input.focused
    },
    get current() {
      return store.prompt
    },
    focus() {
      input.focus()
    },
    blur() {
      input.blur()
    },
    set(prompt) {
      input.setText(prompt.input)
      setStore("prompt", prompt)
      restoreExtmarksFromParts(prompt.parts)
      input.gotoBufferEnd()
    },
    reset() {
      input.clear()
      input.extmarks.clear()
      setStore("prompt", {
        input: "",
        parts: [],
      })
      setStore("extmarkToPartIndex", new Map())
    },
    submit() {
      submit()
    },
  }

  createEffect(() => {
    if (props.visible !== false) input?.focus()
    if (props.visible === false) input?.blur()
  })

  function restoreExtmarksFromParts(parts: PromptInfo["parts"]) {
    input.extmarks.clear()
    setStore("extmarkToPartIndex", new Map())

    parts.forEach((part, partIndex) => {
      let start = 0
      let end = 0
      let virtualText = ""
      let styleId: number | undefined

      if (part.type === "file" && part.source?.text) {
        start = part.source.text.start
        end = part.source.text.end
        virtualText = part.source.text.value
        styleId = fileStyleId
      } else if (part.type === "agent" && part.source) {
        start = part.source.start
        end = part.source.end
        virtualText = part.source.value
        styleId = agentStyleId
      } else if (part.type === "text" && part.source?.text) {
        start = part.source.text.start
        end = part.source.text.end
        virtualText = part.source.text.value
        styleId = pasteStyleId
      }

      if (virtualText) {
        const extmarkId = input.extmarks.create({
          start,
          end,
          virtual: true,
          styleId,
          typeId: promptPartTypeId,
        })
        setStore("extmarkToPartIndex", (map: Map<number, number>) => {
          const newMap = new Map(map)
          newMap.set(extmarkId, partIndex)
          return newMap
        })
      }
    })
  }

  function syncExtmarksWithPromptParts() {
    const allExtmarks = input.extmarks.getAllForTypeId(promptPartTypeId)
    setStore(
      produce((draft) => {
        const newMap = new Map<number, number>()
        const newParts: typeof draft.prompt.parts = []

        for (const extmark of allExtmarks) {
          const partIndex = draft.extmarkToPartIndex.get(extmark.id)
          if (partIndex !== undefined) {
            const part = draft.prompt.parts[partIndex]
            if (part) {
              if (part.type === "agent" && part.source) {
                part.source.start = extmark.start
                part.source.end = extmark.end
              } else if (part.type === "file" && part.source?.text) {
                part.source.text.start = extmark.start
                part.source.text.end = extmark.end
              } else if (part.type === "text" && part.source?.text) {
                part.source.text.start = extmark.start
                part.source.text.end = extmark.end
              }
              newMap.set(extmark.id, newParts.length)
              newParts.push(part)
            }
          }
        }

        draft.extmarkToPartIndex = newMap
        draft.prompt.parts = newParts
      }),
    )
  }

  command.register(() => [
    {
      title: GIZZICopy.prompt.stashPrompt,
      value: "prompt.stash",
      category: GIZZICopy.prompt.categoryPrompt,
      enabled: !!store.prompt.input,
      onSelect: (dialog) => {
        if (!store.prompt.input) return
        stash.push({
          input: store.prompt.input,
          parts: store.prompt.parts,
        })
        input.extmarks.clear()
        input.clear()
        setStore("prompt", { input: "", parts: [] })
        setStore("extmarkToPartIndex", new Map())
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.prompt.stashPop,
      value: "prompt.stash.pop",
      category: GIZZICopy.prompt.categoryPrompt,
      enabled: stash.list().length > 0,
      onSelect: (dialog) => {
        const entry = stash.pop()
        if (entry) {
          input.setText(entry.input)
          setStore("prompt", { input: entry.input, parts: entry.parts })
          restoreExtmarksFromParts(entry.parts)
          input.gotoBufferEnd()
        }
        dialog.clear()
      },
    },
    {
      title: GIZZICopy.prompt.stashList,
      value: "prompt.stash.list",
      category: GIZZICopy.prompt.categoryPrompt,
      enabled: stash.list().length > 0,
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogStash
            onSelect={(entry) => {
              input.setText(entry.input)
              setStore("prompt", { input: entry.input, parts: entry.parts })
              restoreExtmarksFromParts(entry.parts)
              input.gotoBufferEnd()
            }}
          />
        ))
      },
    },
  ])

  async function submit() {
    if (props.disabled) return
    if (autocomplete?.visible) return
    if (!store.prompt.input) return
    const trimmed = store.prompt.input.trim()
    if (trimmed === "exit" || trimmed === "quit" || trimmed === ":q") {
      exit()
      return
    }
    
    // Wait for sync to be ready AND providers to be loaded before checking for model
    // This prevents the "first prompt requires two submits" issue
    const hasProviders = sync.data.provider.length > 0 || sync.data.provider_next.all.length > 0
    if (!sync.ready || !hasProviders) {
      toast.show({
        variant: "info",
        message: "Loading providers...",
        duration: 2000,
      })
      // Retry after a short delay
      setTimeout(() => {
        const hasProvidersNow = sync.data.provider.length > 0 || sync.data.provider_next.all.length > 0
        if (sync.ready && hasProvidersNow && store.prompt.input === trimmed) {
          submit()
        }
      }, 500)
      return
    }
    const selectedModel = local.model.current()
    if (!selectedModel) {
      promptModelWarning()
      return
    }
    async function createSession() {
      const created = await sdk.client.session.create({ body: { surface: "code" } as any })
      if (!created.data?.id) throw new Error("Failed to create session: no ID returned")
      return created.data.id
    }

    const sessionResolution = await (async () => {
      if (!props.sessionID) {
        const created = await createSession()
        return {
          sessionID: created,
          createdNewSession: true,
        }
      }

      if (sync.session.get(props.sessionID)) {
        return {
          sessionID: props.sessionID,
          createdNewSession: false,
        }
      }

      const lookup = await sdk.client.session.get({ path: { sessionID: props.sessionID } })
      if (lookup.data?.id) {
        return {
          sessionID: props.sessionID,
          createdNewSession: false,
        }
      }

      const created = await createSession()
      toast.show({
        variant: "warning",
        message: "Previous session was missing. Started a new session.",
        duration: 3500,
      })
      return {
        sessionID: created,
        createdNewSession: true,
      }
    })().catch((err) => {
      log.debug("Session resolution failed", { error: err })
      toast.show({ variant: "error", message: "Failed to create session" })
      throw err
    })
    const sessionID = sessionResolution.sessionID
    const isSessionNotFoundError = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      const lower = message.toLowerCase()
      const statusCode = Number(
        (error as any)?.status ??
          (error as any)?.statusCode ??
          (error as any)?.response?.status ??
          (error as any)?.cause?.status ??
          NaN,
      )
      return (
        statusCode === 404 ||
        lower.includes("session not found") ||
        (lower.includes("not found") && lower.includes("session")) ||
        (lower.includes("404") && lower.includes("session"))
      )
    }
    const withSessionRetry = async <T,>(operation: () => Promise<T>) => {
      const maxAttempts = sessionResolution.createdNewSession ? 6 : 3
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await operation()
        } catch (error) {
          if (!isSessionNotFoundError(error) || attempt === maxAttempts) throw error
          await Bun.sleep(120 * attempt)
        }
      }
      throw new Error("Failed to send prompt")
    }
    const messageID = Identifier.ascending("message")
    setTimeline({
      id: messageID,
      submitAt: Date.now(),
    })
    let inputText = store.prompt.input

    // Expand pasted text inline before submitting
    const allExtmarks = input.extmarks.getAllForTypeId(promptPartTypeId)
    const sortedExtmarks = allExtmarks.sort((a: { start: number }, b: { start: number }) => b.start - a.start)

    for (const extmark of sortedExtmarks) {
      const partIndex = store.extmarkToPartIndex.get(extmark.id)
      if (partIndex !== undefined) {
        const part = store.prompt.parts[partIndex]
        if (part?.type === "text" && part.text) {
          const before = inputText.slice(0, extmark.start)
          const after = inputText.slice(extmark.end)
          inputText = before + part.text + after
        }
      }
    }

    inputText = normalizeSearchModePrompt(inputText)

    // Filter out text parts (pasted content) since they're now expanded inline
    const nonTextParts = store.prompt.parts.filter((part) => part.type !== "text")

    // Capture mode before it gets reset
    const currentMode = store.mode
    const variant = local.model.variant.current()

    if (store.mode === "shell") {
      withSessionRetry(() =>
        (sdk.client.session as any).shell({
          path: { sessionID },
          body: {
            agent: local.agent.current().name,
            model: {
              providerID: selectedModel.providerID,
              modelID: selectedModel.modelID,
            },
            command: inputText,
          },
        } as any),
      )
        .catch((err) => {
          log.debug("Prompt async error", { error: err })
          toast.show({
            variant: "error",
            message: `Error: ${err?.message || "Failed to send prompt"}`,
            duration: 5000,
          })
          setTimeline(undefined)
        })
      setStore("mode", "normal")
    } else if (
      inputText.startsWith("/") &&
      iife(() => {
        const firstLine = inputText.split("\n")[0]
        const command = firstLine.split(" ")[0].slice(1)
        return sync.data.command.some((x) => x.name === command)
      })
    ) {
      // Parse command from first line, preserve multi-line content in arguments
      const firstLineEnd = inputText.indexOf("\n")
      const firstLine = firstLineEnd === -1 ? inputText : inputText.slice(0, firstLineEnd)
      const [command, ...firstLineArgs] = firstLine.split(" ")
      const restOfInput = firstLineEnd === -1 ? "" : inputText.slice(firstLineEnd + 1)
      const args = firstLineArgs.join(" ") + (restOfInput ? "\n" + restOfInput : "")

      withSessionRetry(() =>
        sdk.client.session.command({
          path: { sessionID },
          body: {
            command: command.slice(1),
            arguments: args,
            agent: local.agent.current().name,
            model: `${selectedModel.providerID}/${selectedModel.modelID}`,
            messageID,
            variant,
            parts: nonTextParts
              .filter((x) => x.type === "file")
              .map((x) => ({
                id: Identifier.ascending("part"),
                ...x,
              })),
          },
        } as any),
      )
        .catch((err) => {
          log.debug("Command execution error", { error: err })
          toast.show({
            variant: "error",
            message: `Error: ${err?.message || "Failed to execute command"}`,
            duration: 5000,
          })
          setTimeline(undefined)
        })
    } else {
      withSessionRetry(() =>
        sdk.client.session.prompt({
          path: { sessionID },
          body: {
            ...selectedModel,
            messageID,
            agent: local.agent.current().name,
            model: selectedModel,
            variant,
            parts: [
              {
                id: Identifier.ascending("part"),
                type: "text",
                text: inputText,
              },
              ...nonTextParts.map((x) => ({
                id: Identifier.ascending("part"),
                ...x,
              })),
            ],
          },
        } as any),
      )
        .then((response) => {
          const data = (response as any).data
          if (data?.runId) {
            setStore("runId", data.runId)
          }
        })
        .catch((err) => {
          log.debug("Prompt send error", { error: err })
          toast.show({
            variant: "error",
            message: `Error: ${err?.message || "Failed to send prompt"}`,
            duration: 5000,
          })
          setTimeline(undefined)
        })
    }
    history.append({
      ...store.prompt,
      mode: currentMode,
    })
    input.extmarks.clear()
    setStore("prompt", {
      input: "",
      parts: [],
    })
    setStore("extmarkToPartIndex", new Map())
    props.onSubmit?.()

    // temporary hack to make sure the message is sent
    if (sessionResolution.createdNewSession)
      setTimeout(() => {
        route.navigate({
          type: "session",
          sessionID,
        })
      }, 50)
    input.clear()
  }
  const exit = useExit()

  function pasteText(text: string, virtualText: string) {
    const currentOffset = input.visualCursor.offset
    const extmarkStart = currentOffset
    const extmarkEnd = extmarkStart + virtualText.length

    input.insertText(virtualText + " ")

    const extmarkId = input.extmarks.create({
      start: extmarkStart,
      end: extmarkEnd,
      virtual: true,
      styleId: pasteStyleId,
      typeId: promptPartTypeId,
    })

    setStore(
      produce((draft) => {
        const partIndex = draft.prompt.parts.length
        draft.prompt.parts.push({
          type: "text" as const,
          text,
          source: {
            text: {
              start: extmarkStart,
              end: extmarkEnd,
              value: virtualText,
            },
          },
        })
        draft.extmarkToPartIndex.set(extmarkId, partIndex)
      }),
    )
  }

  async function pasteImage(file: { filename?: string; content: string; mime: string }) {
    const currentOffset = input.visualCursor.offset
    const extmarkStart = currentOffset
    const count = store.prompt.parts.filter((x) => x.type === "file" && x.mime.startsWith("image/")).length
    const virtualText = `[Image ${count + 1}]`
    const extmarkEnd = extmarkStart + virtualText.length
    const textToInsert = virtualText + " "

    input.insertText(textToInsert)

    const extmarkId = input.extmarks.create({
      start: extmarkStart,
      end: extmarkEnd,
      virtual: true,
      styleId: pasteStyleId,
      typeId: promptPartTypeId,
    })

    const part: Omit<FilePart, "id" | "messageID" | "sessionID"> = {
      type: "file" as const,
      mime: file.mime,
      filename: file.filename,
      url: `data:${file.mime};base64,${file.content}`,
      source: {
        type: "file",
        path: file.filename ?? "",
        text: {
          start: extmarkStart,
          end: extmarkEnd,
          value: virtualText,
        },
      },
    }
    setStore(
      produce((draft) => {
        const partIndex = draft.prompt.parts.length
        draft.prompt.parts.push(part)
        draft.extmarkToPartIndex.set(extmarkId, partIndex)
      }),
    )
    return
  }

  const highlight = createMemo(() => {
    if (keybind.leader) return theme.border
    if (store.mode === "shell") return theme.primary
    return local.agent.color(local.agent.current().name)
  })

  const showVariant = createMemo(() => {
    const variants = local.model.variant.list()
    if (variants.length === 0) return false
    const current = local.model.variant.current()
    return !!current
  })

  const placeholderText = createMemo(() => {
    if (props.sessionID) return undefined
    if (store.mode === "shell") {
      const example = SHELL_PLACEHOLDERS[store.placeholder % SHELL_PLACEHOLDERS.length]
      return `Run a command... "${example}"`
    }
    return `Ask anything... "${PLACEHOLDERS[store.placeholder % PLACEHOLDERS.length]}"`
  })

  const isHeightConstrained = createMemo(() => dimensions().height < 28)

  const fileParts = createMemo(() =>
    store.prompt.parts.filter((p) => p.type === "file") as FilePartLocal[]
  )

  function chipLabel(part: FilePartLocal): string {
    if (part.source?.text?.value) return part.source.text.value
    if (part.filename) return path.basename(part.filename)
    if (part.mime?.startsWith("image/")) return "image"
    return "file"
  }

  return (
    <>
      <Autocomplete
        sessionID={props.sessionID}
        ref={(r) => (autocomplete = r)}
        anchor={() => anchor}
        input={() => input}
        setPrompt={(cb) => {
          setStore("prompt", produce(cb))
        }}
        setExtmark={(partIndex, extmarkId) => {
          setStore("extmarkToPartIndex", (map: Map<number, number>) => {
            const newMap = new Map(map)
            newMap.set(extmarkId, partIndex)
            return newMap
          })
        }}
        value={store.prompt.input}
        fileStyleId={fileStyleId}
        agentStyleId={agentStyleId}
        promptPartTypeId={() => promptPartTypeId}
      />
      <box ref={(r) => (anchor = r)} visible={props.visible !== false}>
        <Show when={fileParts().length > 0}>
          <box flexDirection="row" gap={1} paddingLeft={3} paddingTop={1} flexWrap="wrap">
            <For each={fileParts()}>
              {(part) => (
                <box
                  flexDirection="row"
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={theme.backgroundPanel}
                >
                  <text fg={theme.textMuted}>
                    {part.mime?.startsWith("image/") ? "▣ " : "◈ "}
                    {chipLabel(part)}
                  </text>
                </box>
              )}
            </For>
          </box>
        </Show>
        <box
          border={["left"]}
          borderColor={highlight()}
          customBorderChars={{
            ...EmptyBorder,
            vertical: "┃",
            bottomLeft: "╹",
          }}
        >
          <box
            paddingLeft={2}
            paddingRight={2}
            paddingTop={isHeightConstrained() ? 0 : 1}
            flexShrink={0}
            backgroundColor={theme.backgroundElement}
            flexGrow={1}
          >
            <textarea
              placeholder={placeholderText()}
              textColor={keybind.leader ? theme.textMuted : theme.text}
              focusedTextColor={keybind.leader ? theme.textMuted : theme.text}
              minHeight={1}
              maxHeight={6}
              onContentChange={() => {
                const value = input.plainText
                setStore("prompt", "input", value)
                autocomplete.onInput(value)
                syncExtmarksWithPromptParts()
              }}
              keyBindings={textareaKeybindings()}
              onKeyDown={async (e) => {
                if (props.disabled) {
                  e.preventDefault()
                  return
                }
                // Handle clipboard paste (Ctrl+V) - check for images first on Windows
                // This is needed because Windows terminal doesn't properly send image data
                // through bracketed paste, so we need to intercept the keypress and
                // directly read from clipboard before the terminal handles it
                if (keybind.match("input_paste", e)) {
                  const content = await Clipboard.read()
                  if (content?.mime.startsWith("image/")) {
                    e.preventDefault()
                    await pasteImage({
                      filename: "clipboard",
                      mime: content.mime,
                      content: content.data,
                    })
                    return
                  }
                  // If no image, let the default paste behavior continue
                }
                if (keybind.match("input_clear", e) && store.prompt.input !== "") {
                  input.clear()
                  input.extmarks.clear()
                  setStore("prompt", {
                    input: "",
                    parts: [],
                  })
                  setStore("extmarkToPartIndex", new Map())
                  return
                }
                if (keybind.match("app_exit", e)) {
                  if (store.prompt.input === "") {
                    await exit()
                    // Don't preventDefault - let textarea potentially handle the event
                    e.preventDefault()
                    return
                  }
                }
                if (e.name === "!" && input.visualCursor.offset === 0) {
                  setStore("placeholder", Math.floor(Math.random() * SHELL_PLACEHOLDERS.length))
                  setStore("mode", "shell")
                  e.preventDefault()
                  return
                }
                if (store.mode === "shell") {
                  if ((e.name === "backspace" && input.visualCursor.offset === 0) || e.name === "escape") {
                    setStore("mode", "normal")
                    e.preventDefault()
                    return
                  }
                }
                if (store.mode === "normal") autocomplete.onKeyDown(e)
                if (!autocomplete.visible) {
                  if (
                    (keybind.match("history_previous", e) && input.cursorOffset === 0) ||
                    (keybind.match("history_next", e) && input.cursorOffset === input.plainText.length)
                  ) {
                    const direction = keybind.match("history_previous", e) ? -1 : 1
                    const item = history.move(direction, input.plainText)

                    if (item) {
                      input.setText(item.input)
                      setStore("prompt", item)
                      setStore("mode", item.mode ?? "normal")
                      restoreExtmarksFromParts(item.parts)
                      e.preventDefault()
                      if (direction === -1) input.cursorOffset = 0
                      if (direction === 1) input.cursorOffset = input.plainText.length
                    }
                    return
                  }

                  if (keybind.match("history_previous", e) && input.visualCursor.visualRow === 0) input.cursorOffset = 0
                  if (keybind.match("history_next", e) && input.visualCursor.visualRow === input.height - 1)
                    input.cursorOffset = input.plainText.length
                }
              }}
              onSubmit={submit}
              onPaste={async (event: PasteEvent) => {
                if (props.disabled) {
                  event.preventDefault()
                  return
                }

                // Normalize line endings at the boundary
                // Windows ConPTY/Terminal often sends CR-only newlines in bracketed paste
                // Replace CRLF first, then any remaining CR
                const pastedBytes = (event as any).bytes
                const pastedText =
                  pastedBytes instanceof Uint8Array
                    ? new TextDecoder().decode(pastedBytes)
                    : String((event as any).text ?? (event as any).data ?? "")
                const normalizedText = pastedText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
                const pastedContent = normalizedText.trim()
                if (!pastedContent) {
                  command.trigger("prompt.paste")
                  return
                }

                // trim ' from the beginning and end of the pasted content. just
                // ' and nothing else
                const filepath = pastedContent.replace(/^'+|'+$/g, "").replace(/\\ /g, " ")
                const isUrl = /^(https?):\/\//.test(filepath)
                if (!isUrl) {
                  try {
                    const mime = Filesystem.mimeType(filepath)
                    const filename = path.basename(filepath)
                    // Handle SVG as raw text content, not as base64 image
                    if (mime === "image/svg+xml") {
                      event.preventDefault()
                      const content = await Filesystem.readText(filepath).catch(() => {})
                      if (content) {
                        pasteText(content, `[SVG: ${filename ?? "image"}]`)
                        return
                      }
                    }
                    if (mime.startsWith("image/")) {
                      event.preventDefault()
                      const content = await Filesystem.readArrayBuffer(filepath)
                        .then((buffer) => Buffer.from(buffer).toString("base64"))
                        .catch(() => {})
                      if (content) {
                        await pasteImage({
                          filename,
                          mime,
                          content,
                        })
                        return
                      }
                    }
                  } catch {}
                }

                const lineCount = (pastedContent.match(/\n/g)?.length ?? 0) + 1
                if (
                  (lineCount >= 3 || pastedContent.length > 150) &&
                  !(sync.data.config.experimental as any)?.disable_paste_summary
                ) {
                  event.preventDefault()
                  pasteText(pastedContent, `[Pasted ~${lineCount} lines]`)
                  return
                }

                // Force layout update and render for the pasted content
                queueMicrotask(() => {
                  if (!input || input.isDestroyed) return
                  input.getLayoutNode().markDirty()
                  renderer.requestRender()
                })
              }}
              ref={(r: TextareaRenderable) => {
                input = r
                if (promptPartTypeId === 0) {
                  promptPartTypeId = input.extmarks.registerType("prompt-part")
                }
                props.ref?.(ref)
                queueMicrotask(() => {
                  if (!input || input.isDestroyed) return
                  input.cursorColor = theme.text
                })
              }}
              onMouseDown={(r: MouseEvent) => r.target?.focus()}
              focusedBackgroundColor={theme.backgroundElement}
              cursorColor={theme.text}
              syntaxStyle={syntax()}
            />
            <box flexDirection="row" flexShrink={0} paddingTop={1} gap={1}>
              <text fg={highlight()}>
                {store.mode === "shell" ? "Shell" : Locale.titlecase(local.agent.current().name)}{" "}
              </text>
              <Show when={store.mode === "normal"}>
                <box flexDirection="row" gap={1}>
                  <text flexShrink={0} fg={keybind.leader ? theme.textMuted : theme.text}>
                    {local.model.parsed().model}
                  </text>
                  <text fg={theme.textMuted}>{local.model.parsed().provider}</text>
                  <Show when={showVariant()}>
                    <text fg={theme.textMuted}>·</text>
                    <text>
                      <span style={{ fg: theme.warning, bold: true }}>{local.model.variant.current()}</span>
                    </text>
                  </Show>
                </box>
              </Show>
            </box>
          </box>
        </box>
        <box
          height={1}
          border={["left"]}
          borderColor={highlight()}
          customBorderChars={{
            ...EmptyBorder,
            vertical: theme.backgroundElement.a !== 0 ? "╹" : " ",
          }}
        >
          <box
            height={1}
            border={["bottom"]}
            borderColor={theme.backgroundElement}
            customBorderChars={
              theme.backgroundElement.a !== 0
                ? {
                    ...EmptyBorder,
                    horizontal: "▀",
                  }
                : {
                    ...EmptyBorder,
                    horizontal: " ",
                  }
            }
          />
        </box>
        <box flexDirection="row" justifyContent="space-between" width="100%">
          <box flexGrow={1} minWidth={0}>
            <Show when={statusVisible()} fallback={<text />}>
              <GIZZIStatusBar
                status={effectiveStatus() as import("@/runtime/session/status").SessionStatus.Info}
                parts={activeParts() as import("@/runtime/session/message-v2").MessageV2.Part[]}
                interrupt={store.interrupt}
                queuedSince={queuedSince()}
                startedAt={timeline()?.submitAt}
                fixtureMode={fixtureMode()}
                fixtureDelayMs={fixtureDelayMs}
                runId={store.runId}
                compact={terminalWidth() < 124}
                width={terminalWidth()}
              />
            </Show>
          </box>
          <Show when={showControlHints()}>
            <box gap={controlLayout() === "full" ? 2 : 1} flexDirection="row" flexShrink={0} paddingLeft={1}>
              <Show when={showRuntimeBadge()}>
                <text fg={theme.text}>
                  <span style={{ bg: runtimeModeColor(), fg: runtimeModeFg(), bold: true }}> {runtimeModeLabel()} </span>
                </text>
              </Show>
              <Switch>
                <Match when={store.mode === "normal"}>
                  <Show when={showVariantHint()}>
                    <text fg={theme.text}>
                      {keybind.print("variant_cycle")} <span style={{ fg: theme.textMuted }}>{GIZZICopy.prompt.variants}</span>
                    </text>
                  </Show>
                  <Show when={showAgentHint()}>
                    <text fg={theme.text}>
                      {keybind.print("agent_cycle")} <span style={{ fg: theme.textMuted }}>{GIZZICopy.prompt.agents}</span>
                    </text>
                  </Show>
                  <Show when={showCommandHint()}>
                    <text fg={theme.text}>
                      {keybind.print("command_list")} <span style={{ fg: theme.textMuted }}>{GIZZICopy.prompt.commands}</span>
                    </text>
                  </Show>
                </Match>
                <Match when={store.mode === "shell"}>
                  <Show
                    when={controlLayout() === "minimal"}
                    fallback={
                      <text fg={theme.text}>
                        esc <span style={{ fg: theme.textMuted }}>{GIZZICopy.prompt.shellExit}</span>
                      </text>
                    }
                  >
                    <text fg={theme.text}>esc</text>
                  </Show>
                </Match>
              </Switch>
            </box>
          </Show>
        </box>
      </box>
    </>
  )
}

function normalizeSearchModePrompt(input: string): string {
  const raw = input.trim()
  if (!raw) return input
  if (!raw.toLowerCase().startsWith("[search-mode]")) return input

  const segments = raw.split(/\n-{3,}\n/)
  if (segments.length > 1) {
    const candidate = segments.at(-1)?.trim()
    if (candidate) return candidate
  }

  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (line.startsWith("[") && line.endsWith("]")) continue
    if (line.toUpperCase().includes("MAXIMIZE SEARCH EFFORT")) continue
    if (line.startsWith("- ")) continue
    if (line === "---") continue
    return line
  }
  return input
}
