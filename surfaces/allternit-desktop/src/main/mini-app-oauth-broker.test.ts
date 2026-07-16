import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  accountKey,
  buildAuthorizationUrl,
  constantTimeEqual,
  generatePkce,
  generateState,
  validateOAuthProvider,
  type MiniAppOAuthProvider,
} from './mini-app-oauth-broker.js';

const provider: MiniAppOAuthProvider = {
  authorizationUrl: 'https://accounts.example.com/authorize',
  tokenUrl: 'https://accounts.example.com/token',
  clientId: 'allternit-desktop',
  scopes: ['read', 'write'],
};

describe('generatePkce', () => {
  it('produces a high-entropy verifier and its S256 challenge', () => {
    const { verifier, challenge } = generatePkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('never repeats', () => {
    expect(generatePkce().verifier).not.toBe(generatePkce().verifier);
  });
});

describe('generateState / constantTimeEqual', () => {
  it('generates unique URL-safe states', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(state).not.toBe(generateState());
  });

  it('compares in constant time with length check', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(false);
  });
});

describe('accountKey', () => {
  it('isolates per app, provider, and account without collisions', () => {
    expect(accountKey('app', 'prov', 'personal')).not.toBe(accountKey('app', 'prov', 'workspace:1'));
    expect(accountKey('app', 'prov', 'personal')).not.toBe(accountKey('appro', 'v', 'personal'));
  });
});

describe('validateOAuthProvider', () => {
  it('accepts a valid provider', () => {
    expect(validateOAuthProvider(provider)).toBeNull();
  });

  it('requires https outside localhost', () => {
    expect(validateOAuthProvider({ ...provider, authorizationUrl: 'http://evil.com/a' })).toContain('https');
    expect(validateOAuthProvider({ ...provider, tokenUrl: 'http://evil.com/t' })).toContain('https');
    expect(validateOAuthProvider({ ...provider, revocationUrl: 'http://evil.com/r' })).toContain('https');
  });

  it('allows http for localhost development providers', () => {
    expect(validateOAuthProvider({
      ...provider,
      authorizationUrl: 'http://127.0.0.1:8080/authorize',
      tokenUrl: 'http://localhost:8080/token',
    })).toBeNull();
  });

  it('rejects bad clientIds and scopes', () => {
    expect(validateOAuthProvider({ ...provider, clientId: '' })).toContain('clientId');
    expect(validateOAuthProvider({ ...provider, clientId: 'has space' })).toContain('clientId');
    expect(validateOAuthProvider({ ...provider, scopes: [''] })).toContain('scopes');
    expect(validateOAuthProvider({ ...provider, scopes: Array(65).fill('s') })).toContain('scopes');
  });

  it('rejects additionalAuthParams that override standard parameters', () => {
    expect(validateOAuthProvider({ ...provider, additionalAuthParams: { state: 'x' } })).toContain('standard');
    expect(validateOAuthProvider({ ...provider, additionalAuthParams: { redirect_uri: 'x' } })).toContain('standard');
    expect(validateOAuthProvider({ ...provider, additionalAuthParams: { access_type: 'offline' } })).toBeNull();
  });
});

describe('buildAuthorizationUrl', () => {
  it('sets all required parameters exactly once', () => {
    const url = new URL(buildAuthorizationUrl(provider, 'http://127.0.0.1:9999/callback', 'STATE', 'CHALLENGE'));
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('allternit-desktop');
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:9999/callback');
    expect(url.searchParams.get('state')).toBe('STATE');
    expect(url.searchParams.get('code_challenge')).toBe('CHALLENGE');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('read write');
  });

  it('appends additional params and preserves pre-existing query params', () => {
    const url = new URL(buildAuthorizationUrl(
      { ...provider, authorizationUrl: 'https://accounts.example.com/authorize?prompt=consent', additionalAuthParams: { access_type: 'offline' } },
      'http://127.0.0.1:1/callback',
      'S',
      'C',
    ));
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('access_type')).toBe('offline');
  });
});
