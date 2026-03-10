/**
 * Security Tests - HMAC Verifier, Allowlist, Rate Limiter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import {
  verifyHmacSignature,
  verifyWebhookSignature,
  extractSignatureFromHeaders,
} from '../src/security/hmac-verifier.js';
import {
  AllowlistValidator,
  createDefaultAllowlistValidator,
} from '../src/security/allowlist-validator.js';
import { RateLimiter } from '../src/security/rate-limiter.js';

describe('HMAC Verifier', () => {
  const secret = 'test_secret_123';
  const payload = 'Hello, World!';

  describe('verifyHmacSignature', () => {
    it('should verify valid SHA-256 signature', () => {
      const signature = createHmacSignature(payload, secret, 'sha256');
      const result = verifyHmacSignature(payload, signature, secret, 'sha256');

      expect(result.valid).toBe(true);
      expect(result.algorithm).toBe('sha256');
    });

    it('should reject invalid signature', () => {
      const result = verifyHmacSignature(
        payload,
        'invalid_signature',
        secret,
        'sha256'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Signature does not match');
    });

    it('should reject wrong secret', () => {
      const signature = createHmacSignature(payload, secret, 'sha256');
      const result = verifyHmacSignature(payload, signature, 'wrong_secret', 'sha256');

      expect(result.valid).toBe(false);
    });

    it('should handle GitHub format (sha256=signature)', () => {
      const signature = createHmacSignature(payload, secret, 'sha256');
      const githubFormat = `sha256=${signature}`;
      const result = verifyHmacSignature(payload, githubFormat, secret, 'sha256');

      expect(result.valid).toBe(true);
    });

    it('should support SHA-1', () => {
      const signature = createHmacSignature(payload, secret, 'sha1');
      const result = verifyHmacSignature(payload, signature, secret, 'sha1');

      expect(result.valid).toBe(true);
    });

    it('should support SHA-512', () => {
      const signature = createHmacSignature(payload, secret, 'sha512');
      const result = verifyHmacSignature(payload, signature, secret, 'sha512');

      expect(result.valid).toBe(true);
    });
  });

  describe('extractSignatureFromHeaders', () => {
    it('should extract GitHub signature from X-Hub-Signature-256', () => {
      const headers = {
        'x-hub-signature-256': 'sha256=abc123',
      };

      const result = extractSignatureFromHeaders(headers);

      expect(result).toEqual({
        signature: 'abc123',
        algorithm: 'sha256',
      });
    });

    it('should extract generic signature from X-Signature', () => {
      const headers = {
        'x-signature': 'def456',
      };

      const result = extractSignatureFromHeaders(headers, ['x-signature']);

      expect(result).toEqual({
        signature: 'def456',
      });
    });

    it('should return null if no signature found', () => {
      const headers = {
        'content-type': 'application/json',
      };

      const result = extractSignatureFromHeaders(headers);

      expect(result).toBeNull();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook with valid signature', () => {
      const signature = createHmacSignature(payload, secret, 'sha256');
      const headers = {
        'x-hub-signature-256': `sha256=${signature}`,
      };

      const result = verifyWebhookSignature(payload, headers, secret);

      expect(result.valid).toBe(true);
    });

    it('should fail when signature missing', () => {
      const headers = {};
      const result = verifyWebhookSignature(payload, headers, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('No signature found');
    });
  });
});

describe('Allowlist Validator', () => {
  describe('createDefaultAllowlistValidator', () => {
    it('should allow configured sources', () => {
      const validator = createDefaultAllowlistValidator();

      const result = validator.validate('github', 'pull_request.opened');

      expect(result.allowed).toBe(true);
    });

    it('should block unknown sources', () => {
      const validator = createDefaultAllowlistValidator();

      const result = validator.validate('unknown' as any, 'some.event');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in the allowlist');
    });

    it('should block disallowed event types', () => {
      const validator = createDefaultAllowlistValidator();

      const result = validator.validate('github', 'unknown.event');

      expect(result.allowed).toBe(false);
    });
  });

  describe('AllowlistValidator methods', () => {
    let validator: AllowlistValidator;

    beforeEach(() => {
      validator = new AllowlistValidator({
        allowByDefault: false,
        sources: ['github', 'discord'],
      });
    });

    it('should allow source after adding to allowlist', () => {
      validator.allowSource('antfarm');

      const result = validator.validate('antfarm', 'any.event');

      expect(result.allowed).toBe(true);
    });

    it('should block source after blocking', () => {
      validator.blockSource('github');

      const result = validator.validate('github', 'pull_request.opened');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('should allow specific event type', () => {
      validator.allowEventType('github', 'custom.event');

      const result = validator.validate('github', 'custom.event');

      expect(result.allowed).toBe(true);
    });

    it('should block specific event type', () => {
      validator.blockEventType('github', 'pull_request.opened');

      const result = validator.validate('github', 'pull_request.opened');

      expect(result.allowed).toBe(false);
    });
  });
});

describe('Rate Limiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000, // 1 second
      slidingWindow: true,
    });
  });

  describe('check', () => {
    it('should allow requests under limit', async () => {
      const result = await limiter.check('test-key');

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(0);
    });

    it('should block requests over limit', async () => {
      // Record 5 requests
      for (let i = 0; i < 5; i++) {
        await limiter.record('test-key');
      }

      const result = await limiter.check('test-key');

      expect(result.allowed).toBe(false);
      expect(result.count).toBe(5);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('checkAndRecord', () => {
    it('should allow and record requests under limit', async () => {
      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkAndRecord('test-key');
        expect(result.allowed).toBe(true);
      }

      // 6th request should be blocked
      const result = await limiter.checkAndRecord('test-key');
      expect(result.allowed).toBe(false);
    });

    it('should track different keys independently', async () => {
      await limiter.checkAndRecord('key-1');
      await limiter.checkAndRecord('key-1');

      const result1 = await limiter.check('key-1');
      const result2 = await limiter.check('key-2');

      expect(result1.count).toBe(2);
      expect(result2.count).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for a key', async () => {
      // Record 5 requests
      for (let i = 0; i < 5; i++) {
        await limiter.record('test-key');
      }

      await limiter.reset('test-key');

      const result = await limiter.check('test-key');
      expect(result.count).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return current status', async () => {
      await limiter.record('test-key');
      await limiter.record('test-key');

      const result = await limiter.getStatus('test-key');

      expect(result.count).toBe(2);
      expect(result.max).toBe(5);
    });
  });
});

// Helper function
function createHmacSignature(
  payload: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' | 'sha512'
): string {
  return createHash(algorithm)
    .update(payload)
    .digest('hex');
}
