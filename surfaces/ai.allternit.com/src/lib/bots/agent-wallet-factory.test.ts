import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAgentWallet } from './agent-wallet-factory';

vi.mock('@/lib/agents/api-config', () => ({
  apiRequestWithError: vi.fn(async (_url: string, options?: RequestInit) => {
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    if (body.kind === 'identity') {
      return {
        wallet: {
          id: 'wallet-1',
          address: '0xetrid',
          keyVaultRef: 'vault-ref-1',
          provider: 'etrid',
        },
      };
    }
    throw new Error('Unexpected wallet request');
  }),
}));

describe('agent-wallet-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an Etrid wallet through the platform API', async () => {
    const result = await createAgentWallet('bot-a', 'etrid');
    expect(result.provider).toBe('etrid');
    expect(result.address).toBe('0xetrid');
    expect(result.keyVaultRef).toBe('vault-ref-1');
  });

  it('returns manual config for non-custodial wallets', async () => {
    const result = await createAgentWallet('bot-a', 'metamask', {
      chainId: '1',
      allowedMethods: ['receive'],
    });
    expect(result.provider).toBe('metamask');
    expect(result.address).toBeUndefined();
    expect(result.chainId).toBe('1');
    expect(result.allowedMethods).toEqual(['receive']);
  });
});
