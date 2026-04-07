#!/usr/bin/env bun
/**
 * Cloud Relay Service Starter
 *
 * Starts the A2R Cloud Relay service for remote session access.
 *
 * Environment variables:
 *   RELAY_PORT - Port to listen on (default: 8443)
 *   RELAY_HOST - Host to bind to (default: 0.0.0.0)
 *   RELAY_JWT_SECRET - JWT secret for token validation (default: change-me-in-production)
 *
 * Usage:
 *   bun run start
 *   RELAY_PORT=443 bun run start
 */
import { createCloudRelayService } from '../index';
const port = parseInt(process.env.RELAY_PORT || '8443', 10);
const host = process.env.RELAY_HOST || '0.0.0.0';
const jwtSecret = process.env.RELAY_JWT_SECRET || 'change-me-in-production';
console.log('🔃 Starting A2R Cloud Relay Service...');
console.log(`   Port: ${port}`);
console.log(`   Host: ${host}`);
console.log('');
const relay = createCloudRelayService({ port, host, jwtSecret });
relay.on('started', ({ port }) => {
    console.log('');
    console.log('✅ Cloud Relay Service is ready!');
    console.log('');
    console.log('Endpoints:');
    console.log(`  WebSocket: ws://${host}:${port}/relay`);
    console.log(`  HTTP API:  http://${host}:${port}/api`);
    console.log(`  Health:    http://${host}:${port}/health`);
    console.log('');
    console.log('Usage:');
    console.log('  1. Local Gizzi-Code connects with ?type=local');
    console.log('  2. Remote clients connect with ?token=xxx');
    console.log('  3. Traffic is relayed bidirectionally');
    console.log('');
    console.log('Press Ctrl+C to stop');
});
relay.on('sessionRegistered', ({ sessionId, localSessionId }) => {
    console.log(`📝 Session: ${sessionId} (local: ${localSessionId})`);
});
relay.on('localConnected', ({ sessionId }) => {
    console.log(`🔗 Local connected: ${sessionId}`);
});
relay.on('remoteConnected', ({ sessionId, clientId }) => {
    console.log(`📥 Remote client: ${sessionId} (${clientId})`);
});
relay.on('error', (error) => {
    console.error('❌ Error:', error);
});
// Start the relay service
await relay.start();
// Handle shutdown
process.on('SIGINT', async () => {
    console.log('');
    console.log('🛑 Stopping Cloud Relay Service...');
    await relay.stop();
    console.log('✅ Stopped');
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('🛑 Stopping Cloud Relay Service...');
    await relay.stop();
    console.log('✅ Stopped');
    process.exit(0);
});
