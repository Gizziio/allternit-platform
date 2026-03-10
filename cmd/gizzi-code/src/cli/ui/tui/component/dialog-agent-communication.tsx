/**
 * Agent Communication Dialog - TUI Component
 * 
 * Displays agent-to-agent communication in the terminal UI.
 * Shows messages, channels, and unread counts.
 */

import { useState, useEffect } from "hono/jsx"
import { Box, Text, Newline } from "@inkjs/ui"
import { AgentCommunicationRuntime } from "@/runtime/agents/communication-runtime"

export function DialogAgentCommunication(props: { sessionID: string }) {
  const [messages, setMessages] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedTab, setSelectedTab] = useState<"messages" | "channels">("messages")

  useEffect(() => {
    // Load initial data
    const loadData = () => {
      // Get messages for this session
      const allMessages = AgentCommunicationRuntime.getAllAgentsStatus()
      
      // Get channels
      const sessionChannels = AgentCommunicationRuntime.getAgentChannels(props.sessionID)
      setChannels(sessionChannels)

      // Get unread count (simplified - would need agent identity)
      setUnreadCount(0)
    }

    loadData()

    // Subscribe to message events
    const unsubscribe = subscribeToMessages((message) => {
      setMessages(prev => [message, ...prev].slice(0, 50))
    })

    return () => unsubscribe()
  }, [props.sessionID])

  return (
    <Box flexDirection="column" height={20}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>Agent Communication</Text>
        {unreadCount > 0 && (
          <Text color="yellow"> ({unreadCount} unread)</Text>
        )}
      </Box>

      {/* Tabs */}
      <Box marginBottom={1}>
        <Text
          color={selectedTab === "messages" ? "green" : "gray"}
          bold={selectedTab === "messages"}
        >
          [M]essages
        </Text>
        <Text> | </Text>
        <Text
          color={selectedTab === "channels" ? "green" : "gray"}
          bold={selectedTab === "channels"}
        >
          [C]hannels
        </Text>
      </Box>

      {/* Content */}
      {selectedTab === "messages" ? (
        <Box flexDirection="column" height={14}>
          {messages.length === 0 ? (
            <Text color="gray">No agent messages yet</Text>
          ) : (
            messages.slice(0, 10).map((msg, i) => (
              <Box key={msg.id} marginBottom={i < 9 ? 1 : 0}>
                <Text color="cyan">{msg.from.agentName}</Text>
                <Text color="gray"> → </Text>
                <Text color="magenta">
                  {msg.to.channel ? `#${msg.to.channel}` : msg.to.agentName || "broadcast"}
                </Text>
                <Text>: </Text>
                <Text>{msg.content.slice(0, 60)}</Text>
                {msg.mentions && msg.mentions.length > 0 && (
                  <Text color="yellow"> {msg.mentions.map(m => `@${m}`).join(" ")}</Text>
                )}
              </Box>
            ))
          )}
        </Box>
      ) : (
        <Box flexDirection="column" height={14}>
          {channels.length === 0 ? (
            <Text color="gray">No channels yet</Text>
          ) : (
            channels.map((channel, i) => (
              <Box key={channel.id} marginBottom={i < channels.length - 1 ? 1 : 0}>
                <Text color="green">#{channel.name}</Text>
                <Text color="gray"> ({channel.members.length} members)</Text>
              </Box>
            ))
          )}
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">Tab to switch • Esc to close</Text>
      </Box>
    </Box>
  )
}

// Simple subscription helper
function subscribeToMessages(callback: (message: any) => void): () => void {
  // In production, would subscribe to Bus events
  // For now, this is a placeholder
  return () => {}
}

export default DialogAgentCommunication
