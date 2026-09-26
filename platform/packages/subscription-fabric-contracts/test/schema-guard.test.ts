import { describe, expect, it } from "vitest";
import {
  adapterEventSchema,
  artifactTypeSchema,
  failureClassSchema,
  reconcileOutcomeSchema,
  rejectReasonSchema,
  sessionHealthSchema,
  taskStatusSchema,
} from "../src/index";

// Schema-version guard: pin every public union member list so an accidental
// removal (or rename) fails loudly instead of silently widening a contract.

describe("schema-version guard — pinned union members", () => {
  it("TaskStatus (§S4)", () => {
    expect(taskStatusSchema.options).toEqual([
      "queued",
      "routing",
      "waiting_worker",
      "running",
      "streaming",
      "provider_running",
      "needs_user",
      "completed",
      "partial",
      "failed",
      "cancelled",
    ]);
  });

  it("FailureClass (§S7 base minus selector_not_found, plus §A9)", () => {
    expect(failureClassSchema.options).toEqual([
      "auth_required",
      "quota_exhausted",
      "rate_limited",
      "provider_ui_changed",
      "provider_error",
      "artifact_generation_failed",
      "download_failed",
      "network_error",
      "user_intervention_required",
      "unsupported_capability",
      "challenge_presented",
      "account_restricted",
      "submission_ambiguous",
      "model_downgraded",
      "content_refused",
      "stalled",
      "timeout",
      "output_truncated",
      "profile_locked",
      "worker_crashed",
      "artifact_expired",
      "approval_required",
      "policy_denied",
    ]);
  });

  it("SessionHealth (HARDENING)", () => {
    expect(sessionHealthSchema.options).toEqual([
      "ready",
      "degraded",
      "auth_required",
      "challenge_presented",
      "account_restricted",
      "ui_drift",
      "provider_down",
      "profile_locked",
    ]);
  });

  it("RejectReason (§A2 + spec-implied extensions)", () => {
    expect(rejectReasonSchema.options).toEqual([
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
  });

  it("ArtifactType (§13 + html_app)", () => {
    expect(artifactTypeSchema.options).toEqual([
      "text",
      "image",
      "document",
      "pdf",
      "presentation",
      "spreadsheet",
      "website",
      "code_project",
      "archive",
      "video",
      "audio",
      "html_app",
    ]);
  });

  it("ReconcileOutcome (§A1)", () => {
    expect(reconcileOutcomeSchema.options).toEqual([
      "acknowledged",
      "duplicate",
      "not_found",
      "ambiguous",
    ]);
  });

  it("AdapterEvent tags — exactly 11 variants (§A1)", () => {
    const tags = adapterEventSchema.options.map(
      (option) => (option.shape as { t: { value: string } }).t.value
    );
    expect(tags).toEqual([
      "submitted",
      "reply",
      "progress",
      "artifact.partial",
      "artifact.ready",
      "model.observed",
      "quota.signal",
      "needs_user",
      "detached",
      "done",
      "error",
    ]);
  });
});
