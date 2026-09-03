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

export async function fillCredential(
  credentialId: string,
  origin?: string,
): Promise<FilledCredential> {
  const response = await fetchVault(
    `/credentials/${credentialId}/fill`,
    {
      method: 'POST',
      body: JSON.stringify({
        actor: 'browser-extension-autofill',
        context: 'login-form-autofill',
        origin,
      }),
    },
    'Vault fill',
  );
  return (await response.json()) as FilledCredential;
}

export async function recordCredentialUse(credentialId: string, origin?: string): Promise<void> {
  await fetchVault(
    `/credentials/${credentialId}/use`,
    {
      method: 'POST',
      body: JSON.stringify({
        actor: 'browser-extension-autofill',
        context: 'login-form-autofill',
        origin,
      }),
    },
    'Vault record use',
  );
}

// Passkey / WebAuthn challenge/registration/authentication endpoints.
//
// Note: WebAuthn credentials are origin-bound. The extension sidepanel runs
// under `chrome-extension://<id>` and cannot itself act as the relying-party
// origin. These helpers call the backend, but the actual `navigator.credentials`
// call must happen from the configured RP origin (e.g. the Allternit platform
// page). The sidepanel UI attempts the call for convenience and falls back to
// opening the platform page when the origin is rejected.

export interface PasskeyChallenge {
  challenge_id: string;
  options: PublicKeyCredentialCreationOptions | PublicKeyCredentialRequestOptions;
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function decodePasskeyChallenge(challenge: PasskeyChallenge): PasskeyChallenge {
  const options = challenge.options as Record<string, unknown>;
  const decoded: Record<string, unknown> = { ...options };

  if (typeof options.challenge === 'string') {
    decoded.challenge = base64UrlToBuffer(options.challenge);
  }
  if (options.user && typeof (options.user as Record<string, unknown>).id === 'string') {
    const user = { ...(options.user as Record<string, unknown>) };
    user.id = base64UrlToBuffer(user.id as string);
    decoded.user = user;
  }
  if (Array.isArray(options.excludeCredentials)) {
    decoded.excludeCredentials = options.excludeCredentials.map((cred: Record<string, unknown>) => ({
      ...cred,
      id: typeof cred.id === 'string' ? base64UrlToBuffer(cred.id) : cred.id,
    }));
  }
  if (Array.isArray(options.allowCredentials)) {
    decoded.allowCredentials = options.allowCredentials.map((cred: Record<string, unknown>) => ({
      ...cred,
      id: typeof cred.id === 'string' ? base64UrlToBuffer(cred.id) : cred.id,
    }));
  }

  return { ...challenge, options: decoded as PasskeyChallenge['options'] };
}

export async function createPasskeyChallenge(provider: string): Promise<PasskeyChallenge> {
  const response = await fetchVault(
    '/credentials/passkey/challenge/register',
    {
      method: 'POST',
      body: JSON.stringify({ provider }),
    },
    'Passkey challenge create',
  );
  return decodePasskeyChallenge((await response.json()) as PasskeyChallenge);
}

export async function finishPasskeyRegistration(
  challengeId: string,
  credential: PublicKeyCredential,
  provider: string,
): Promise<{ id: string; credential_id: string; provider: string }> {
  const response = await fetchVault(
    '/credentials/passkey/register',
    {
      method: 'POST',
      body: JSON.stringify({
        challenge_id: challengeId,
        provider,
        credential: credential.toJSON(),
      }),
    },
    'Passkey register finish',
  );
  return (await response.json()) as { id: string; credential_id: string; provider: string };
}

export async function createPasskeyAuthenticationChallenge(
  credentialId?: string,
): Promise<PasskeyChallenge> {
  const response = await fetchVault(
    '/credentials/passkey/challenge/authenticate',
    {
      method: 'POST',
      body: JSON.stringify({ credential_id: credentialId }),
    },
    'Passkey authentication challenge',
  );
  return decodePasskeyChallenge((await response.json()) as PasskeyChallenge);
}

export async function finishPasskeyAuthentication(
  challengeId: string,
  credential: PublicKeyCredential,
): Promise<{ authenticated: boolean; credential_id: string }> {
  const response = await fetchVault(
    '/credentials/passkey/authenticate',
    {
      method: 'POST',
      body: JSON.stringify({
        challenge_id: challengeId,
        credential: credential.toJSON(),
      }),
    },
    'Passkey authenticate finish',
  );
  return (await response.json()) as { authenticated: boolean; credential_id: string };
}
