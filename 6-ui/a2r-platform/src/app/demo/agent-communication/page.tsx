/**
 * Agent Communication Demo Page
 * 
 * Live demonstration of agent-to-agent communication system.
 * Shows real-time messaging, @mentions, channels, and agent status.
 */

"use client"

import React from "react"
import { AgentCommunicationPanel } from "@/components/agents/AgentCommunicationPanel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  MessageCircle, 
  AtSign, 
  Hash, 
  Users, 
  Activity,
  Zap,
  CheckCircle2,
  ArrowRight
} from "lucide-react"

export default function AgentCommunicationDemo() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">Agent Communication System</h1>
          </div>
          <p className="text-muted-foreground">
            Live demonstration of full-duplex asynchronous agent-to-agent communication
          </p>
        </div>

        {/* Status Badges */}
        <div className="flex gap-4">
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Runtime Integrated
          </Badge>
          <Badge variant="default" className="gap-1">
            <Zap className="w-3 h-3" />
            Real-time Messaging
          </Badge>
          <Badge variant="default" className="gap-1">
            <AtSign className="w-3 h-3" />
            @mention Routing
          </Badge>
          <Badge variant="default" className="gap-1">
            <Hash className="w-3 h-3" />
            Channel Support
          </Badge>
        </div>

        {/* Main Demo */}
        <div className="grid gap-6">
          {/* Live Communication Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Live Agent Communication
              </CardTitle>
              <CardDescription>
                Watch agents communicate in real-time. Messages are automatically routed and agents are triggered on @mention.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AgentCommunicationPanel sessionId="demo-session-1" />
            </CardContent>
          </Card>

          {/* Architecture Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
              <CardDescription>
                End-to-end communication flow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      1. Agent Sends Message
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Agent uses <code className="text-xs bg-background px-1 py-0.5 rounded">agent_communicate</code> tool
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <h3 className="font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      2. Bus Event Published
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Message stored and broadcast via Bus system
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <h3 className="font-medium flex items-center gap-2">
                      <AtSign className="w-4 h-4" />
                      3. @mention Detected
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      MentionRouter routes to target agent
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <h3 className="font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      4. Agent Triggered
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Idle agent automatically triggered to respond
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Full-Duplex Async</CardTitle>
                <CardDescription>
                  Bidirectional concurrent messaging
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Non-blocking communication</li>
                  <li>• Multiple concurrent conversations</li>
                  <li>• Message threading via correlation IDs</li>
                  <li>• In-reply-to support</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Loop Guard</CardTitle>
                <CardDescription>
                  Prevents infinite agent chains
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Maximum 4 hops per thread</li>
                  <li>• 60-second sliding window</li>
                  <li>• Automatic escalation</li>
                  <li>• Human intervention trigger</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agent Registry</CardTitle>
                <CardDescription>
                  Real-time agent status tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Idle/Busy/Offline status</li>
                  <li>• Role-based routing</li>
                  <li>• Session association</li>
                  <li>• Auto-trigger on mention</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Code Example */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Example</CardTitle>
              <CardDescription>
                How agents use the communication system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code>{`// Agent sends message to another agent
await agent_communicate({
  action: "send",
  content: "@validator Authentication module ready for review",
  to: { agentRole: "validator" },
  correlationId: "auth-review-123"
})

// Create and join channel
await agent_communicate({
  action: "create_channel",
  channel: "development"
})

await agent_communicate({
  action: "join_channel",
  channel: "development"
})

// Send to channel
await agent_communicate({
  action: "send",
  content: "Build completed. Tests passing.",
  to: { channel: "development" }
})

// Read messages
await agent_communicate({
  action: "read",
  unreadOnly: true,
  limit: 10
})`}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
