// §S3 — quota pools, signals, entitlements
import { z } from "zod";
import { capabilityIdSchema } from "./capability";

export const quotaSignalSchema = z.object({
  kind: z.enum([
    "limit_banner",
    "hard_error",
    "model_downgraded",
    "slow_mode",
    "reset_notice",
    "counter_visible",
  ]),
  raw_excerpt: z.string().max(500),
  observed_at: z.string(),
  task_id: z.string().nullable(),
});
export type QuotaSignal = z.infer<typeof quotaSignalSchema>;

export const quotaPoolSchema = z.object({
  pool_key: z.string(),
  pool_id: z.string(),
  state: z.enum(["available", "estimated", "unknown", "degraded", "cooling_down", "exhausted"]),
  remaining: z.number().nullable(),
  remaining_confidence: z.enum(["exact", "estimated", "none"]),
  window: z.object({
    kind: z.enum(["rolling", "fixed", "unknown"]),
    seconds: z.number().nullable(),
  }),
  reset_at: z.string().nullable(),
  reset_at_source: z.enum(["provider_ui", "error_message", "documented", "inferred"]).nullable(),
  local_used_in_window: z.number(),
  local_budget: z.number().nullable(),
  cooldown_until: z.string().nullable(),
  last_signal: quotaSignalSchema.nullable(),
  updated_at: z.string(),
});
export type QuotaPool = z.infer<typeof quotaPoolSchema>;

// Computed join of Account × Manifest × QuotaPool × SessionHealth — never a
// stored record.
export const entitlementSchema = z.object({
  account_id: z.string(),
  capability: capabilityIdSchema,
  pool_key: z.string(),
  available: z.boolean(),
  reason_unavailable: z.string().optional(),
});
export type Entitlement = z.infer<typeof entitlementSchema>;
