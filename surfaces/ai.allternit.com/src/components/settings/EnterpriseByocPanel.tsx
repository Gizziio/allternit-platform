"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowsClockwise,
  Buildings,
  CheckCircle,
  Cloud,
  DownloadSimple,
  HardDrives,
  Receipt,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  usePlatformAuth,
  usePlatformOrganization,
  usePlatformUser,
} from "@/lib/platform-auth-client";
import {
  getEnterpriseUsageSummary,
  type EnterpriseUsageSummary,
} from "@/lib/enterprise-usage";
import { CloudCredentialsPanel } from "@/components/settings/CloudCredentialsPanel";
import {
  hasOrganizationAdminAccess,
  OrganizationAccessPanel,
} from "@/components/settings/OrganizationAccessPanel";
import { SectionHeading } from "@/components/settings/SectionHeading";
import {
  SettingsTable,
  SettingsTableCell,
} from "@/components/settings/SettingsTable";
import { EmptyState } from "@/components/settings/EmptyState";
import { SkeletonRow } from "@/components/settings/SkeletonRow";
import { Badge } from "@/components/settings/Badge";
import { QUIET_BUTTON_CLASS } from "@/components/settings/buttonStyles";
import { listCloudCredentials } from "@/lib/design/cloud-credentials";
import { cn } from "@/lib/utils";

type EnterpriseTab = "overview" | "accounts" | "usage";

function currentBillingPeriod() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

function openSettings(section: string) {
  window.dispatchEvent(
    new CustomEvent("allternit:navigate-settings", { detail: { section } }),
  );
}

function detectRuntimeAvailable() {
  if (typeof window === "undefined") return false;
  if (window.allternitSidecar || window.allternit?.auth) return true;
  return Boolean(localStorage.getItem("allternit.active-runtime-id"));
}

function formatPeriod(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const inclusiveEnd = new Date(new Date(end).getTime() - 1);
  return `${formatter.format(new Date(start))} – ${formatter.format(inclusiveEnd)}`;
}

function downloadUsageCsv(summary: EnterpriseUsageSummary) {
  const escape = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ["Meter", "Resource type", "Quantity", "Unit", "Subtotal USD"],
    ...summary.line_items.map((item) => [
      item.description,
      item.resource_type,
      item.quantity,
      item.unit,
      (item.subtotal_cents / 100).toFixed(2),
    ]),
    ["Total", "", "", "", (summary.total_cents / 100).toFixed(2)],
  ];
  const blob = new Blob(
    [rows.map((row) => row.map(escape).join(",")).join("\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `allternit-byoc-usage-${summary.period_start.slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Requirement({
  ready,
  title,
  detail,
}: {
  ready: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-solid border-[var(--border-subtle)] px-3 py-3">
      {ready ? (
        <CheckCircle size={17} weight="fill" className="text-[var(--status-success)] shrink-0 mt-0.5" />
      ) : (
        <WarningCircle size={17} className="text-[var(--status-warning)] shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-[var(--text-primary)]">{title}</div>
        <div className="text-[11px] leading-relaxed text-[var(--text-tertiary)] mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

export function EnterpriseByocPanel() {
  const auth = usePlatformAuth();
  const { isLoaded: userLoaded, isSignedIn } = usePlatformUser();
  const { isLoaded: orgLoaded, organization, membership } = usePlatformOrganization();
  const organizationId = auth.orgId ?? organization?.id ?? null;
  const organizationRole = auth.orgRole ?? membership?.role ?? null;
  const canManageBilling = hasOrganizationAdminAccess(organizationRole);
  const period = useMemo(currentBillingPeriod, []);
  const [activeTab, setActiveTab] = useState<EnterpriseTab>("overview");
  const [runtimeAvailable, setRuntimeAvailable] = useState(false);
  const [activeCredentialCount, setActiveCredentialCount] = useState<number | null>(null);
  const [summary, setSummary] = useState<EnterpriseUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setRuntimeAvailable(detectRuntimeAvailable());
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const load = useCallback(async () => {
    if (!organizationId || !canManageBilling || !runtimeAvailable) return;
    setLoading(true);
    setError(null);
    try {
      setSummary(
        await getEnterpriseUsageSummary(
          organizationId,
          period.start,
          period.end,
        ),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to load enterprise usage",
      );
    } finally {
      setLoading(false);
    }
  }, [canManageBilling, organizationId, period.end, period.start, runtimeAvailable]);

  useEffect(() => {
    if (activeTab === "usage") void load();
  }, [activeTab, load]);

  useEffect(() => {
    if (!runtimeAvailable || !organizationId || !canManageBilling) {
      setActiveCredentialCount(null);
      return;
    }
    let active = true;
    void listCloudCredentials()
      .then((credentials) => {
        if (active) {
          setActiveCredentialCount(
            credentials.filter((credential) => credential.status === "active").length,
          );
        }
      })
      .catch(() => {
        if (active) setActiveCredentialCount(null);
      });
    return () => {
      active = false;
    };
  }, [activeTab, canManageBilling, organizationId, runtimeAvailable]);

  if (!userLoaded || !orgLoaded) return <SkeletonRow lines={5} />;

  if (!isSignedIn || !organizationId || !organization) {
    return (
      <div className="space-y-5">
        <div>
          <SectionHeading className="mb-1">Enterprise BYOC</SectionHeading>
          <p className="text-[12px] text-[var(--text-secondary)] m-0 leading-relaxed">
            Select the organization that owns the cloud account and metered billing contract.
          </p>
        </div>
        <OrganizationAccessPanel compact />
      </div>
    );
  }

  const tabs: Array<{ id: EnterpriseTab; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: "Overview", icon: <ShieldCheck size={14} /> },
    { id: "accounts", label: "Cloud accounts", icon: <Cloud size={14} /> },
    { id: "usage", label: "Usage & billing", icon: <Receipt size={14} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <SectionHeading className="m-0">Enterprise BYOC</SectionHeading>
            <Badge className={canManageBilling ? "text-[var(--status-success)] bg-[var(--status-success)]/10" : undefined}>
              {canManageBilling ? "Admin billing access" : "Member access"}
            </Badge>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] m-0 leading-relaxed max-w-[620px]">
            Provision isolated workloads in your AWS, Google Cloud, or Azure account.
            Your provider bills infrastructure directly; Allternit records the metered
            enterprise platform service.
          </p>
        </div>
      </div>

      <OrganizationAccessPanel compact />

      <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-secondary)] p-1 border border-solid border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border-none px-3 py-2 text-[11px] font-medium cursor-pointer transition-colors",
              activeTab === tab.id
                ? "bg-[var(--surface-canvas)] text-[var(--text-primary)] shadow-sm"
                : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {!canManageBilling ? (
        <EmptyState
          icon={<ShieldCheck size={32} weight="thin" />}
          title="Owner or admin access required"
          caption="Only organization owners and admins can manage cloud credentials or view metered billing. Ask an admin to update your Clerk organization role."
        />
      ) : activeTab === "overview" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Requirement
              ready={Boolean(organizationId)}
              title="Organization selected"
              detail={`${organization.name} is the active security and billing boundary.`}
            />
            <Requirement
              ready={canManageBilling}
              title="Admin billing permission"
              detail="Your signed Clerk role can manage credentials and metered usage."
            />
            <Requirement
              ready={runtimeAvailable}
              title="Runtime connected"
              detail={runtimeAvailable
                ? "Credential encryption, validation, and provisioning services are reachable."
                : "Pair a desktop, VPS, or hosted runtime before connecting a cloud account."}
            />
            <Requirement
              ready={Boolean(activeCredentialCount)}
              title="Cloud account"
              detail={activeCredentialCount
                ? `${activeCredentialCount} active provider connection${activeCredentialCount === 1 ? "" : "s"} ready for enterprise environments.`
                : "Connect a scoped provider identity, test it, then use it for enterprise environments."}
            />
          </div>

          <div className="rounded-xl border border-solid border-[var(--border-subtle)] p-4">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                <HardDrives size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">Customer-cloud deployment boundary</div>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] mt-1 mb-3">
                  The selected runtime encrypts the provider credential before storage,
                  resolves it only for this organization, and reports measured environment
                  runtime when the workload stops. Revoking a connection blocks future provisioning.
                </p>
                <div className="flex items-center justify-end gap-2">
                  {!runtimeAvailable && (
                    <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => openSettings("signin")}>
                      Manage runtimes
                    </button>
                  )}
                  <button
                    type="button"
                    className={QUIET_BUTTON_CLASS}
                    onClick={() => setActiveTab("accounts")}
                    disabled={!runtimeAvailable}
                  >
                    <Cloud size={13} /> Connect cloud account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "accounts" ? (
        runtimeAvailable ? (
          <CloudCredentialsPanel />
        ) : (
          <EmptyState
            icon={<HardDrives size={32} weight="thin" />}
            title="Connect a runtime first"
            caption="Cloud credentials are sealed and used by your selected Allternit runtime. Pair a desktop, VPS, or hosted runtime, then return here."
            ctaLabel="Manage runtimes"
            onCtaClick={() => openSettings("signin")}
          />
        )
      ) : (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <SectionHeading className="m-0">Metered usage</SectionHeading>
              <div className="text-[11px] text-[var(--text-tertiary)] mt-1">
                {formatPeriod(period.start, period.end)} · draft, not yet invoiced
              </div>
            </div>
            <div className="flex items-center gap-2">
              {summary && (
                <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => downloadUsageCsv(summary)}>
                  <DownloadSimple size={13} /> Export CSV
                </button>
              )}
              <button
                type="button"
                className={QUIET_BUTTON_CLASS}
                onClick={() => void load()}
                disabled={loading || !runtimeAvailable}
              >
                <ArrowsClockwise size={13} className={loading ? "animate-spin" : undefined} /> Refresh
              </button>
            </div>
          </div>

          {!runtimeAvailable ? (
            <EmptyState
              icon={<Receipt size={32} weight="thin" />}
              title="Runtime required for metering"
              caption="Connect the runtime that owns your BYOC environments to load its organization-scoped usage ledger."
              ctaLabel="Manage runtimes"
              onCtaClick={() => openSettings("signin")}
            />
          ) : loading ? (
            <SkeletonRow lines={3} />
          ) : error ? (
            <EmptyState
              icon={<Receipt size={32} weight="thin" />}
              title="Usage summary unavailable"
              caption={error}
              ctaLabel="Retry"
              onCtaClick={() => void load()}
            />
          ) : summary ? (
            <div className="space-y-3">
              {summary.line_items.length > 0 ? (
                <SettingsTable columns={["Meter", "Quantity", "Subtotal"]}>
                  {summary.line_items.map((item) => (
                    <tr key={`${item.resource_type}:${item.unit}`}>
                      <SettingsTableCell>{item.description}</SettingsTableCell>
                      <SettingsTableCell className="font-mono text-[12px]">
                        {item.quantity.toLocaleString()} {item.unit}
                      </SettingsTableCell>
                      <SettingsTableCell className="text-right font-mono text-[12px]">
                        ${(item.subtotal_cents / 100).toFixed(2)}
                      </SettingsTableCell>
                    </tr>
                  ))}
                </SettingsTable>
              ) : (
                <EmptyState
                  icon={<Receipt size={28} weight="thin" />}
                  title="No metered usage this month"
                  caption="Usage appears after an enterprise BYOC environment stops and reports its measured runtime."
                />
              )}
              <div className="flex items-center justify-between rounded-lg border border-solid border-[var(--border-subtle)] px-3 py-2 text-[12px]">
                <div>
                  <div className="text-[var(--text-secondary)]">Draft total · {summary.payment_terms}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{summary.seller_legal_name}</div>
                </div>
                <span className="font-mono font-semibold text-[var(--text-primary)]">
                  ${(summary.total_cents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Receipt size={28} weight="thin" />}
              title="Load this billing period"
              caption="Refresh to retrieve the selected runtime's organization-scoped usage ledger."
              ctaLabel="Load usage"
              onCtaClick={() => void load()}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default EnterpriseByocPanel;
