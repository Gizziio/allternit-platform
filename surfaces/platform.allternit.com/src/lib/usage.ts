import { api } from "@/lib/api-client";

export interface CostSummary {
  user_id: string;
  current_month_cost: number;
  monthly_budget: number;
  budget_utilization_percent: number;
  budget_status: "ok" | "warning" | "over_budget";
  currency: string;
  run_count: number;
  total_duration_seconds: number;
  total_duration_hours: number;
}

export interface CostBreakdownItem {
  provider?: string;
  region?: string;
  instance_type?: string;
  total_cost: number;
  run_count: number;
  total_duration_seconds: number;
}

export async function getCostSummary(): Promise<CostSummary> {
  return api.get<CostSummary>("/api/v1/costs/summary");
}

export async function getCostBreakdown(groupBy?: string): Promise<CostBreakdownItem[]> {
  const query = groupBy ? `?group_by=${encodeURIComponent(groupBy)}` : "";
  return api.get<CostBreakdownItem[]>(`/api/v1/costs/breakdown${query}`);
}
