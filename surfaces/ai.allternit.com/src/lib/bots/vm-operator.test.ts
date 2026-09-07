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
