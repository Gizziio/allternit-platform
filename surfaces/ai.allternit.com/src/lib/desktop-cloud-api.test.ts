import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/integration/api-client';
import {
  listAgents,
  listTemplates,
  getCapacity,
  getUsageSummary,
  listUsage,
  listSandboxes,
  provisionDesktop,
  startDesktop,
  stopDesktop,
  deprovisionDesktop,
} from './desktop-cloud-api';

vi.mock('@/integration/api-client', () => ({
  api: {
    listAgents: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  },
  AllternitApiError: class AllternitApiError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
      this.name = 'AllternitApiError';
    }
  },
}));

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('desktop-cloud-api', () => {
  it('listAgents returns agents array', async () => {
    mockApi.get.mockResolvedValue({ agents: [{ id: 'bot-1', name: 'Bot One' }] });
    const agents = await listAgents();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/agents');
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('bot-1');
  });

  it('listTemplates calls /api/v1/desktop-templates', async () => {
    mockApi.get.mockResolvedValue({ templates: [{ id: 'tpl-1', name: 'Linux Dev' }] });
    const templates = await listTemplates();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/desktop-templates');
    expect(templates[0].id).toBe('tpl-1');
  });

  it('listTemplates passes os and tag filters', async () => {
    mockApi.get.mockResolvedValue({ templates: [] });
    await listTemplates({ os: 'linux', tag: 'dev' });
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/desktop-templates?os=linux&tag=dev');
  });

  it('getCapacity calls /api/v1/desktop-capacity', async () => {
    mockApi.get.mockResolvedValue({ snapshots: [], scale_up_recommended: false });
    const data = await getCapacity();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/desktop-capacity');
    expect(data.scale_up_recommended).toBe(false);
  });

  it('getUsageSummary calls /api/v1/desktop-usage/summary with optional range', async () => {
    mockApi.get.mockResolvedValue({ total_minutes: 10, total_cost: 1, currency: 'USD', rows: 1 });
    const data = await getUsageSummary({ start: '2026-01-01T00:00:00Z', end: '2026-01-02T00:00:00Z' });
    expect(mockApi.get).toHaveBeenCalledWith(
      '/api/v1/desktop-usage/summary?start=2026-01-01T00%3A00%3A00Z&end=2026-01-02T00%3A00%3A00Z'
    );
    expect(data.total_cost).toBe(1);
  });

  it('listUsage calls /api/v1/desktop-usage', async () => {
    mockApi.get.mockResolvedValue({ usage: [{ bot_id: 'bot-1', sandbox_id: 'sb-1', provider: 'tart', started_at: '2026-01-01T00:00:00Z', cost: 0.5, currency: 'USD' }] });
    const usage = await listUsage();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/desktop-usage');
    expect(usage[0].bot_id).toBe('bot-1');
  });

  it('listSandboxes calls /api/v1/desktop-sandboxes', async () => {
    mockApi.get.mockResolvedValue({ sandboxes: [{ bot_id: 'bot-1', sandbox_id: 'sb-1', provider: 'tart', status: 'running', os: 'linux' }] });
    const sandboxes = await listSandboxes();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/desktop-sandboxes');
    expect(sandboxes[0].sandbox_id).toBe('sb-1');
  });

  it('provisionDesktop posts with template_id query', async () => {
    mockApi.post.mockResolvedValue({ sandbox_id: 'sb-1', status: 'creating', provider: 'tart' });
    const result = await provisionDesktop('bot-1', 'tpl-1');
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/bots/bot-1/desktop/provision?template_id=tpl-1');
    expect(result.sandbox_id).toBe('sb-1');
  });

  it('startDesktop posts start endpoint', async () => {
    mockApi.post.mockResolvedValue({ sandbox_id: 'sb-1', status: 'running' });
    const result = await startDesktop('bot-1');
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/bots/bot-1/desktop/start');
    expect(result.status).toBe('running');
  });

  it('stopDesktop posts stop endpoint', async () => {
    mockApi.post.mockResolvedValue({ sandbox_id: 'sb-1', status: 'stopped' });
    const result = await stopDesktop('bot-1');
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/bots/bot-1/desktop/stop');
    expect(result.status).toBe('stopped');
  });

  it('deprovisionDesktop posts deprovision endpoint', async () => {
    mockApi.post.mockResolvedValue({ sandbox_id: 'sb-1', status: 'deprovisioned' });
    const result = await deprovisionDesktop('bot-1');
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/bots/bot-1/desktop/deprovision');
    expect(result.status).toBe('deprovisioned');
  });
});
