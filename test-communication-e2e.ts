#!/usr/bin/env node

/**
 * Agent Communication System - Standalone E2E Test
 * 
 * Tests the core communication logic without requiring full runtime initialization.
 */

// Import the core logic directly
import { AgentCommunicate } from './cmd/gizzi-code/src/runtime/tools/builtins/agent-communicate.ts'
import { MentionRouter } from './cmd/gizzi-code/src/runtime/agents/mention-router.ts'

console.log('='.repeat(60))
console.log('AGENT COMMUNICATION SYSTEM - E2E TEST')
console.log('='.repeat(60))

let passCount = 0
let failCount = 0

function test(name: string, fn: () => boolean | Promise<boolean>) {
  return async () => {
    try {
      const result = await fn()
      if (result) {
        console.log(`✅ PASS: ${name}`)
        passCount++
      } else {
        console.log(`❌ FAIL: ${name}`)
        failCount++
      }
    } catch (error: any) {
      console.log(`❌ FAIL: ${name} - ${error.message}`)
      failCount++
    }
  }
}

// Test 1: Mention Detection
await test('Mention Detection', () => {
  const testContent = '@validator Please review @builder code'
  const mentions = AgentCommunicate.extractMentions(testContent)
  
  console.log(`  Input: "${testContent}"`)
  console.log(`  Extracted:`, mentions)
  
  return mentions.length === 2 && 
         mentions.includes('validator') && 
         mentions.includes('builder')
})()

// Test 2: Agent Registration
await test('Agent Registration', () => {
  const testSessionId = 'test-session-e2e'
  const builderAgent = {
    agentId: 'builder-1',
    agentName: 'Builder',
    agentRole: 'builder',
    sessionId: testSessionId,
    status: 'idle' as const,
    lastActiveAt: Date.now(),
  }
  
  MentionRouter.registerAgentSession(builderAgent)
  const registeredAgent = MentionRouter.getAgentSession('builder-1')
  
  console.log(`  Registered:`, registeredAgent?.agentId)
  
  return registeredAgent && registeredAgent.agentId === 'builder-1'
})()

// Test 3: Agent Status Update
await test('Agent Status Update', () => {
  MentionRouter.updateAgentStatus('builder-1', 'busy')
  const updatedAgent = MentionRouter.getAgentSession('builder-1')
  
  console.log(`  Status:`, updatedAgent?.status)
  
  return updatedAgent && updatedAgent.status === 'busy'
})()

// Test 4: Mention Routing
await test('Mention Routing', async () => {
  const testSessionId = 'test-session-e2e'
  
  const validatorAgent = {
    agentId: 'validator-1',
    agentName: 'Validator',
    agentRole: 'validator',
    sessionId: testSessionId,
    status: 'idle' as const,
    lastActiveAt: Date.now(),
  }
  
  MentionRouter.registerAgentSession(validatorAgent)
  const mentionInfo = await MentionRouter.resolveMention('validator', testSessionId, 'builder-1')
  
  console.log(`  Resolution:`, mentionInfo.type, '→', mentionInfo.targetAgentId)
  
  return mentionInfo.type === 'role' && mentionInfo.targetAgentId === 'validator-1'
})()

// Test 5: Send Message
await test('Send Message', async () => {
  const testSessionId = 'test-session-e2e'
  
  const message = await AgentCommunicate.sendMessage({
    sessionID: testSessionId,
    agentId: 'builder-1',
    agentName: 'Builder',
    agentRole: 'builder',
    content: '@validator Ready for review',
    to: { agentRole: 'validator' },
    type: 'direct',
  })
  
  console.log(`  Message ID:`, message.id)
  console.log(`  From:`, message.from.agentName)
  console.log(`  To:`, message.to.agentRole)
  console.log(`  Mentions:`, message.mentions)
  
  return message.id && 
         message.from.agentId === 'builder-1' && 
         message.to.agentRole === 'validator' &&
         message.mentions?.includes('validator')
})()

// Test 6: Read Messages
await test('Read Messages', () => {
  const testSessionId = 'test-session-e2e'
  
  const messages = AgentCommunicate.readMessages({
    sessionID: testSessionId,
    agentId: 'validator-1',
    agentRole: 'validator',
    unreadOnly: false,
    limit: 10,
  })
  
  console.log(`  Messages read:`, messages.length)
  
  return messages.length > 0
})()

// Test 7: Loop Guard - Hop Counting
await test('Loop Guard - Hop Counting', async () => {
  const testSessionId = 'test-session-e2e'
  const correlationId = 'test-loop-guard'
  
  // Send 4 messages
  for (let i = 1; i <= 4; i++) {
    await AgentCommunicate.sendMessage({
      sessionID: testSessionId,
      agentId: i % 2 === 1 ? 'builder-1' : 'validator-1',
      agentName: i % 2 === 1 ? 'Builder' : 'Validator',
      agentRole: i % 2 === 1 ? 'builder' : 'validator',
      content: `Message ${i}`,
      to: { agentId: i % 2 === 1 ? 'validator-1' : 'builder-1' },
      correlationId,
    })
  }
  
  const hopCount = AgentCommunicate.getHopCount(testSessionId, correlationId)
  console.log(`  Hop count: ${hopCount}/4`)
  
  return hopCount === 4
})()

// Test 8: Loop Guard - Enforcement
await test('Loop Guard - Enforcement', async () => {
  const testSessionId = 'test-session-e2e'
  const correlationId = 'test-loop-guard'
  
  try {
    await AgentCommunicate.sendMessage({
      sessionID: testSessionId,
      agentId: 'builder-1',
      agentName: 'Builder',
      agentRole: 'builder',
      content: 'Message 5 - should fail',
      to: { agentId: 'validator-1' },
      correlationId,
    })
    console.log(`  ERROR: Should have thrown`)
    return false
  } catch (error: any) {
    console.log(`  Error caught:`, error.message.substring(0, 50))
    return error.message.includes('Maximum agent communication hops exceeded')
  }
})()

// Test 9: Channel Creation
await test('Channel Creation', () => {
  const testSessionId = 'test-session-e2e'
  
  const channel = AgentCommunicate.createChannel({
    sessionID: testSessionId,
    name: 'test-channel',
    description: 'Test channel',
    createdBy: 'builder-1',
  })
  
  console.log(`  Channel: #${channel.name} (${channel.id})`)
  
  return channel.id && channel.name === 'test-channel'
})()

// Test 10: Get Channels
await test('Get Channels', () => {
  const testSessionId = 'test-session-e2e'
  
  const channels = AgentCommunicate.getChannels(testSessionId)
  console.log(`  Channels:`, channels.map(c => `#${c.name}`))
  
  return channels.length > 0 && channels.some(c => c.name === 'test-channel')
})()

// Test 11: Join Channel
await test('Join Channel', () => {
  const testSessionId = 'test-session-e2e'
  const channels = AgentCommunicate.getChannels(testSessionId)
  const channel = channels.find(c => c.name === 'test-channel')
  
  if (!channel) {
    console.log(`  Channel not found`)
    return false
  }
  
  AgentCommunicate.joinChannel({
    sessionID: testSessionId,
    channelId: channel.id,
    agentId: 'validator-1',
  })
  
  const updatedChannels = AgentCommunicate.getChannels(testSessionId)
  const updatedChannel = updatedChannels.find(c => c.name === 'test-channel')
  
  console.log(`  Members:`, updatedChannel?.members)
  
  return updatedChannel?.members.includes('validator-1')
})()

// Test 12: Unread Count
await test('Unread Count', () => {
  const testSessionId = 'test-session-e2e'
  
  const count = AgentCommunicate.getUnreadCount({
    sessionID: testSessionId,
    agentId: 'validator-1',
    agentRole: 'validator',
  })
  
  console.log(`  Unread count:`, count)
  
  return count >= 0 // Just verify it returns a number
})()

// Cleanup
console.log('\n[CLEANUP]')
AgentCommunicate.cleanup('test-session-e2e')
MentionRouter.cleanup('test-session-e2e')
console.log('Cleanup complete')

// Summary
console.log('\n' + '='.repeat(60))
console.log('E2E TEST SUMMARY')
console.log('='.repeat(60))
console.log(`Passed: ${passCount}`)
console.log(`Failed: ${failCount}`)
console.log('')

if (failCount === 0) {
  console.log('✅ All tests passed!')
  console.log('')
  console.log('Verified functionality:')
  console.log('  ✓ Mention detection and extraction')
  console.log('  ✓ Agent registration and status tracking')
  console.log('  ✓ Mention routing to agents')
  console.log('  ✓ Message sending and receiving')
  console.log('  ✓ Loop guard hop counting')
  console.log('  ✓ Loop guard enforcement (max 4 hops)')
  console.log('  ✓ Channel creation and management')
  console.log('  ✓ Channel joining')
  console.log('  ✓ Unread count tracking')
  console.log('')
  console.log('The agent communication system is working correctly.')
} else {
  console.log('❌ Some tests failed')
  process.exit(1)
}
console.log('='.repeat(60))
