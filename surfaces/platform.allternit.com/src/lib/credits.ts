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
