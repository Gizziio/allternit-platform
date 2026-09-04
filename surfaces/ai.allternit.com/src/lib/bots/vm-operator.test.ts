import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  beforeEach(() => {
    (globalThis as any).ALLTERNIT_SANDBOX_URL = 'http://localhost:8080';
  });

  afterEach(() => {
    delete (globalThis as any).ALLTERNIT_SANDBOX_URL;
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
      provider: 'opensandbox',
      persistence: 'session',
    });

    const config: AgentVMOperatorConfig = {
      enabled: true,
      provider: 'cloud-desktop',
      computerKind: 'cloud_desktop',
      image: 'opensandbox/desktop:v1.0.0',
      networkPolicy: 'restricted',
      persistence: 'session',
      timeoutMinutes: 30,
    };

    const result = await createSandbox('agent-1', config);
    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('sb-1');
    expect(result.data?.provider).toBe('opensandbox');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/computers'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('creates a sandbox with a template id', async () => {
    mockFetchJson({
      id: 'sb-tpl',
      status: 'creating',
      provider: 'opensandbox',
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
          provider: 'opensandbox',
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

  it('runs a command in a sandbox', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ exitCode: 0, stdout: 'hello', stderr: '' }),
    }));

    const result = await runCommand('sb-1', 'echo hello');
    expect(result.ok).toBe(true);
    expect(result.data?.stdout).toBe('hello');
  });

  it('runs a browser task in a sandbox', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, url: 'https://example.com' }),
    }));

    const result = await runBrowserTask('sb-1', 'https://example.com', 'scan the page');
    expect(result.ok).toBe(true);
    expect(result.data?.success).toBe(true);
  });

  it('destroys a sandbox', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const result = await destroySandbox('sb-1');
    expect(result.ok).toBe(true);
  });

  it('checks sandbox health', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    }));
    const result = await healthCheck();
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe('ok');
  });

  it('creates a snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'snap-1',
        sandboxId: 'sb-1',
        label: 'before-upgrade',
        createdAt: new Date().toISOString(),
      }),
    }));

    const result = await snapshotSandbox('sb-1', 'before-upgrade');
    expect(result.ok).toBe(true);
    expect(result.data?.label).toBe('before-upgrade');
  });

  it('restores a snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'sb-1',
        agentId: 'agent-1',
        status: 'running',
        provider: 'opensandbox',
      }),
    }));

    const result = await restoreSandbox('sb-1', 'snap-1');
    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('sb-1');
  });
});
