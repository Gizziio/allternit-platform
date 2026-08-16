import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSandbox,
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

  it('returns not configured when sandbox URL is missing', async () => {
    delete (globalThis as any).ALLTERNIT_SANDBOX_URL;
    const result = await createSandbox('agent-1', { enabled: true, provider: 'opensandbox' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('creates a sandbox when configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'sb-1',
        agentId: 'agent-1',
        status: 'running',
        provider: 'opensandbox',
      }),
    }));

    const config: AgentVMOperatorConfig = {
      enabled: true,
      provider: 'opensandbox',
      image: 'opensandbox/desktop:v1.0.0',
      networkPolicy: 'restricted',
      persistence: 'session',
      timeoutMinutes: 30,
    };

    const result = await createSandbox('agent-1', config);
    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('sb-1');
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
});
