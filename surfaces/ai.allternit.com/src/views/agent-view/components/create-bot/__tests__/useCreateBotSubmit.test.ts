import { describe, it, expect, vi } from 'vitest';
import type { Computer } from '@/lib/computers-api';
import { defaultBotVMOperatorConfig } from '@/lib/bots/vm-operator';
import { pollBotComputerProvisioning } from '../useCreateBotSubmit';

function computer(status: Computer['status'], botId = 'bot_1'): Computer {
  return {
    id: 'comp_1',
    kind: 'cloud_desktop',
    provider: 'incus',
    status,
    owner_type: 'bot',
    owner_id: botId,
    bot_id: botId,
    name: 'Test',
    billing_source: 'org',
    created_at: '2026-09-09T00:00:00Z',
    updated_at: '2026-09-09T00:00:00Z',
  };
}

const vmConfig = defaultBotVMOperatorConfig();

describe('pollBotComputerProvisioning', () => {
  it('returns running as soon as the desktop reports running', async () => {
    const statuses: Computer['status'] = ['creating', 'creating', 'running'];
    const listFn = vi.fn(async () => [computer(statuses.shift()!)]);
    const onStatus = vi.fn();

    const result = await pollBotComputerProvisioning('bot_1', vmConfig, listFn as never, {
      pollMs: 1,
      onStatus,
    });

    expect(result).toBe('running');
    expect(onStatus).toHaveBeenLastCalledWith('running');
  });

  it('ignores computers bound to other bots and deleted records', async () => {
    const listFn = vi.fn(async () => [
      computer('running', 'bot_other'),
      { ...computer('running'), status: 'deleted' as const },
    ]);
    // No own record → never terminal → must hit the timeout cap.
    const result = await pollBotComputerProvisioning('bot_1', vmConfig, listFn as never, {
      pollMs: 1,
      timeoutMs: 20,
    });
    expect(result).toBe('timeout');
  });

  it('survives transient list failures and keeps polling', async () => {
    let calls = 0;
    const listFn = vi.fn(async (): Promise<Computer[]> => {
      calls += 1;
      if (calls === 1) throw new Error('network down');
      return [computer('running')];
    });

    const result = await pollBotComputerProvisioning('bot_1', vmConfig, listFn as never, {
      pollMs: 1,
    });
    expect(result).toBe('running');
    expect(calls).toBe(2);
  });

  it('returns error on a terminal error status', async () => {
    const listFn = vi.fn(async () => [computer('error')]);
    const result = await pollBotComputerProvisioning('bot_1', vmConfig, listFn as never, {
      pollMs: 1,
    });
    expect(result).toBe('error');
  });

  it('caps polling with timeout instead of polling forever', async () => {
    const listFn = vi.fn(async () => [computer('creating')]);
    const start = Date.now();
    const result = await pollBotComputerProvisioning('bot_1', vmConfig, listFn as never, {
      pollMs: 1,
      timeoutMs: 30,
    });
    expect(result).toBe('timeout');
    expect(Date.now() - start).toBeLessThan(2_000);
  });
});
