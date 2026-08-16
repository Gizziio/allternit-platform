import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createEtridWallet,
  listEtridWallets,
  signWithEtridWallet,
  createEtridInvoice,
} from './etrid-client';

describe('etrid-client', () => {
  beforeEach(() => {
    (globalThis as any).ALLTERNIT_ETRID_URL = 'http://localhost:8723';
  });

  afterEach(() => {
    delete (globalThis as any).ALLTERNIT_ETRID_URL;
    vi.restoreAllMocks();
  });

  it('creates an Etrid wallet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'wallet-1',
          agentId: 'bot-a',
          kind: 'identity',
          address: '0x123',
          keyVaultRef: 'vault-ref-1',
          createdAt: new Date().toISOString(),
        }),
      }),
    );

    const wallet = await createEtridWallet('bot-a', 'identity', 'primary');
    expect(wallet.address).toBe('0x123');
    expect(wallet.keyVaultRef).toBe('vault-ref-1');
  });

  it('lists wallets for an agent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          wallets: [
            {
              id: 'wallet-1',
              agentId: 'bot-a',
              kind: 'identity',
              address: '0x123',
              keyVaultRef: 'vault-ref-1',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      }),
    );

    const wallets = await listEtridWallets('bot-a');
    expect(wallets).toHaveLength(1);
    expect(wallets[0].address).toBe('0x123');
  });

  it('signs a message with a wallet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ signature: '0xabc' }),
      }),
    );

    const result = await signWithEtridWallet('wallet-1', 'hello');
    expect(result.signature).toBe('0xabc');
  });

  it('creates an invoice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          invoice_id: 'inv-1',
          wallet_id: 'wallet-1',
          amount: '100',
          currency: 'USD',
          uri: 'etrid:pay:inv-1',
          createdAt: new Date().toISOString(),
        }),
      }),
    );

    const invoice = await createEtridInvoice({
      wallet_id: 'wallet-1',
      amount: '100',
      currency: 'USD',
      memo: 'Test invoice',
    });

    expect(invoice.uri).toBe('etrid:pay:inv-1');
  });
});
