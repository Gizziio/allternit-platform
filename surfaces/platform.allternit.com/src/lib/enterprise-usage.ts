import { api } from '@/lib/api-client';

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
  return api.get<EnterpriseUsageSummary>(`/api/v1/usage/summary?${query.toString()}`);
}
