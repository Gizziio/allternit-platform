/**
 * Allternit Gateway - Main Entry Point
 * 
 * Launches either stdio or HTTP transport based on command-line arguments.
 * 
 * Usage:
 *   node index.js                    # stdio mode (default)
 *   node index.js --transport stdio  # stdio mode
 *   node index.js --transport http   # HTTP mode
 *   node index.js --transport http --port 3210  # HTTP mode with custom port
 * 
 * @module @allternit/allternit-gateway
 */

import { StdioTransport, DEFAULT_CONFIG as STDIO_CONFIG } from './transports/stdio/index.js';
import { HttpTransport, DEFAULT_CONFIG as HTTP_CONFIG, DEFAULT_HTTP_OPTIONS } from './transports/http_server/index.js';

// =============================================================================
// Parse Command Line Arguments
// =============================================================================

function parseArgs(): { transport: string; port?: number; host?: string } {
  const args = process.argv.slice(2);
  const result = {
    transport: 'stdio',
    port: undefined as number | undefined,
    host: undefined as string | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--transport':
      case '-t':
        result.transport = args[++i] || 'stdio';
        break;
      case '--port':
      case '-p':
        result.port = parseInt(args[++i], 10);
        break;
      case '--host':
      case '-h':
        result.host = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
      case '--version':
      case '-v':
        console.log('allternit-gateway/1.0.0');
        process.exit(0);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Allternit Gateway - Transport-agnostic API Gateway

Usage:
  node index.js [options]

Options:
  -t, --transport <type>  Transport type: stdio or http (default: stdio)
  -p, --port <number>     HTTP port (default: 3210)
  -h, --host <host>       HTTP host (default: 0.0.0.0)
  -v, --version           Print version
  --help                  Print this help

Examples:
  # Start in stdio mode (for local subprocess usage)
  node index.js

  # Start in HTTP mode
  node index.js --transport http

  # Start HTTP mode on custom port
  node index.js --transport http --port 8080

Environment Variables:
  ALLTERNIT_API_URL           API service URL
  ALLTERNIT_VOICE_URL         Voice service URL
  ALLTERNIT_OPERATOR_URL      Operator service URL
  ALLTERNIT_RAILS_URL         Rails service URL
  ALLTERNIT_HTTP_PORT         HTTP port (alternative to --port)
  ALLTERNIT_HTTP_HOST         HTTP host (alternative to --host)
  ALLTERNIT_CORS_ORIGINS      CORS allowed origins
  LOG_LEVEL             Logging level (debug, info, warn, error)
`);
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  console.error('[Allternit Gateway] Starting...');
  console.error(`[Allternit Gateway] Transport: ${args.transport}`);

  if (args.transport === 'http') {
    const options = {
      ...DEFAULT_HTTP_OPTIONS,
      port: args.port || DEFAULT_HTTP_OPTIONS.port,
      host: args.host || DEFAULT_HTTP_OPTIONS.host,
    };

    console.error(`[Allternit Gateway] HTTP Port: ${options.port}`);
    console.error(`[Allternit Gateway] HTTP Host: ${options.host}`);

    const transport = new HttpTransport(HTTP_CONFIG, options);

    // Handle shutdown signals
    process.on('SIGINT', async () => {
      console.error('[Allternit Gateway] Received SIGINT');
      await transport.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('[Allternit Gateway] Received SIGTERM');
      await transport.stop();
      process.exit(0);
    });

    await transport.start();
  } else {
    // stdio mode (default)
    const transport = new StdioTransport(STDIO_CONFIG);

    // Handle shutdown signals
    process.on('SIGINT', async () => {
      console.error('[Allternit Gateway] Received SIGINT');
      await transport.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('[Allternit Gateway] Received SIGTERM');
      await transport.stop();
      process.exit(0);
    });

    await transport.start();
  }
}

// Run main
main().catch((err) => {
  console.error('[Allternit Gateway] Fatal error:', err);
  process.exit(1);
});
