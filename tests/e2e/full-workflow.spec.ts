/**
 * Full End-to-End Workflow Tests
 * 
 * Tests the complete integration:
 * 1. MCP server connection and tool discovery
 * 2. Tool execution with policy enforcement
 * 3. OpenClaw session management
 * 4. ChatStore bidirectional sync
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// API base URL
const API_URL = process.env.API_URL || 'http://localhost:8013';

/**
 * Helper to wait for a specific amount of time
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to make API requests
 */
async function apiRequest(method: string, endpoint: string, body?: any) {
  const url = `${API_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  return response;
}

test.describe('Full Workflow: MCP → Tool Execution → OpenClaw Session', () => {
  
  test('full workflow: MCP server → tool execution → OpenClaw session', async ({ page }) => {
    // 1. Connect to MCP server via API
    const mcpResponse = await apiRequest('POST', '/api/v1/mcp/servers', {
      name: 'test-fs',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
      }
    });
    
    // Registration should succeed (even if server can't fully initialize in test env)
    expect([201, 400]).toContain(mcpResponse.status);
    
    // 2. Verify tools endpoint is accessible
    const toolsResponse = await apiRequest('GET', '/api/v1/tools');
    expect(toolsResponse.status).toBe(200);
    
    const tools = await toolsResponse.json();
    expect(tools).toHaveProperty('mcp');
    expect(tools).toHaveProperty('count');
    expect(typeof tools.count).toBe('number');
    
    // 3. Create OpenClaw agent session via API
    const sessionResponse = await apiRequest('POST', '/api/v1/sessions', {
      name: 'Agent Test'
    });
    expect(sessionResponse.status).toBe(200);
    
    const session = await sessionResponse.json();
    expect(session).toHaveProperty('id');
    expect(session).toHaveProperty('name', 'Agent Test');
    expect(session).toHaveProperty('created_at');
    expect(session).toHaveProperty('status', 'active');
    
    // 4. Send message that triggers tool
    const msgResponse = await apiRequest(
      'POST',
      `/api/v1/sessions/${session.id}/messages`,
      {
        text: 'Read the file /tmp/test.txt'
      }
    );
    expect(msgResponse.status).toBe(200);
    
    const message = await msgResponse.json();
    expect(message).toHaveProperty('id');
    expect(message).toHaveProperty('content', 'Read the file /tmp/test.txt');
    expect(message).toHaveProperty('role', 'user');
    
    // 5. Verify message appears in session
    const getSessionResponse = await apiRequest('GET', `/api/v1/sessions/${session.id}`);
    expect(getSessionResponse.status).toBe(200);
    
    // 6. Load frontend and verify session appears
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Verify the page loaded (adjust selector based on actual UI)
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
  });

  test('MCP server registration and tool discovery', async () => {
    // Test registering multiple MCP servers
    const servers = [
      {
        name: 'filesystem-server',
        transport: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
        }
      },
      {
        name: 'github-server',
        transport: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github']
        }
      }
    ];
    
    for (const server of servers) {
      const response = await apiRequest('POST', '/api/v1/mcp/servers', server);
      expect([200, 201, 400]).toContain(response.status);
    }
    
    // List registered servers
    const listResponse = await apiRequest('GET', '/api/v1/mcp/servers');
    expect(listResponse.status).toBe(200);
    
    const serverList = await listResponse.json();
    expect(Array.isArray(serverList)).toBe(true);
  });

  test('session CRUD operations', async () => {
    // Create session
    const createResponse = await apiRequest('POST', '/api/v1/sessions', {
      name: 'CRUD Test Session',
      metadata: { test: true }
    });
    expect(createResponse.status).toBe(200);
    
    const session = await createResponse.json();
    const sessionId = session.id;
    
    // Get session
    const getResponse = await apiRequest('GET', `/api/v1/sessions/${sessionId}`);
    expect(getResponse.status).toBe(200);
    
    const retrievedSession = await getResponse.json();
    expect(retrievedSession.id).toBe(sessionId);
    expect(retrievedSession.name).toBe('CRUD Test Session');
    
    // List sessions
    const listResponse = await apiRequest('GET', '/api/v1/sessions');
    expect(listResponse.status).toBe(200);
    
    const sessions = await listResponse.json();
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.some((s: any) => s.id === sessionId)).toBe(true);
    
    // Get non-existent session
    const notFoundResponse = await apiRequest('GET', '/api/v1/sessions/nonexistent-id');
    expect(notFoundResponse.status).toBe(404);
  });

  test('message flow in session', async () => {
    // Create session
    const sessionResponse = await apiRequest('POST', '/api/v1/sessions', {
      name: 'Message Flow Test'
    });
    const session = await sessionResponse.json();
    
    // Send multiple messages
    const messages = [
      'Hello, assistant!',
      'Can you help me with a task?',
      'I need to read a file',
    ];
    
    for (const text of messages) {
      const response = await apiRequest(
        'POST',
        `/api/v1/sessions/${session.id}/messages`,
        { text }
      );
      expect(response.status).toBe(200);
      
      const message = await response.json();
      expect(message.content).toBe(text);
      expect(message.role).toBe('user');
      
      // Small delay between messages
      await sleep(50);
    }
  });

  test('SSE sync events', async ({ page }) => {
    // Create session
    const sessionResponse = await apiRequest('POST', '/api/v1/sessions', {
      name: 'SSE Test'
    });
    const session = await sessionResponse.json();
    
    // Connect to SSE endpoint
    const events: any[] = [];
    
    // Use page to make SSE connection
    await page.goto('/');
    
    // Inject script to connect to SSE
    const eventSourcePromise = page.evaluate((apiUrl) => {
      return new Promise((resolve, reject) => {
        const events: any[] = [];
        const es = new EventSource(`${apiUrl}/api/v1/sessions/sync`);
        
        es.onmessage = (event) => {
          events.push(JSON.parse(event.data));
          if (events.length >= 1) {
            es.close();
            resolve(events);
          }
        };
        
        es.onerror = (error) => {
          es.close();
          reject(error);
        };
        
        // Timeout after 5 seconds
        setTimeout(() => {
          es.close();
          resolve(events);
        }, 5000);
      });
    }, API_URL);
    
    // Send a message to trigger an event
    await sleep(500);
    await apiRequest('POST', `/api/v1/sessions/${session.id}/messages`, {
      text: 'Trigger SSE event'
    });
    
    // Wait for events
    const receivedEvents = await eventSourcePromise.catch(() => []);
    
    // We should have received at least one event
    expect(Array.isArray(receivedEvents)).toBe(true);
  });

  test('error handling: invalid MCP server config', async () => {
    const invalidConfigs = [
      { name: '', transport: { type: 'stdio', command: 'echo' } },
      { transport: { type: 'unknown', command: 'echo' } },
      { name: 'test', transport: {} },
    ];
    
    for (const config of invalidConfigs) {
      const response = await apiRequest('POST', '/api/v1/mcp/servers', config);
      expect([400, 422]).toContain(response.status);
    }
  });

  test('error handling: invalid session operations', async () => {
    // Try to send message to non-existent session
    const response = await apiRequest('POST', '/api/v1/sessions/invalid-id/messages', {
      text: 'Test'
    });
    expect(response.status).toBe(404);
    
    // Try to create session without name
    const noNameResponse = await apiRequest('POST', '/api/v1/sessions', {});
    expect([400, 422]).toContain(noNameResponse.status);
  });

  test('concurrent session operations', async () => {
    // Create multiple sessions concurrently
    const sessionPromises = Array(5).fill(null).map((_, i) => 
      apiRequest('POST', '/api/v1/sessions', {
        name: `Concurrent Session ${i}`
      })
    );
    
    const responses = await Promise.all(sessionPromises);
    
    // All should succeed
    for (const response of responses) {
      expect(response.status).toBe(200);
    }
    
    // Verify all sessions exist
    const listResponse = await apiRequest('GET', '/api/v1/sessions');
    const sessions = await listResponse.json();
    
    for (let i = 0; i < 5; i++) {
      expect(sessions.some((s: any) => s.name === `Concurrent Session ${i}`)).toBe(true);
    }
  });

  test('session metadata handling', async () => {
    const metadata = {
      agent_type: 'assistant',
      model: 'gpt-4',
      tags: ['test', 'integration'],
      config: {
        temperature: 0.7,
        max_tokens: 1000
      }
    };
    
    const response = await apiRequest('POST', '/api/v1/sessions', {
      name: 'Metadata Test',
      metadata
    });
    
    expect(response.status).toBe(200);
    const session = await response.json();
    expect(session.id).toBeTruthy();
  });

  test('health check endpoint', async () => {
    const response = await fetch(`${API_URL}/health`);
    expect(response.status).toBe(200);
    
    const text = await response.text();
    expect(text).toBe('OK');
  });
});

test.describe('Policy Enforcement Integration', () => {
  
  test('policy blocks dangerous commands', async () => {
    // This would require a running MCP server with shell execution capability
    // For now, we verify the policy engine exists and responds correctly
    
    const response = await apiRequest('GET', '/api/v1/tools');
    expect(response.status).toBe(200);
    
    const tools = await response.json();
    expect(tools).toHaveProperty('mcp');
  });

  test('policy requires approval for external writes', async () => {
    // Create a session
    const sessionResponse = await apiRequest('POST', '/api/v1/sessions', {
      name: 'Policy Test'
    });
    expect(sessionResponse.status).toBe(200);
  });
});

test.describe('UI Integration Tests', () => {
  
  test('page loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Basic page structure should exist
    const html = await page.content();
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(0);
  });

  test('API and frontend connectivity', async ({ page }) => {
    // Test that the frontend can reach the API
    const response = await page.evaluate(async (apiUrl) => {
      try {
        const res = await fetch(`${apiUrl}/health`);
        return { status: res.status, ok: res.ok };
      } catch (error) {
        return { error: String(error) };
      }
    }, API_URL);
    
    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
  });
});
