/**
 * A2R Gateway - stdio Transport Contract Tests
 * 
 * Tests for JSON-RPC 2.0 over stdin/stdout.
 * Verifies protocol conformance and message handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GATEWAY_PATH = join(__dirname, '../index.ts');

// =============================================================================
// Test Helpers
// =============================================================================

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id?: string | number;
  method?: string;
  params?: unknown;
}

class StdioClient {
  private gateway: ChildProcess;
  private rl: ReturnType<typeof createInterface> | null = null;
  private pendingRequests: Map<string | number, {
    resolve: (responses: JsonRpcResponse[]) => void;
    reject: (err: Error) => void;
    responses: JsonRpcResponse[];
  }> = new Map();
  private notificationHandlers: Array<(notification: JsonRpcResponse) => void> = [];

  constructor() {
    this.gateway = spawn('tsx', [GATEWAY_PATH, '--transport', 'stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.rl = createInterface({
      input: this.gateway.stdout,
      terminal: false,
    });

    this.rl.on('line', (line) => this.handleLine(line));
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;

    try {
      const data: JsonRpcResponse = JSON.parse(line);

      if (data.id !== undefined && this.pendingRequests.has(data.id)) {
        const pending = this.pendingRequests.get(data.id)!;
        pending.responses.push(data);

        // Resolve if it's a response (not a notification)
        if (data.result !== undefined || data.error !== undefined) {
          this.pendingRequests.delete(data.id);
          pending.resolve(pending.responses);
        }
      } else if (data.id === undefined) {
        // Notification
        this.notificationHandlers.forEach(handler => handler(data));
      }
    } catch {
      // Ignore non-JSON lines (logs, etc.)
    }
  }

  async request(method: string, params: Record<string, unknown> = {}, id?: string | number): Promise<JsonRpcResponse> {
    const requestId = id ?? `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${method}`));
      }, 10000);

      this.pendingRequests.set(requestId, {
        resolve: (responses) => {
          clearTimeout(timeout);
          resolve(responses[0]);
        },
        reject,
        responses: [],
      });

      const request = {
        jsonrpc: '2.0' as const,
        method,
        params,
        id: requestId,
      };

      this.gateway.stdin?.write(JSON.stringify(request) + '\n');
    });
  }

  onNotification(handler: (notification: JsonRpcResponse) => void): () => void {
    this.notificationHandlers.push(handler);
    return () => {
      const index = this.notificationHandlers.indexOf(handler);
      if (index !== -1) this.notificationHandlers.splice(index, 1);
    };
  }

  async close(): Promise<void> {
    this.rl?.close();
    this.gateway.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('A2R Gateway stdio Transport', () => {
  let client: StdioClient;

  beforeAll(async () => {
    client = new StdioClient();
    // Wait for gateway to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 15000);

  afterAll(async () => {
    await client?.close();
  });

  describe('Protocol Conformance', () => {
    it('uses JSON-RPC 2.0 format', async () => {
      const response = await client.request('health/check');
      expect(response.jsonrpc).toBe('2.0');
    });

    it('includes id in responses matching request id', async () => {
      const customId = 'test_123';
      const response = await client.request('health/check', {}, customId);
      expect(response.id).toBe(customId);
    });
  });

  describe('Health & Discovery', () => {
    it('health/check returns healthy status', async () => {
      const response = await client.request('health/check');
      
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      
      const result = response.result as Record<string, unknown>;
      expect(result.status).toBe('healthy');
      expect(result.service).toBe('a2r-gateway');
      expect(result.version).toBe('1.0.0');
    });

    it('health/check returns backends status', async () => {
      const response = await client.request('health/check');
      const result = response.result as Record<string, unknown>;
      
      expect(result.backends).toBeDefined();
      expect(typeof result.backends).toBe('object');
    });

    it('discovery/get returns gateway info', async () => {
      const response = await client.request('discovery/get');
      
      expect(response.error).toBeUndefined();
      const result = response.result as Record<string, unknown>;
      
      expect(result.gateway).toBeDefined();
      expect((result.gateway as Record<string, unknown>).version).toBe('1.0.0');
    });

    it('discovery/get returns services array', async () => {
      const response = await client.request('discovery/get');
      const result = response.result as Record<string, unknown>;
      
      expect(result.services).toBeDefined();
      expect(Array.isArray(result.services)).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('session/create returns sessionId', async () => {
      const response = await client.request('session/create', {
        profile_id: 'test_profile',
        capsules: ['browser', 'terminal'],
        timeout: 3600000,
      });

      expect(response.error).toBeUndefined();
      const result = response.result as Record<string, unknown>;
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.profile_id).toBe('test_profile');
    });

    it('session/get returns session for valid id', async () => {
      // First create a session
      const createResponse = await client.request('session/create', {
        profile_id: 'test_profile_2',
      });
      const sessionId = (createResponse.result as Record<string, unknown>).id as string;

      // Then get it
      const getResponse = await client.request('session/get', { session_id: sessionId });
      
      expect(getResponse.error).toBeUndefined();
      const result = getResponse.result as Record<string, unknown>;
      expect(result.id).toBe(sessionId);
    });

    it('session/get returns error for invalid id', async () => {
      const response = await client.request('session/get', {
        session_id: 'invalid_session_id',
      });

      expect(response.result).toBeNull();
    });

    it('session/list returns sessions array', async () => {
      const response = await client.request('session/list');
      
      expect(response.error).toBeUndefined();
      const result = response.result as Record<string, unknown>;
      expect(result.sessions).toBeDefined();
      expect(Array.isArray(result.sessions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('returns method not found for unknown method', async () => {
      const response = await client.request('unknown/method');
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // Method not found
      expect(response.error?.message).toContain('unknown/method');
    });

    it('includes error message in response', async () => {
      const response = await client.request('invalid/method');
      
      expect(response.error?.message).toBeDefined();
      expect(typeof response.error?.message).toBe('string');
    });
  });

  describe('Event Notifications', () => {
    it('receives notifications from event bus', async () => {
      const notifications: JsonRpcResponse[] = [];
      const unsubscribe = client.onNotification((n) => notifications.push(n));

      try {
        // Trigger an event by creating a session
        await client.request('session/create', {
          profile_id: 'test_profile_events',
        });

        // Give time for events to be published
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should have received session.created notification
        const sessionCreated = notifications.find(n => n.method === 'session/created');
        expect(sessionCreated).toBeDefined();
        
        unsubscribe();
      } finally {
        unsubscribe();
      }
    });
  });
});
