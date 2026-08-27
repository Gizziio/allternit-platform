/**
 * Agent Identity Channel Provisioning
 *
 * Allocates owned email addresses, phone numbers, and wallets for bots. These
 * are real backend-backed resources; if the platform operator has not configured
 * the underlying provider, the call fails and the user can supply a manual value.
 */

import { apiRequest } from './api-config';
import type { AgentEmailChannel, AgentPhoneChannel, AgentWalletChannel } from './agent.types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('AgentIdentityProvisioning');

export interface ProvisionEmailResult {
  address: string;
  provider: AgentEmailChannel['provider'];
}

export interface ProvisionPhoneResult {
  number: string;
  provider: AgentPhoneChannel['provider'];
}

export interface ProvisionWalletResult {
  address: string;
  provider: AgentWalletChannel['provider'];
  chainId?: string | number;
  keyVaultRef?: string;
}

function provisioningError(err: unknown): Error {
  const status = (err as { status?: number }).status;
  const message = err instanceof Error ? err.message : 'Provisioning failed';
  if (status === 501 || status === 503) {
    return new Error(`${message} — configure the provider or enter the value manually.`);
  }
  return new Error(message);
}

export async function provisionAgentEmail(agentId: string): Promise<ProvisionEmailResult> {
  try {
    return await apiRequest<ProvisionEmailResult>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/identity/email`,
      { method: 'POST' },
    );
  } catch (err) {
    logger.error({ err, agentId }, 'Agent email provisioning failed');
    throw provisioningError(err);
  }
}

export async function provisionAgentPhone(agentId: string): Promise<ProvisionPhoneResult> {
  try {
    return await apiRequest<ProvisionPhoneResult>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/identity/phone`,
      { method: 'POST' },
    );
  } catch (err) {
    logger.error({ err, agentId }, 'Agent phone provisioning failed');
    throw provisioningError(err);
  }
}

export async function provisionAgentWallet(agentId: string): Promise<ProvisionWalletResult> {
  try {
    const response = await apiRequest<{
      wallet: {
        id: string;
        address?: string;
        keyVaultRef: string;
        provider: string;
      };
    }>(`/api/v1/agents/${encodeURIComponent(agentId)}/identity/wallet`, { method: 'POST' });
    if (!response.wallet?.address) {
      throw new Error('Etrid did not return a wallet address.');
    }
    return {
      address: response.wallet.address,
      provider: response.wallet.provider as AgentWalletChannel['provider'],
      keyVaultRef: response.wallet.keyVaultRef,
    };
  } catch (err) {
    logger.error({ err, agentId }, 'Agent wallet provisioning failed');
    throw provisioningError(err);
  }
}
