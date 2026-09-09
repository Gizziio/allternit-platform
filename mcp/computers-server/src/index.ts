#!/usr/bin/env node
/**
 * `computers-mcp` bin entry — stdio MCP server for the Allternit Computers API.
 *
 * Env:
 *   ALLTERNIT_API_URL  base URL of allternit-api (default http://127.0.0.1:8013)
 *   ALLTERNIT_TOKEN    Clerk bearer token (Authorization header)
 */
import { runComputersMcpServer } from './server.js';

runComputersMcpServer().catch((error) => {
  console.error('computers-mcp failed to start:', error);
  process.exit(1);
});
