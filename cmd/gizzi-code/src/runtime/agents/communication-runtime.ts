/**
 * Agent Communication Runtime Integration
 * 
 * Wires agent communication into the gizzi-code runtime.
 * Automatically handles message routing, mention detection, and agent triggering.
 */

import { Bus } from "@/shared/bus"
import { BusEvent } from "@/shared/bus/bus-event"
import { z } from "zod/v4"
import { Log } from "@/shared/util/log"
import { Session } from "@/runtime/session"
import { MessageV2 } from "@/runtime/session/message-v2"
import { Agent } from "@/runtime/loop/agent"
import { AgentCommunicate } from "@/runtime/tools/builtins/agent-communicate"
import { MentionRouter } from "@/runtime/agents/mention-router"
import { SessionProcessor } from "@/runtime/session/processor"

export namespace AgentCommunicationRuntime {
  const log = Log.create({ service: "agent.communication.runtime" })

  // ============================================================================
  // Event Definitions
  // ============================================================================

  export const AgentRegistered = BusEvent.define(
    "agent.communication.registered",
    z.object({
      agentId: z.string(),
      agentName: z.string(),
      agentRole: z.string(),
      sessionId: z.string(),
    }),
  )

  export const AgentUnregistered = BusEvent.define(
    "agent.communication.unregistered",
    z.object({
      agentId: z.string(),
      sessionId: z.string(),
    }),
  )

  export const MessageBroadcastToUI = BusEvent.define(
    "agent.communication.message.ui",
    z.object({
      sessionId: z.string(),
      message: z.object({
        id: z.string(),
        from: z.object({
          agentId: z.string(),
          agentName: z.string(),
          agentRole: z.string(),
        }),
        to: z.object({
          agentName: z.string().optional(),
          agentRole: z.string().optional(),
          channel: z.string().optional(),
        }),
        content: z.string(),
        type: z.enum(["direct", "channel", "broadcast"]),
        timestamp: z.number(),
        correlationId: z.string().optional(),
        mentions: z.array(z.string()).optional(),
        read: z.boolean(),
      }),
    }),
  )

  // ============================================================================
  // Initialization
  // ============================================================================

  export function initialize(): void {
    log.info("initializing agent communication runtime")

    // Subscribe to session events
    setupSessionHandlers()

    // Subscribe to message events
    setupMessageHandlers()

    // Subscribe to mention events
    setupMentionHandlers()

    // Wire into tool execution
    setupToolExecutionHooks()

    log.info("agent communication runtime initialized")
  }

  // ============================================================================
  // Session Lifecycle Handlers
  // ============================================================================

  function setupSessionHandlers(): void {
    // Register agent when session starts
    Bus.subscribe(Session.Event.Start, async (event: any) => {
      const sessionID = event.properties?.sessionID
      const agentId = event.properties?.agent

      if (sessionID && agentId) {
        try {
          const agent = await Agent.get(agentId)
          
          MentionRouter.registerAgentSession({
            agentId,
            agentName: agent?.name || agentId,
            agentRole: agent?.role || "agent",
            sessionId: sessionID,
            status: "idle",
            lastActiveAt: Date.now(),
          })

          Bus.publish(AgentRegistered, {
            agentId,
            agentName: agent?.name || agentId,
            agentRole: agent?.role || "agent",
            sessionId,
          })

          log.info("agent registered for communication", {
            agentId,
            sessionId,
            role: agent?.role,
          })
        } catch (error) {
          log.error("failed to register agent", { agentId, sessionId, error })
        }
      }
    })

    // Update agent status during session
    Bus.subscribe(Session.Event.Busy, async (event: any) => {
      const sessionID = event.properties?.sessionID
      if (sessionID) {
        // Find agent for this session and mark as busy
        const agents = MentionRouter.getAllAgents()
        const agent = agents.find(a => a.sessionId === sessionID)
        if (agent) {
          MentionRouter.updateAgentStatus(agent.agentId, "busy")
        }
      }
    })

    // Mark agent as idle when session completes
    Bus.subscribe(Session.Event.End, async (event: any) => {
      const sessionID = event.properties?.sessionID
      if (sessionID) {
        const agents = MentionRouter.getAllAgents()
        const agent = agents.find(a => a.sessionId === sessionID)
        if (agent) {
          MentionRouter.updateAgentStatus(agent.agentId, "idle")
        }
      }
    })

    // Unregister agent when session is disposed
    Bus.subscribe(Session.Event.Dispose, async (event: any) => {
      const sessionID = event.properties?.sessionID
      if (sessionID) {
        const agents = MentionRouter.getAllAgents()
        const agent = agents.find(a => a.sessionId === sessionID)
        if (agent) {
          MentionRouter.unregisterAgentSession(agent.agentId)
          
          Bus.publish(AgentUnregistered, {
            agentId: agent.agentId,
            sessionId,
          })
        }

        // Cleanup communication state
        AgentCommunicate.cleanup(sessionID)
      }
    })
  }

  // ============================================================================
  // Message Handlers
  // ============================================================================

  function setupMessageHandlers(): void {
    // Handle outgoing messages
    Bus.subscribe(AgentCommunicate.MessageSent, async (event: any) => {
      const props = event.properties

      // Broadcast to UI for display
      Bus.publish(MessageBroadcastToUI, {
        sessionId: props.sessionId,
        message: {
          id: props.messageId,
          from: {
            agentId: props.fromAgent,
            agentName: props.fromAgent,
            agentRole: "agent",
          },
          to: {
            agentName: props.toAgent,
            agentRole: props.toRole,
            channel: props.channel,
          },
          content: props.content,
          type: props.type,
          timestamp: Date.now(),
          correlationId: props.correlationId,
          mentions: props.mentions,
          read: false,
        },
      })

      log.info("message sent", {
        from: props.fromAgent,
        to: props.toAgent || props.toRole || props.channel,
        content: props.content.slice(0, 50),
      })
    })

    // Handle loop guard triggers
    Bus.subscribe(AgentCommunicate.LoopGuardTriggered, async (event: any) => {
      const props = event.properties

      log.warn("loop guard triggered - escalating to human", {
        correlationId: props.correlationId,
        hopCount: props.hopCount,
        sessionId: props.sessionId,
        agentId: props.agentId,
      })

      // Create escalation message in session
      await createEscalationMessage({
        sessionID: props.sessionId,
        correlationId: props.correlationId,
        hopCount: props.hopCount,
        agentId: props.agentId,
      })
    })
  }

  // ============================================================================
  // Mention Handlers
  // ============================================================================

  function setupMentionHandlers(): void {
    // Handle mention detection
    Bus.subscribe(MentionRouter.MentionDetected, async (event: any) => {
      const props = event.properties

      log.info("mention detected", {
        mention: props.mention,
        fromAgent: props.fromAgent,
        content: props.content.slice(0, 50),
      })
    })

    // Handle mention routing
    Bus.subscribe(MentionRouter.MentionRouted, async (event: any) => {
      const props = event.properties

      if (props.triggered) {
        log.info("mention routed and agent triggered", {
          mention: props.mention,
          targetAgent: props.targetAgent,
          targetSessionId: props.targetSessionId,
        })
      } else {
        log.info("mention routed but agent not triggered", {
          mention: props.mention,
          targetAgent: props.targetAgent,
          reason: "Agent may be busy or offline",
        })
      }
    })

    // Handle ignored mentions
    Bus.subscribe(MentionRouter.MentionIgnored, async (event: any) => {
      const props = event.properties

      log.debug("mention ignored", {
        mention: props.mention,
        reason: props.reason,
      })
    })
  }

  // ============================================================================
  // Tool Execution Hooks
  // ============================================================================

  function setupToolExecutionHooks(): void {
    // Intercept tool execution to check for mentions in tool output
    const originalProcess = SessionProcessor.create

    SessionProcessor.create = function(input: any) {
      const result = originalProcess(input)

      // After tool execution, check output for mentions
      const originalProcess_fn = result.process
      result.process = async function(streamInput: any) {
        const output = await originalProcess_fn.call(this, streamInput)

        // Check if any tool output contains mentions
        // This allows agents to mention other agents in their tool outputs
        const parts = await MessageV2.parts(input.assistantMessage.id)
        for (const part of parts) {
          if (part.type === "tool" && part.state.status === "completed") {
            const outputText = JSON.stringify(part.state.output)
            const mentions = AgentCommunicate.extractMentions(outputText)
            
            if (mentions.length > 0) {
              // Route mentions
              await MentionRouter.routeMentions({
                sessionId: input.sessionID,
                messageId: input.assistantMessage.id,
                fromAgentId: input.assistantMessage.agent,
                content: outputText,
              })
            }
          }
        }

        return output
      }

      return result
    }
  }

  // ============================================================================
  // Escalation Message Creation
  // ============================================================================

  async function createEscalationMessage(input: {
    sessionID: string
    correlationId: string
    hopCount: number
    agentId: string
  }): Promise<void> {
    const content = `⚠️ **Loop Guard Triggered**

Agent communication chain has exceeded the maximum hop count (${input.hopCount}/${AgentCommunicate.MAX_HOP_COUNT}).

**Details:**
- Correlation ID: ${input.correlationId}
- Agent: ${input.agentId}
- Session: ${input.sessionID}

**Action Required:**
This conversation chain requires human intervention. Please review the communication thread and provide guidance.`

    // Create a system message in the session
    await Session.updatePart({
      id: `escalation_${Date.now()}`,
      messageID: `system_${Date.now()}`,
      sessionID: input.sessionID,
      type: "text",
      text: content,
      time: { start: Date.now() },
      metadata: {
        type: "escalation",
        correlationId: input.correlationId,
        hopCount: input.hopCount,
      },
    })
  }

  // ============================================================================
  // Public API
  // ============================================================================

  export function getAgentStatus(agentId: string): "idle" | "busy" | "offline" | undefined {
    const session = MentionRouter.getAgentSession(agentId)
    return session?.status
  }

  export function getAllAgentsStatus(): Array<{
    agentId: string
    agentName: string
    agentRole: string
    sessionId: string
    status: "idle" | "busy" | "offline"
  }> {
    return MentionRouter.getAllAgents()
  }

  export function getUnreadMessageCount(sessionId: string, agentId: string, agentRole: string): number {
    return AgentCommunicate.getUnreadCount({
      sessionID: sessionId,
      agentId,
      agentRole,
    })
  }

  export function getAgentChannels(sessionId: string): Array<{
    id: string
    name: string
    members: string[]
  }> {
    return AgentCommunicate.getChannels(sessionId)
  }
}

// Auto-initialize when module is loaded
AgentCommunicationRuntime.initialize()
