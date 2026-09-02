import React, { useCallback, useEffect, useState } from "react";
import {
  Receipt,
  ArrowSquareOut,
  Gauge,
  WarningCircle,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { usePlatformOrganization, usePlatformUser, usePlatformAuth } from "@/lib/platform-auth-client";
import { getHostedEntitlement, type HostedRuntimeEntitlement } from "@/lib/hosted-compute";
import { EmptyState } from "@/components/settings/EmptyState";
import { SkeletonRow } from "@/components/settings/SkeletonRow";
import { QUIET_BUTTON_CLASS } from "@/components/settings/buttonStyles";
import { formatApiError } from "@/lib/api-client";
import { PlanPicker } from "@/components/PlanPicker";

function formatHours(seconds: number): string {
  if (seconds < 3600) return `${Math.max(0, Math.round(seconds / 60))} min`;
  return `${(seconds / 3600).toFixed(seconds < 36_000 ? 1 : 0)} hr`;
}

function safePortalUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function BillingPage() {
  const { organization } = usePlatformOrganization();
  const { user } = usePlatformUser();
  const { getToken, isSignedIn } = usePlatformAuth();
  const email = user?.primaryEmailAddress?.emailAddress || user?.userEmail || "—";

  const [entitlement, setEntitlement] = useState<HostedRuntimeEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("A web account session is required to view billing.");
      const data = await getHostedEntitlement(token);
      setEntitlement(data);
    } catch (err) {
      setError(formatApiError(err, "Unable to load billing details"));
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const usagePercent = entitlement?.maxHoursMonthly
    ? Math.min(100, (entitlement.usedSecondsMonthly / (entitlement.maxHoursMonthly * 3600)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <PlanPicker currentPlanName={entitlement?.planDisplayName} />

      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
          Usage & invoices
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Manage invoices, payment methods, and organization billing details.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Billed organization</div>
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">
            {organization?.name || "Personal"}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">{email}</div>
        </div>

        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Current plan</div>
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">
            {entitlement?.planDisplayName || "Free"}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
            {entitlement?.canCreateHostedRuntime ? "Hosted compute enabled" : "No active subscription"}
          </div>
        </div>

        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Estimated cost</div>
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">
            ${(entitlement?.estimatedCostUsdMonthly || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">Month-to-date infrastructure</div>
        </div>
      </div>

      {loading ? (
        <SkeletonRow lines={3} />
      ) : error ? (
        <EmptyState
          icon={<WarningCircle size={28} />}
          title="Billing details unavailable"
          caption={error}
          ctaLabel="Retry"
          onCtaClick={() => void load()}
        />
      ) : (
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-9 shrink-0 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
              <Gauge size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">Monthly runtime usage</div>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                Managed compute hours accrue toward your plan limit.
              </p>
            </div>
          </div>

          {entitlement && entitlement.maxHoursMonthly > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <span className="text-[var(--text-secondary)]">
                  {formatHours(entitlement.usedSecondsMonthly)} / {entitlement.maxHoursMonthly} hr
                </span>
                <span className="font-mono text-[var(--text-primary)]">{usagePercent.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent-primary)] transition-[width]"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--text-tertiary)]">
                <span>{formatHours(entitlement.remainingSecondsMonthly)} remaining</span>
                <span>${entitlement.estimatedCostUsdMonthly.toFixed(2)} estimated</span>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-[var(--text-secondary)]">
              No hosted runtime quota on the current plan. Pick a paid tier above to enable managed compute.
            </div>
          )}

          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-[var(--border-subtle)]">
            {(() => {
              const portalUrl = safePortalUrl(entitlement?.billingPortalUrl);
              return portalUrl ? (
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={QUIET_BUTTON_CLASS}
                >
                  Billing portal <ArrowSquareOut size={13} />
                </a>
              ) : null;
            })()}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={QUIET_BUTTON_CLASS}
            >
              <ArrowsClockwise size={13} /> Refresh
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-8 text-center">
        <div className="size-12 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center mx-auto mb-4">
          <Receipt size={24} />
        </div>
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">
          Invoice history
        </h2>
        <p className="text-[13px] text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
          Invoices and usage exports will appear here once billing is enabled for your organization.
        </p>
      </div>
    </div>
  );
}
