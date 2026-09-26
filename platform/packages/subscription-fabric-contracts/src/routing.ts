// §A2 — Router interface + snapshot. `resolve` is a pure, deterministic
// function over a `FabricSnapshot`: no browsers, table-testable, and it
// produces a `rejected[]` list that explains "why not this adapter?".
import { z } from "zod";
import { accountSchema, sessionHealthSchema } from "./account";
import { adapterManifestSchema } from "./manifest";
import { quotaPoolSchema } from "./quota";
import type { Task, TaskAttempt } from "./task";

// Machine-readable reasons an (adapter, account) pair was not routed to.
// The first eleven are named in §A2; `account_disabled` and `policy_denied`
// are implied by `Account.enabled` (§S3) and by §A9's note that
// `policy_denied` is a router rejection rather than an adapter error.
export const rejectReasonSchema = z.enum([
  "capability_not_offered",
  "plan_lacks_capability",
  "adapter_disabled",
  "account_disabled",
  "pool_exhausted",
  "pool_cooling_down",
  "pool_degraded",
  "health_not_ready",
  "sensitivity_blocked",
  "metered_not_allowed",
  "approval_required",
  "policy_denied",
  "ui_drift",
]);
export type RejectReason = z.infer<typeof rejectReasonSchema>;

export const routeLaneSchema = z.enum([
  "subscription",
  "local",
  "credits",
  "metered",
]);
export type RouteLane = z.infer<typeof routeLaneSchema>;

export const routeCandidateSchema = z.object({
  adapter_id: z.string(),
  account_id: z.string().nullable(),
  pool_key: z.string().nullable(),
  lane: routeLaneSchema,
  est_metered_usd: z.number(), // 0 for subscription lanes
  requires_approval: z.boolean(), // metered over threshold, external_publish
});
export type RouteCandidate = z.infer<typeof routeCandidateSchema>;

export const rejectedRouteSchema = z.object({
  adapter_id: z.string(),
  account_id: z.string().optional(),
  reason: rejectReasonSchema,
});
export type RejectedRoute = z.infer<typeof rejectedRouteSchema>;

export const routeDecisionSchema = z.object({
  decision_id: z.string(),
  primary: routeCandidateSchema.nullable(), // null → no eligible route; task → needs_user or failed
  fallbacks: z.array(routeCandidateSchema), // pre-filtered by policy and sensitivity
  rejected: z.array(rejectedRouteSchema),
  policy_version: z.string(),
  explain: z.string(), // human-readable, shown in observability
});
export type RouteDecision = z.infer<typeof routeDecisionSchema>;

// The pure-router input: the live registry (manifests merged with probe
// results), accounts, quota pools, and per-account session health. Kept minimal
// on purpose — anything the router needs must be derivable from these.
export const fabricSnapshotSchema = z.object({
  accounts: z.array(accountSchema),
  manifests: z.array(adapterManifestSchema),
  pools: z.array(quotaPoolSchema),
  session_health: z.record(sessionHealthSchema), // keyed by account_id
  captured_at: z.string(),
});
export type FabricSnapshot = z.infer<typeof fabricSnapshotSchema>;

// TS-only boundary contract (no zod): the worker implements this and calls it
// on every hop, so policy is re-checked rather than carried over from `resolve`.
export interface CapabilityRouter {
  resolve(task: Task, snapshot: FabricSnapshot): RouteDecision;
  onAttemptFailed(
    task: Task,
    attempt: TaskAttempt,
    snapshot: FabricSnapshot
  ): RouteDecision | "stop";
}
