
/**
 * Cowork Mode - Collaborative workspace view
 * 
 * Uses the same session system as Code mode but with a focused
 * "work visualization" layout showing tool calls as inline blocks.
 */

import { createMemo, createSignal, Show, For, onMount } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { GIZZIFrame, GIZZIMascot } from "@/cli/ui/components/gizzi"
import { RGBA, TextAttributes } from "@opentui/core"
import { useTerminalDimensions, useKeyboard, useRenderer } from "@opentui/solid"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useRoute } from "@/cli/ui/tui/context/route"
import { useExit } from "@/cli/ui/tui/context/exit"
import { useToast } from "@/cli/ui/tui/ui/toast"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useLocal } from "@/cli/ui/tui/context/local"
import { DialogCronList } from "@/cli/ui/tui/component/dialog-cron-list"
import { Log } from "@/shared/util/log"
import { Prompt } from "@/cli/ui/tui/component/prompt"
import { SessionMount } from "@/cli/ui/tui/component/session-mount"

export function Cowork() {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const sync = useSync()
  const sdk = useSDK()
  const route = useRoute()
  const exit = useExit()
  const renderer = useRenderer()
  const toast = useToast()
  const dialog = useDialog()
  const local = useLocal()
  
  // Cowork brand colors - Purple accent for differentiation
  const coworkPurple = RGBA.fromInts(167, 139, 250)        // Primary accent
  const coworkPurpleDim = RGBA.fromInts(167, 139, 250, 80) // Borders
  const coworkPurpleBg = RGBA.fromInts(167, 139, 250, 20)  // Backgrounds
  const gold = RGBA.fromInts(212, 176, 140)                // Gizzi gold (secondary)
  const goldDim = RGBA.fromInts(212, 176, 140, 100)
  const success = RGBA.fromInts(134, 239, 172)
  const error = RGBA.fromInts(252, 165, 165)
  const warn = RGBA.fromInts(250, 204, 21)
  const obsidian = RGBA.fromInts(15, 17, 21)
  const obsidianLight = RGBA.fromInts(26, 29, 38)
  
  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false)
  const [activeSessionId, setActiveSessionId] = createSignal<string | null>(null)
  
  // Get data from sync
  const sessions = createMemo(() => sync.data?.session || [])
  const cronJobs = createMemo(() => sync.data?.cron_jobs || [])
  
  // Find active session
  const session = createMemo(() => {
    const id = activeSessionId()
    if (id) return sessions().find((s: any) => s.id === id) as any
    return sessions().find((s: any) => s.active) as any || sessions()[0] as any
  })
  
  const sessionId = createMemo(() => session()?.id)
  
  // Get messages and parts
  const messages = createMemo(() => {
    const id = sessionId()
    if (!id) return []
    return sync.data?.message?.[id] || []
  })
  
  const parts = createMemo(() => sync.data?.part || {})
  const todos = createMemo(() => {
    const id = sessionId()
    if (!id) return []
    return sync.data?.todo?.[id] || []
  })
  
  // Transform into work blocks
  const workBlocks = createMemo(() => {
    const msgs = messages()
    const msgParts = parts()
    const blocks: any[] = []
    
    for (const msg of msgs as any[]) {
      const msgPartsList: any[] = msgParts[(msg as any).id] || []
      
      if ((msg as any).role === "user") {
        const text = msgPartsList
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("")
        blocks.push({
          type: "message",
          actor: "user",
          content: text || "...",
          timestamp: (msg as any).time?.created,
        })
      } else {
        for (const part of msgPartsList) {
          if ((part as any).type === "tool") {
            blocks.push({
              type: "tool",
              tool: (part as any).tool || "unknown",
              args: (part as any).args || {},
              result: (part as any).result,
              error: (part as any).error,
              timestamp: (msg as any).time?.created,
            })
          } else if ((part as any).type === "text") {
            const text = (part as any).text || ""
            if (!text.trim()) continue
            
            const lastBlock = blocks[blocks.length - 1]
            if (lastBlock?.type === "message" && lastBlock.actor === "agent") {
              lastBlock.content += "\n" + text
            } else {
              blocks.push({
                type: "message",
                actor: "agent",
                content: text,
                timestamp: (msg as any).time?.created,
              })
            }
          }
        }
      }
    }
    
    return blocks
  })
  
  // Derived data
  const filesTouched = createMemo(() => {
    const todoList = todos() as any[]
    const files: { path: string; status: string }[] = []
    
    for (const todo of todoList) {
      if (todo?.status === "completed" && todo?.title) {
        const match = todo.title.match(/(?:write|edit|modify|create)\s+(?:to\s+)?[`']?([^`'\n]+)[`']?/i)
        if (match) {
          files.push({ path: match[1].trim(), status: "modified" })
        }
      }
    }
    return files
  })
  
  const currentStep = createMemo(() => {
    const id = sessionId()
    if (!id) return "Ready"
    const status = sync.data?.session_status?.[id] as any
    if (!status) return "Ready"
    if (status.type === "thinking") return "Thinking..."
    if (status.type === "executing") return "Running tools..."
    if (status.type === "responding") return "Generating response..."
    return status.type || "Ready"
  })
  
  const sidebarVisible = createMemo(() => 
    dimensions().width >= 100 && !sidebarCollapsed() && session()
  )
  
  const mascotState = createMemo(() => {
    const id = sessionId()
    if (!id) return "idle"
    const status = (sync.data?.session_status?.[id] as any)?.type
    if (status === "thinking") return "thinking"
    if (status === "executing") return "executing"
    if (status === "responding") return "responding"
    return "focused"
  })
  
  // Keyboard
  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      if (!renderer.getSelection()) {
        evt.preventDefault()
        evt.stopPropagation()
        exit()
      }
    }
  })
  
  // Create session on mount if none
  onMount(async () => {
    if (sessions().length === 0) {
      try {
        const result = await sdk.client.session.create({ body: { title: "Cowork Session" } })
        if (result.data?.id) setActiveSessionId(result.data.id)
      } catch (err) {
        Log.Default.error("Failed to create session", { error: err })
      }
    }
  })
  
  async function createNewSession() {
    try {
      const result = await sdk.client.session.create({
        body: { title: `Cowork ${new Date().toLocaleTimeString()}` },
      })
      if (result.data?.id) {
        setActiveSessionId(result.data.id)
        toast.show({ variant: "success", message: "New session created" })
      }
    } catch (err) {
      toast.show({ variant: "error", message: "Failed to create session" })
    }
  }
  
  function openCronDialog() {
    dialog.replace(() => <DialogCronList />)
  }
  
  // Tool icon and color - Cowork style with purple accents
  function getToolStyle(tool: string) {
    const styles: Record<string, { icon: string; color: RGBA }> = {
      bash: { icon: "⚡", color: coworkPurple },      // Purple for commands
      write: { icon: "✎", color: RGBA.fromInts(96, 165, 250) },
      read: { icon: "📖", color: warn },
      edit: { icon: "✏", color: gold },              // Gold for edits
      todo: { icon: "☐", color: success },
      grep: { icon: "🔍", color: RGBA.fromInts(156, 163, 175) },
      ls: { icon: "📁", color: RGBA.fromInts(156, 163, 175) },
    }
    return styles[tool] || { icon: "⚙", color: coworkPurpleDim }
  }
  
  return (
    <GIZZIFrame isHeightConstrained={false}>
      <box flexDirection="column" flexGrow={1} backgroundColor={obsidian}>
        
        {/* Header - Cowork Identity with Purple Accent */}
        <box
          flexDirection="row"
          padding={1}
          border={["bottom"]}
          borderColor={coworkPurpleDim}
          backgroundColor={obsidian}
          justifyContent="space-between"
          alignItems="center"
        >
          <box flexDirection="row" gap={2} alignItems="center">
            <text fg={coworkPurple} attributes={TextAttributes.BOLD}>
              ◆ COWORK
            </text>
            <text fg={theme.textMuted}>|</text>
            <Show when={session()}>
              <text fg={theme.text}>{session()?.title}</text>
            </Show>
            <Show when={!session()}>
              <text fg={theme.textMuted}>No session</text>
            </Show>
          </box>
          
          <box flexDirection="row" gap={1} alignItems="center">
            {/* Cron Button */}
            <box
              padding={1}
              borderStyle="single"
              borderColor={cronJobs().length > 0 ? coworkPurpleDim : theme.border}
              onMouseUp={openCronDialog}
            >
              <text fg={cronJobs().length > 0 ? coworkPurple : theme.textMuted}>
                🕐 {String(cronJobs().length)}
              </text>
            </box>
            
            {/* New Session */}
            <box
              padding={1}
              borderStyle="single"
              borderColor={theme.border}
              onMouseUp={createNewSession}
            >
              <text fg={theme.textMuted}>+ New</text>
            </box>
            
            {/* Sidebar Toggle */}
            <Show when={session()}>
              <box
                padding={1}
                borderStyle="single"
                borderColor={theme.border}
                onMouseUp={() => setSidebarCollapsed((p) => !p)}
              >
                <text fg={theme.textMuted}>
                  {sidebarCollapsed() ? "▶" : "◀"}
                </text>
              </box>
            </Show>
          </box>
        </box>
        
        {/* Session Mount (Gizzi style) */}
        <Show when={session()}>
          <SessionMount
            isHeightConstrained={false}
            sessionStatus={mascotState() as "idle" | "thinking" | "executing" | "responding"}
          />
        </Show>
        
        {/* Main Content */}
        <box flexDirection="row" flexGrow={1} overflow="hidden">
          
          {/* Left: Transcript */}
          <box flexGrow={1} flexDirection="column" overflow="hidden">
            
            {/* Work Blocks Area */}
            <box 
              flexGrow={1} 
              flexDirection="column" 
              padding={1}
              overflow="scroll"
              gap={1}
            >
              <Show when={!session()}>
                <box flexGrow={1} justifyContent="center" alignItems="center">
                  <text fg={theme.textMuted}>Creating session...</text>
                </box>
              </Show>
              
              <Show when={session() && workBlocks().length === 0}>
                <box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column" gap={2}>
                  <GIZZIMascot state="idle" compact={true} color={coworkPurple} />
                  <text fg={theme.textMuted}>Type a message to start collaborating</text>
                </box>
              </Show>
              
              <For each={workBlocks()}>
                {(block) => {
                  if (block.type === "message") {
                    return (
                      <box flexDirection="column" marginBottom={1}>
                        <box flexDirection="row" gap={1}>
                          <text 
                            fg={block.actor === "user" ? gold : theme.text}
                            attributes={TextAttributes.BOLD}
                          >
                            {block.actor === "user" ? "You" : "Gizzi"}
                          </text>
                        </box>
                        <box paddingLeft={2}>
                          <text fg={theme.text}>{block.content}</text>
                        </box>
                      </box>
                    )
                  }
                  
                  if (block.type === "tool") {
                    const style = getToolStyle(block.tool)
                    return (
                      <box 
                        flexDirection="column" 
                        padding={1}
                        border={["left"]} 
                        borderColor={block.error ? error : style.color}
                        backgroundColor={RGBA.fromInts(0, 0, 0, 20)}
                      >
                        <box flexDirection="row" gap={1} alignItems="center">
                          <text fg={style.color}>{style.icon}</text>
                          <text fg={style.color} attributes={TextAttributes.BOLD}>
                            {block.tool.toUpperCase()}
                          </text>
                          <Show when={block.args?.path || block.args?.command}>
                            <text fg={theme.textMuted}>
                              {block.args?.path || block.args?.command?.slice(0, 40)}
                            </text>
                          </Show>
                        </box>
                        <Show when={block.error}>
                          <text fg={error}>{block.error}</text>
                        </Show>
                      </box>
                    )
                  }
                  
                  return null
                }}
              </For>
            </box>
            
            {/* Input - Full Prompt Component */}
            <Show when={session()}>
              <box border={["top"]} borderColor={coworkPurpleDim}>
                <Prompt 
                  sessionID={sessionId()!}
                  visible={true}
                  showPlaceholder={true}
                />
              </box>
            </Show>
          </box>
          
          {/* Right: Rail - Cowork Style */}
          <Show when={sidebarVisible()}>
            <box
              flexDirection="column"
              width={38}
              minWidth={35}
              border={["left"]}
              borderColor={coworkPurpleDim}
              backgroundColor={obsidianLight}
              padding={1}
              gap={2}
            >
              {/* Progress */}
              <box flexDirection="column" gap={1}>
                <text fg={coworkPurple} attributes={TextAttributes.BOLD}>
                  PROGRESS
                </text>
                <box flexDirection="row" gap={1}>
                  <text fg={success}>
                    {String(todos().filter((t: any) => t.status === "completed").length)}
                  </text>
                  <text fg={theme.textMuted}>/</text>
                  <text fg={theme.text}>{String(todos().length)}</text>
                  <text fg={theme.textMuted}>tasks</text>
                </box>
                <text fg={theme.textMuted}>
                  {currentStep()}
                </text>
              </box>
              
              {/* Files */}
              <box flexDirection="column" gap={1}>
                <text fg={coworkPurple} attributes={TextAttributes.BOLD}>
                  FILES
                </text>
                <Show when={filesTouched().length === 0}>
                  <text fg={theme.textMuted}>No files modified</text>
                </Show>
                <For each={filesTouched()}>
                  {(file) => (
                    <box flexDirection="row" gap={1}>
                      <text fg={success}>~</text>
                      <text fg={theme.text}>{file.path}</text>
                    </box>
                  )}
                </For>
              </box>
              
              {/* Schedules */}
              <box flexDirection="column" gap={1}>
                <text fg={coworkPurple} attributes={TextAttributes.BOLD}>
                  SCHEDULES
                </text>
                <Show when={cronJobs().length === 0}>
                  <text fg={theme.textMuted}>No jobs scheduled</text>
                </Show>
                <For each={cronJobs().slice(0, 5)}>
                  {(job: any) => (
                    <box flexDirection="column">
                      <text fg={job.status === "active" ? success : theme.textMuted}>
                        {job.status === "active" ? "●" : "○"} {job.name}
                      </text>
                    </box>
                  )}
                </For>
              </box>
              
              {/* Context */}
              <box flexDirection="column" gap={1}>
                <text fg={coworkPurple} attributes={TextAttributes.BOLD}>
                  CONTEXT
                </text>
                <text fg={theme.textMuted}>
                  📁 {(sync.data?.path?.directory || process.cwd()).slice(-25)}
                </text>
                <text fg={theme.textMuted}>
                  🤖 {(session() as any)?.agent?.name || (local.agent.current() as any)?.name || "default"}
                </text>
              </box>
            </box>
          </Show>
        </box>
        
        {/* Footer */}
        <box
          flexDirection="row"
          padding={1}
          border={["top"]}
          borderColor={coworkPurpleDim}
          backgroundColor={obsidian}
          justifyContent="space-between"
        >
          <box flexDirection="row" gap={2}>
            <Show when={session()}>
              <text fg={success}>●</text>
              <text fg={theme.textMuted}>
                {String(messages().length)} messages · {String(todos().length)} tasks · {String(filesTouched().length)} files
              </text>
            </Show>
            <Show when={!session() && !sidebarVisible()}>
              <text fg={theme.textMuted}>Press Ctrl+C to exit</text>
            </Show>
          </box>
          
          <Show when={session()}>
            <text fg={theme.textMuted}>
              {String(cronJobs().length)} scheduled
            </text>
          </Show>
        </box>
      </box>
    </GIZZIFrame>
  )
}
