import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createSandbox,
  getSandboxForAgent,
  deleteComputer,
  snapshotSandbox,
  restoreSandbox,
  runCommand,
  runBrowserTask,
  destroySandbox,
  healthCheck,
  defaultBotVMOperatorConfig,
  ensureBotComputer,
  provisionFleetComputers,
} from './vm-operator';
import type { AgentVMOperatorConfig } from '@/lib/agents/agent.types';

describe('vm-operator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchJson(json: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => json,
      }),
    );
  }

  function mockFetchSequence(...responses: unknown[]) {
    const fetchMock = vi.fn();
    for (const json of responses) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => json,
      });
    }
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  describe('ensureBotComputer (atomic Create Bot bind)', () => {
    it('defaults to a persistent 2 vCPU / 4 GB / 100 GB cloud desktop with autoStart off', () => {
      const config = defaultBotVMOperatorConfig();
      expect(config).toMatchObject({
        enabled: true,
        provider: 'cloud-desktop',
        computerKind: 'cloud_desktop',
        persistence: 'persistent',
        autoStart: false,
        resources: { cpu: '2', memory: '4096', disk: '102400' },
      });
    });

    it('provisions a persistent desktop bound by bot_id when none exists', async () => {
      const fetchMock = mockFetchSequence(
        { computers: [] },
        {
          id: 'sb-new',
          sandbox_id: 'sb-new',
          status: 'creating',
          provider: 'cloud-desktop',
          persistence: 'persistent',
        },
      );

      const config = defaultBotVMOperatorConfig();
      const result = await ensureBotComputer('bot-1', config, {
        displayName: 'Quinn — Chief of Staff',
      });

      expect(result.ok).toBe(true);
      expect(result.data?.id).toBe('sb-new');
      expect(result.data?.persistence).toBe('persistent');

      // First call lists by bot_id, second creates.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/computers?');
      expect(fetchMock.mock.calls[0][0]).toContain('bot_id=bot-1');
      expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/computers');
      expect(fetchMock.mock.calls[1][1].method).toBe('POST');
      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body).toMatchObject({
        kind: 'cloud_desktop',
        bot_id: 'bot-1',
        persistence: 'persistent',
        name: 'Quinn — Chief of Staff',
      });
    });

    it('binds the existing desktop (even stopped) instead of provisioning a new one', async () => {
      const fetchMock = mockFetchSequence({
        computers: [
          {
            id: 'sb-persist',
            bot_id: 'bot-1',
            kind: 'cloud_desktop',
            status: 'stopped',
            provider: 'cloud-desktop',
            created_at: '2026-09-09T00:00:00Z',
            updated_at: '2026-09-09T00:10:00Z',
          },
        ],
      });

      const result = await ensureBotComputer('bot-1', defaultBotVMOperatorConfig());

      expect(result.ok).toBe(true);
      expect(result.data?.id).toBe('sb-persist');
      expect(result.data?.status).toBe('stopped');
      // Exactly one call — the list lookup — and no provisioning POST.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'POST')).toBe(false);
    });

    it('create → reopen returns the same computer id (no duplicate sandbox)', async () => {
      const fetchMock = mockFetchSequence(
        { computers: [] },
        {
          id: 'sb-same',
          sandbox_id: 'sb-same',
          status: 'running',
          provider: 'cloud-desktop',
          persistence: 'persistent',
        },
        {
          computers: [
            {
              id: 'sb-same',
              bot_id: 'bot-1',
              kind: 'cloud_desktop',
              status: 'running',
              provider: 'cloud-desktop',
              created_at: '2026-09-09T00:00:00Z',
              updated_at: '2026-09-09T00:05:00Z',
            },
          ],
        },
      );

      const config = defaultBotVMOperatorConfig();
      const created = await ensureBotComputer('bot-1', config);
      const reopened = await ensureBotComputer('bot-1', config);

      expect(created.ok && reopened.ok).toBe(true);
      expect(created.data?.id).toBe('sb-same');
      expect(reopened.data?.id).toBe(created.data?.id);
      // create (GET+POST) then reopen (GET only) — no second POST.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const postCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST');
      expect(postCalls).toHaveLength(1);
    });

    it('skips deleted desktops when binding', async () => {
      const fetchMock = mockFetchSequence(
        {
          computers: [
            {
              id: 'sb-old',
              bot_id: 'bot-1',
              kind: 'cloud_desktop',
              status: 'deleted',
              provider: 'cloud-desktop',
              created_at: '2026-09-08T00:00:00Z',
              updated_at: '2026-09-08T01:00:00Z',
            },
          ],
        },
        {
          id: 'sb-replacement',
          sandbox_id: 'sb-replacement',
          status: 'creating',
          provider: 'cloud-desktop',
          persistence: 'persistent',
        },
      );

      const result = await ensureBotComputer('bot-1', defaultBotVMOperatorConfig());

      expect(result.ok).toBe(true);
      expect(result.data?.id).toBe('sb-replacement');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('provisionFleetComputers (Phase 2 fleet action)', () => {
    it('provisions each enabled bot sequentially and skips bots without a computer', async () => {
      // bot-1: has a bound desktop (GET only); bot-2: none (GET+POST); bot-3: no vmOperator.
      const fetchMock = mockFetchSequence(
        {
          computers: [
            {
              id: 'sb-1',
              bot_id: 'bot-1',
              kind: 'cloud_desktop',
              status: 'running',
              provider: 'cloud-desktop',
              created_at: '2026-09-09T00:00:00Z',
              updated_at: '2026-09-09T00:05:00Z',
            },
          ],
        },
        { computers: [] },
        {
          id: 'sb-2',
          sandbox_id: 'sb-2',
          status: 'creating',
          provider: 'cloud-desktop',
          persistence: 'persistent',
        },
      );

      const results = await provisionFleetComputers([
        { id: 'bot-1', vmOperator: defaultBotVMOperatorConfig() },
        { id: 'bot-2', vmOperator: defaultBotVMOperatorConfig() },
        { id: 'bot-3' },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({ botId: 'bot-1', ok: true, computerId: 'sb-1' });
      expect(results[1]).toMatchObject({ botId: 'bot-2', ok: true, computerId: 'sb-2' });
      expect(results[2]).toMatchObject({ botId: 'bot-3', ok: true, skipped: true });
      // 3 fetch calls for 2 enabled bots, one of which needed a POST —
      // i.e. sequential, no duplicate provisioning.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const postCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST');
      expect(postCalls).toHaveLength(1);
      const body = JSON.parse(postCalls[0][1].body);
      expect(body).toMatchObject({ kind: 'cloud_desktop', bot_id: 'bot-2', persistence: 'persistent' });
    });
  });

  it('creates a sandbox via the unified computers API', async () => {
    mockFetchJson({
      id: 'sb-1',
      sandbox_id: 'sb-1',
      status: 'running',
      provider: 'cloud-desktop',
      persistence: 'session',
    });

    const config: AgentVMOperatorConfig = {
      enabled: true,
      provider: 'cloud-desktop',
      computerKind: 'cloud_desktop',
      image: 'ubuntu/desktop',
      networkPolicy: 'restricted',
      persistence: 'session',
      timeoutMinutes: 30,
    };

    const result = await createSandbox('agent-1', config);
    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('sb-1');
    expect(result.data?.provider).toBe('cloud-desktop');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/computers'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('provisions Incus/Tart substrates through the same computers API', async () => {
    mockFetchJson({
      id: 'incus-1',
      sandbox_id: 'incus-1',
      status: 'running',
      provider: 'incus',
      persistence: 'persistent',
    });

    const config: AgentVMOperatorConfig = {
      enabled: true,
      provider: 'incus',
      computerKind: 'cloud_desktop',
      persistence: 'persistent',
    };

    const result = await createSandbox('agent-1', config);
    expect(result.ok).toBe(true);
    expect(result.data?.provider).toBe('incus');
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toMatchObject({
      kind: 'cloud_desktop',
      bot_id: 'agent-1',
      provider: 'incus',
    });
  });

  it('creates a sandbox with a template id', async () => {
    mockFetchJson({
      id: 'sb-tpl',
      status: 'creating',
      provider: 'cloud-desktop',
      persistence: 'ephemeral',
    });

    const config: AgentVMOperatorConfig = {
      enabled: true,
      provider: 'cloud-desktop',
      computerKind: 'cloud_desktop',
      templateId: 'win11-pro',
      persistence: 'ephemeral',
    };

    const result = await createSandbox('agent-1', config);
    expect(result.ok).toBe(true);
    expect(result.data?.persistence).toBe('ephemeral');
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toMatchObject({
      kind: 'cloud_desktop',
      bot_id: 'agent-1',
      template_id: 'win11-pro',
      persistence: 'ephemeral',
    });
  });

  it('finds an existing sandbox via the unified computers API', async () => {
    mockFetchJson({
      computers: [
        {
          id: 'sb-existing',
          bot_id: 'agent-1',
          status: 'running',
          provider: 'cloud-desktop',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const result = await getSandboxForAgent('agent-1');
    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('sb-existing');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/computers?bot_id=agent-1'),
      expect.anything(),
    );
  });

  it('returns error when no active computer exists for agent', async () => {
    mockFetchJson({ computers: [] });

    const result = await getSandboxForAgent('agent-1');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No active sandbox');
  });

  it('deletes a computer via the unified computers API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    await expect(deleteComputer('sb-1')).resolves.not.toThrow();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/computers/sb-1/delete'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('runs a command via the computers shell API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ exit_code: 0, stdout: 'hello', stderr: '' }),
    }));

    const result = await runCommand('sb-1', 'echo hello');
    expect(result.ok).toBe(true);
    expect(result.data?.stdout).toBe('hello');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/computers/sb-1/shell'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not expose a dedicated browser-task endpoint', async () => {
    const result = await runBrowserTask('sb-1', 'https://example.com', 'scan the page');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Computer Cloud');
  });

  it('destroys a sandbox via the computers API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
    const result = await destroySandbox('sb-1');
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/computers/sb-1/delete'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('checks Computer Cloud health', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    }));
    const result = await healthCheck();
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe('ok');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/health'));
  });

  it('creates a snapshot through the bot desktop API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        snapshot_id: 'snap-1',
      }),
    }));

    const result = await snapshotSandbox('sb-1', 'before-upgrade', 'agent-1');
    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('snap-1');
    expect(result.data?.label).toBe('before-upgrade');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/bots/agent-1/desktop/snapshots'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('restores a snapshot through the bot desktop API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }));

    const result = await restoreSandbox('sb-1', 'snap-1', 'agent-1');
    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('sb-1');
    expect(result.data?.provider).toBe('cloud-desktop');
  });
});
