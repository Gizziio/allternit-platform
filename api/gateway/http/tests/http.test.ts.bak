/**
 * A2R Gateway - HTTP Transport Contract Tests
 * 
 * Tests for Streamable HTTP endpoints.
 * Verifies REST API conformance and streaming responses.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GATEWAY_PATH = join(__dirname, '../index.ts');
const PORT = 3299; // Use non-standard port to avoid conflicts
const BASE_URL = `http://127.0.0.1:${PORT}`;

// =============================================================================
// Test Helpers
// =============================================================================

interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function httpRequest(options: {
  path: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: options.path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            headers: res.headers as Record<string, string>,
            body: Buffer.concat(chunks).toString(),
          });
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

function parseSSEEvents(rawText: string): Array<{ type: string; data: unknown }> {
  const events: Array<{ type: string; data: unknown }> = [];
  const lines = rawText.split('\n');
  let currentEvent = { type: 'message', data: '' };

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent.type = line.slice(7);
    } else if (line.startsWith('data: ')) {
      currentEvent.data += line.slice(6);
    } else if (line === '' && currentEvent.data) {
      try {
        events.push({
          type: currentEvent.type,
          data: JSON.parse(currentEvent.data),
        });
      } catch {
        events.push({
          type: currentEvent.type,
          data: currentEvent.data,
        });
      }
      currentEvent = { type: 'message', data: '' };
    }
  }

  // Handle last event
  if (currentEvent.data) {
    try {
      events.push({
        type: currentEvent.type,
        data: JSON.parse(currentEvent.data),
      });
    } catch {
      events.push({
        type: currentEvent.type,
        data: currentEvent.data,
      });
    }
  }

  return events;
}

// =============================================================================
// Tests
// =============================================================================

describe('A2R Gateway HTTP Transport', () => {
  let gateway: ChildProcess;

  beforeAll(async () => {
    gateway = spawn('tsx', [GATEWAY_PATH, '--transport', 'http', '--port', String(PORT)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait for gateway to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Gateway startup timeout')), 10000);
      
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

  describe('Health Endpoints', () => {
    it('GET /health returns 200', async () => {
      const response = await httpRequest({ path: '/health' });
      expect(response.statusCode).toBe(200);
    });

    it('GET /health returns healthy status', async () => {
      const response = await httpRequest({ path: '/health' });
      const data = JSON.parse(response.body);
      
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('a2r-gateway');
      expect(data.version).toBe('1.0.0');
    });

    it('GET /health includes backends', async () => {
      const response = await httpRequest({ path: '/health' });
      const data = JSON.parse(response.body);
      
      expect(data.backends).toBeDefined();
      expect(typeof data.backends).toBe('object');
    });
  });

  describe('Discovery Endpoint', () => {
    it('GET /v1/discovery returns 200', async () => {
      const response = await httpRequest({ path: '/v1/discovery' });
      expect(response.statusCode).toBe(200);
    });

    it('GET /v1/discovery returns gateway info', async () => {
      const response = await httpRequest({ path: '/v1/discovery' });
      const data = JSON.parse(response.body);
      
      expect(data.gateway).toBeDefined();
      expect(data.gateway.version).toBe('1.0.0');
    });

    it('GET /v1/discovery returns services array', async () => {
      const response = await httpRequest({ path: '/v1/discovery' });
      const data = JSON.parse(response.body);
      
      expect(data.services).toBeDefined();
      expect(Array.isArray(data.services)).toBe(true);
    });
  });

  describe('SSE Events Endpoint', () => {
    it('GET /v1/events returns SSE content-type', async () => {
      const response = await httpRequest({
        path: '/v1/events',
        headers: { Accept: 'text/event-stream' },
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    it('GET /v1/events sends connected event', async () => {
      const response = await httpRequest({
        path: '/v1/events',
        headers: { Accept: 'text/event-stream' },
      });
      
      const events = parseSSEEvents(response.body);
      const connectedEvent = events.find(e => e.type === 'connected');
      
      expect(connectedEvent).toBeDefined();
      expect((connectedEvent?.data as Record<string, unknown>)?.session_id).toBeDefined();
    });
  });

  describe('Request Tracing', () => {
    it('responses include X-Request-ID header', async () => {
      const response = await httpRequest({ path: '/health' });
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('responses include X-Gateway-Version header', async () => {
      const response = await httpRequest({ path: '/health' });
      expect(response.headers['x-gateway-version']).toBe('1.0.0');
    });

    it('preserves incoming X-Request-ID', async () => {
      const customId = 'test-request-123';
      const response = await httpRequest({
        path: '/health',
        headers: { 'X-Request-ID': customId },
      });
      
      expect(response.headers['x-request-id']).toBe(customId);
    });
  });

  describe('CORS Headers', () => {
    it('OPTIONS request returns CORS headers', async () => {
      const response = await httpRequest({
        path: '/health',
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5177',
          'Access-Control-Request-Method': 'GET',
        },
      });
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Session Operations', () => {
    it('POST /v1/sessions creates session', async () => {
      const response = await httpRequest({
        path: '/v1/sessions',
        method: 'POST',
        body: {
          profile_id: 'test_profile',
          capsules: ['browser'],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBeDefined();
      expect(data.profile_id).toBe('test_profile');
    });

    it('GET /v1/sessions lists sessions', async () => {
      const response = await httpRequest({ path: '/v1/sessions' });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.sessions).toBeDefined();
      expect(Array.isArray(data.sessions)).toBe(true);
    });

    it('GET /v1/sessions/:id returns session', async () => {
      // First create a session
      const createResponse = await httpRequest({
        path: '/v1/sessions',
        method: 'POST',
        body: { profile_id: 'test_profile_2' },
      });
      const sessionId = JSON.parse(createResponse.body).id;

      // Then get it
      const getResponse = await httpRequest({ path: `/v1/sessions/${sessionId}` });
      
      expect(getResponse.statusCode).toBe(200);
      const data = JSON.parse(getResponse.body);
      expect(data.id).toBe(sessionId);
    });

    it('GET /v1/sessions/:id returns 404 for invalid id', async () => {
      const response = await httpRequest({ path: '/v1/sessions/invalid_id' });
      
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Error Responses', () => {
    it('POST /v1/sessions without profile_id returns 400', async () => {
      const response = await httpRequest({
        path: '/v1/sessions',
        method: 'POST',
        body: {},
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('INVALID_REQUEST');
    });

    it('invalid JSON body returns proper error format', async () => {
      const response = await httpRequest({
        path: '/v1/sessions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json' as unknown as object,
      });

      expect([400, 500]).toContain(response.statusCode);
    });
  });

  describe('SSE Event Ordering', () => {
    it('events follow correct ordering: connected -> ...', async () => {
      const response = await httpRequest({
        path: '/v1/events',
      });

      const events = parseSSEEvents(response.body);
      expect(events.length).toBeGreaterThan(0);

      // First event must be 'connected'
      expect(events[0].type).toBe('connected');
    });
  });
});
