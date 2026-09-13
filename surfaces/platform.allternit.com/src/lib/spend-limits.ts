/**
 * Spend-limit client — organization monthly cap, usage, and the
 * request-increase / approve / reject workflow.
 *
 * Endpoints (cmd/allternit-api/src/admin_spend_limit_routes.rs):
 *   GET  /api/v1/admin/spend-limits                -> SpendLimitRow (admin only)
 *   POST /api/v1/admin/spend-limits/increase-request { amount, reason? }
 *   POST /api/v1/admin/spend-limits/approve        { amount? }
 *   POST /api/v1/admin/spend-limits/reject         (no body)
 *   GET  /api/v1/users/me/balance                  -> { available_balance, ... }
 *
 * All monetary values are integer USD cents. The admin routes 403 for
 * non-admin members; /users/me/balance works for any org member.
 */

import { api } from "@/lib/api-client";

export interface SpendLimit {
  org_id: string;
  /** Monthly cap in USD cents. */
  monthly_usd_cap: number;
  /** Stored spend/credit offset in USD cents. */
  current_month_spend: number;
  increase_request_status: "pending" | "approved" | "rejected" | null;
  increase_request_amount: number | null;
  increase_request_reason: string | null;
  increase_request_created_at: string | null;
  increase_request_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserBalance {
  object: "balance";
  /** Remaining headroom in USD cents. */
  available_balance: number;
  /** Total monthly cap in USD cents. */
  total_balance: number;
  currency: string;
}

export async function getSpendLimit(): Promise<SpendLimit> {
  return api.get<SpendLimit>("/api/v1/admin/spend-limits");
}

export async function getUserBalance(): Promise<UserBalance> {
  return api.get<UserBalance>("/api/v1/users/me/balance");
}

export async function requestSpendLimitIncrease(input: {
  /** USD cents; must be > 0. */
  amount: number;
  reason?: string;
}): Promise<SpendLimit> {
  return api.post<SpendLimit>("/api/v1/admin/spend-limits/increase-request", {
    amount: input.amount,
    reason: input.reason?.trim() ? input.reason.trim() : null,
  });
}

export async function approveSpendLimitIncrease(amount?: number): Promise<SpendLimit> {
  return api.post<SpendLimit>("/api/v1/admin/spend-limits/approve", {
    amount: amount ?? null,
  });
}

export async function rejectSpendLimitIncrease(): Promise<SpendLimit> {
  return api.post<SpendLimit>("/api/v1/admin/spend-limits/reject");
}
