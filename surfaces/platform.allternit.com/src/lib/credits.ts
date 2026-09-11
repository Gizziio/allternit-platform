import { api } from "@/lib/api-client";

export interface FreeInferenceUsage {
  monthly_allowance_usd: number;
  used_usd: number;
  remaining_usd: number;
}

export interface CreditsBalance {
  balance_usd: number;
  month_to_date_usage_usd: number;
  free_inference?: FreeInferenceUsage;
}

function billingApiBaseUrl(): string {
  return String(
    import.meta.env.VITE_ALLTERNIT_CLOUD_API_URL || "https://api.allternit.com",
  ).replace(/\/$/, "");
}

/**
 * Current credit balance for the signed-in user. Same endpoint and auth shape
 * as the BillingPage credits panel (allternit-cloud-api).
 */
export async function getCreditsBalance(
  token: string,
  signal?: AbortSignal,
): Promise<CreditsBalance> {
  const response = await fetch(`${billingApiBaseUrl()}/api/v1/billing/credits`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload.message ||
        payload.error ||
        `Unable to load credit balance (${response.status})`,
    );
  }
  return (await response.json()) as CreditsBalance;
}

export function formatCreditsUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export interface OrgCreditsBalance {
  organization_id: string;
  balance_cents: number;
  available_cents: number;
  held_cents: number;
  currency: string;
}

export interface TransferFromWalletResult {
  organization_id: string;
  balance_cents: number;
  available_cents: number;
  wallet_balance_usd: number;
}

/**
 * Organization compute-credits balance (the fabric ledger in allternit-api,
 * served through the gateway). Personal users without an org get null.
 */
export async function getOrgCreditsBalance(): Promise<OrgCreditsBalance | null> {
  try {
    return await api.get<OrgCreditsBalance>("/api/v1/credits/balance");
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 403 || status === 404) return null; // no active org
    }
    throw err;
  }
}

/**
 * Move credits from the signed-in user's Stripe-backed wallet into the
 * active organization's fabric compute ledger. Idempotent via idempotencyKey
 * (generate one per user action, reuse it on retry).
 */
export async function transferWalletToOrg(
  amountCents: number,
  idempotencyKey?: string,
): Promise<TransferFromWalletResult> {
  return api.post<TransferFromWalletResult>("/api/v1/credits/transfer_from_wallet", {
    amount_cents: amountCents,
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
  });
}
