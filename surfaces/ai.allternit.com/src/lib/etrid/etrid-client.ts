/**
 * Etrid Client — Native Agent Wallet
 *
 * Talks to the Allternit-native Etrid wallet service. Etrid gives bots a
 * scoped cryptographic identity and payment capability without requiring
 * users to bring their own wallet.
 *
 * The service may not be live yet; this client is the production integration
 * surface. When Etrid is unavailable, provisioning falls back to the generic
 * platform endpoint in `agent-identity-provisioning.ts`.
 *
 * @module etrid-client
 */

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('Etrid');

export interface EtridWallet {
  id: string;
  agentId: string;
  kind: 'identity' | 'evm';
  address: string;
  keyVaultRef: string;
  createdAt: string;
}

export interface EtridCreateWalletRequest {
  agent_id: string;
  kind?: 'identity' | 'evm';
  label?: string;
}

export interface EtridInvoiceRequest {
  wallet_id: string;
  amount: string;
  currency: string;
  memo?: string;
}

export interface EtridInvoice {
  invoice_id: string;
  wallet_id: string;
  amount: string;
  currency: string;
  uri: string;
  createdAt: string;
}

export interface EtridSignRequest {
  wallet_id: string;
  message: string;
}

export interface EtridSignResponse {
  signature: string;
}

function getEtridBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return (
    (window as any).ALLTERNIT_ETRID_URL ||
    process.env.NEXT_PUBLIC_ETRID_URL ||
    'http://localhost:8723'
  );
}

function etridError(err: unknown): Error {
  return err instanceof Error ? err : new Error('Etrid request failed');
}

export async function createEtridWallet(
  agentId: string,
  kind: 'identity' | 'evm' = 'identity',
  label?: string,
): Promise<EtridWallet> {
  const baseUrl = getEtridBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, kind, label } satisfies EtridCreateWalletRequest),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`Etrid returned ${res.status}: ${text}`);
    }

    return (await res.json()) as EtridWallet;
  } catch (err) {
    logger.error({ err, agentId }, 'Failed to create Etrid wallet');
    throw etridError(err);
  }
}

export async function listEtridWallets(agentId: string): Promise<EtridWallet[]> {
  const baseUrl = getEtridBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/wallets/${encodeURIComponent(agentId)}`);
    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`Etrid returned ${res.status}: ${text}`);
    }
    return ((await res.json()) as { wallets?: EtridWallet[] }).wallets ?? [];
  } catch (err) {
    logger.error({ err, agentId }, 'Failed to list Etrid wallets');
    throw etridError(err);
  }
}

export async function signWithEtridWallet(
  walletId: string,
  message: string,
): Promise<EtridSignResponse> {
  const baseUrl = getEtridBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/wallets/${encodeURIComponent(walletId)}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_id: walletId, message } satisfies EtridSignRequest),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`Etrid returned ${res.status}: ${text}`);
    }

    return (await res.json()) as EtridSignResponse;
  } catch (err) {
    logger.error({ err, walletId }, 'Failed to sign with Etrid wallet');
    throw etridError(err);
  }
}

export async function createEtridInvoice(req: EtridInvoiceRequest): Promise<EtridInvoice> {
  const baseUrl = getEtridBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`Etrid returned ${res.status}: ${text}`);
    }

    return (await res.json()) as EtridInvoice;
  } catch (err) {
    logger.error({ err, req }, 'Failed to create Etrid invoice');
    throw etridError(err);
  }
}
