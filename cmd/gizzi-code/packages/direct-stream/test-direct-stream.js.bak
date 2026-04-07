#!/usr/bin/env bun
/**
 * Test script for Direct Stream Server
 *
 * Usage: bun test-direct-stream.ts
 */
import { createDirectStreamServer } from './src/index';
console.log('🧪 Testing Direct Stream Server...\n');
// Create server
const server = createDirectStreamServer({
    port: 0, // Auto-assign port
    host: '127.0.0.1',
    path: '/stream',
});
// Track events
server.on('started', ({ url, port }) => {
    console.log('✅ Server started');
    console.log(`   WebSocket URL: ${url}`);
    console.log(`   HTTP Port: ${port}`);
    console.log(`   Health URL: http://127.0.0.1:${port}/health`);
    console.log(`   Info URL: http://127.0.0.1:${port}/info`);
});
server.on('clientConnected', ({ count }) => {
    console.log(`📥 Client connected (${count} total)`);
});
server.on('clientDisconnected', ({ count }) => {
    console.log(`📤 Client disconnected (${count} remaining)`);
});
server.on('error', (error) => {
    console.error('❌ Server error:', error);
});
// Start server
const testRunId = 'test-run-123';
console.log(`🚀 Starting server for run: ${testRunId}\n`);
try {
    const url = await server.start(testRunId);
    console.log('\n✅ Server is running!');
    console.log(`   Clients: ${server.getClientCount()}`);
    console.log(`   Port: ${server.getPort()}`);
    console.log(`   Running: ${server.isRunning()}`);
    // Broadcast a test message
    console.log('\n📢 Broadcasting test message...');
    server.broadcast({
        type: 'output',
        data: 'Hello from test!',
        timestamp: Date.now(),
        runId: testRunId,
    });
    console.log('   Message sent');
    // Wait a bit then stop
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Stop server
    console.log('\n🛑 Stopping server...');
    await server.stop();
    console.log('✅ Server stopped');
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
}
catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
}
