import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { validateAuthToken } from '../auth.js';

function base64url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  header: Record<string, unknown> = { alg: 'HS256', typ: 'JWT' },
): string {
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

test('validateAuthToken accepts a valid HS256 JWT', () => {
  const secret = 'cloud-backend-test-secret';
  const token = signJwt(
    {
      sub: 'user-123',
      aud: 'cloud-backend',
      exp: Math.floor(Date.now() / 1000) + 60,
    },
    secret,
  );

  const result = validateAuthToken(token, {
    JWT_SECRET: secret,
    JWT_AUDIENCE: 'cloud-backend',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.userId, 'user-123');
    assert.equal(result.mode, 'jwt');
  }
});

test('validateAuthToken rejects opaque tokens when JWT validation is configured', () => {
  const result = validateAuthToken('test-token', {
    JWT_SECRET: 'cloud-backend-test-secret',
  });

  assert.deepEqual(result, {
    ok: false,
    error: 'Opaque tokens are disabled when JWT validation is configured',
  });
});

test('validateAuthToken allows opaque tokens when no JWT secret is configured', () => {
  const result = validateAuthToken('test-token', {});

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.mode, 'opaque');
    assert.match(result.userId, /^opaque-/);
  }
});
