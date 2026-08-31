/**
 * Allternit Vault API client for the browser extension.
 *
 * Calls the Allternit gateway to store and retrieve password credentials.
 * All requests are authenticated with the user's Clerk JWT stored in
 * chrome.storage.local under `AllternitClerkJwt`.
 */

const GATEWAY_URL = 'http://127.0.0.1:8013';

interface StoredCredential {
  id: string;
  credential_type: string;
  provider: string;
  username: string | null;
  origin_pattern: string | null;
}

interface FilledCredential {
  credential_id: string;
  username: string | null;
  password: string;
}

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

function getVaultId(): string {
  // TODO: support multiple vaults via settings.
  return 'default';
}

export async function findMatchingCredentials(origin: string): Promise<StoredCredential[]> {
  const vaultId = getVaultId();
  const url = new URL(`${GATEWAY_URL}/api/v1/beta/vaults/${vaultId}/credentials/match`);
  url.searchParams.set('origin', origin);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vault match failed: ${response.status} ${text}`);
  }
  const data = (await response.json()) as { credentials: StoredCredential[] };
  return data.credentials || [];
}

export async function fillCredential(credentialId: string): Promise<FilledCredential> {
  const vaultId = getVaultId();
  const response = await fetch(
    `${GATEWAY_URL}/api/v1/beta/vaults/${vaultId}/credentials/${credentialId}/fill`,
    {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ actor: 'browser-extension-autofill', context: 'login-form-autofill' }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vault fill failed: ${response.status} ${text}`);
  }
  return (await response.json()) as FilledCredential;
}

export async function recordCredentialUse(credentialId: string): Promise<void> {
  const vaultId = getVaultId();
  await fetch(
    `${GATEWAY_URL}/api/v1/beta/vaults/${vaultId}/credentials/${credentialId}/use`,
    {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ actor: 'browser-extension-autofill', context: 'login-form-autofill' }),
    },
  );
}
