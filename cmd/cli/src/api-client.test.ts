import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient } from './api-client.js';

test('ApiClient sends bearer auth and JSON bodies', async () => {
  const originalFetch = globalThis.fetch;
  let seen: Request | undefined;
  globalThis.fetch = (async (input, init) => {
    seen = new Request(input, init);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  try {
    const result = await new ApiClient({ apiUrl: 'https://api.example/', token: 'secret' })
      .request('POST', '/api/v1/workspaces', { name: 'demo' });
    assert.deepEqual(result, { ok: true });
    assert.equal(seen?.url, 'https://api.example/api/v1/workspaces');
    assert.equal(seen?.headers.get('authorization'), 'Bearer secret');
    assert.deepEqual(await seen?.json(), { name: 'demo' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ApiClient supports update and delete requests', async () => {
  const originalFetch = globalThis.fetch;
  const seen: Request[] = [];
  globalThis.fetch = (async (input, init) => {
    seen.push(new Request(input, init));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof globalThis.fetch;
  try {
    const client = new ApiClient({ apiUrl: 'https://api.example' });
    await client.request('PATCH', '/api/v1/gateway/keys/key%2Fone', { name: 'updated' });
    await client.request('DELETE', '/api/v1/workspaces/workspace%2Fone');

    assert.equal(seen[0]?.method, 'PATCH');
    assert.deepEqual(await seen[0]?.json(), { name: 'updated' });
    assert.equal(seen[1]?.method, 'DELETE');
    assert.equal(seen[1]?.body, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
