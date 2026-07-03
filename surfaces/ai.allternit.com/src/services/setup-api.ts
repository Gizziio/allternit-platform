/**
 * Setup / onboarding API client.
 *
 * Bridges the brain-setup wizard to the Rust API. All provider keys are sent
 * to the backend once; the backend stores them in the OS keychain and writes
 * provider metadata to the Gizzi runtime config.
 */

import { api } from '@/integration/api-client';

export interface CompanyConfig {
  clerkPublishableKey?: string;
  gatewayUrl: string;
  terminalServerUrl: string;
  tenantId: string;
}

export interface UserConfig {
  defaultModel?: string;
  terminalServerUrl?: string;
  gatewayUrl?: string;
  providerApiKeys?: Record<string, unknown>;
  onboardingComplete?: boolean;
}

export interface SetupConfigResponse {
  company: CompanyConfig;
  user: UserConfig;
  onboardingComplete: boolean;
}

export interface DiscoveredCli {
  name: string;
  command: string;
  installed: boolean;
  version?: string;
}

export interface DiscoveryResponse {
  ollama: {
    running: boolean;
    models: Array<{ id: string; name: string }>;
  };
  lmstudio: {
    running: boolean;
    models: Array<{ id: string; name: string }>;
  };
  cli: DiscoveredCli[];
}

export interface ValidateKeyResponse {
  valid: boolean;
  models?: Array<{ id: string; name: string }>;
  error?: string;
}

export interface SaveProviderPayload {
  provider: string;
  name?: string;
  npm?: string;
  defaultModel?: string;
  apiKey?: string;
  baseURL?: string;
  authType?: 'api_key' | 'none' | 'bearer' | 'subprocess';
  subprocessCmd?: string;
  models?: Record<string, unknown>;
  setDefault?: boolean;
}

export interface SaveProviderResponse {
  success: boolean;
  provider: string;
}

export const setupApi = {
  getConfig(): Promise<SetupConfigResponse> {
    return api.get('/onboarding/config');
  },

  saveConfig(config: UserConfig): Promise<{ success: boolean }> {
    return api.post('/onboarding/config', config);
  },

  discover(): Promise<DiscoveryResponse> {
    return api.get('/onboarding/discover');
  },

  validateKey(provider: string, key: string): Promise<ValidateKeyResponse> {
    return api.post('/onboarding/validate-key', { provider, key });
  },

  saveProvider(payload: SaveProviderPayload): Promise<SaveProviderResponse> {
    return api.post('/onboarding/provider', payload);
  },
};
