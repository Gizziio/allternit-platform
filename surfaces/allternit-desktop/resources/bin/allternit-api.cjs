#!/usr/bin/env node
/**
 * Mock allternit-api - development stand-in for the Rust backend
 * Returns well-formed empty responses so the platform UI doesn't crash.
 */

const http = require('http');

const PORT = process.env.ALLTERNIT_API_PORT || 8013;
const API_KEY = process.env.ALLTERNIT_OPERATOR_API_KEY || 'mock-key';

function emptyResponse(url) {
  // Return sensible empty structures based on endpoint patterns
  if (url.includes('/agents')) {
    return { agents: [], total: 0, page: 1, pageSize: 50 };
  }
  if (url.includes('/sessions')) {
    return { sessions: [], total: 0, page: 1, pageSize: 50 };
  }
  if (url.includes('/wihs') || url.includes('/rails/')) {
    return { wihs: [], myWihs: [], total: 0 };
  }
  if (url.includes('/providers')) {
    return { providers: [], authStatus: {}, total: 0 };
  }
  if (url.includes('/agent-sessions')) {
    return { sessions: [], total: 0 };
  }
  if (url.includes('/events') || url.includes('/event')) {
    return { events: [], total: 0 };
  }
  if (url.includes('/user') || url.includes('/profile')) {
    return { id: 'desktop-user', name: 'Desktop User', email: 'user@localhost', mode: 'desktop' };
  }
  if (url.includes('/capabilities')) {
    return { features: ['chat', 'agents', 'sessions'], executionModes: ['local'], vm: { enabled: false } };
  }
  if (url.includes('/status')) {
    return { status: 'running', backend: 'mock', timestamp: Date.now() };
  }
  if (url.includes('/version')) {
    return { version: '0.1.0-mock', mode: 'desktop-mock' };
  }
  // Generic empty object for unknown endpoints
  return { mock: true, endpoint: url, data: [] };
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-version, x-api-key, x-request-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`[allternit-api] ${req.method} ${req.url}`);

  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '0.1.0-mock', timestamp: new Date().toISOString() }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(emptyResponse(req.url)));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[allternit-api] Mock server running on http://127.0.0.1:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[allternit-api] Shutting down...');
  server.close(() => process.exit(0));
});
