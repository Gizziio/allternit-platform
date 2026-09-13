/**
 * Service account client — organization-scoped non-human identities.
 *
 * Endpoints (cmd/allternit-api/src/admin_service_account_routes.rs):
 *   GET    /api/v1/admin/service-accounts        -> { service_accounts: [...] }
 *   POST   /api/v1/admin/service-accounts        -> account + client_secret (once)
 *   PATCH  /api/v1/admin/service-accounts/:id    -> updated account
 *   DELETE /api/v1/admin/service-accounts/:id    -> 204
 *   POST   /api/v1/admin/service-accounts/:id/rotate -> { id, client_id, client_secret, last_rotated_at }
 *
 * Owner/admin only — 403 "insufficient_role" for regular members. The POST
 * body takes `scopes` as a comma-separated string (not an array).
 */

import { api } from "@/lib/api-client";

export interface ServiceAccount {
  id: string;
  org_id: string;
  name: string;
  client_id: string;
  /** null when created without scopes (unrestricted). */
  scopes: string[] | null;
  created_at: string;
  last_rotated_at: string;
}

export interface CreatedServiceAccount extends ServiceAccount {
  /** Shown exactly once at creation; never stored server-side. */
  client_secret: string;
}

export interface RotatedServiceAccount {
  id: string;
  client_id: string;
  client_secret: string;
  last_rotated_at: string;
}

interface ServiceAccountJson {
  id: string;
  org_id: string;
  name: string;
  client_id: string;
  scopes?: string[] | null;
  created_at: string;
  last_rotated_at: string;
}

function mapAccount(json: ServiceAccountJson): ServiceAccount {
  return {
    id: json.id,
    org_id: json.org_id,
    name: json.name,
    client_id: json.client_id,
    scopes: json.scopes ?? null,
    created_at: json.created_at,
    last_rotated_at: json.last_rotated_at,
  };
}

export async function listServiceAccounts(): Promise<ServiceAccount[]> {
  const data = await api.get<{ service_accounts: ServiceAccountJson[] }>(
    "/api/v1/admin/service-accounts"
  );
  return (data.service_accounts ?? []).map(mapAccount);
}

export async function createServiceAccount(input: {
  name: string;
  scopes: string[];
}): Promise<CreatedServiceAccount> {
  const json = await api.post<ServiceAccountJson & { client_secret: string }>(
    "/api/v1/admin/service-accounts",
    {
      name: input.name.trim(),
      // The handler parses a comma-separated string, not an array.
      scopes: input.scopes.length > 0 ? input.scopes.join(",") : null,
    }
  );
  return { ...mapAccount(json), client_secret: json.client_secret };
}

export async function updateServiceAccount(
  id: string,
  input: { name?: string; scopes?: string[] }
): Promise<ServiceAccount> {
  const body: { name?: string; scopes?: string | null } = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.scopes !== undefined) {
    body.scopes = input.scopes.length > 0 ? input.scopes.join(",") : null;
  }
  const json = await api.patch<ServiceAccountJson>(
    `/api/v1/admin/service-accounts/${id}`,
    body
  );
  return mapAccount(json);
}

export async function deleteServiceAccount(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/service-accounts/${id}`);
}

export async function rotateServiceAccount(id: string): Promise<RotatedServiceAccount> {
  return api.post<RotatedServiceAccount>(`/api/v1/admin/service-accounts/${id}/rotate`);
}
