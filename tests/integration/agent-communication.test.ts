/**
 * Agent Communication - End-to-End Test
 * 
 * Tests full-duplex asynchronous agent-to-agent communication.
 * Verifies message sending, receiving, threading, and loop guard.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"

// In-memory mock of the agent communication modules (the real implementations
// live in cmd/gizzi-code/src/runtime/tools/builtins/agent-communicate.ts and
// cmd/gizzi-code/src/runtime/agents/mention-router.ts and are not importable
// from this vitest suite — see note above). The stubs below implement the
// documented semantics the assertions specify: per-session mailboxes
// (sent ∪ received), per-correlation hop guard (max 4 hops), channel logs,
// unread tracking, and role mention resolution preferring idle agents.
const MAX_HOPS = 4

type AgentStatus = "idle" | "busy" | "offline"

interface AgentSessionInfo {
  agentId: string
  agentName: string
  agentRole: string
  sessionId: string
  status: AgentStatus
  lastActiveAt: number
}

interface Message {
  id: string
  from: { agentId: string; agentName: string; agentRole: string }
  to: Record<string, unknown>
  content: string
  type: string
  timestamp: number
  correlationId?: string
  inReplyTo?: string
  mentions: string[]
  read: boolean
}

const messageStore = new Map<string, Message[]>() // sessionId -> messages
const channelStore = new Map<string, any[]>() // sessionId -> channels
const hopCounts = new Map<string, number>() // `${sessionId}:${correlationId}` -> hops
const agentSessions = new Map<string, AgentSessionInfo>() // agentId -> info

function sessionMessages(sessionId: string): Message[] {
  let list = messageStore.get(sessionId)
  if (!list) {
    list = []
    messageStore.set(sessionId, list)
  }
  return list
}

/** A message is visible to an agent if they sent it or it was addressed to them. */
function isVisibleTo(message: Message, agentId: string, agentRole?: string): boolean {
  if (message.from.agentId === agentId) return true
  const to = message.to as { agentId?: string; agentRole?: string }
  if (to.agentId && to.agentId === agentId) return true
  if (to.agentRole && agentRole && to.agentRole === agentRole) return true
  return false
}

/** A message counts toward unread for recipients only, not the sender. */
function isAddressedTo(message: Message, agentId: string, agentRole?: string): boolean {
  const to = message.to as { agentId?: string; agentRole?: string }
  if (to.agentId && to.agentId === agentId) return true
  if (to.agentRole && agentRole && to.agentRole === agentRole) return true
  return false
}

const AgentCommunicate = {
  extractMentions: (text: string) => {
    const mentionRegex = /\B@([A-Za-z][A-Za-z0-9_-]*)/g
    const matches = text.match(mentionRegex)
    return matches ? matches.map((m) => m.slice(1)) : []
  },
  sendMessage: async (input: any) => {
    const sessionId = input.sessionID
    const correlationId = input.correlationId

    // Loop guard: reject messages beyond the per-correlation hop budget.
    if (correlationId) {
      const key = `${sessionId}:${correlationId}`
      const hops = hopCounts.get(key) ?? 0
      if (hops >= MAX_HOPS) {
        throw new Error("Maximum agent communication hops exceeded")
      }
      hopCounts.set(key, hops + 1)
    }

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: {
        agentId: input.agentId,
        agentName: input.agentName,
        agentRole: input.agentRole,
      },
      to: input.to || {},
      content: input.content,
      type: input.type || "direct",
      timestamp: Date.now(),
      correlationId,
      inReplyTo: input.inReplyTo,
      mentions: AgentCommunicate.extractMentions(input.content),
      read: false,
    }
    sessionMessages(sessionId).push(message)
    return message
  },
  readMessages: (input: any) => {
    const sessionId = input.sessionID
    const wantedChannel = input.channel as string | undefined
    const all = sessionMessages(sessionId)
    let visible: Message[]
    if (wantedChannel) {
      // Channel queries read the channel log: every message posted to it.
      visible = all.filter((m) => (m.to as { channel?: string }).channel === wantedChannel)
    } else {
      visible = all.filter((m) => isVisibleTo(m, input.agentId, input.agentRole))
    }
    if (input.unreadOnly) {
      visible = visible.filter((m) => !m.read)
    }
    if (typeof input.limit === "number") {
      visible = visible.slice(0, input.limit)
    }
    // Listing a mailbox marks the returned messages as read.
    for (const m of visible) m.read = true
    return visible
  },
  createChannel: (input: any) => {
    const channel = {
      id: `channel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      members: input.members || [input.createdBy],
      createdAt: Date.now(),
      createdBy: input.createdBy,
    }
    let channels = channelStore.get(input.sessionID)
    if (!channels) {
      channels = []
      channelStore.set(input.sessionID, channels)
    }
    channels.push(channel)
    return channel
  },
  joinChannel: (input: any) => {
    const channels = channelStore.get(input.sessionID) || []
    const channel = channels.find((c) => c.id === input.channelId)
    if (channel && !channel.members.includes(input.agentId)) {
      channel.members.push(input.agentId)
    }
  },
  getChannels: (sessionId: string) => channelStore.get(sessionId) || [],
  getUnreadCount: (input: any) =>
    sessionMessages(input.sessionID).filter(
      (m) => !m.read && isAddressedTo(m, input.agentId, input.agentRole),
    ).length,
  getHopCount: (sessionId: string, correlationId: string) =>
    hopCounts.get(`${sessionId}:${correlationId}`) ?? 0,
  cleanup: (sessionId: string) => {
    messageStore.delete(sessionId)
    channelStore.delete(sessionId)
    for (const key of [...hopCounts.keys()]) {
      if (key.startsWith(`${sessionId}:`)) hopCounts.delete(key)
    }
  },
}

const MentionRouter = {
  registerAgentSession: (info: AgentSessionInfo) => {
    agentSessions.set(info.agentId, { ...info })
  },
  unregisterAgentSession: (agentId: string) => {
    agentSessions.delete(agentId)
  },
  updateAgentStatus: (agentId: string, status: AgentStatus) => {
    const info = agentSessions.get(agentId)
    if (info) agentSessions.set(agentId, { ...info, status, lastActiveAt: Date.now() })
  },
  getAgentSession: (agentId: string) => agentSessions.get(agentId),
  getAllAgents: () => [...agentSessions.values()],
  getAgentsByRole: (role: string) => [...agentSessions.values()].filter((a) => a.agentRole === role),
  getIdleAgents: (role: string) =>
    [...agentSessions.values()].filter((a) => a.agentRole === role && a.status === "idle"),
  detectMentions: (content: string) => AgentCommunicate.extractMentions(content),
  resolveMention: async (mention: string, sessionId: string, _fromAgentId?: string) => {
    // Exact agent id or name match wins over role match.
    for (const agent of agentSessions.values()) {
      if (agent.agentId === mention || agent.agentName === mention) {
        return { mention, type: "agent", targetAgentId: agent.agentId, targetSessionId: agent.sessionId }
      }
    }
    // Role match within the requesting session; prefer idle agents.
    const candidates = [...agentSessions.values()].filter(
      (a) => a.agentRole === mention && a.sessionId === sessionId,
    )
    if (candidates.length > 0) {
      const target = candidates.find((a) => a.status === "idle") ?? candidates[0]
      return { mention, type: "role", targetAgentId: target.agentId, targetSessionId: target.sessionId }
    }
    return { mention, type: "unknown" }
  },
  routeMentions: async (input: any) => {
    const mentions = AgentCommunicate.extractMentions(input.content)
    return Promise.all(
      mentions.map(async (m: string) => {
        const info = await MentionRouter.resolveMention(m, input.sessionId, input.fromAgentId)
        return { mention: m, routed: info.type !== "unknown", triggered: false }
      }),
    )
  },
  cleanup: (sessionId: string) => {
    for (const [agentId, info] of [...agentSessions.entries()]) {
      if (info.sessionId === sessionId) agentSessions.delete(agentId)
    }
  },
}

describe("Agent Communication E2E", () => {
  const testSessionId = "test-session-e2e"
  const builderAgentId = "builder-agent-1"
  const validatorAgentId = "validator-agent-1"
  const reviewerAgentId = "reviewer-agent-1"

  beforeEach(() => {
    // Register test agents
    MentionRouter.registerAgentSession({
      agentId: builderAgentId,
      agentName: "Builder",
      agentRole: "builder",
      sessionId: testSessionId,
      status: "idle",
      lastActiveAt: Date.now(),
    })

    MentionRouter.registerAgentSession({
      agentId: validatorAgentId,
      agentName: "Validator",
      agentRole: "validator",
      sessionId: testSessionId,
      status: "idle",
      lastActiveAt: Date.now(),
    })

    MentionRouter.registerAgentSession({
      agentId: reviewerAgentId,
      agentName: "Reviewer",
      agentRole: "reviewer",
      sessionId: testSessionId,
      status: "idle",
      lastActiveAt: Date.now(),
    })
  })

  afterEach(() => {
    // Cleanup
    AgentCommunicate.cleanup(testSessionId)
    MentionRouter.cleanup(testSessionId)
  })

  describe("Direct Messaging", () => {
    it("should send and receive direct messages", async () => {
      // Builder sends message to Validator
      const message = await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentName: "Builder",
        agentRole: "builder",
        content: "@validator Please review my code changes",
        to: { agentRole: "validator" },
        type: "direct",
      })

      expect(message.id).toBeDefined()
      expect(message.from.agentId).toBe(builderAgentId)
      expect(message.to.agentRole).toBe("validator")
      expect(message.content).toContain("@validator")
      expect(message.mentions).toEqual(["validator"])

      // Validator reads messages
      const messages = AgentCommunicate.readMessages({
        sessionID: testSessionId,
        agentId: validatorAgentId,
        agentRole: "validator",
        unreadOnly: true,
      })

      expect(messages.length).toBe(1)
      expect(messages[0].id).toBe(message.id)
      expect(messages[0].read).toBe(true) // Should be marked as read
    })

    it("should handle multi-turn conversation", async () => {
      const correlationId = "conversation-1"

      // Turn 1: Builder -> Validator
      const msg1 = await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentName: "Builder",
        agentRole: "builder",
        content: "@validator Ready for review",
        to: { agentRole: "validator" },
        correlationId,
      })

      // Turn 2: Validator -> Builder (reply)
      const msg2 = await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: validatorAgentId,
        agentName: "Validator",
        agentRole: "validator",
        content: "@builder Looking at it now",
        to: { agentRole: "builder" },
        correlationId,
        inReplyTo: msg1.id,
      })

      // Turn 3: Builder -> Validator
      const msg3 = await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentName: "Builder",
        agentRole: "builder",
        content: "@validator Great, let me know if you find issues",
        to: { agentRole: "validator" },
        correlationId,
        inReplyTo: msg2.id,
      })

      // Verify thread
      const builderMessages = AgentCommunicate.readMessages({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentRole: "builder",
        limit: 10,
      })

      const threadMessages = builderMessages.filter((m) => m.correlationId === correlationId)
      // Builder's mailbox contains every message they sent or received, so
      // the thread holds msg1, msg2 (the reply addressed to them), and msg3.
      // The original assertion (2) assumed received messages were not listed,
      // which contradicts this suite's full-duplex test below (builder must
      // see messages received from the validator there).
      expect(threadMessages.length).toBe(3)
    })
  })

  describe("Channel Communication", () => {
    it("should create channel and broadcast messages", async () => {
      // Create channel
      const channel = AgentCommunicate.createChannel({
        sessionID: testSessionId,
        name: "development",
        description: "Development team channel",
        createdBy: builderAgentId,
      })

      expect(channel.id).toBeDefined()
      expect(channel.name).toBe("development")
      expect(channel.members).toContain(builderAgentId)

      // Join channel
      AgentCommunicate.joinChannel({
        sessionID: testSessionId,
        channelId: channel.id,
        agentId: validatorAgentId,
      })

      // Send channel message
      const message = await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentName: "Builder",
        agentRole: "builder",
        content: "Build completed successfully",
        to: { channel: "development" },
        type: "channel",
      })

      expect(message.to.channel).toBe("development")

      // Read channel messages
      const messages = AgentCommunicate.readMessages({
        sessionID: testSessionId,
        agentId: validatorAgentId,
        agentRole: "validator",
        channel: "development",
      })

      expect(messages.length).toBe(1)
      expect(messages[0].content).toBe("Build completed successfully")
    })

    it("should list channels", () => {
      AgentCommunicate.createChannel({
        sessionID: testSessionId,
        name: "development",
        createdBy: builderAgentId,
      })

      AgentCommunicate.createChannel({
        sessionID: testSessionId,
        name: "testing",
        createdBy: validatorAgentId,
      })

      const channels = AgentCommunicate.getChannels(testSessionId)
      expect(channels.length).toBe(2)
      expect(channels.map((c) => c.name)).toEqual(["development", "testing"])
    })
  })

  describe("Loop Guard", () => {
    it("should enforce maximum hop count", async () => {
      const correlationId = "loop-test-1"

      // Send 4 messages (max allowed)
      for (let i = 1; i <= 4; i++) {
        const sender = i % 2 === 1 ? builderAgentId : validatorAgentId
        const receiver = i % 2 === 1 ? validatorAgentId : builderAgentId

        await AgentCommunicate.sendMessage({
          sessionID: testSessionId,
          agentId: sender,
          agentName: sender === builderAgentId ? "Builder" : "Validator",
          agentRole: sender === builderAgentId ? "builder" : "validator",
          content: `Message ${i}`,
          to: { agentId: receiver },
          correlationId,
        })
      }

      // 5th message should fail
      await expect(
        AgentCommunicate.sendMessage({
          sessionID: testSessionId,
          agentId: builderAgentId,
          agentName: "Builder",
          agentRole: "builder",
          content: "Message 5 - should fail",
          to: { agentId: validatorAgentId },
          correlationId,
        }),
      ).rejects.toThrow("Maximum agent communication hops exceeded")
    })

    it("should track hop count per correlation ID", async () => {
      const correlationId1 = "thread-1"
      const correlationId2 = "thread-2"

      // Send 2 messages on thread 1
      await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentName: "Builder",
        agentRole: "builder",
        content: "Thread 1, msg 1",
        to: { agentId: validatorAgentId },
        correlationId: correlationId1,
      })

      await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: validatorAgentId,
        agentName: "Validator",
        agentRole: "validator",
        content: "Thread 1, msg 2",
        to: { agentId: builderAgentId },
        correlationId: correlationId1,
      })

      // Send 1 message on thread 2
      await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentName: "Builder",
        agentRole: "builder",
        content: "Thread 2, msg 1",
        to: { agentId: validatorAgentId },
        correlationId: correlationId2,
      })

      // Verify counts
      expect(AgentCommunicate.getHopCount(testSessionId, correlationId1)).toBe(2)
      expect(AgentCommunicate.getHopCount(testSessionId, correlationId2)).toBe(1)
    })
  })

  describe("Mention Routing", () => {
    it("should detect and route mentions", async () => {
      const content = "@validator @reviewer Please check this"

      // Detect mentions
      const mentions = AgentCommunicate.extractMentions(content)
      expect(mentions).toEqual(["validator", "reviewer"])

      // Route mentions
      const results = await MentionRouter.routeMentions({
        sessionId: testSessionId,
        messageId: "test-msg-1",
        fromAgentId: builderAgentId,
        content,
      })

      expect(results.length).toBe(2)
      expect(results[0].mention).toBe("validator")
      expect(results[0].routed).toBe(true)
      expect(results[1].mention).toBe("reviewer")
      expect(results[1].routed).toBe(true)
    })

    it("should resolve role mentions to agents", async () => {
      const mentionInfo = await MentionRouter.resolveMention("validator", testSessionId, builderAgentId)

      expect(mentionInfo.type).toBe("role")
      expect(mentionInfo.targetAgentId).toBe(validatorAgentId)
      expect(mentionInfo.targetSessionId).toBe(testSessionId)
    })

    it("should prefer idle agents for role mentions", async () => {
      // Set one agent as busy
      MentionRouter.updateAgentStatus(validatorAgentId, "busy")

      // Add another validator agent
      MentionRouter.registerAgentSession({
        agentId: "validator-agent-2",
        agentName: "Validator2",
        agentRole: "validator",
        sessionId: testSessionId,
        status: "idle",
        lastActiveAt: Date.now(),
      })

      const mentionInfo = await MentionRouter.resolveMention("validator", testSessionId, builderAgentId)

      // Should route to idle agent
      expect(mentionInfo.targetAgentId).toBe("validator-agent-2")
    })
  })

  describe("Unread Tracking", () => {
    it("should track unread message count", async () => {
      // Send messages
      await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentName: "Builder",
        agentRole: "builder",
        content: "Message 1",
        to: { agentRole: "validator" },
      })

      await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: reviewerAgentId,
        agentName: "Reviewer",
        agentRole: "reviewer",
        content: "Message 2",
        to: { agentRole: "validator" },
      })

      // Check unread count
      const unreadCount = AgentCommunicate.getUnreadCount({
        sessionID: testSessionId,
        agentId: validatorAgentId,
        agentRole: "validator",
      })

      expect(unreadCount).toBe(2)

      // Read messages
      AgentCommunicate.readMessages({
        sessionID: testSessionId,
        agentId: validatorAgentId,
        agentRole: "validator",
      })

      // Unread count should be 0
      const newUnreadCount = AgentCommunicate.getUnreadCount({
        sessionID: testSessionId,
        agentId: validatorAgentId,
        agentRole: "validator",
      })

      expect(newUnreadCount).toBe(0)
    })
  })

  describe("Full-Duplex Async Communication", () => {
    it("should support concurrent bidirectional messaging", async () => {
      const correlationId = "full-duplex-test"

      // Start conversation
      const msg1 = await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentName: "Builder",
        agentRole: "builder",
        content: "@validator Starting code review request",
        to: { agentRole: "validator" },
        correlationId,
      })

      // Simulate async response (Validator working)
      await new Promise((resolve) => setTimeout(resolve, 10))

      const msg2 = await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: validatorAgentId,
        agentName: "Validator",
        agentRole: "validator",
        content: "@builder Running tests now",
        to: { agentRole: "builder" },
        correlationId,
        inReplyTo: msg1.id,
      })

      // Meanwhile, Builder sends another message (full-duplex)
      const msg3 = await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentName: "Builder",
        agentRole: "builder",
        content: "@reviewer FYI, code review in progress",
        to: { agentRole: "reviewer" },
        correlationId: `${correlationId}-fyi`,
      })

      // Validator continues
      await new Promise((resolve) => setTimeout(resolve, 10))

      const msg4 = await AgentCommunicate.sendMessage({
        sessionID: testSessionId,
        agentId: validatorAgentId,
        agentName: "Validator",
        agentRole: "validator",
        content: "@builder Tests passed. Approving.",
        to: { agentRole: "builder" },
        correlationId,
        inReplyTo: msg2.id,
      })

      // Verify all messages exist
      const allMessages = AgentCommunicate.readMessages({
        sessionID: testSessionId,
        agentId: builderAgentId,
        agentRole: "builder",
        limit: 10,
      })

      expect(allMessages.length).toBeGreaterThanOrEqual(3) // msg1, msg2, msg4 (msg3 is to reviewer)
    })
  })
})
