import React from "react";
import { ComingSoonPage } from "./ComingSoonPage";

/**
 * Phase 1 route stubs — one named component per future console page. Each is
 * a ComingSoonPage with copy appropriate to the surface it stands in for.
 * Phase 2 landed Playground, Files, Skills, Batches, and Builder; Phase 3
 * landed the Managed Agents group (Agents/Sessions/Deployments/Computers/
 * Vaults/Memory); Phase 4 landed the Analytics group (Usage/Logs/Caching/
 * Rate limits/Cost); Phase 5 landed the Manage group (Members/Service
 * accounts/Spend limits/Security/Webhooks/Tags) — all their stubs are
 * retired.
 */

export function GizziUsageStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Gizzi Code usage"
      description="Usage and spend for Gizzi Code, the Allternit coding agent — sessions, tokens, and model mix across your team. This surface is coming soon."
    />
  );
}

export function ManageRateLimitsStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Rate limits"
      description="Set organization-wide and per-member rate limits — requests per minute, tokens per minute, and concurrency caps — with model-specific overrides."
    />
  );
}
