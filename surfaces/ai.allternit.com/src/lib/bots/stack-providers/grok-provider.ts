/**
 * Grok Stack Provider (stub)
 *
 * Placeholder for importing Grok bots into Allternit. The auth model is TBD:
 * - User-supplied xAI API key stored in the desktop vault
 * - OAuth to xAI (if available)
 * - Browser automation of the Grok web UI
 *
 * Until the auth model is finalized, this provider registers itself but reports
 * as not installed and returns empty agent lists.
 *
 * @module stack-providers/grok-provider
 */

import type {
  AgentStackProvider,
  ExternalAgentReference,
  BotMemoryBundle,
  ProviderUsage,
} from './types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('GrokStackProvider');

export const GROK_PROVIDER_ID = 'grok';
export const GROK_PROVIDER_NAME = 'Grok';

export interface GrokProviderOptions {
  /** xAI API key; if absent the provider is not installed. */
  apiKey?: string;
}

export function createGrokProvider(options: GrokProviderOptions = {}): AgentStackProvider {
  return new GrokProvider(options);
}

class GrokProvider implements AgentStackProvider {
  readonly id = GROK_PROVIDER_ID;
  readonly name = GROK_PROVIDER_NAME;

  private apiKey?: string;

  constructor(options: GrokProviderOptions = {}) {
    this.apiKey = options.apiKey;
  }

  async isInstalled(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async listAgents(): Promise<ExternalAgentReference[]> {
    if (!this.apiKey) return [];

    // TODO: Replace with real xAI API call once auth model is finalized.
    // For now, advertise a single "Grok" agent so the UI can surface the provider.
    return [
      {
        providerId: this.id,
        externalId: 'grok-default',
        displayName: 'Grok',
        tagline: 'xAI Grok assistant',
        capabilities: ['chat'],
        pricing: { model: 'per_token', currency: 'USD' },
      },
    ];
  }

  async *sendMessage(externalId: string, session: string, message: string): AsyncIterable<string> {
    if (!this.apiKey) {
      yield 'Grok is not configured. Add an xAI API key in Settings.';
      return;
    }

    logger.info({ session }, `Sending message to Grok (${externalId})`);

    // TODO: Implement xAI chat completions streaming:
    // POST https://api.x.ai/v1/chat/completions
    // with Authorization: Bearer <apiKey>
    yield 'Grok integration is not fully implemented yet.';
  }

  async getStatus(externalId: string): Promise<'idle' | 'working' | 'error'> {
    return this.apiKey ? 'idle' : 'error';
  }

  async syncMemory(externalId: string): Promise<BotMemoryBundle> {
    // TODO: Import Grok conversation history once API supports it.
    return { entries: [], skills: [] };
  }

  async getUsage(externalId: string, since: Date): Promise<ProviderUsage> {
    // TODO: Read usage from xAI API response headers / usage field.
    return {
      messageCount: 0,
      tokenCount: 0,
      since: since.toISOString(),
    };
  }
}
