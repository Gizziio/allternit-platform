import React from "react";
import { ComingSoonPage } from "./ComingSoonPage";

/**
 * Phase 1 route stubs — one named component per future console page. Each is
 * a ComingSoonPage with copy appropriate to the surface it stands in for.
 * Phase 2 landed Playground, Files, Skills, Batches, and Builder; Phase 3
 * landed the Managed Agents group (Agents/Sessions/Deployments/Computers/
 * Vaults/Memory); Phase 4 landed the Analytics group (Usage/Logs/Caching/
 * Rate limits/Cost) — all their stubs are retired.
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

export function ManageSpendLimitsStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Spend limits"
      description="Monthly and total spend caps per member, service account, or project tag. Alerts before the cap, hard stops at it."
      cta={{ label: "View billing", to: "/billing" }}
    />
  );
}

export function ManageMembersStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Members"
      description="Invite, remove, and role-manage organization members, and control which models and surfaces each role can access."
      cta={{ label: "Open current organizations", to: "/organizations" }}
    />
  );
}

export function ManageServiceAccountsStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Service accounts"
      description="Non-human identities with scoped API keys, rate limits, and audit trails — for CI pipelines, scheduled jobs, and integrations."
      cta={{ label: "Manage API keys", to: "/api-keys" }}
    />
  );
}

export function ManageSecurityStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Security"
      description="SSO/SAML, mandatory two-factor, session policies, IP allowlists, and the organization audit log."
    />
  );
}

export function ManageWebhooksStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Webhooks"
      description="Subscribe to organization events — spend thresholds, member changes, batch completions — with signed payloads and delivery retries."
    />
  );
}

export function ManageTagsStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Tags"
      description="Project tags for attributing usage and spend across teams. Tag API requests with x-allternit-tag and filter analytics and invoices by tag."
    />
  );
}
