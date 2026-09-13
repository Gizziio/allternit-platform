/**
 * LLM gateway virtual-key client (`ak-…` keys for /v1/* routes).
 *
 * Endpoints (cmd/allternit-api/src/llm_gateway/keys.rs):
 *   GET    /api/v1/gateway/keys          -> { keys }  (list shape: keys.rs:238-275)
 *   POST   /api/v1/gateway/keys          -> row incl. one-time plaintext `key`
 *   PATCH  /api/v1/gateway/keys/:id      -> updated row (null clears a field)
 *   DELETE /api/v1/gateway/keys/:id      -> revoke ({ id, revoked: true })
 *
 * Budgets are integer USD cents per month; rate_limit_rpm must be ≥ 1 when set.
 */

import { api } from "@/lib/api-client";

export interface GatewayKey {
  id: string;
  key_prefix: string | null;
  name: string | null;
  revoked: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  monthly_budget_cents: number | null;
  rate_limit_rpm: number | null;
  allowed_models: string[] | null;
  created_at: string | null;
}

export interface CreatedGatewayKey {
  id: string;
  name: string | null;
  key_prefix: string | null;
  /** Plaintext `ak-…` key — shown exactly once at creation. */
  key: string;
  warning: string;
  monthly_budget_cents: number | null;
  rate_limit_rpm: number | null;
  allowed_models: string[] | null;
  created_at: string;
}

export interface UpdateGatewayKeyResult {
  id: string;
  name: string | null;
  monthly_budget_cents: number | null;
  rate_limit_rpm: number | null;
  allowed_models: string[] | null;
}

export interface CreateGatewayKeyInput {
  name?: string;
  monthly_budget_cents?: number;
  rate_limit_rpm?: number;
}

export interface UpdateGatewayKeyInput {
  name?: string | null;
  monthly_budget_cents?: number | null;
  rate_limit_rpm?: number | null;
}

export async function listGatewayKeys(): Promise<GatewayKey[]> {
  const data = await api.get<{ keys: GatewayKey[] }>("/api/v1/gateway/keys");
  return data.keys ?? [];
}

export async function createGatewayKey(input: CreateGatewayKeyInput): Promise<CreatedGatewayKey> {
  const body: Record<string, unknown> = {};
  if (input.name?.trim()) body.name = input.name.trim();
  if (input.monthly_budget_cents !== undefined) body.monthly_budget_cents = input.monthly_budget_cents;
  if (input.rate_limit_rpm !== undefined) body.rate_limit_rpm = input.rate_limit_rpm;
  return api.post<CreatedGatewayKey>("/api/v1/gateway/keys", body);
}

export async function updateGatewayKey(
  id: string,
  input: UpdateGatewayKeyInput
): Promise<UpdateGatewayKeyResult> {
  return api.patch<UpdateGatewayKeyResult>(`/api/v1/gateway/keys/${id}`, input);
}

export async function revokeGatewayKey(id: string): Promise<void> {
  await api.delete(`/api/v1/gateway/keys/${id}`);
}
