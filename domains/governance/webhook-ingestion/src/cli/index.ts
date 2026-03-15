#!/usr/bin/env node

/**
 * Webhook Ingestion Service - CLI Entry Point
 * 
 * Commands:
 *   serve - Start webhook server
 *   list  - List configured webhooks
 *   trigger - Manually trigger a webhook
 */

import { loadConfig, validateConfig } from '../config/index.js';
import { createWebhookServer } from '../server/webhook-server.js';

/**
 * Print usage
 */
function printUsage(): void {
  console.log(`
A2R Webhook Ingestion Service

Usage:
  a2r-webhook <command> [options]

Commands:
  serve              Start webhook server
  list               List configured webhook sources
  trigger            Manually trigger a webhook for testing
  help               Show this help message

Options:
  --port <port>      Server port (default: 8787)
  --host <host>      Server host (default: 0.0.0.0)
  --log-level <lvl>  Log level: debug, info, warn, error (default: info)

Examples:
  a2r-webhook serve --port 8787 --log-level debug
  a2r-webhook list
  a2r-webhook trigger --source github --event pull_request.opened
`);
}

/**
 * Serve command - start webhook server
 */
async function serveCommand(args: string[]): Promise<void> {
  const config = loadConfig();
  
  // Override with CLI args
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    config.server.port = parseInt(args[portIdx + 1]);
  }
  
  const hostIdx = args.indexOf('--host');
  if (hostIdx !== -1 && args[hostIdx + 1]) {
    config.server.host = args[hostIdx + 1];
  }
  
  const logLevelIdx = args.indexOf('--log-level');
  if (logLevelIdx !== -1 && args[logLevelIdx + 1]) {
    const level = args[logLevelIdx + 1] as 'debug' | 'info' | 'warn' | 'error';
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      config.server.logLevel = level;
    }
  }
  
  // Validate configuration
  validateConfig(config);
  
  // Create and start server
  const server = createWebhookServer({
    port: config.server.port,
    host: config.server.host,
    corsOrigins: config.cors.origins,
    logLevel: config.server.logLevel,
  });
  
  // Handle shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // Start server
  await server.start();
  
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     A2R Webhook Ingestion Service                        ║
╠══════════════════════════════════════════════════════════╣
║  Server:   http://${config.server.host}:${String(config.server.port).padEnd(5)}                     ║
║  Log Level: ${config.server.logLevel.padEnd(44)}║
╠══════════════════════════════════════════════════════════╣
║  Configured Sources:                                     ║`);
  
  for (const [source, sourceConfig] of config.sources.entries()) {
    const status = sourceConfig.enabled ? '✓' : '✗';
    const hasSecret = sourceConfig.secret ? '🔐' : '🔓';
    console.log(`║    ${status} ${source.padEnd(12)} ${hasSecret.padEnd(4)}                            ║`);
  }
  
  console.log(`╚══════════════════════════════════════════════════════════╝
`);
}

/**
 * List command - show configured webhooks
 */
function listCommand(): void {
  const config = loadConfig();
  
  console.log('\nConfigured Webhook Sources:\n');
  console.log('Source         Enabled    Secret     Rate Limit');
  console.log('─'.repeat(60));
  
  for (const [source, sourceConfig] of config.sources.entries()) {
    const enabled = sourceConfig.enabled ? 'Yes' : 'No';
    const hasSecret = sourceConfig.secret ? 'Configured' : 'None';
    const rateLimit = `${config.rateLimit.maxRequests}/${config.rateLimit.windowMs / 1000}s`;
    
    console.log(`${source.padEnd(15)} ${enabled.padEnd(11)} ${hasSecret.padEnd(13)} ${rateLimit}`);
  }
  
  console.log('\nRails Integration:');
  console.log(`  URL: ${config.rails.url}`);
  console.log(`  API Key: ${config.rails.apiKey ? 'Configured' : 'Not set'}`);
  console.log('');
}

/**
 * Trigger command - manually trigger a webhook for testing
 */
async function triggerCommand(args: string[]): Promise<void> {
  const sourceIdx = args.indexOf('--source');
  const eventIdx = args.indexOf('--event');
  const payloadIdx = args.indexOf('--payload');
  
  if (sourceIdx === -1 || !args[sourceIdx + 1]) {
    console.error('Error: --source is required');
    console.error('Usage: a2r-webhook trigger --source <source> --event <event> [--payload <file>]');
    process.exit(1);
  }
  
  const source = args[sourceIdx + 1];
  const event = eventIdx !== -1 && args[eventIdx + 1] ? args[eventIdx + 1] : 'test.event';
  
  // Build test payload
  const testPayload: Record<string, unknown> = {
    source,
    eventType: event,
    timestamp: new Date().toISOString(),
    test: true,
  };
  
  // Load custom payload if provided
  if (payloadIdx !== -1 && args[payloadIdx + 1]) {
    const fs = await import('fs');
    const payloadFile = args[payloadIdx + 1];
    try {
      const content = fs.readFileSync(payloadFile, 'utf-8');
      const customPayload = JSON.parse(content);
      Object.assign(testPayload, customPayload);
    } catch (error) {
      console.error(`Error reading payload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }
  
  // Send webhook to local server
  const config = loadConfig();
  const url = `http://${config.server.host}:${config.server.port}/webhook/${source}`;
  
  console.log(`\nSending test webhook to ${url}...`);
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });
    
    const result = await response.json();
    
    console.log(`\nResponse (${response.status}):`);
    console.log(JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error sending webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('Make sure the webhook server is running.');
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  switch (command) {
    case 'serve':
      await serveCommand(args);
      break;
    
    case 'list':
      listCommand();
      break;
    
    case 'trigger':
      await triggerCommand(args);
      break;
    
    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;
    
    default:
      if (!command) {
        printUsage();
      } else {
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
      }
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
