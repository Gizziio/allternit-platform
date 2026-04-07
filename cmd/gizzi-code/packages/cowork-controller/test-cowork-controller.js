#!/usr/bin/env bun
/**
 * Test script for Cowork Controller
 *
 * Usage: bun test-cowork-controller.ts
 */
import { createCoworkController } from './src/index';
import WebSocket from 'ws';
console.log('🧪 Testing Cowork Controller...\n');
// Create controller
const controller = createCoworkController({
    port: 0, // Auto-assign
    host: '127.0.0.1',
});
// Track events
const events = [];
controller.on('started', ({ port }) => {
    events.push(`✅ Controller started on port ${port}`);
});
controller.on('sessionCreated', ({ sessionId, runId }) => {
    events.push(`📝 Session created: ${sessionId} (run: ${runId})`);
});
controller.on('clientConnected', ({ sessionId, clientCount }) => {
    events.push(`📥 Client connected to ${sessionId} (${clientCount} viewers)`);
});
controller.on('broadcast', ({ sessionId, event, clientCount }) => {
    events.push(`📢 Broadcast to ${sessionId} (${clientCount} clients): ${event.type}`);
});
// Start controller
console.log('🚀 Starting Cowork Controller...\n');
await controller.start();
for (const event of events) {
    console.log(event);
}
events.length = 0;
// Get the actual port
const address = controller['httpServer'].address();
const port = typeof address === 'object' ? address?.port : 0;
console.log(`\n   Running on port ${port}\n`);
// Test 1: Create a session
console.log('📝 Test 1: Creating session...');
const session = await controller.createSession('test-run-123');
console.log(`   Session ID: ${session.id}`);
console.log(`   Run ID: ${session.runId}`);
console.log(`   ✅ Session created\n`);
// Test 2: Connect a WebSocket client
console.log('📥 Test 2: Connecting WebSocket client...');
let ws;
const wsConnectPromise = new Promise((resolve, reject) => {
    ws = new WebSocket(`ws://127.0.0.1:${port}/cowork/${session.id}`);
    const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
    }, 5000);
    ws.on('open', () => {
        clearTimeout(timeout);
        console.log('   ✅ Client connected\n');
        resolve();
    });
    ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
    });
});
await wsConnectPromise;
// Test 3: Broadcast an event
console.log('📢 Test 3: Broadcasting event...');
controller.broadcast(session.id, {
    type: 'output',
    data: 'Hello from controller!',
    timestamp: Date.now(),
});
console.log('   ✅ Event broadcast\n');
// Wait for client to receive
await new Promise(resolve => setTimeout(resolve, 100));
// Test 4: Get session info
console.log('📊 Test 4: Getting session info...');
const info = controller.getSessionInfo(session.id);
if (info) {
    console.log(`   Session: ${info.id}`);
    console.log(`   Run ID: ${info.runId}`);
    console.log(`   Clients: ${info.clientCount}`);
    console.log(`   History: ${info.historyLength} events`);
    console.log('   ✅ Session info retrieved\n');
}
// Test 5: List sessions
console.log('📋 Test 5: Listing sessions...');
const sessions = controller.listSessions();
console.log(`   Total sessions: ${sessions.length}`);
for (const s of sessions) {
    console.log(`   - ${s.id} (run: ${s.runId}, clients: ${s.clientCount})`);
}
console.log('   ✅ Sessions listed\n');
// Test 6: API endpoint
console.log('🌐 Test 6: Testing HTTP API...');
const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
const health = await healthResponse.json();
console.log(`   Health status: ${health.status}`);
console.log(`   Sessions: ${health.sessions}`);
console.log('   ✅ API working\n');
// Test 7: Create session via API
console.log('🌐 Test 7: Creating session via API...');
const createResponse = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId: 'api-run-456' }),
});
const created = await createResponse.json();
console.log(`   Created session: ${created.id}`);
console.log(`   WebSocket URL: ${created.wsUrl}`);
console.log('   ✅ API session created\n');
// Cleanup
console.log('🧹 Cleaning up...');
ws?.close();
// Give WebSocket time to close
await new Promise(resolve => setTimeout(resolve, 100));
await controller.deleteSession(session.id);
await controller.deleteSession(created.id);
// Force stop after cleanup
const stopPromise = controller.stop();
await Promise.race([
    stopPromise,
    new Promise(resolve => setTimeout(resolve, 2000))
]);
console.log('   ✅ Cleanup complete\n');
console.log('✅ All Cowork Controller tests passed!\n');
// Force exit
process.exit(0);
