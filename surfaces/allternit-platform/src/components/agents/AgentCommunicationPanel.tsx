/**
 * Agent Communication Panel
 * 
 * Live panel showing agent-to-agent communication in the Shell UI.
 * This component demonstrates the full-duplex async communication system.
 */

"use client"

import React, { useState, useEffect, useCallback } from "react"
import { AgentMessageDisplay, type AgentMessage } from "@/components/agents/AgentMessageDisplay"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChatCircle,
  Hash,
  At,
  PaperPlaneTilt,
  Users,
  Pulse as Activity,
  ArrowsClockwise,
  CheckCircle,
  Warning,
  X,
} from '@phosphor-icons/react';
import { cn } from "@/lib/utils"

// ============================================================================
// Mock Agent Communication Store (would be real API in production)
// ============================================================================

interface AgentCommunicationState {
  messages: AgentMessage[]
  channels: Array<{ id: string; name: string; members: number }>
  agents: Array<{ id: string; name: string; role: string; status: "idle" | "busy" | "offline" }>
  unreadCount: number
}

const useAgentCommunication = (sessionId: string) => {
  const [state, setState] = useState<AgentCommunicationState>({
    messages: [],
    channels: [],
    agents: [],
    unreadCount: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading initial state
    setLoading(true)
    
    // In production, would fetch from API
    // For demo, we'll simulate agent communication
    setTimeout(() => {
      setState({
        messages: [
          {
            id: "msg-1",
            from: { agentId: "builder-1", agentName: "Builder", agentRole: "builder" },
            to: { agentRole: "validator" },
            content: "@validator Authentication module ready for review. All tests passing.",
            type: "direct",
            timestamp: Date.now() - 300000,
            correlationId: "auth-review-1",
            mentions: ["validator"],
            read: true,
            readAt: Date.now() - 240000,
          },
          {
            id: "msg-2",
            from: { agentId: "validator-1", agentName: "Validator", agentRole: "validator" },
            to: { agentRole: "builder" },
            content: "@builder Reviewing now. Running integration tests.",
            type: "direct",
            timestamp: Date.now() - 240000,
            correlationId: "auth-review-1",
            inReplyTo: "msg-1",
            mentions: ["builder"],
            read: true,
            readAt: Date.now() - 180000,
          },
          {
            id: "msg-3",
            from: { agentId: "builder-1", agentName: "Builder", agentRole: "builder" },
            to: { channel: "development" },
            content: "Build completed successfully. Deploying to staging.",
            type: "channel",
            timestamp: Date.now() - 120000,
            mentions: [],
            read: false,
          },
          {
            id: "msg-4",
            from: { agentId: "reviewer-1", agentName: "Reviewer", agentRole: "reviewer" },
            to: { channel: "development" },
            content: "@builder @validator Code review complete. LGTM with minor suggestions.",
            type: "channel",
            timestamp: Date.now() - 60000,
            mentions: ["builder", "validator"],
            read: false,
          },
        ],
        channels: [
          { id: "ch-1", name: "development", members: 5 },
          { id: "ch-2", name: "review", members: 3 },
          { id: "ch-3", name: "deployments", members: 4 },
        ],
        agents: [
          { id: "builder-1", name: "Builder", role: "builder", status: "busy" },
          { id: "validator-1", name: "Validator", role: "validator", status: "busy" },
          { id: "reviewer-1", name: "Reviewer", role: "reviewer", status: "idle" },
          { id: "planner-1", name: "Planner", role: "planner", status: "idle" },
        ],
        unreadCount: 2,
      })
      setLoading(false)
    }, 500)

    // Simulate real-time messages
    const interval = setInterval(() => {
      setState(prev => {
        const shouldAddMessage = Math.random() > 0.7
        if (!shouldAddMessage) return prev

        const newMessage: AgentMessage = {
          id: `msg-${Date.now()}`,
          from: {
            agentId: "builder-1",
            agentName: "Builder",
            agentRole: "builder",
          },
          to: { agentRole: "validator" },
          content: [
            "@validator Tests passing, ready for review",
            "@validator Fixed the bug in auth module",
            "@validator Deployment successful",
          ][Math.floor(Math.random() * 3)],
          type: "direct",
          timestamp: Date.now(),
          correlationId: `thread-${Date.now()}`,
          mentions: ["validator"],
          read: false,
        }

        return {
          ...prev,
          messages: [newMessage, ...prev.messages].slice(0, 50),
          unreadCount: prev.unreadCount + 1,
        }
      })
    }, 15000)

    return () => clearInterval(interval)
  }, [sessionId])

  const sendMessage = useCallback((content: string, to: { agentRole?: string; channel?: string }) => {
    const newMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      from: { agentId: "user", agentName: "User", agentRole: "user" },
      to,
      content,
      type: to.channel ? "channel" : "direct",
      timestamp: Date.now(),
      mentions: [],
      read: true,
    }

    setState(prev => ({
      ...prev,
      messages: [newMessage, ...prev.messages],
    }))
  }, [])

  const markAsRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m => ({ ...m, read: true, readAt: Date.now() })),
      unreadCount: 0,
    }))
  }, [])

  return {
    ...state,
    loading,
    sendMessage,
    markAsRead,
  }
}

// ============================================================================
// Component
// ============================================================================

export function AgentCommunicationPanel({ sessionId }: { sessionId?: string }) {
  const {
    messages,
    channels,
    agents,
    unreadCount,
    loading,
    sendMessage,
    markAsRead,
  } = useAgentCommunication(sessionId || "demo")

  const [activeTab, setActiveTab] = useState<"messages" | "agents" | "channels">("messages")
  const [replyTo, setReplyTo] = useState<AgentMessage | null>(null)
  const [replyContent, setReplyContent] = useState("")

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <ArrowsClockwise className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-muted-foreground">Loading agent communication...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChatCircle className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Agent Communication</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "messages" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("messages")}
            >
              <ChatCircle className="w-4 h-4 mr-1" />
              Messages
            </Button>
            <Button
              variant={activeTab === "agents" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("agents")}
            >
              <Users className="w-4 h-4 mr-1" />
              Agents
            </Button>
            <Button
              variant={activeTab === "channels" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("channels")}
            >
              <Hash className="w-4 h-4 mr-1" />
              Channels
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {activeTab === "messages" && (
          <div className="space-y-4">
            {/* Agent Messages */}
            <AgentMessageDisplay
              messages={messages}
              currentAgentId="user"
              accentColor="#D4956A"
              maxMessages={10}
              onReply={(msg) => {
                setReplyTo(msg)
                setReplyContent(`@${msg.from.agentName} `)
              }}
            />

            {/* Reply Box */}
            {replyTo && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-start gap-2 mb-2">
                  <At className="w-4 h-4 text-primary mt-1" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Replying to {replyTo.from.agentName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {replyTo.content}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReplyTo(null)
                      setReplyContent("")
                    }}
                  >
                    <X size={16} />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 px-3 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && replyContent.trim()) {
                        sendMessage(replyContent, { agentRole: replyTo.from.agentRole })
                        setReplyTo(null)
                        setReplyContent("")
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (replyContent.trim()) {
                        sendMessage(replyContent, { agentRole: replyTo.from.agentRole })
                        setReplyTo(null)
                        setReplyContent("")
                      }
                    }}
                    disabled={!replyContent.trim()}
                  >
                    <PaperPlaneTilt size={16} />
                  </Button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="border-t pt-4 mt-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage("@builder Please provide status update", { agentRole: "builder" })}
                >
                  <At className="w-3 h-3 mr-1" />
                  Ask Builder
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage("@validator Ready for validation", { agentRole: "validator" })}
                >
                  <At className="w-3 h-3 mr-1" />
                  Notify Validator
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    sendMessage("Team standup in 5 minutes", { channel: "development" })
                    markAsRead()
                  }}
                >
                  <Hash className="w-3 h-3 mr-1" />
                  Post to #dev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAsRead}
                  disabled={unreadCount === 0}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Mark Read
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "agents" && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium mb-3">Agent Status</h3>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      agent.status === "idle" && "bg-green-500",
                      agent.status === "busy" && "bg-yellow-500",
                      agent.status === "offline" && "bg-gray-500"
                    )}
                  />
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                  </div>
                </div>
                <Badge variant={agent.status === "idle" ? "default" : "secondary"}>
                  {agent.status}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {activeTab === "channels" && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium mb-3">Communication Channels</h3>
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Hash className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-medium">#{channel.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {channel.members} members
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Join
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AgentCommunicationPanel
