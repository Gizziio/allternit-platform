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
  clerkJwksUrl?: string;
  clerkIssuer?: string;
  clerkWebhookSecret?: string;
  gatewayUrl: string;
  terminalServerUrl: string;
  tenantId: string;
  /** When true, Clerk is optional and the local bundle is the auth authority. */
  selfHosted?: boolean;
}

export interface WizardState {
  lastRunAt?: string;
  lastRunVersion?: string;
  lastRunCommand?: string;
  lastRunMode?: string;
}

export interface UserConfig {
  defaultModel?: string;
  terminalServerUrl?: string;
  gatewayUrl?: string;
  providerApiKeys?: Record<string, unknown>;
  onboardingComplete?: boolean;
  ollamaUrl?: string;
  memoryUrl?: string;
  embeddingUrl?: string;
  agentWorkdir?: string;
  cronDaemonUrl?: string;
  wizard?: WizardState;
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
    return api.get('/api/onboarding/config');
  },

  saveConfig(config: UserConfig): Promise<{ success: boolean }> {
    return api.post('/api/onboarding/config', config);
  },

  discover(): Promise<DiscoveryResponse> {
    return api.get('/api/onboarding/discover');
  },

  /** Providers already authenticated on this machine (keychain / env / Gizzi config). */
  listProviderAuthStatus(): Promise<
    Array<{
      provider_id: string;
      status: 'ok' | 'missing' | 'expired' | 'unknown' | 'not_required';
      authenticated: boolean;
    }>
  > {
    return api.listProviderAuthStatus().then((r) => r.providers);
  },

  /** Discover models for a provider that already has a saved key (no key paste needed). */
  discoverProviderModels(provider: string): Promise<{
    supported: boolean;
    models: Array<{ id: string; name: string }>;
    default_model_id?: string;
  }> {
    return api.discoverProviderModels(provider).then((r) => ({
      supported: r.supported,
      models: (r.models ?? []).map((m) => ({ id: m.id, name: m.name })),
      default_model_id: r.default_model_id,
    }));
  },

  validateKey(provider: string, key: string): Promise<ValidateKeyResponse> {
    return api.post('/api/onboarding/validate-key', { provider, key });
  },

  saveProvider(payload: SaveProviderPayload): Promise<SaveProviderResponse> {
    return api.post('/api/onboarding/provider', payload);
  },

  /** Trigger a subscription/OAuth sign-in flow for a CLI provider (claude/codex/qwen/kimi/antigravity/zai). */
  connectProvider(id: string): Promise<{
    status: 'already_connected' | 'started' | 'not_installed' | 'needs_api_key';
    provider: string;
    label?: string;
    page?: string;
    binary?: string;
  }> {
    return api.post(`/api/v1/providers/${id}/connect`, {});
  },

  connectProviderStatus(id: string): Promise<{
    status: 'success' | 'pending';
    provider: string;
    label?: string;
  }> {
    return api.get(`/api/v1/providers/${id}/connect/status`);
  },

  /** User-attested completion of an interactive sign-in we could not auto-detect. */
  confirmProviderConnect(id: string): Promise<{ status: string; provider: string; confirmed?: boolean }> {
    return api.post(`/api/v1/providers/${id}/connect/confirm`, {});
  },
};
