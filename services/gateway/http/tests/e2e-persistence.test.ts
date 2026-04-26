/**
 * Allternit Gateway - E2E Persistence Test
 * 
 * Verifies complete flow:
 * session.create → prompt_async → wait complete → GET session → verify final state
 * 
 * This test ensures determinism is preserved end-to-end.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GATEWAY_PATH = join(__dirname, '../index.ts');
const HTTP_PORT = 3296;

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

function parseSSEEvents(rawText: string): Array<{ data: unknown }> {
  const events: Array<{ data: unknown }> = [];
  const blocks = rawText.split('\n\n');
  
  for (const block of blocks) {
    if (!block.trim()) continue;
    
    for (const line of block.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          events.push({ data: JSON.parse(line.slice(6)) });
        } catch {
          events.push({ data: line.slice(6) });
        }
      }
    }
  }
  
  return events;
}

// =============================================================================
// E2E Tests
// =============================================================================

describe('Allternit Gateway - E2E Persistence Tests', () => {
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

  describe('Complete Flow: session.create → prompt_async → GET session', () => {
    it('verifies final state persisted after prompt execution', async () => {
      // Step 1: Create session
      const createResponse = await httpRequest({
        path: '/session',
        method: 'POST',
        body: {
          profile_id: 'e2e_test_profile',
          directory: '/e2e/test',
          metadata: { test: 'persistence' },
        },
      });

      expect(createResponse.statusCode).toBe(200);
      const session = JSON.parse(createResponse.body);
      expect(session.id).toBeDefined();
      expect(session.directory).toBe('/e2e/test');

      // Step 2: Subscribe to SSE before triggering prompt
      const sseEventsPromise = new Promise<Array<{ data: unknown }>>((resolve) => {
        const events: Array<{ data: unknown }> = [];
        const req = http.get(
          {
            hostname: '127.0.0.1',
            port: HTTP_PORT,
            path: `/global/event?directory=/e2e/test`,
            headers: { Accept: 'text/event-stream' },
          },
          (res) => {
            res.on('data', (chunk) => {
              const parsed = parseSSEEvents(chunk.toString());
              events.push(...parsed);
            });
          }
        );

        // Trigger prompt_async after 100ms
        setTimeout(async () => {
          await httpRequest({
            path: `/session/${session.id}/prompt_async?directory=/e2e/test`,
            method: 'POST',
            body: { text: 'test e2e persistence flow' },
          });
        }, 100);

        // Collect events for 3 seconds then resolve
        setTimeout(() => {
          req.destroy();
          resolve(events);
        }, 3000);
      });

      // Wait for SSE events
      const events = await sseEventsPromise;

      // Step 3: Verify event ordering (determinism check)
      // PART_CREATED must come before any PART_DELTA
      let partCreatedIndex = -1;
      let firstPartDeltaIndex = -1;

      for (let i = 0; i < events.length; i++) {
        const payload = (events[i].data as Record<string, any>)?.payload;
        if (payload?.type === 'PART_CREATED' && partCreatedIndex === -1) {
          partCreatedIndex = i;
        }
        if (payload?.type === 'PART_DELTA' && firstPartDeltaIndex === -1) {
          firstPartDeltaIndex = i;
        }
      }

      expect(partCreatedIndex).toBeGreaterThanOrEqual(0);
      expect(firstPartDeltaIndex).toBeGreaterThanOrEqual(0);
      expect(partCreatedIndex).toBeLessThan(firstPartDeltaIndex);

      // Step 4: Verify SESSION_STATUS_CHANGED events
      const statusChanges = events.filter(e => {
        const payload = (e.data as Record<string, any>)?.payload;
        return payload?.type === 'SESSION_STATUS_CHANGED';
      });

      expect(statusChanges.length).toBeGreaterThanOrEqual(2);

      // First status change should be active → running
      const firstStatusChange = statusChanges[0].data as Record<string, any>;
      expect(firstStatusChange.payload.properties.old_status).toBe('active');
      expect(firstStatusChange.payload.properties.new_status).toBe('running');

      // Last status change should be running → idle
      const lastStatusChange = statusChanges[statusChanges.length - 1].data as Record<string, any>;
      expect(lastStatusChange.payload.properties.old_status).toBe('running');
      expect(lastStatusChange.payload.properties.new_status).toBe('idle');

      // Step 5: GET session and verify final state
      const getResponse = await httpRequest({
        path: `/session/${session.id}?directory=/e2e/test`,
      });

      expect(getResponse.statusCode).toBe(200);
      const finalSession = JSON.parse(getResponse.body);

      // Verify session persisted with correct final state
      expect(finalSession.id).toBe(session.id);
      expect(finalSession.status).toBe('idle');
      expect(finalSession.directory).toBe('/e2e/test');
      expect(finalSession.metadata).toEqual({ test: 'persistence' });
    }, 10000);

    it('verifies multiple sessions maintain isolated state', async () => {
      // Create two sessions in different directories
      const session1Response = await httpRequest({
        path: '/session',
        method: 'POST',
        body: { profile_id: 'multi_test', directory: '/dir1' },
      });
      const session1 = JSON.parse(session1Response.body);

      const session2Response = await httpRequest({
        path: '/session',
        method: 'POST',
        body: { profile_id: 'multi_test', directory: '/dir2' },
      });
      const session2 = JSON.parse(session2Response.body);

      // Trigger prompts in both sessions
      await Promise.all([
        httpRequest({
          path: `/session/${session1.id}/prompt_async?directory=/dir1`,
          method: 'POST',
          body: { text: 'session 1 text' },
        }),
        httpRequest({
          path: `/session/${session2.id}/prompt_async?directory=/dir2`,
          method: 'POST',
          body: { text: 'session 2 text' },
        }),
      ]);

      // Wait for events to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify session 1 state
      const get1Response = await httpRequest({
        path: `/session/${session1.id}?directory=/dir1`,
      });
      const final1 = JSON.parse(get1Response.body);
      expect(final1.status).toBe('idle');
      expect(final1.directory).toBe('/dir1');

      // Verify session 2 state
      const get2Response = await httpRequest({
        path: `/session/${session2.id}?directory=/dir2`,
      });
      const final2 = JSON.parse(get2Response.body);
      expect(final2.status).toBe('idle');
      expect(final2.directory).toBe('/dir2');

      // Verify directory isolation - session 1 not visible from dir2
      const crossDirResponse = await httpRequest({
        path: `/session/${session1.id}?directory=/dir2`,
      });
      expect(crossDirResponse.statusCode).toBe(404);
    });
  });

  describe('PTY Lifecycle with Event Verification', () => {
    it('creates PTY → sends input → kills → verifies PTY_EXITED event', async () => {
      // Subscribe to SSE for PTY_EXITED
      const ptyExitPromise = new Promise<boolean>((resolve) => {
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
          // Create PTY
          const createResponse = await httpRequest({
            path: '/pty',
            method: 'POST',
            body: { directory: '/pty/test' },
          });
          const pty = JSON.parse(createResponse.body);

          // Send input
          await httpRequest({
            path: `/pty/${pty.id}`,
            method: 'PUT',
            body: { input: 'echo hello\n' },
          });

          // Kill PTY
          await httpRequest({
            path: `/pty/${pty.id}`,
            method: 'DELETE',
          });
        }, 100);

        setTimeout(() => {
          req.destroy();
          resolve(found);
        }, 3000);
      });

      const ptyExited = await ptyExitPromise;
      expect(ptyExited).toBe(true);
    });
  });

  describe('SSE Wire Format Compliance', () => {
    it('verifies SERVER_CONNECTED has correct envelope format', async () => {
      const response = await httpRequest({
        path: '/global/event?directory=/format/test',
        headers: { Accept: 'text/event-stream' },
      });

      const events = parseSSEEvents(response.body);
      expect(events.length).toBeGreaterThan(0);

      // First event should be SERVER_CONNECTED with correct format
      const firstEvent = events[0].data as Record<string, any>;
      
      // Must have directory and payload wrapper
      expect(firstEvent.directory).toBeDefined();
      expect(firstEvent.payload).toBeDefined();
      expect(firstEvent.payload.type).toBe('SERVER_CONNECTED');
      expect(firstEvent.payload.properties).toBeDefined();
      expect(firstEvent.payload.properties.directory).toBe('/format/test');
    });

    it('verifies SERVER_HEARTBEAT has correct envelope format', async () => {
      const response = await httpRequest({
        path: '/global/event',
        headers: { Accept: 'text/event-stream' },
      });

      const events = parseSSEEvents(response.body);
      
      // Find heartbeat event
      const heartbeatEvent = events.find(e => {
        const data = e.data as Record<string, any>;
        return data.payload?.type === 'SERVER_HEARTBEAT';
      });

      expect(heartbeatEvent).toBeDefined();
      
      const heartbeatData = heartbeatEvent!.data as Record<string, any>;
      expect(heartbeatData.directory).toBeDefined();
      expect(heartbeatData.payload.type).toBe('SERVER_HEARTBEAT');
      expect(heartbeatData.payload.properties).toBeDefined();
      expect(heartbeatData.payload.properties.timestamp).toBeDefined();
    });
  });
});
