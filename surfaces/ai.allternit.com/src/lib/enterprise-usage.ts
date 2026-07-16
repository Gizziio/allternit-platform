export interface EnterpriseUsageLineItem {
  description: string;
  resource_type: string;
  quantity: number;
  unit: string;
  subtotal_cents: number;
}

export interface EnterpriseUsageSummary {
  organization_id: string;
  period_start: string;
  period_end: string;
  line_items: EnterpriseUsageLineItem[];
  total_cents: number;
  seller_legal_name: string;
  seller_address_lines: string[];
  payment_terms: string;
}

export async function getEnterpriseUsageSummary(
  organizationId: string,
  periodStart: string,
  periodEnd: string,
): Promise<EnterpriseUsageSummary> {
  const query = new URLSearchParams({
    organization_id: organizationId,
    period_start: periodStart,
    period_end: periodEnd,
  });
  const response = await fetch(`/api/v1/usage/summary?${query.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.message ||
        payload.error ||
        `Usage summary failed (${response.status})`,
    );
  }
  return payload as EnterpriseUsageSummary;
}
