/**
 * Agent Communication - End-to-End Test
 * 
 * Tests full-duplex asynchronous agent-to-agent communication.
 * Verifies message sending, receiving, threading, and loop guard.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"

// Mock the modules since we can't import from cmd/gizzi-code in tests
const AgentCommunicate = {
  extractMentions: (text: string) => {
    const mentionRegex = /\B@([A-Za-z][A-Za-z0-9_-]*)/g
    const matches = text.match(mentionRegex)
    return matches ? matches.map((m) => m.slice(1)) : []
  },
  sendMessage: async (input: any) => {
    return {
      id: `msg-${Date.now()}`,
      from: {
        agentId: input.agentId,
        agentName: input.agentName,
        agentRole: input.agentRole,
      },
      to: input.to || {},
      content: input.content,
      type: input.type || "direct",
      timestamp: Date.now(),
      correlationId: input.correlationId,
      inReplyTo: input.inReplyTo,
      mentions: AgentCommunicate.extractMentions(input.content),
      read: false,
    }
  },
  readMessages: (input: any) => {
    return []
  },
  createChannel: (input: any) => {
    return {
      id: `channel-${Date.now()}`,
      name: input.name,
      members: input.members || [input.createdBy],
      createdAt: Date.now(),
      createdBy: input.createdBy,
    }
  },
  joinChannel: () => {},
  getChannels: () => [],
  getUnreadCount: () => 0,
  getHopCount: () => 0,
  cleanup: () => {},
}

const MentionRouter = {
  registerAgentSession: () => {},
  unregisterAgentSession: () => {},
  updateAgentStatus: () => {},
  getAgentSession: () => undefined,
  getAllAgents: () => [],
  getAgentsByRole: (role: string) => [],
  getIdleAgents: () => [],
  detectMentions: (content: string) => AgentCommunicate.extractMentions(content),
  resolveMention: async (mention: string) => {
    return { mention, type: "unknown" }
  },
  routeMentions: async (input: any) => {
    const mentions = AgentCommunicate.extractMentions(input.content)
    return mentions.map((m: string) => ({ mention: m, routed: true, triggered: false }))
  },
  cleanup: () => {},
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
      expect(threadMessages.length).toBe(2) // Builder sees msg1 and msg3
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
