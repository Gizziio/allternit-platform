/**
 * Mention Router
 *
 * Routes @mentions to specific agent sessions and triggers agent execution.
 * Integrates with the Bus system for cross-session communication.
 */

import { Bus } from "@/shared/bus"
import { BusEvent } from "@/shared/bus/bus-event"
import { z } from "zod/v4"
import { Log } from "@/shared/util/log"
import { AgentCommunicate } from "@/runtime/tools/builtins/agent-communicate"

export namespace MentionRouter {
  const log = Log.create({ service: "mention.router" })

  // ============================================================================
  // Event Definitions
  // ============================================================================

  export const MentionDetected = BusEvent.define(
    "agent.mention.detected",
    z.object({
      mention: z.string(),
      messageId: z.string(),
      sessionId: z.string(),
      fromAgent: z.string(),
      content: z.string(),
    }),
  )

  export const MentionRouted = BusEvent.define(
    "agent.mention.routed",
    z.object({
      mention: z.string(),
      targetSessionId: z.string(),
      targetAgent: z.string(),
      messageId: z.string(),
      triggered: z.boolean(),
    }),
  )

  export const MentionIgnored = BusEvent.define(
    "agent.mention.ignored",
    z.object({
      mention: z.string(),
      messageId: z.string(),
      reason: z.string(),
    }),
  )

  // ============================================================================
  // Types
  // ============================================================================

  export interface MentionInfo {
    mention: string
    type: "agent" | "role" | "unknown"
    targetAgentId?: string
    targetSessionId?: string
  }

  export interface RouteResult {
    mention: string
    routed: boolean
    targetSessionId?: string
    targetAgentId?: string
    triggered: boolean
    reason?: string
  }

  // ============================================================================
  // Agent Registry
  // ============================================================================

  interface AgentSession {
    agentId: string
    agentName: string
    agentRole: string
    sessionId: string
    status: "idle" | "busy" | "offline"
    lastActiveAt: number
  }

  const agentSessions = new Map<string, AgentSession>() // agentId -> session

  export function registerAgentSession(session: AgentSession): void {
    agentSessions.set(session.agentId, session)
    log.info("registered agent session", {
      agentId: session.agentId,
      sessionId: session.sessionId,
      role: session.agentRole,
    })
  }

  export function unregisterAgentSession(agentId: string): void {
    agentSessions.delete(agentId)
  }

  export function updateAgentStatus(agentId: string, status: AgentSession["status"]): void {
    const session = agentSessions.get(agentId)
    if (session) {
      session.status = status
      session.lastActiveAt = Date.now()
      agentSessions.set(agentId, session)
    }
  }

  export function getAgentSession(agentId: string): AgentSession | undefined {
    return agentSessions.get(agentId)
  }

  export function getAllAgents(): AgentSession[] {
    return Array.from(agentSessions.values())
  }

  export function getAgentsByRole(role: string): AgentSession[] {
    return Array.from(agentSessions.values()).filter((s) => s.agentRole === role)
  }

  export function getIdleAgents(): AgentSession[] {
    return Array.from(agentSessions.values()).filter((s) => s.status === "idle")
  }

  // ============================================================================
  // Mention Detection
  // ============================================================================

  export function detectMentions(content: string): string[] {
    return AgentCommunicate.extractMentions(content)
  }

  export async function resolveMention(
    mention: string,
    sessionId: string,
    fromAgentId: string,
  ): Promise<MentionInfo> {
    // Check if it's a direct agent ID
    const directSession = agentSessions.get(mention)
    if (directSession) {
      return {
        mention,
        type: "agent",
        targetAgentId: mention,
        targetSessionId: directSession.sessionId,
      }
    }

    // Check if it's a role
    const roleAgents = getAgentsByRole(mention)
    if (roleAgents.length > 0) {
      // Prefer idle agents
      const idleAgent = roleAgents.find((a) => a.status === "idle") || roleAgents[0]
      return {
        mention,
        type: "role",
        targetAgentId: idleAgent.agentId,
        targetSessionId: idleAgent.sessionId,
      }
    }

    // Unknown mention
    return {
      mention,
      type: "unknown",
    }
  }

  // ============================================================================
  // Message Routing
  // ============================================================================

  export async function routeMentions(input: {
    sessionId: string
    messageId: string
    fromAgentId: string
    content: string
  }): Promise<RouteResult[]> {
    const mentions = detectMentions(input.content)
    const results: RouteResult[] = []

    for (const mention of mentions) {
      const result = await routeSingleMention({
        ...input,
        mention,
      })
      results.push(result)
    }

    return results
  }

  async function routeSingleMention(input: {
    sessionId: string
    messageId: string
    fromAgentId: string
    mention: string
    content: string
  }): Promise<RouteResult> {
    const mentionInfo = await resolveMention(input.mention, input.sessionId, input.fromAgentId)

    if (mentionInfo.type === "unknown") {
      Bus.publish(MentionIgnored, {
        mention: input.mention,
        messageId: input.messageId,
        reason: "Unknown agent or role",
      })
      return {
        mention: input.mention,
        routed: false,
        triggered: false,
        reason: "Unknown agent or role",
      }
    }

    if (!mentionInfo.targetSessionId) {
      Bus.publish(MentionIgnored, {
        mention: input.mention,
        messageId: input.messageId,
        reason: "No session found for mention",
      })
      return {
        mention: input.mention,
        routed: false,
        triggered: false,
        reason: "No session found",
      }
    }

    // Publish mention detected event
    Bus.publish(MentionDetected, {
      mention: input.mention,
      messageId: input.messageId,
      sessionId: input.sessionId,
      fromAgent: input.fromAgentId,
      content: input.content,
    })

    // Check if target agent is available
    const targetSession = getAgentSession(mentionInfo.targetAgentId!)
    if (!targetSession) {
      return {
        mention: input.mention,
        routed: true,
        targetSessionId: mentionInfo.targetSessionId,
        targetAgentId: mentionInfo.targetAgentId,
        triggered: false,
        reason: "Target agent session not found",
      }
    }

    // Trigger agent if idle
    let triggered = false
    if (targetSession.status === "idle") {
      triggered = await triggerAgentSession({
        sessionId: targetSession.sessionId,
        agentId: targetSession.agentId,
        fromAgentId: input.fromAgentId,
        reason: "mention",
        mention: input.mention,
        messageId: input.messageId,
        content: input.content,
      })
    }

    // Publish routing event
    Bus.publish(MentionRouted, {
      mention: input.mention,
      targetSessionId: targetSession.sessionId,
      targetAgent: targetSession.agentId,
      messageId: input.messageId,
      triggered,
    })

    return {
      mention: input.mention,
      routed: true,
      targetSessionId: targetSession.sessionId,
      targetAgentId: targetSession.agentId,
      triggered,
    }
  }

  // ============================================================================
  // Agent Triggering
  // ============================================================================

  async function triggerAgentSession(input: {
    sessionId: string
    agentId: string
    fromAgentId: string
    reason: string
    mention: string
    messageId: string
    content: string
  }): Promise<boolean> {
    try {
      log.info("triggering agent session", {
        sessionId: input.sessionId,
        agentId: input.agentId,
        fromAgentId: input.fromAgentId,
        reason: input.reason,
      })

      // Update status to busy
      updateAgentStatus(input.agentId, "busy")

      // Use SessionPrompt.loop to trigger the session execution
      const { SessionPrompt } = await import("@/runtime/session/prompt")
      SessionPrompt.loop({ 
        sessionID: input.sessionId, 
        resume_existing: true 
      }).catch((error) => {
        log.error("failed to resume session via loop", { sessionId: input.sessionId, error })
      })

      return true
    } catch (error) {
      log.error("failed to trigger agent session", {
        sessionId: input.sessionId,
        agentId: input.agentId,
        error,
      })

      // Revert status
      updateAgentStatus(input.agentId, "idle")

      return false
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  export function cleanup(sessionId: string): void {
    // Find and unregister all agents in this session
    for (const [agentId, session] of agentSessions.entries()) {
      if (session.sessionId === sessionId) {
        unregisterAgentSession(agentId)
      }
    }
  }

  // ============================================================================
  // Session Lifecycle Integration
  // ============================================================================
  // Note: Session lifecycle hooks are handled by communication-runtime.ts
  // This module exports pure functions for use by the runtime
}
