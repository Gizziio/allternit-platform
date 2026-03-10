/**
 * Server Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWebhookServer } from '../src/server/webhook-server.js';
import type { WebhookServer } from '../src/server/webhook-server.js';

describe('Webhook Server', () => {
  let server: WebhookServer;
  let baseUrl: string;

  beforeEach(async () => {
    // Find available port
    const port = 3000 + Math.floor(Math.random() * 1000);
    baseUrl = `http://127.0.0.1:${port}`;

    server = createWebhookServer({
      port,
      host: '127.0.0.1',
      corsOrigins: ['*'],
      logLevel: 'error', // Suppress logs during tests
    });

    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${baseUrl}/health`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.version).toBe('1.0.0');
      expect(data.stats).toBeDefined();
    });
  });

  describe('POST /webhook/:source', () => {
    it('should accept valid GitHub webhook', async () => {
      const fetch = (await import('node-fetch')).default;
      
      const payload = {
        action: 'opened',
        number: 42,
        pull_request: {
          title: 'Test PR',
          state: 'open',
        },
        repository: {
          full_name: 'test/repo',
          name: 'repo',
          html_url: 'https://github.com/test/repo',
        },
        sender: {
          login: 'testuser',
          id: 123,
          type: 'User',
        },
      };

      const response = await fetch(`${baseUrl}/webhook/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('accepted');
      expect(data.eventId).toMatch(/^evt_/);
      expect(data.idempotencyKey).toMatch(/^gh_[a-f0-9]{16}$/);
    });

    it('should reject invalid source', async () => {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${baseUrl}/webhook/invalid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('InvalidSource');
    });

    it('should handle duplicate events', async () => {
      const fetch = (await import('node-fetch')).default;

      const payload = {
        action: 'opened',
        number: 42,
        pull_request: {
          title: 'Test PR',
          state: 'open',
        },
        repository: {
          full_name: 'test/repo',
          name: 'repo',
          html_url: 'https://github.com/test/repo',
        },
        sender: {
          login: 'testuser',
          id: 123,
          type: 'User',
        },
      };

      // First request
      const response1 = await fetch(`${baseUrl}/webhook/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response1.status).toBe(200);

      // Second request (duplicate)
      const response2 = await fetch(`${baseUrl}/webhook/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response2.status).toBe(200);

      const data2 = await response2.json();
      expect(data2.status).toBe('duplicate');
    });

    it('should handle rate limiting', async () => {
      const fetch = (await import('node-fetch')).default;

      const payload = {
        action: 'opened',
        number: Math.floor(Math.random() * 1000),
        pull_request: {
          title: 'Test PR',
          state: 'open',
        },
        repository: {
          full_name: 'test/repo',
          name: 'repo',
          html_url: 'https://github.com/test/repo',
        },
        sender: {
          login: 'testuser',
          id: 123,
          type: 'User',
        },
      };

      // Send many requests to trigger rate limit
      const requests = [];
      for (let i = 0; i < 70; i++) {
        requests.push(
          fetch(`${baseUrl}/webhook/github`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        );
      }

      const responses = await Promise.all(requests);
      const statusCodes = responses.map(r => r.status);

      // Some should be rate limited (429)
      expect(statusCodes).toContain(429);
    });
  });

  describe('POST /webhook (generic)', () => {
    it('should accept webhook with source in body', async () => {
      const fetch = (await import('node-fetch')).default;

      const payload = {
        source: 'custom',
        eventType: 'test.event',
        customData: {
          message: 'Hello',
        },
      };

      const response = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('accepted');
    });

    it('should reject missing source', async () => {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('MissingSource');
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          'Origin': 'http://example.com',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });
  });
});
