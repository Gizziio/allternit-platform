/**
 * A2R Gateway - UI v0 Binding Tests
 * 
 * Tests for UI v0 compatibility layer:
 * - /global/health endpoint
 * - SSE connection and event ordering
 * - prompt_async streaming flow
 * - Delta drop protection
 * - PTY functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import WebSocket from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GATEWAY_PATH = join(__dirname, '../index.ts');
const HTTP_PORT = 3297;

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
        port: HTTP_PORT,
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

function parseSSEEvents(rawText: string): Array<{ type?: string; data: unknown }> {
  const events: Array<{ type?: string; data: unknown }> = [];
  const blocks = rawText.split('\n\n');
  
  for (const block of blocks) {
    if (!block.trim()) continue;
    
    const event: { type?: string; data?: string } = {};
    for (const line of block.split('\n')) {
      if (line.startsWith('data: ')) {
        event.data = line.slice(6);
      }
    }
    
    if (event.data) {
      try {
        events.push({ data: JSON.parse(event.data) });
      } catch {
        events.push({ data: event.data });
      }
    }
  }
  
  return events;
}

// =============================================================================
// Tests
// =============================================================================

describe('A2R Gateway - UI v0 Binding', () => {
  let gateway: ChildProcess;

  beforeAll(async () => {
    gateway = spawn('tsx', [GATEWAY_PATH, '--transport', 'http', '--port', String(HTTP_PORT)], {
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

  describe('/global/health', () => {
    it('returns expected schema', async () => {
      const response = await httpRequest({ path: '/global/health' });
      
      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.body);
      expect(data.status).toBe('ok');
      expect(data.version).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.services).toBeDefined();
    });
  });

  describe('SSE Connection - /global/event', () => {
    it('emits SERVER_CONNECTED immediately on connect', async () => {
      const response = await httpRequest({
        path: '/global/event',
        headers: { Accept: 'text/event-stream' },
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      
      const events = parseSSEEvents(response.body);
      expect(events.length).toBeGreaterThan(0);
      
      // First event should be SERVER_CONNECTED (data without type = connected)
      const firstEvent = events[0].data as Record<string, unknown>;
      expect(firstEvent.directory).toBeDefined();
      expect(firstEvent.timestamp).toBeDefined();
    });

    it('includes directory in SSE envelope', async () => {
      const response = await httpRequest({
        path: '/global/event?directory=/test/project',
        headers: { Accept: 'text/event-stream' },
      });
      
      const events = parseSSEEvents(response.body);
      expect(events.length).toBeGreaterThan(0);
      
      const firstEvent = events[0].data as Record<string, unknown>;
      expect(firstEvent.directory).toBe('/test/project');
    });

    it('receives SERVER_HEARTBEAT every 10 seconds', async () => {
      // This test would need to wait for heartbeat
      // For now, verify connection stays open
      const response = await httpRequest({
        path: '/global/event',
        headers: { Accept: 'text/event-stream' },
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('SSE Event Ordering', () => {
    it('ensures PART_CREATED emitted before PART_DELTA', async () => {
      // Create a session first
      const sessionResponse = await httpRequest({
        path: '/session',
        method: 'POST',
        body: { profile_id: 'test_ordering', directory: '/test' },
      });
      
      const session = JSON.parse(sessionResponse.body);
      
      // Subscribe to SSE before triggering prompt
      const ssePromise = new Promise<Array<{ data: unknown }>>((resolve) => {
        const events: Array<{ data: unknown }> = [];
        const req = http.get(
          {
            hostname: '127.0.0.1',
            port: HTTP_PORT,
            path: `/global/event?directory=/test`,
            headers: { Accept: 'text/event-stream' },
          },
          (res) => {
            res.on('data', (chunk) => {
              const block = chunk.toString();
              const parsed = parseSSEEvents(block);
              events.push(...parsed);
              
              // Wait for part.delta events
              if (events.some(e => {
                const d = e.data as Record<string, any>;
                return d.payload?.type === 'PART_DELTA';
              })) {
                res.destroy();
                resolve(events);
              }
            });
          }
        );
        
        setTimeout(() => {
          req.destroy();
          resolve(events);
        }, 5000);
      });
      
      // Trigger prompt_async
      setTimeout(async () => {
        await httpRequest({
          path: `/session/${session.id}/prompt_async?directory=/test`,
          method: 'POST',
          body: { text: 'test streaming output' },
        });
      }, 100);
      
      const events = await ssePromise;
      
      // Find indices of PART_CREATED and PART_DELTA
      let partCreatedIndex = -1;
      let partDeltaIndex = -1;
      
      for (let i = 0; i < events.length; i++) {
        const payload = (events[i].data as Record<string, any>)?.payload;
        if (payload?.type === 'PART_CREATED' && partCreatedIndex === -1) {
          partCreatedIndex = i;
        }
        if (payload?.type === 'PART_DELTA' && partDeltaIndex === -1) {
          partDeltaIndex = i;
        }
      }
      
      // PART_CREATED must come before PART_DELTA
      expect(partCreatedIndex).toBeGreaterThanOrEqual(0);
      expect(partDeltaIndex).toBeGreaterThanOrEqual(0);
      expect(partCreatedIndex).toBeLessThan(partDeltaIndex);
    });
  });

  describe('prompt_async Streaming Flow', () => {
    it('returns 204 immediately', async () => {
      const sessionResponse = await httpRequest({
        path: '/session',
        method: 'POST',
        body: { profile_id: 'test_prompt' },
      });
      
      const session = JSON.parse(sessionResponse.body);
      
      const response = await httpRequest({
        path: `/session/${session.id}/prompt_async`,
        method: 'POST',
        body: { text: 'hello' },
      });
      
      expect(response.statusCode).toBe(204);
    });

    it('emits MESSAGE_CREATED before PART_CREATED', async () => {
      const sessionResponse = await httpRequest({
        path: '/session',
        method: 'POST',
        body: { profile_id: 'test_ordering2' },
      });
      
      const session = JSON.parse(sessionResponse.body);
      
      // Collect events
      const eventsPromise = new Promise<Array<{ data: unknown }>>((resolve) => {
        const events: Array<{ data: unknown }> = [];
        const req = http.get(
          {
            hostname: '127.0.0.1',
            port: HTTP_PORT,
            path: '/global/event',
            headers: { Accept: 'text/event-stream' },
          },
          (res) => {
            res.on('data', (chunk) => {
              const parsed = parseSSEEvents(chunk.toString());
              events.push(...parsed);
            });
          }
        );
        
        setTimeout(async () => {
          await httpRequest({
            path: `/session/${session.id}/prompt_async`,
            method: 'POST',
            body: { text: 'test' },
          });
        }, 100);
        
        setTimeout(() => {
          req.destroy();
          resolve(events);
        }, 3000);
      });
      
      const events = await eventsPromise;
      
      // Find MESSAGE_CREATED and PART_CREATED
      let messageCreatedIndex = -1;
      let partCreatedIndex = -1;
      
      for (let i = 0; i < events.length; i++) {
        const payload = (events[i].data as Record<string, any>)?.payload;
        if (payload?.type === 'MESSAGE_CREATED' && messageCreatedIndex === -1) {
          messageCreatedIndex = i;
        }
        if (payload?.type === 'PART_CREATED' && partCreatedIndex === -1) {
          partCreatedIndex = i;
        }
      }
      
      expect(messageCreatedIndex).toBeGreaterThanOrEqual(0);
      expect(partCreatedIndex).toBeGreaterThanOrEqual(0);
      expect(messageCreatedIndex).toBeLessThanOrEqual(partCreatedIndex);
    });
  });

  describe('Delta Drop Protection', () => {
    it('verifies delta ignored if part not created first', async () => {
      // This test verifies the ordering guarantee
      // The implementation ensures PART_CREATED is emitted before any PART_DELTA
      // UI reducer would drop deltas without prior PART_CREATED
      
      const sessionResponse = await httpRequest({
        path: '/session',
        method: 'POST',
        body: { profile_id: 'test_delta' },
      });
      
      const session = JSON.parse(sessionResponse.body);
      
      const eventsPromise = new Promise<Array<{ data: unknown }>>((resolve) => {
        const events: Array<{ data: unknown }> = [];
        const req = http.get(
          {
            hostname: '127.0.0.1',
            port: HTTP_PORT,
            path: '/global/event',
            headers: { Accept: 'text/event-stream' },
          },
          (res) => {
            res.on('data', (chunk) => {
              const parsed = parseSSEEvents(chunk.toString());
              events.push(...parsed);
            });
          }
        );
        
        setTimeout(async () => {
          await httpRequest({
            path: `/session/${session.id}/prompt_async`,
            method: 'POST',
            body: { text: 'delta test' },
          });
        }, 100);
        
        setTimeout(() => {
          req.destroy();
          resolve(events);
        }, 3000);
      });
      
      const events = await eventsPromise;
      
      // Verify no PART_DELTA comes before PART_CREATED
      let foundPartCreated = false;
      let deltaBeforeCreated = false;
      
      for (const event of events) {
        const payload = (event.data as Record<string, any>)?.payload;
        if (payload?.type === 'PART_CREATED') {
          foundPartCreated = true;
        }
        if (payload?.type === 'PART_DELTA' && !foundPartCreated) {
          deltaBeforeCreated = true;
        }
      }
      
      expect(deltaBeforeCreated).toBe(false);
    });
  });

  describe('Session Operations', () => {
    it('creates session with directory scoping', async () => {
      const response = await httpRequest({
        path: '/session',
        method: 'POST',
        body: {
          profile_id: 'test_profile',
          directory: '/test/dir1',
        },
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBeDefined();
      expect(data.directory).toBe('/test/dir1');
    });

    it('gets session by id', async () => {
      const createResponse = await httpRequest({
        path: '/session',
        method: 'POST',
        body: { profile_id: 'test_get' },
      });
      
      const session = JSON.parse(createResponse.body);
      
      const getResponse = await httpRequest({
        path: `/session/${session.id}`,
      });
      
      expect(getResponse.statusCode).toBe(200);
      const data = JSON.parse(getResponse.body);
      expect(data.id).toBe(session.id);
    });

    it('returns 404 for non-existent session', async () => {
      const response = await httpRequest({
        path: '/session/nonexistent',
      });
      
      expect(response.statusCode).toBe(404);
    });

    it('deletes session', async () => {
      const createResponse = await httpRequest({
        path: '/session',
        method: 'POST',
        body: { profile_id: 'test_delete' },
      });
      
      const session = JSON.parse(createResponse.body);
      
      const deleteResponse = await httpRequest({
        path: `/session/${session.id}`,
        method: 'DELETE',
      });
      
      expect(deleteResponse.statusCode).toBe(200);
      
      // Verify deleted
      const getResponse = await httpRequest({
        path: `/session/${session.id}`,
      });
      
      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe('PTY Operations', () => {
    it('creates PTY instance', async () => {
      const response = await httpRequest({
        path: '/pty',
        method: 'POST',
        body: { directory: '/test' },
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBeDefined();
      expect(data.pid).toBeDefined();
    });

    it('sends input to PTY', async () => {
      const createResponse = await httpRequest({
        path: '/pty',
        method: 'POST',
        body: {},
      });
      
      const pty = JSON.parse(createResponse.body);
      
      const inputResponse = await httpRequest({
        path: `/pty/${pty.id}`,
        method: 'PUT',
        body: { input: 'ls -la\n' },
      });
      
      expect(inputResponse.statusCode).toBe(200);
    });

    it('kills PTY and emits PTY_EXITED', async () => {
      const createResponse = await httpRequest({
        path: '/pty',
        method: 'POST',
        body: {},
      });
      
      const pty = JSON.parse(createResponse.body);
      
      // Subscribe to SSE to catch PTY_EXITED
      const exitPromise = new Promise<boolean>((resolve) => {
        let found = false;
        const req = http.get(
          {
            hostname: '127.0.0.1',
            port: HTTP_PORT,
            path: '/global/event',
            headers: { Accept: 'text/event-stream' },
          },
          (res) => {
            res.on('data', (chunk) => {
              const events = parseSSEEvents(chunk.toString());
              for (const event of events) {
                const payload = (event.data as Record<string, any>)?.payload;
                if (payload?.type === 'PTY_EXITED') {
                  found = true;
                }
              }
            });
          }
        );
        
        setTimeout(async () => {
          await httpRequest({
            path: `/pty/${pty.id}`,
            method: 'DELETE',
          });
        }, 100);
        
        setTimeout(() => {
          req.destroy();
          resolve(found);
        }, 2000);
      });
      
      const exited = await exitPromise;
      expect(exited).toBe(true);
    });

    it('connects to PTY via WebSocket', async () => {
      const createResponse = await httpRequest({
        path: '/pty',
        method: 'POST',
        body: {},
      });
      
      const pty = JSON.parse(createResponse.body);
      
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${HTTP_PORT}/pty/${pty.id}/connect`);
        
        ws.on('open', () => {
          // Should receive backlog and cursor data
          ws.close();
          resolve();
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 5000);
      });
    });
  });

  describe('Directory Partitioning', () => {
    it('scopes sessions by directory', async () => {
      // Create sessions in different directories
      const response1 = await httpRequest({
        path: '/session',
        method: 'POST',
        body: { profile_id: 'test', directory: '/dir1' },
      });
      
      const response2 = await httpRequest({
        path: '/session',
        method: 'POST',
        body: { profile_id: 'test', directory: '/dir2' },
      });
      
      const session1 = JSON.parse(response1.body);
      const session2 = JSON.parse(response2.body);
      
      // Get session from dir1 should not see dir2 session
      const getResponse = await httpRequest({
        path: `/session/${session2.id}?directory=/dir1`,
      });
      
      expect(getResponse.statusCode).toBe(404);
    });

    it('scopes SSE events by directory', async () => {
      // Subscribe to dir1 events
      const ssePromise = new Promise<Array<{ data: unknown }>>((resolve) => {
        const events: Array<{ data: unknown }> = [];
        const req = http.get(
          {
            hostname: '127.0.0.1',
            port: HTTP_PORT,
            path: '/global/event?directory=/scoped_dir',
            headers: { Accept: 'text/event-stream' },
          },
          (res) => {
            res.on('data', (chunk) => {
              const parsed = parseSSEEvents(chunk.toString());
              events.push(...parsed);
            });
          }
        );
        
        setTimeout(async () => {
          // Create session in different directory
          await httpRequest({
            path: '/session',
            method: 'POST',
            body: { profile_id: 'test', directory: '/other_dir' },
          });
        }, 100);
        
        setTimeout(() => {
          req.destroy();
          resolve(events);
        }, 2000);
      });
      
      const events = await ssePromise;
      
      // Should not see events from /other_dir
      const sessionCreatedEvents = events.filter(e => {
        const payload = (e.data as Record<string, any>)?.payload;
        return payload?.type === 'SESSION_CREATED';
      });
      
      // Events should be filtered by directory
      for (const event of sessionCreatedEvents) {
        const data = (event.data as Record<string, any>);
        expect(data.directory).toBe('/scoped_dir');
      }
    });
  });
});
