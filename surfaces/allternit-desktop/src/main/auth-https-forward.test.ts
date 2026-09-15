import { describe, expect, it } from 'vitest';
import {
  buildAuthForwardInit,
  cookieFromSetCookieHeader,
  setCookiesFromResponse,
} from './auth-https-forward.js';

describe('buildAuthForwardInit', () => {
  it('injects partition cookies and always bypasses custom protocol handlers', async () => {
    const request = new Request('https://allternit.com/__clerk/npm/@clerk/clerk-js@5/dist/clerk.browser.js');
    const init = await buildAuthForwardInit(request, [
      { name: '__client', value: 'abc' },
    ]);
    expect(init.bypassCustomProtocolHandlers).toBe(true);
    expect(init.method).toBe('GET');
    expect(init.headers.get('Cookie')).toBe('__client=abc');
    expect(init.body).toBeUndefined();
  });

  it('does not overwrite an existing Cookie header', async () => {
    const request = new Request('https://allternit.com/__clerk/v1/client', {
      headers: { Cookie: 'already=1' },
    });
    const init = await buildAuthForwardInit(request, [{ name: '__client', value: 'abc' }]);
    expect(init.headers.get('Cookie')).toBe('already=1');
  });
});

describe('cookieFromSetCookieHeader', () => {
  it('parses Clerk __client cookies rewritten onto .allternit.com', () => {
    const cookie = cookieFromSetCookieHeader(
      '__client=tok; Domain=.allternit.com; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=31536000',
      'https://allternit.com/__clerk/v1/client',
    );
    expect(cookie.name).toBe('__client');
    expect(cookie.value).toBe('tok');
    expect(cookie.domain).toBe('.allternit.com');
    expect(cookie.path).toBe('/');
    expect(cookie.secure).toBe(true);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('no_restriction');
    expect(cookie.session).toBe(false);
    expect(cookie.expirationDate).toBeGreaterThan(Date.now() / 1000);
  });
});

describe('setCookiesFromResponse', () => {
  it('reads getSetCookie when present', () => {
    const headers = new Headers();
    headers.append('set-cookie', 'a=1');
    headers.append('set-cookie', 'b=2');
    const response = new Response(null, { headers });
    const got = setCookiesFromResponse(response);
    expect(got.length).toBeGreaterThanOrEqual(1);
  });
});
