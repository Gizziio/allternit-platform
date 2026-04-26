#!/usr/bin/env node
/**
 * Mock gizzi-code - ACP server replacement
 * This is a temporary replacement until the real gizzi-code binary is fixed
 */

const http = require('http');
const crypto = require('crypto');

const args = process.argv.slice(2);
const command = args[0];

if (command !== 'acp') {
  console.log('gizzi-code mock - only supports "acp" command');
  process.exit(1);
}

// Parse flags
let PORT = 4096;
let HOSTNAME = '127.0.0.1';

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    PORT = parseInt(args[i + 1], 10);
    i++;
  }
  if (args[i] === '--hostname' && args[i + 1]) {
    HOSTNAME = args[i + 1];
    i++;
  }
}

const PASSWORD = process.env.GIZZI_PASSWORD || crypto.randomBytes(16).toString('hex');

console.log('[AgentCommunicationRuntime] Initializing...');
console.log('[AgentCommunicationRuntime] Initialized successfully');

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Auth check (Basic auth: gizzi:password)
  const authHeader = req.headers.authorization || '';
  const expectedToken = Buffer.from(`gizzi:${PASSWORD}`).toString('base64');
  const expectedAuth = `Basic ${expectedToken}`;
  
  const isHealthCheck = req.url === '/health' || req.url === '/api/app/health';
  
  // Allow health checks without auth
  if (!isHealthCheck && authHeader !== expectedAuth) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  console.log(`[gizzi] ${req.method} ${req.url}`);

  // Health endpoint
  if (req.url === '/health' || req.url === '/api/app/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '1.0.0-mock' }));
    return;
  }

  // Sessions list
  if (req.url === '/api/sessions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessions: [] }));
    return;
  }

  // Version
  if (req.url === '/api/version') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ version: '1.0.0-mock' }));
    return;
  }

  // Default
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ mock: true, endpoint: req.url }));
});

server.listen(PORT, HOSTNAME, () => {
  console.log(`[gizzi-code] Mock ACP server running on http://${HOSTNAME}:${PORT}`);
  console.log(`[gizzi-code] Password: ${PASSWORD.substring(0, 8)}...`);
});

// Keep alive
process.on('SIGTERM', () => {
  console.log('[gizzi-code] Shutting down...');
  server.close(() => process.exit(0));
});

// Keep process alive
setInterval(() => {}, 1000);
