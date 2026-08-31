/**
 * Allternit Vault API client for the browser extension.
 *
 * Calls the Allternit gateway to store and retrieve password credentials.
 * All requests are authenticated with the user's Clerk JWT stored in
 * chrome.storage.local under `AllternitClerkJwt`.
 */

const GATEWAY_URL = 'http://127.0.0.1:8013';

export interface StoredCredential {
  id: string;
  credential_type: string;
  provider: string;
  username: string | null;
  origin_pattern: string | null;
}

export interface FilledCredential {
  credential_id: string;
  username: string | null;
  password: string;
}

export interface VaultSummary {
  id: string;
  name: string;
  description?: string | null;
}

interface StoredVault {
  id: string;
  name: string;
  description: string | null;
}

const VAULT_CACHE_KEY = 'AllternitExtensionVaultId';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get('AllternitClerkJwt');
  const token = result.AllternitClerkJwt;
  if (!token) {
    throw new Error('Not authenticated with Allternit');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function resolveVaultId(): Promise<string> {
  const cached = await chrome.storage.local.get(VAULT_CACHE_KEY);
  if (typeof cached[VAULT_CACHE_KEY] === 'string' && cached[VAULT_CACHE_KEY]) {
    return cached[VAULT_CACHE_KEY];
  }
  const vault = await ensureDefaultVault();
  await chrome.storage.local.set({ [VAULT_CACHE_KEY]: vault.id });
  return vault.id;
}

async function clearVaultCache(): Promise<void> {
  await chrome.storage.local.remove(VAULT_CACHE_KEY);
}

async function isVaultNotFound(response: Response): Promise<boolean> {
  if (response.status !== 404) return false;
  try {
    const body = (await response.clone().json()) as { error?: string };
    return body.error === 'vault_not_found';
  } catch {
    return false;
  }
}

async function fetchVault(
  path: string,
  init: RequestInit,
  operationName: string,
): Promise<Response> {
  const vaultId = await resolveVaultId();
  const url = `${GATEWAY_URL}/api/v1/beta/vaults/${vaultId}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    if (await isVaultNotFound(response)) {
      await clearVaultCache();
      const freshVaultId = await resolveVaultId();
      const retryResponse = await fetch(`${GATEWAY_URL}/api/v1/beta/vaults/${freshVaultId}${path}`, {
        ...init,
        headers: await getAuthHeaders(),
      });
      if (!retryResponse.ok) {
        const text = await retryResponse.text();
        throw new Error(`${operationName} failed: ${retryResponse.status} ${text}`);
      }
      return retryResponse;
    }
    const text = await response.text();
    throw new Error(`${operationName} failed: ${response.status} ${text}`);
  }
  return response;
}

export async function listVaults(): Promise<StoredVault[]> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/beta/vaults`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vault list failed: ${response.status} ${text}`);
  }
  const data = (await response.json()) as { vaults: StoredVault[] };
  return data.vaults || [];
}

export async function createVault(name: string, description?: string): Promise<StoredVault> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/beta/vaults`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ name, description }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vault create failed: ${response.status} ${text}`);
  }
  return (await response.json()) as StoredVault;
}

export async function ensureDefaultVault(): Promise<StoredVault> {
  const vaults = await listVaults();
  const defaultVault = vaults.find((v) => v.name === 'Default') ?? vaults[0];
  if (defaultVault) {
    return defaultVault;
  }
  return createVault('Default', 'Default credential vault for the Allternit browser extension.');
}

export async function listVaultCredentials(): Promise<StoredCredential[]> {
  const response = await fetchVault('/credentials', { method: 'GET' }, 'Vault credentials list');
  const data = (await response.json()) as { credentials: StoredCredential[] };
  return data.credentials || [];
}

export async function createPasswordCredential(
  provider: string,
  username: string,
  password: string,
  originPattern?: string,
): Promise<{ id: string }> {
  const response = await fetchVault(
    '/credentials/password',
    {
      method: 'POST',
      body: JSON.stringify({
        provider,
        username,
        password,
        origin_pattern: originPattern,
      }),
    },
    'Vault credential create',
  );
  return (await response.json()) as { id: string };
}

export async function deleteVaultCredential(credentialId: string): Promise<void> {
  await fetchVault(
    `/credentials/${credentialId}`,
    { method: 'DELETE' },
    'Vault credential delete',
  );
}

export async function findMatchingCredentials(origin: string): Promise<StoredCredential[]> {
  const vaultId = await resolveVaultId();
  const url = new URL(`${GATEWAY_URL}/api/v1/beta/vaults/${vaultId}/credentials/match`);
  url.searchParams.set('origin', origin);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    if (await isVaultNotFound(response)) {
      await clearVaultCache();
      const freshVaultId = await resolveVaultId();
      const retryUrl = new URL(`${GATEWAY_URL}/api/v1/beta/vaults/${freshVaultId}/credentials/match`);
      retryUrl.searchParams.set('origin', origin);
      const retryResponse = await fetch(retryUrl.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });
      if (!retryResponse.ok) {
        const text = await retryResponse.text();
        throw new Error(`Vault match failed: ${retryResponse.status} ${text}`);
      }
      const data = (await retryResponse.json()) as { credentials: StoredCredential[] };
      return data.credentials || [];
    }
    const text = await response.text();
    throw new Error(`Vault match failed: ${response.status} ${text}`);
  }
  const data = (await response.json()) as { credentials: StoredCredential[] };
  return data.credentials || [];
}

export async function fillCredential(credentialId: string): Promise<FilledCredential> {
  const response = await fetchVault(
    `/credentials/${credentialId}/fill`,
    {
      method: 'POST',
      body: JSON.stringify({ actor: 'browser-extension-autofill', context: 'login-form-autofill' }),
    },
    'Vault fill',
  );
  return (await response.json()) as FilledCredential;
}

export async function recordCredentialUse(credentialId: string): Promise<void> {
  await fetchVault(
    `/credentials/${credentialId}/use`,
    {
      method: 'POST',
      body: JSON.stringify({ actor: 'browser-extension-autofill', context: 'login-form-autofill' }),
    },
    'Vault record use',
  );
}
