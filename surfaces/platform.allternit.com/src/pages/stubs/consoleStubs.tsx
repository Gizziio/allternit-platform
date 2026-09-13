import React from "react";
import { ComingSoonPage } from "./ComingSoonPage";

/**
 * Phase 1 route stubs — one named component per future console page. Each is
 * a ComingSoonPage with copy appropriate to the surface it stands in for.
 * Phase 2 landed Playground, Files, Skills, Batches, and Builder; Phase 3
 * landed the Managed Agents group (Agents/Sessions/Deployments/Computers/
 * Vaults/Memory) and retired their stubs.
 */

export function AnalyticsUsageStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Usage"
      description="Token and request volume across every model, broken down by workspace, project tag, and API key. Usage analytics land in a later phase."
      cta={{ label: "View current usage dashboard", to: "/" }}
    />
  );
}

export function AnalyticsLogsStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Logs"
      description="Structured request logs with latency, status, token counts, and cost per call. Filter, search, and export your API traffic."
    />
  );
}

export function AnalyticsCachingStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Caching"
      description="Prompt-cache hit rates, savings, and cache TTL performance. See where context caching is cutting your bill — and where it could."
    />
  );
}

export function AnalyticsRateLimitsStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Rate limits"
      description="Observed throughput against your organization rate limits — RPM, TPM, and concurrent request usage over time."
    />
  );
}

export function AnalyticsCostStubPage(): React.ReactNode {
  return (
    <ComingSoonPage
      title="Cost"
      description="Spend by model, feature, and project tag, with forecasts against your budget. Cost analytics land alongside the usage pipeline in a later phase."
      cta={{ label: "View billing", to: "/billing" }}
    />
  );
}

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
