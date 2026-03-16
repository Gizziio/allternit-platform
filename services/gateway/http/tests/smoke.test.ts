/**
 * A2R Gateway - Smoke Tests
 * 
 * End-to-end tests for both transports:
 * - stdio: spawn gateway, send prompt, receive streamed response
 * - HTTP: start server, call stream endpoint, receive streamed response
 */

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GATEWAY_PATH = join(__dirname, '../index.ts');
const HTTP_PORT = 3298;

// =============================================================================
// stdio Smoke Tests
// =============================================================================

describe('A2R Gateway Smoke Tests - stdio', () => {
  it('completes full flow: spawn → health → discovery → session', async () => {
    // Spawn gateway
    const gateway = spawn('tsx', [GATEWAY_PATH, '--transport', 'stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = createInterface({
      input: gateway.stdout,
      terminal: false,
    });

    // Wait for ready
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 2000);
    });

    try {
      // Helper to send request
      function sendRequest(request: unknown): Promise<unknown> {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
          
          const listener = (line: string) => {
            if (!line.trim()) return;
            try {
              const data = JSON.parse(line);
              if (data.id !== undefined) {
                rl.removeListener('line', listener);
                clearTimeout(timeout);
                resolve(data);
              }
            } catch {
              // Ignore
            }
          };
          
          rl.on('line', listener);
          gateway.stdin?.write(JSON.stringify(request) + '\n');
        });
      }

      // Step 1: Health check
      const healthResponse = await sendRequest({
        jsonrpc: '2.0',
        method: 'health/check',
        params: {},
        id: 'smoke_1',
      }) as Record<string, unknown>;

      expect(healthResponse.result).toBeDefined();
      expect((healthResponse.result as Record<string, unknown>).status).toBe('healthy');

      // Step 2: Discovery
      const discoveryResponse = await sendRequest({
        jsonrpc: '2.0',
        method: 'discovery/get',
        params: {},
        id: 'smoke_2',
      }) as Record<string, unknown>;

      expect(discoveryResponse.result).toBeDefined();
      const discovery = discoveryResponse.result as Record<string, unknown>;
      expect(discovery.gateway).toBeDefined();
      expect(Array.isArray(discovery.services)).toBe(true);

      // Step 3: Session create
      const sessionResponse = await sendRequest({
        jsonrpc: '2.0',
        method: 'session/create',
        params: { profile_id: 'smoke_test', capsules: ['browser'] },
        id: 'smoke_3',
      }) as Record<string, unknown>;

      expect(sessionResponse.result).toBeDefined();
      const session = sessionResponse.result as Record<string, unknown>;
      expect(session.id).toBeDefined();
      expect(session.profile_id).toBe('smoke_test');

    } finally {
      rl.close();
      gateway.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }, 20000);
});

// =============================================================================
// HTTP Smoke Tests
// =============================================================================

describe('A2R Gateway Smoke Tests - HTTP', () => {
  let gateway: ReturnType<typeof spawn>;

  beforeAll(async () => {
    gateway = spawn('tsx', [GATEWAY_PATH, '--transport', 'http', '--port', String(HTTP_PORT)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait for ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Startup timeout')), 10000);
      gateway.stderr?.on('data', (data) => {
        if (data.toString().includes('Listening')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }, 15000);

  afterAll(() => {
    gateway?.kill('SIGTERM');
  });

  function httpRequest(options: {
    path: string;
    method?: string;
    body?: unknown;
  }): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: HTTP_PORT,
          path: options.path,
          method: options.method || 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 500,
              body: Buffer.concat(chunks).toString(),
              headers: res.headers as Record<string, string>,
            });
          });
        }
      );
      req.on('error', reject);
      if (options.body) req.write(JSON.stringify(options.body));
      req.end();
    });
  }

  it('completes full flow: boot → health → discovery → session → events', async () => {
    // Step 1: Health check (simulates UI boot check)
    const healthResponse = await httpRequest({ path: '/health' });
    expect(healthResponse.statusCode).toBe(200);
    
    const health = JSON.parse(healthResponse.body);
    expect(health.status).toBe('healthy');

    // Step 2: Discovery (simulates UI discovering services)
    const discoveryResponse = await httpRequest({ path: '/v1/discovery' });
    expect(discoveryResponse.statusCode).toBe(200);
    
    const discovery = JSON.parse(discoveryResponse.body);
    expect(discovery.gateway).toBeDefined();
    expect(Array.isArray(discovery.services)).toBe(true);

    // Step 3: Create session (simulates UI creating session)
    const sessionResponse = await httpRequest({
      path: '/v1/sessions',
      method: 'POST',
      body: { profile_id: 'smoke_test', capsules: ['browser'] },
    });
    expect(sessionResponse.statusCode).toBe(200);
    
    const session = JSON.parse(sessionResponse.body);
    expect(session.id).toBeDefined();
    expect(session.profile_id).toBe('smoke_test');

    // Step 4: SSE connection (simulates UI connecting to event stream)
    const sseResponse = await httpRequest({
      path: '/v1/events',
    });
    expect(sseResponse.statusCode).toBe(200);
    expect(sseResponse.body).toContain('event: connected');

    // Parse SSE events
    const events = sseResponse.body.split('\n\n')
      .filter(block => block.trim())
      .map(block => {
        const lines = block.split('\n');
        const event: { type?: string; data?: unknown } = {};
        for (const line of lines) {
          if (line.startsWith('event: ')) event.type = line.slice(7);
          if (line.startsWith('data: ')) event.data = JSON.parse(line.slice(6));
        }
        return event;
      });

    const connectedEvent = events.find(e => e.type === 'connected');
    expect(connectedEvent).toBeDefined();
    expect((connectedEvent?.data as Record<string, unknown>)?.session_id).toBeDefined();

    // Step 5: Verify request tracing
    expect(healthResponse.headers['x-request-id']).toBeDefined();
    expect(discoveryResponse.headers['x-request-id']).toBeDefined();
    expect(sessionResponse.headers['x-request-id']).toBeDefined();
  }, 20000);

  it('handles concurrent requests correctly', async () => {
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(httpRequest({ path: '/health' }));
    }

    const responses = await Promise.all(requests);
    
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBeDefined();
    }
  });
});
