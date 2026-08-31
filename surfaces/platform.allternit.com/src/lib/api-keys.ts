/**
 * Platform API key client.
 *
 * The backend for scoped platform API keys is not yet live, so this module
 * currently persists keys in localStorage and prefixes them with
 * `allternit_platform_test_`. Once the cloud API exposes /api/v1/api-keys,
 * swap this implementation for real API calls.
 */

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface CreatedApiKey extends ApiKey {
  token: string;
}

const STORAGE_KEY = "allternit_platform_api_keys_v1";
const TOKEN_PREFIX = "allternit_platform_test_";

function readKeys(): ApiKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ApiKey[]) : [];
  } catch {
    return [];
  }
}

function writeKeys(keys: ApiKey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

function randomId() {
  return `key_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function randomToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${TOKEN_PREFIX}${token}`;
}

export async function listApiKeys(): Promise<ApiKey[]> {
  return readKeys().filter((key) => !key.revokedAt);
}

export async function createApiKey(input: {
  name: string;
  scopes: string[];
}): Promise<CreatedApiKey> {
  const token = randomToken();
  const key: ApiKey = {
    id: randomId(),
    name: input.name.trim() || "Unnamed key",
    prefix: token.slice(0, 16),
    scopes: input.scopes.length ? input.scopes : ["read"],
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };
  writeKeys([key, ...readKeys()]);
  return { ...key, token };
}

export async function revokeApiKey(id: string): Promise<void> {
  const keys = readKeys();
  const next = keys.map((key) =>
    key.id === id ? { ...key, revokedAt: new Date().toISOString() } : key
  );
  writeKeys(next);
}
