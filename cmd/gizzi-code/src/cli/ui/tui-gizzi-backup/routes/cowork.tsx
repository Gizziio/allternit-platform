
/**
 * Cowork Mode - Collaborative workspace view
 * 
 * Uses the same session system as Code mode but with a focused
 * "work visualization" layout showing tool calls as inline blocks.
 */

import { createMemo, createSignal, Show, For, onMount, batch } from "solid-js"
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
import { Log } from "@/runtime/util/log"
import { Prompt } from "@/cli/ui/tui/component/prompt"
import { SessionMount } from "@/cli/ui/tui/component/session-mount"

// Feature imports from Code mode
import { useScrollMemory } from "@/cli/ui/tui/hooks/useScrollMemory"
import { useBookmarks } from "@/cli/ui/tui/hooks/useBookmarks"
import { usePinned } from "@/cli/ui/tui/hooks/usePinned"
import { useSearch } from "@/cli/ui/tui/hooks/useSearch"
import { DialogSearch } from "@/cli/ui/tui/component/dialog-search"
import { DialogBookmarks } from "@/cli/ui/tui/component/dialog-bookmarks"
import { DialogUsage } from "@/cli/ui/tui/component/dialog-usage"
import { DialogJump } from "@/cli/ui/tui/component/dialog-jump"
import { DialogTimeline } from "@/cli/ui/tui/routes/session/dialog-timeline"
import { DialogForkFromTimeline } from "@/cli/ui/tui/routes/session/dialog-fork-from-timeline"
import { DialogSessionRename } from "@/cli/ui/tui/component/dialog-session-rename"
import { DialogExport } from "@/cli/ui/tui/component/dialog-export"
import { DialogPinned } from "@/cli/ui/tui/component/dialog-pinned"
import { DialogFileRefs } from "@/cli/ui/tui/component/dialog-file-refs"
import { DialogHelp } from "@/cli/ui/tui/component/dialog-help"
import { DialogMessage } from "@/cli/ui/tui/routes/session/dialog-message"
import { DialogMessageActions } from "@/cli/ui/tui/component/dialog-message-actions"
import { useCommandDialog } from "@/cli/ui/tui/component/dialog-command"
import { Clipboard } from "@/cli/ui/tui/util/clipboard"
import { GIZZICopy } from "@/runtime/brand/brand"
import { getFirstCodeBlock, hasCodeBlocks } from "@/runtime/util/code-blocks"

// Collaboration & Remote Control imports
import { CoworkCollaborationProvider, useCoworkCollaboration } from "@/cli/ui/tui/context/cowork-collaboration"
import { DialogCoworkPairing } from "@/cli/ui/tui/component/dialog-cowork-pairing"
import { DialogCoworkApprovals } from "@/cli/ui/tui/component/dialog-cowork-approvals"
import { ensureServicesRunning, getLocalIPAddress, COWORK_PORTS } from "@allternit/cowork-controller/service-manager"

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
  const command = useCommandDialog()
  const collaboration = useCoworkCollaboration()
  const log = Log.create({ service: "cowork" })
  
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
  const [conceal, setConceal] = createSignal(true)
  
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

  // Bookmarks and pins
  const bookmarks = useBookmarks(sessionId() || "")
  const pinned = usePinned(sessionId() || "")
  
  // Search functionality
  const search = useSearch(messages as () => any[], (messageID) => (sync.data.part[messageID] ?? []) as any[])
  
  // Scroll memory
  let scroll: any
  const scrollMemory = useScrollMemory(sessionId() || "", () => scroll)
  
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
          messageID: (msg as any).id,
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
              messageID: (msg as any).id,
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
                messageID: (msg as any).id,
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

  // Find last assistant message
  const lastAssistant = createMemo(() => {
    const msgs = messages() as any[]
    return msgs.findLast((x: any) => x.role === "assistant")
  })

  // Navigate to a message by ID
  function navigateToMessage(messageID: string) {
    const scrollBox = scroll
    if (!scrollBox) return
    const children = scrollBox.getChildren?.() || []
    const child = children.find((c: any) => c.id === messageID)
    if (child) {
      scrollBox.scrollBy(child.y - scrollBox.y - 1)
    }
  }
  
  // Keyboard shortcuts
  useKeyboard((evt) => {
    // Exit handler - only essential keyboard shortcut
    if (evt.ctrl && evt.name === "c") {
      if (!renderer.getSelection()) {
        evt.preventDefault()
        evt.stopPropagation()
        exit()
      }
    }
  })
  
  // Command Palette Registration
  command.register(() => [
    {
      title: "Copy last code block",
      value: "messages.copy_code",
      category: "Messages",
      slash: { name: "copy-code" },
      onSelect: (dialog) => {
        const currentAssistant = lastAssistant()
        if (currentAssistant) {
          const msgParts = (sync.data.part[currentAssistant.id] ?? []) as any[]
          const textPart = msgParts.find((p: any) => p.type === "text" && p.text?.trim().length > 0)
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
      category: "Messages",
      slash: { name: "search" },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogSearch
            sessionID={sessionId() || ""}
            onNavigate={navigateToMessage}
          />
        ))
      },
    },
    {
      title: "View bookmarks",
      value: "messages.bookmarks",
      category: "Messages",
      slash: { name: "bookmarks" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogBookmarks sessionID={sessionId() || ""} />)
      },
    },
    {
      title: "View usage",
      value: "messages.usage",
      category: "Messages",
      slash: { name: "usage" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogUsage sessionID={sessionId()} />)
      },
    },
    {
      title: "Share session",
      value: "session.share",
      category: "Session",
      slash: { name: "share" },
      onSelect: async (dialog) => {
        const currentSession = session()
        if (!currentSession) {
          dialog.clear()
          return
        }
        const url = currentSession.share?.url
        if (url) {
          await Clipboard.copy(url)
          toast.show({ message: "Share URL copied!", variant: "success" })
        } else {
          try {
            const res = await sdk.client.session.share({
              path: { sessionID: sessionId()! },
            })
            if (res.data?.share?.url) {
              await Clipboard.copy(res.data.share.url)
              toast.show({ message: "Share URL copied!", variant: "success" })
            }
          } catch {
            toast.show({ message: "Failed to share session", variant: "error" })
          }
        }
        dialog.clear()
      },
    },
    {
      title: "Rename session",
      value: "session.rename",
      category: "Session",
      slash: { name: "rename" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogSessionRename session={sessionId() || ""} />)
      },
    },
    {
      title: "Jump to message",
      value: "session.jump",
      category: "Navigation",
      slash: { name: "jump" },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogJump
            totalMessages={messages().length}
            currentIndex={0}
            onJump={(index) => {
              const msg = (messages() as any[])[index]
              if (msg) navigateToMessage(msg.id)
            }}
          />
        ))
      },
    },
    {
      title: "View timeline",
      value: "session.timeline",
      category: "Session",
      slash: { name: "timeline" },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogTimeline
            onMove={(messageID) => navigateToMessage(messageID)}
            sessionID={sessionId() || ""}
          />
        ))
      },
    },
    {
      title: "Fork from message",
      value: "session.fork",
      category: "Session",
      slash: { name: "fork" },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogForkFromTimeline
            onMove={(messageID) => navigateToMessage(messageID)}
            sessionID={sessionId() || ""}
          />
        ))
      },
    },
    {
      title: "Compact/summarize session",
      value: "session.compact",
      category: "Session",
      slash: { name: "compact" },
      onSelect: (dialog) => {
        const selectedModel = local.model.current()
        if (!selectedModel) {
          toast.show({
            variant: "warning",
            message: "Please select a model first",
            duration: 3000,
          })
          return
        }
        sdk.client.session.summarize({
          path: { sessionID: sessionId() || "" },
          body: { modelID: selectedModel.modelID, providerID: selectedModel.providerID },
        } as any)
        dialog.clear()
      },
    },
    {
      title: sidebarCollapsed() ? "Show sidebar" : "Hide sidebar",
      value: "session.sidebar.toggle",
      category: "View",
      slash: { name: "sidebar-toggle" },
      onSelect: (dialog) => {
        setSidebarCollapsed((p) => !p)
        dialog.clear()
      },
    },
    {
      title: "Export session",
      value: "session.export",
      category: "Session",
      slash: { name: "export" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogExport sessionID={sessionId() || ""} />)
      },
    },
    {
      title: "View pinned messages",
      value: "session.pinned",
      category: "Messages",
      slash: { name: "pinned" },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogPinned
            sessionID={sessionId() || ""}
            onNavigate={navigateToMessage}
          />
        ))
      },
    },
    {
      title: "View file references",
      value: "session.files",
      category: "Session",
      slash: { name: "files" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogFileRefs sessionID={sessionId() || ""} />)
      },
    },
    {
      title: "Keyboard shortcuts help",
      value: "session.help",
      category: "General",
      slash: { name: "help" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogHelp />)
      },
    },
    {
      title: conceal() ? "Disable code concealment" : "Enable code concealment",
      value: "session.toggle.conceal",
      category: "View",
      slash: { name: "conceal" },
      onSelect: (dialog) => {
        setConceal((prev) => !prev)
        dialog.clear()
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
      title: "Remote pairing - Connect web client",
      value: "cowork.pairing",
      category: "Cowork",
      slash: { name: "pair" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogCoworkPairing sessionId={sessionId()!} />)
      },
    },
    {
      title: "View pending approvals",
      value: "cowork.approvals",
      category: "Cowork",
      slash: { name: "approvals" },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogCoworkApprovals />)
      },
    },
  ])
  
  // Service status
  const [serviceStatus, setServiceStatus] = createSignal<{ localIP: string | null; controllerRunning: boolean }>({
    localIP: null,
    controllerRunning: false,
  })

  // Create session on mount if none & auto-start services
  onMount(async () => {
    // Auto-start Cowork services
    try {
      const status = await ensureServicesRunning()
      const localIP = await getLocalIPAddress()
      setServiceStatus({
        localIP,
        controllerRunning: status.controller.running,
      })
      
      if (status.controller.running) {
        toast.show({ 
          message: `Cowork Controller ready (${localIP || 'localhost'}:${COWORK_PORTS.CONTROLLER})`, 
          variant: "success", 
          duration: 3000 
        })
      }
    } catch (err) {
      log.error("Failed to start Cowork services", { error: err })
    }

    if (sessions().length === 0) {
      try {
        const result = await sdk.client.session.create({ body: { title: "Cowork Session", surface: "cowork" } as any })
        if (result.data?.id) setActiveSessionId(result.data.id)
      } catch (err) {
        Log.Default.error("Failed to create session", { error: err })
      }
    }
  })
  
  async function createNewSession() {
    try {
      const result = await sdk.client.session.create({
        body: { title: `Cowork ${new Date().toLocaleTimeString()}`, surface: "cowork" } as any,
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

  function openExportDialog() {
    dialog.replace(() => <DialogExport sessionID={sessionId() || ""} />)
  }

  function openPinnedDialog() {
    dialog.replace(() => (
      <DialogPinned
        sessionID={sessionId() || ""}
        onNavigate={navigateToMessage}
      />
    ))
  }

  function openFileRefsDialog() {
    dialog.replace(() => <DialogFileRefs sessionID={sessionId() || ""} />)
  }

  function openHelpDialog() {
    dialog.replace(() => <DialogHelp />)
  }

  function openUsageDialog() {
    dialog.replace(() => <DialogUsage sessionID={sessionId()} />)
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
    <CoworkCollaborationProvider 
      sessionId={sessionId() || undefined}
      enabled={!!sessionId()}
    >
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
            
            {/* Viewer Indicator */}
            <Show when={session() && collaboration.isConnected()}>
              <box flexDirection="row" gap={1} alignItems="center" marginLeft={1}>
                <text fg={success}>●</text>
                <text fg={theme.textMuted}>
                  {String(collaboration.clientCount() + 1)} viewers
                </text>
              </box>
            </Show>
          </box>
          
          <box flexDirection="row" gap={1} alignItems="center">
            {/* Usage Button */}
            <Show when={session()}>
              <box
                padding={1}
                borderStyle="single"
                borderColor={theme.border}
                onMouseUp={openUsageDialog}
              >
                <text fg={theme.textMuted}>💰</text>
              </box>
            </Show>
            
            {/* Export Button */}
            <Show when={session()}>
              <box
                padding={1}
                borderStyle="single"
                borderColor={theme.border}
                onMouseUp={openExportDialog}
              >
                <text fg={theme.textMuted}>📤</text>
              </box>
            </Show>
            
            {/* Pinned Button */}
            <Show when={session()}>
              <box
                padding={1}
                borderStyle="single"
                borderColor={pinned.count() > 0 ? coworkPurpleDim : theme.border}
                onMouseUp={openPinnedDialog}
              >
                <text fg={pinned.count() > 0 ? coworkPurple : theme.textMuted}>
                  📌 {String(pinned.count())}
                </text>
              </box>
            </Show>
            
            {/* Files Button */}
            <Show when={session()}>
              <box
                padding={1}
                borderStyle="single"
                borderColor={theme.border}
                onMouseUp={openFileRefsDialog}
              >
                <text fg={theme.textMuted}>📁</text>
              </box>
            </Show>
            
            {/* Help Button */}
            <box
              padding={1}
              borderStyle="single"
              borderColor={theme.border}
              onMouseUp={openHelpDialog}
            >
              <text fg={theme.textMuted}>?</text>
            </box>
            
            {/* Remote Pairing Button */}
            <Show when={session()}>
              <box
                padding={1}
                borderStyle="single"
                borderColor={theme.border}
                onMouseUp={() => dialog.replace(() => (
                  <DialogCoworkPairing 
                    sessionId={sessionId()!} 
                    localIP={serviceStatus().localIP}
                    controllerPort={COWORK_PORTS.CONTROLLER}
                  />
                ))}
              >
                <text fg={theme.textMuted}>🌐</text>
              </box>
            </Show>
            
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
              ref={(r) => (scroll = r)}
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
                    const isBookmarked = bookmarks.isBookmarked(block.messageID)
                    return (
                      <box 
                        flexDirection="column" 
                        marginBottom={1}
                        id={block.messageID}
                        onMouseUp={() => {
                          if (renderer.getSelection()?.getSelectedText()) return
                          // Open message actions for user messages
                          if (block.actor === "user") {
                            const msg = (messages() as any[]).find((m: any) => m.id === block.messageID)
                            if (msg) {
                              dialog.replace(() => (
                                <DialogMessageActions
                                  message={msg}
                                  sessionID={sessionId() || ""}
                                  onAction={(action) => {
                                    if (action === "edit") {
                                      // Handle edit - populate prompt
                                      const msgParts = (sync.data.part[block.messageID] ?? []) as any[]
                                      const textParts = msgParts
                                        .filter((p: any) => p.type === "text" && !p.synthetic)
                                        .map((p: any) => p.text)
                                        .join("")
                                      // Could set prompt here if we had access to prompt ref
                                    }
                                  }}
                                />
                              ))
                            }
                          }
                        }}
                      >
                        <box flexDirection="row" gap={1}>
                          <text 
                            fg={block.actor === "user" ? gold : theme.text}
                            attributes={TextAttributes.BOLD}
                          >
                            {block.actor === "user" ? "You" : "Gizzi"}
                          </text>
                          {/* Bookmark indicator */}
                          <Show when={isBookmarked}>
                            <text fg={coworkPurple}>🔖</text>
                          </Show>
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
              
              {/* Bookmarks */}
              <box flexDirection="column" gap={1}>
                <text fg={coworkPurple} attributes={TextAttributes.BOLD}>
                  BOOKMARKS
                </text>
                <Show when={bookmarks.count() === 0}>
                  <text fg={theme.textMuted}>No bookmarks</text>
                </Show>
                <Show when={bookmarks.count() > 0}>
                  <box flexDirection="row" gap={1}>
                    <text fg={coworkPurple}>🔖</text>
                    <text fg={theme.text}>{bookmarks.count()} saved</text>
                  </box>
                </Show>
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
                        {job.status === "active" ? "●" : "○"}{job.name}
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
              
              {/* Quick Actions */}
              <box flexDirection="column" gap={1}>
                <text fg={coworkPurple} attributes={TextAttributes.BOLD}>
                  ACTIONS
                </text>
                <box flexDirection="row" gap={1} onMouseUp={openExportDialog}>
                  <text fg={theme.textMuted}>📤 Export</text>
                </box>
                <box flexDirection="row" gap={1} onMouseUp={openUsageDialog}>
                  <text fg={theme.textMuted}>💰 Usage</text>
                </box>
                <box flexDirection="row" gap={1} onMouseUp={openHelpDialog}>
                  <text fg={theme.textMuted}>? Help</text>
                </box>
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
              <Show when={bookmarks.count() > 0}>
                <text fg={coworkPurple}>
                  🔖 {String(bookmarks.count())}
                </text>
              </Show>
              {/* Connection Status */}
              <Show when={collaboration.isConnected()}>
                <text fg={theme.textMuted}>|</text>
                <text fg={collaboration.connectionState() === "connected_cloud" ? coworkPurple : success}>
                  {collaboration.connectionState() === "connected_cloud" ? "☁️" : "📶"}
                </text>
                <text fg={theme.textMuted}>
                  {collaboration.clientCount()} viewers
                </text>
              </Show>
              <Show when={collaboration.hasPendingApprovals()}>
                <text fg={warn}>⚠️ {collaboration.pendingApprovals().length} pending</text>
              </Show>
            </Show>
            <Show when={!session() && !sidebarVisible()}>
              <text fg={theme.textMuted}>Press Ctrl+C to exit</text>
            </Show>
          </box>
          
          <box flexDirection="row" gap={2}>
            <Show when={session()}>
              <text fg={theme.textMuted}>
                {String(cronJobs().length)} scheduled
              </text>
              <text fg={theme.textMuted}>·</text>
            </Show>
            <text fg={theme.textMuted}>/ for commands</text>
          </box>
        </box>
      </box>
    </GIZZIFrame>
    </CoworkCollaborationProvider>
  )
}
