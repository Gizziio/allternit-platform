/**
 * Agent Wallet Factory
 *
 * Creates or resolves wallets for bots across providers. Etrid is the native
 * Allternit wallet; other providers (MetaMask, Coinbase, Rainbow, Phantom,
 * custom) require the user to supply an address or use a browser extension.
 *
 * @module agent-wallet-factory
 */

import type { AgentWalletChannel } from '@/lib/agents/agent.types';
import { apiRequestWithError } from '@/lib/agents/api-config';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('AgentWalletFactory');

export interface WalletFactoryResult {
  provider: AgentWalletChannel['provider'];
  address?: string;
  chainId?: string | number;
  keyVaultRef?: string;
  allowedMethods: Array<'send' | 'receive' | 'swap' | 'stake' | 'invoice'>;
}

interface EtridProvisionResponse {
  wallet: {
    id: string;
    address?: string;
    keyVaultRef: string;
    provider: string;
  };
}

export async function createAgentWallet(
  agentId: string,
  provider: AgentWalletChannel['provider'],
  opts?: { chainId?: string | number; allowedMethods?: WalletFactoryResult['allowedMethods'] },
): Promise<WalletFactoryResult> {
  const allowedMethods = opts?.allowedMethods || ['receive', 'invoice'];

  switch (provider) {
    case 'etrid': {
      const { wallet } = await apiRequestWithError<EtridProvisionResponse>(
        `/api/v1/agents/${encodeURIComponent(agentId)}/identity/wallet`,
        {
          method: 'POST',
          body: JSON.stringify({
            kind: 'identity',
            chainId: opts?.chainId,
            allowedMethods,
          }),
        },
      );
      if (!wallet.address) {
        throw new Error('Etrid did not return a wallet address.');
      }
      return {
        provider: 'etrid',
        address: wallet.address,
        keyVaultRef: wallet.keyVaultRef,
        allowedMethods,
      };
    }

    case 'metamask':
    case 'coinbase_wallet':
    case 'rainbow':
    case 'phantom':
    case 'custom': {
      // Browser/extension wallets cannot be auto-created. The caller must
      // supply an address after user authorization.
      logger.info({ agentId, provider }, 'Non-custodial wallet requires manual address');
      return {
        provider,
        chainId: opts?.chainId,
        allowedMethods,
      };
    }

    default:
      throw new Error(`Unsupported wallet provider: ${provider}`);
  }
}
