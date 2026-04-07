/**
 * Agent Communication Dialog - TUI Component
 * 
 * Displays agent-to-agent communication in the terminal UI.
 * Shows messages, channels, and unread counts.
 */

import { createMemo, createSignal } from "solid-js"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useKeybind } from "@/cli/ui/tui/context/keybind"
import { useSync } from "@/cli/ui/tui/context/sync"
import type { AgentPart, TextPart } from "@allternit/sdk"

// Message type for agent communication
interface AgentMessage {
  id: string
  from: {
    agentName: string
  }
  to: {
    channel?: string
    agentName?: string
  }
  content: string
  mentions?: string[]
}

// Channel type for agent channels
interface AgentChannel {
  id: string
  name: string
  members: string[]
}

export function DialogAgentCommunication(props: { sessionID: string }) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const keybind = useKeybind()
  const sync = useSync()
  
  const [selectedTab, setSelectedTab] = createSignal<"messages" | "channels">("messages")
  const [unreadCount, setUnreadCount] = createSignal(0)

  // Extract agent-to-agent messages from session parts
  const messages = createMemo<AgentMessage[]>(() => {
    const msgs = sync.data.message[props.sessionID]
    if (!msgs) return []
    const result: AgentMessage[] = []
    for (const msg of msgs) {
      if (msg.role !== "assistant") continue
      const parts = sync.data.part[msg.id] ?? []
      const agentParts = parts.filter((p): p is AgentPart => p.type === "agent")
      if (agentParts.length === 0) continue
      const textContent = parts
        .filter((p): p is TextPart => p.type === "text")
        .map(p => p.text ?? "")
        .join("")
        .slice(0, 100)
      for (const agentPart of agentParts) {
        result.push({
          id: `${msg.id}-${agentPart.name}`,
          from: { agentName: agentPart.name },
          to: { agentName: "coordinator" },
          content: agentPart.source?.value ?? textContent,
        })
      }
    }
    return result
  })

  // Derive channels from unique agent names seen in session parts
  const channels = createMemo<AgentChannel[]>(() => {
    const msgs = sync.data.message[props.sessionID]
    if (!msgs) return []
    const agentNames = new Set<string>()
    for (const msg of msgs) {
      const parts = sync.data.part[msg.id] ?? []
      for (const part of parts) {
        if (part.type === "agent") agentNames.add((part as AgentPart).name)
      }
    }
    return [...agentNames].map(name => ({ id: name, name, members: [name, "coordinator"] }))
  })

  // Format message content for display
  const formatMessage = (msg: AgentMessage): DialogSelectOption<void> => {
    const recipient = msg.to.channel ? `#${msg.to.channel}` : msg.to.agentName || "broadcast"
    const mentions = msg.mentions && msg.mentions.length > 0 
      ? ` ${msg.mentions.map((m: string) => `@${m}`).join(" ")}`
      : ""
    
    return {
      title: `${msg.from.agentName} → ${recipient}: ${msg.content.slice(0, 60)}`,
      description: mentions,
      value: undefined,
    }
  }

  // Format channel for display
  const formatChannel = (channel: AgentChannel): DialogSelectOption<void> => {
    return {
      title: `#${channel.name}`,
      description: `(${channel.members.length} members)`,
      value: undefined,
    }
  }

  // Create options based on selected tab
  const options = createMemo<DialogSelectOption<void>[]>(() => {
    const opts = selectedTab() === "messages" 
      ? messages().slice(0, 10).map(formatMessage)
      : channels().map(formatChannel)
    
    // Add empty state option
    if (opts.length === 0) {
      return [{
        title: selectedTab() === "messages" 
          ? "No agent messages yet" 
          : "No channels yet",
        disabled: true,
        value: undefined,
      }]
    }
    
    return opts
  })

  const title = createMemo(() => {
    const unread = unreadCount()
    return `Agent Communication${unread > 0 ? ` (${unread} unread)` : ""}`
  })

  return (
    <DialogSelect
      title={title()}
      options={options()}
      onSelect={() => {
        dialog.clear()
      }}
      skipFilter={true}
    />
  )
}

export default DialogAgentCommunication
