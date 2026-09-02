/**
 * Platform API key client.
 *
 * Talks to the Allternit Cloud API at /api/v1/api-keys. Keys are created,
 * listed, and revoked server-side; only the full token is returned once at
 * creation time.
 */

import { api, formatApiError, AllternitApiError } from "@/lib/api-client";

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

interface ApiKeyJson {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

interface CreatedApiKeyJson extends ApiKeyJson {
  token: string;
}

function mapKey(json: ApiKeyJson): ApiKey {
  return {
    id: json.id,
    name: json.name,
    prefix: json.prefix,
    scopes: json.scopes,
    createdAt: json.createdAt,
    lastUsedAt: json.lastUsedAt,
    revokedAt: json.revokedAt,
  };
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const data = await api.get<ApiKeyJson[]>("/api/v1/api-keys");
  return data.map(mapKey);
}

export async function createApiKey(input: {
  name: string;
  scopes: string[];
}): Promise<CreatedApiKey> {
  const json = await api.post<CreatedApiKeyJson>("/api/v1/api-keys", {
    name: input.name.trim(),
    scopes: input.scopes,
  });

  return {
    ...mapKey(json),
    token: json.token,
  };
}

export async function revokeApiKey(id: string): Promise<void> {
  await api.delete(`/api/v1/api-keys/${id}`);
}

export { formatApiError, AllternitApiError };
