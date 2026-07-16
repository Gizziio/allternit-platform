"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, Receipt, ShieldCheck } from "@phosphor-icons/react";
import { usePlatformAuth } from "@/lib/platform-auth-client";
import {
  getEnterpriseUsageSummary,
  type EnterpriseUsageSummary,
} from "@/lib/enterprise-usage";
import { CloudCredentialsPanel } from "@/components/settings/CloudCredentialsPanel";
import { SectionHeading } from "@/components/settings/SectionHeading";
import {
  SettingsTable,
  SettingsTableCell,
} from "@/components/settings/SettingsTable";
import { EmptyState } from "@/components/settings/EmptyState";
import { SkeletonRow } from "@/components/settings/SkeletonRow";
import { QUIET_BUTTON_CLASS } from "@/components/settings/buttonStyles";

function currentBillingPeriod() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

export function EnterpriseByocPanel() {
  const auth = usePlatformAuth();
  const organizationId = auth.orgId ?? null;
  const organizationRole = auth.orgRole?.replace(/^org:/, "") ?? null;
  const canManageBilling =
    organizationRole === "owner" || organizationRole === "admin";
  const period = useMemo(currentBillingPeriod, []);
  const [summary, setSummary] = useState<EnterpriseUsageSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !canManageBilling) return;
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
  }, [canManageBilling, organizationId, period.end, period.start]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <SectionHeading className="mb-1">Enterprise BYOC</SectionHeading>
        <p className="text-[12px] text-[var(--text-secondary)] m-0 leading-relaxed">
          Infrastructure remains in your cloud account. Allternit seals the
          provisioning credential, limits it to your organization, and records
          metered platform usage for invoicing.
        </p>
      </div>

      {organizationId && canManageBilling ? (
        <CloudCredentialsPanel />
      ) : organizationId ? (
        <EmptyState
          icon={<ShieldCheck size={32} weight="thin" />}
          title="Owner or admin access required"
          caption="Only organization owners and admins can manage cloud credentials or view metered billing."
        />
      ) : (
        <EmptyState
          icon={<ShieldCheck size={32} weight="thin" />}
          title="Enterprise organization required"
          caption="Join or create an enterprise organization before connecting customer-cloud credentials and metered billing."
        />
      )}

      {organizationId && canManageBilling && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <SectionHeading className="m-0">Metered usage</SectionHeading>
            <button
              type="button"
              className={QUIET_BUTTON_CLASS}
              onClick={() => void load()}
            >
              <ArrowsClockwise size={13} /> Refresh
            </button>
          </div>

          {loading ? (
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
                  caption="Usage appears here after an enterprise BYOC environment stops and reports its measured runtime."
                />
              )}
              <div className="flex items-center justify-between rounded-lg border border-solid border-[var(--border-subtle)] px-3 py-2 text-[12px]">
                <span className="text-[var(--text-secondary)]">
                  Draft total · {summary.payment_terms}
                </span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">
                  ${(summary.total_cents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default EnterpriseByocPanel;
