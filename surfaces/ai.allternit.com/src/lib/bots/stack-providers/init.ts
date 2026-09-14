/**
 * Stack Provider Initialization
 *
 * Registers the default set of external agent providers and starts the sync
 * service. Called once at application startup.
 *
 * @module stack-providers/init
 */

import { registerStackProvider } from './registry';
import { createHermesProvider, HERMES_PROVIDER_ID } from './hermes-provider';
import { createOpenClawProvider, OPENCLAW_PROVIDER_ID } from './openclaw-provider';
import { createGrokProvider, GROK_PROVIDER_ID } from './grok-provider';
import { stackedAgentService } from '../stacked-agent.service';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('StackProvidersInit');

const MINI_APP_IDS: Record<string, string> = {
  [HERMES_PROVIDER_ID]: 'hermes-agent',
  [OPENCLAW_PROVIDER_ID]: 'openclaw-agent',
  [GROK_PROVIDER_ID]: 'grok-agent',
};

export function registerDefaultStackProviders(): void {
  registerStackProvider(HERMES_PROVIDER_ID, createHermesProvider);
  registerStackProvider(OPENCLAW_PROVIDER_ID, createOpenClawProvider);
  registerStackProvider(GROK_PROVIDER_ID, createGrokProvider);

  const providers = [
    createHermesProvider(),
    createOpenClawProvider(),
    createGrokProvider(),
  ];
  stackedAgentService.registerProviders(providers);
  stackedAgentService.startPolling();

  void autoDownloadMiniApps(providers);
}

async function autoDownloadMiniApps(providers: Array<{ id: string; isInstalled: () => Promise<boolean> }>): Promise<void> {
  if (typeof window === 'undefined') return;
  const miniApps = window.allternit?.miniApps;
  if (!miniApps) return;

  for (const provider of providers) {
    try {
      const installed = await provider.isInstalled();
      if (!installed) continue;

      const miniAppId = MINI_APP_IDS[provider.id];
      if (!miniAppId) continue;

      const status = await miniApps.getStatus(miniAppId);
      if (status.managed) {
        logger.debug(`Mini app '${miniAppId}' already managed`);
        continue;
      }

      logger.info(`Auto-downloading mini app '${miniAppId}' for provider '${provider.id}'`);
      await miniApps.install(miniAppId);
    } catch (err) {
      logger.warn({ err }, `Failed to auto-download mini app for provider '${provider.id}'`);
    }
  }
}
