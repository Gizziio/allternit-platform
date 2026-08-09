import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient } from './api-client.js';

test('ApiClient sends bearer auth and JSON bodies', async () => {
  const originalFetch = globalThis.fetch;
  let seen: Request | undefined;
  globalThis.fetch = async (input, init) => {
    seen = new Request(input, init);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
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
