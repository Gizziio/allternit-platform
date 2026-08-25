import { describe, it, expect, vi } from 'vitest';
import {
  listAgents,
  listTemplates,
  getCapacity,
  getUsageSummary,
  provisionDesktop,
} from '../../public/desktop-cloud-admin.js';

function mockFetch(response: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => response,
    text: async () => JSON.stringify(response),
  } as Response);
}

function failingFetch(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
    text: async () => 'boom',
  } as Response);
}

describe('desktop-cloud-admin API client', () => {
  it('lists agents from /api/v1/agents', async () => {
    const fetchImpl = mockFetch({ agents: [{ id: 'bot-1', name: 'Bot One' }] });
    const agents = await listAgents('http://127.0.0.1:8013/api/v1', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:8013/api/v1/agents');
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('bot-1');
  });

  it('lists templates from /api/v1/desktop-templates', async () => {
    const fetchImpl = mockFetch({ templates: [{ id: 'preset-linux', os: 'linux' }] });
    const templates = await listTemplates('http://127.0.0.1:8013/api/v1', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:8013/api/v1/desktop-templates');
    expect(templates[0].id).toBe('preset-linux');
  });

  it('reads capacity from /api/v1/desktop-capacity', async () => {
    const fetchImpl = mockFetch({ scale_up_recommended: false, snapshots: [] });
    const data = await getCapacity('http://127.0.0.1:8013/api/v1', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:8013/api/v1/desktop-capacity');
    expect(data.scale_up_recommended).toBe(false);
  });

  it('reads usage summary from /api/v1/desktop-usage/summary', async () => {
    const fetchImpl = mockFetch({ total_minutes: 120, total_cost: 6, currency: 'USD', rows: 1 });
    const data = await getUsageSummary('http://127.0.0.1:8013/api/v1', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:8013/api/v1/desktop-usage/summary');
    expect(data.total_cost).toBe(6);
  });

  it('provisions a desktop with a template', async () => {
    const fetchImpl = mockFetch({ sandbox_id: 'sb-1', status: 'creating', provider: 'tart' });
    const result = await provisionDesktop('bot-1', 'preset-macos', 'http://127.0.0.1:8013/api/v1', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8013/api/v1/bots/bot-1/desktop/provision?template_id=preset-macos',
      { method: 'POST' }
    );
    expect(result.sandbox_id).toBe('sb-1');
  });

  it('throws on HTTP error', async () => {
    const fetchImpl = failingFetch(429);
    await expect(listAgents('http://127.0.0.1:8013/api/v1', fetchImpl)).rejects.toThrow('429');
  });
});
