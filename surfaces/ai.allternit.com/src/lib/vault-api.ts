/**
 * Vault (Lens) API client
 *
 * Thin wrapper around gizzi-code's /v1/vault/* routes (see
 * cmd/gizzi-code/src/runtime/server/routes/vault.ts) — lets the Settings UI
 * manage Lens context sources without the `gizzi vault ...` CLI.
 */

import { gizziBaseUrl, apiRequest } from './agents/api-config';

export interface VaultSource {
  id: string;
  name: string;
  description: string;
  authType: 'oauth' | 'apikey' | 'none';
  enabled: boolean;
  connected: boolean;
  authenticated: boolean;
  error: string | null;
  hasApiKey: boolean;
}

export interface VaultSyncResult {
  source: string;
  success: boolean;
  itemsSynced: number;
  errors: string[];
}

function vaultUrl(path: string): string {
  return `${gizziBaseUrl()}/v1/vault${path}`;
}

export async function listVaultSources(): Promise<VaultSource[]> {
  const res = await apiRequest<{ sources: VaultSource[] }>(vaultUrl('/sources'));
  return res.sources;
}

export async function setVaultSourceEnabled(id: string, enabled: boolean): Promise<void> {
  await apiRequest(vaultUrl(`/sources/${encodeURIComponent(id)}/enable`), {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

export async function setVaultSourceApiKey(id: string, apiKey: string): Promise<void> {
  await apiRequest(vaultUrl(`/sources/${encodeURIComponent(id)}/credentials`), {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export async function syncVaultSource(id: string): Promise<VaultSyncResult> {
  return apiRequest<VaultSyncResult>(vaultUrl(`/sources/${encodeURIComponent(id)}/sync`), {
    method: 'POST',
  });
}
