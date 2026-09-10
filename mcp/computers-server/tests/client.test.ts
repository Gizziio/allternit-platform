import { describe, it, expect, afterEach } from 'vitest';

import { ApiError, ComputersApiClient, configFromEnv } from '../src/client.js';
import { jsonResponse, mockFetch } from './mock-fetch.js';

describe('configFromEnv', () => {
  it('defaults baseUrl to http://127.0.0.1:8013 without a token', () => {
    expect(configFromEnv({})).toEqual({
      baseUrl: 'http://127.0.0.1:8013',
      token: undefined,
    });
  });

  it('reads ALLTERNIT_API_URL and ALLTERNIT_TOKEN, trimming trailing slashes', () => {
    expect(
      configFromEnv({
        ALLTERNIT_API_URL: 'http://gw:8013///',
        ALLTERNIT_TOKEN: 'tok-1',
      }),
    ).toEqual({ baseUrl: 'http://gw:8013', token: 'tok-1' });
  });

  it('treats an empty ALLTERNIT_TOKEN as absent', () => {
    expect(configFromEnv({ ALLTERNIT_TOKEN: '' }).token).toBeUndefined();
  });
});

describe('ComputersApiClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends the bearer token on every request', async () => {
    const calls = mockFetch(() => jsonResponse({ ok: true }));
    const client = new ComputersApiClient({ baseUrl: 'http://gw:8013', token: 'tok-1' });
    await client.requestJson('GET', '/api/v1/computers');
    expect(calls[0]?.headers['authorization']).toBe('Bearer tok-1');
    expect(calls[0]?.url).toBe('http://gw:8013/api/v1/computers');
  });

  it('omits the Authorization header without a token', async () => {
    const calls = mockFetch(() => jsonResponse({ ok: true }));
    const client = new ComputersApiClient({ baseUrl: 'http://gw' });
    await client.requestJson('GET', '/api/v1/computers');
    expect(calls[0]?.headers['authorization']).toBeUndefined();
  });

  it('serializes JSON bodies and sets content-type', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 'c-1' }));
    const client = new ComputersApiClient({ baseUrl: 'http://gw' });
    await client.requestJson('POST', '/api/v1/computers', { kind: 'local' });
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(calls[0]?.body).toBe(JSON.stringify({ kind: 'local' }));
  });

  it('threads approvalId as ?approval_id=, encoding it', async () => {
    const calls = mockFetch(() => jsonResponse({ ok: true }));
    const client = new ComputersApiClient({ baseUrl: 'http://gw' });
    await client.requestJson('POST', '/api/v1/computers/c-1/shell', { command: ['ls'] }, 'gr ant/1');
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/api/v1/computers/c-1/shell');
    expect(url.searchParams.get('approval_id')).toBe('gr ant/1');
  });

  it('uses &approval_id= when the path already has a query string', async () => {
    const calls = mockFetch(() => jsonResponse({ ok: true }));
    const client = new ComputersApiClient({ baseUrl: 'http://gw' });
    await client.requestJson('POST', '/api/v1/computers/c-1/files/upload?path=/tmp/x', undefined, 'a1');
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get('path')).toBe('/tmp/x');
    expect(url.searchParams.get('approval_id')).toBe('a1');
  });

  it('throws ApiError with status and body on non-2xx', async () => {
    mockFetch(() => jsonResponse({ error: 'confirmation_required' }, 428));
    const client = new ComputersApiClient({ baseUrl: 'http://gw' });
    const error = await client.requestJson('POST', '/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(428);
    expect((error as ApiError).body).toBe(JSON.stringify({ error: 'confirmation_required' }));
  });

  it('uploadBytes posts octet-stream bytes', async () => {
    const calls = mockFetch(() => jsonResponse({ path: '/tmp/x' }));
    const client = new ComputersApiClient({ baseUrl: 'http://gw' });
    await client.uploadBytes('/api/v1/computers/c-1/files/upload?path=/tmp/x', new Uint8Array([1, 2, 3]));
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers['content-type']).toBe('application/octet-stream');
    expect(calls[0]?.body).toBe('\x01\x02\x03');
  });

  it('downloadBytes returns bytes and content type', async () => {
    mockFetch(() => new Response(new Uint8Array([9, 8]), { headers: { 'Content-Type': 'image/png' } }));
    const client = new ComputersApiClient({ baseUrl: 'http://gw' });
    const { bytes, contentType } = await client.downloadBytes('/api/v1/computers/c-1/screenshot');
    expect([...bytes]).toEqual([9, 8]);
    expect(contentType).toBe('image/png');
  });

  it('requestRaw sends the body with the given content type', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 'dtpl-1' }));
    const client = new ComputersApiClient({ baseUrl: 'http://gw' });
    await client.requestRaw('POST', '/api/v1/desktop-templates/import', 'apiVersion: allternit.ai/v1\n', 'application/yaml');
    expect(calls[0]?.headers['content-type']).toBe('application/yaml');
    expect(calls[0]?.body).toBe('apiVersion: allternit.ai/v1\n');
  });
});
