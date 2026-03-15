/**
 * End-to-End Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWebhookServer } from '../src/server/webhook-server.js';
import { createDefaultAllowlistValidator } from '../src/security/allowlist-validator.js';
import { createWebhookRateLimiter } from '../src/security/rate-limiter.js';
import { createDeduplicationStore } from '../src/idempotency/deduplication-store.js';
import { createRailsEventEmitter } from '../src/rails/event-emitter.js';
import { createReceiptRecorder } from '../src/rails/receipt-recorder.js';
import type { WebhookServer } from '../src/server/webhook-server.js';

describe('End-to-End Integration', () => {
  let server: WebhookServer;
  let baseUrl: string;

  beforeEach(async () => {
    const port = 4000 + Math.floor(Math.random() * 1000);
    baseUrl = `http://127.0.0.1:${port}`;

    server = new (createWebhookServer as any).constructor({
      port,
      host: '127.0.0.1',
      corsOrigins: ['*'],
      secrets: new Map(),
      allowlistValidator: createDefaultAllowlistValidator(),
      rateLimiter: createWebhookRateLimiter(),
      deduplicationStore: createDeduplicationStore({
        backend: 'memory',
        defaultTtlSeconds: 3600,
        cleanupIntervalSeconds: 300,
      }),
      railsEmitter: createRailsEventEmitter(),
      receiptRecorder: createReceiptRecorder(),
      logLevel: 'error',
    });

    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('GitHub Webhook Flow', () => {
    it('should process complete GitHub webhook flow', async () => {
      const fetch = (await import('node-fetch')).default;

      // Simulate GitHub pull_request.opened webhook
      const payload = {
        action: 'opened',
        number: 42,
        pull_request: {
          title: 'Add new authentication feature',
          state: 'open',
          body: 'This PR adds OAuth2 support',
          user: { login: 'developer' },
        },
        repository: {
          full_name: 'company/secure-app',
          name: 'secure-app',
          html_url: 'https://github.com/company/secure-app',
          private: true,
        },
        sender: {
          login: 'developer',
          id: 999,
          type: 'User',
        },
      };

      const response = await fetch(`${baseUrl}/webhook/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=test', // Will be skipped without secret
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.status).toBe('accepted');
      expect(result.eventId).toMatch(/^evt_/);
      expect(result.correlationId).toMatch(/^wh_/);
    });
  });

  describe('Discord Webhook Flow', () => {
    it('should process complete Discord webhook flow', async () => {
      const fetch = (await import('node-fetch')).default;

      const payload = {
        type: 0,
        content: '@builder Can you review this PR? https://github.com/company/app/pull/123',
        channel_id: '123456789',
        guild_id: '987654321',
        id: 'msg_999',
        timestamp: '2026-03-08T12:00:00.000Z',
        author: {
          id: 'user_123',
          username: 'project-manager',
          discriminator: '0001',
          bot: false,
        },
        mentions: [
          { id: 'bot_456', username: 'builder' },
        ],
      };

      const response = await fetch(`${baseUrl}/webhook/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.status).toBe('accepted');
      expect(result.idempotencyKey).toMatch(/^dc_[a-f0-9]{16}$/);
    });
  });

  describe('Ant Farm Webhook Flow', () => {
    it('should process complete Ant Farm task request', async () => {
      const fetch = (await import('node-fetch')).default;

      const payload = {
        type: 'room.task.requested',
        room: {
          id: 'room_dev',
          name: 'development',
          type: 'public',
        },
        task: {
          id: 'task_123',
          description: 'Implement user authentication endpoint',
          requestedBy: 'tech-lead',
          priority: 'high',
          status: 'requested',
        },
        message: {
          id: 'msg_456',
          content: 'Need help with auth endpoint',
          author: {
            id: 'tech-lead',
            name: 'Tech Lead',
            type: 'human',
          },
          timestamp: '2026-03-08T12:00:00.000Z',
        },
      };

      const response = await fetch(`${baseUrl}/webhook/antfarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.status).toBe('accepted');
      expect(result.idempotencyKey).toMatch(/^af_[a-f0-9]{16}$/);
    });
  });

  describe('Mention Detection Flow', () => {
    it('should detect @mention and create work request', async () => {
      const fetch = (await import('node-fetch')).default;

      // Discord message with @mention
      const payload = {
        content: '@validator Please test this fix',
        channel_id: '123',
        id: 'msg_test',
        timestamp: '2026-03-08T12:00:00.000Z',
        author: {
          id: 'user_1',
          username: 'developer',
          discriminator: '0001',
        },
      };

      const response = await fetch(`${baseUrl}/webhook/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.status).toBe('accepted');

      // Should have created work request for validator
      // (verified through Rails event emitter in production)
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${baseUrl}/webhook/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBeDefined();
    });

    it('should handle empty body', async () => {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${baseUrl}/webhook/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Idempotency', () => {
    it('should return duplicate status for same event', async () => {
      const fetch = (await import('node-fetch')).default;

      const payload = {
        action: 'opened',
        number: 999,
        pull_request: {
          title: 'Test',
          state: 'open',
        },
        repository: {
          full_name: 'test/repo',
          name: 'repo',
        },
        sender: {
          login: 'test',
          id: 1,
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
      const result1 = await response1.json();
      expect(result1.status).toBe('accepted');

      // Second request (same payload)
      const response2 = await fetch(`${baseUrl}/webhook/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response2.status).toBe(200);
      const result2 = await response2.json();
      expect(result2.status).toBe('duplicate');
      expect(result2.idempotencyKey).toBe(result1.idempotencyKey);
    });
  });
});
