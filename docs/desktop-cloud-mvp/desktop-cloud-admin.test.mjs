import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  listAgents,
  listTemplates,
  getCapacity,
  getUsageSummary,
  provisionDesktop,
} from '../../surfaces/ai.allternit.com/public/desktop-cloud-admin.js';

function mockFetch(response, ok = true) {
  return async () => ({
    ok,
    json: async () => response,
    text: async () => JSON.stringify(response),
  });
}

function failingFetch(status) {
  return async () => ({
    ok: false,
    status,
    json: async () => ({}),
    text: async () => 'boom',
  });
}

describe('desktop-cloud-admin API client', () => {
  it('lists agents from /api/v1/agents', async () => {
    const fetchImpl = mockFetch({ agents: [{ id: 'bot-1', name: 'Bot One' }] });
    const agents = await listAgents('http://127.0.0.1:8013/api/v1', fetchImpl);
    assert.deepStrictEqual(agents, [{ id: 'bot-1', name: 'Bot One' }]);
  });

  it('lists templates from /api/v1/desktop-templates', async () => {
    const fetchImpl = mockFetch({ templates: [{ id: 'preset-linux', os: 'linux' }] });
    const templates = await listTemplates('http://127.0.0.1:8013/api/v1', fetchImpl);
    assert.strictEqual(templates[0].id, 'preset-linux');
  });

  it('reads capacity from /api/v1/desktop-capacity', async () => {
    const fetchImpl = mockFetch({ scale_up_recommended: false, snapshots: [] });
    const data = await getCapacity('http://127.0.0.1:8013/api/v1', fetchImpl);
    assert.strictEqual(data.scale_up_recommended, false);
  });

  it('reads usage summary from /api/v1/desktop-usage/summary', async () => {
    const fetchImpl = mockFetch({ total_minutes: 120, total_cost: 6, currency: 'USD', rows: 1 });
    const data = await getUsageSummary('http://127.0.0.1:8013/api/v1', fetchImpl);
    assert.strictEqual(data.total_cost, 6);
  });

  it('provisions a desktop with a template', async () => {
    const fetchImpl = mockFetch({ sandbox_id: 'sb-1', status: 'creating', provider: 'tart' });
    const result = await provisionDesktop('bot-1', 'preset-macos', 'http://127.0.0.1:8013/api/v1', fetchImpl);
    assert.strictEqual(result.sandbox_id, 'sb-1');
  });

  it('throws on HTTP error', async () => {
    const fetchImpl = failingFetch(429);
    await assert.rejects(() => listAgents('http://127.0.0.1:8013/api/v1', fetchImpl), /429/);
  });
});
