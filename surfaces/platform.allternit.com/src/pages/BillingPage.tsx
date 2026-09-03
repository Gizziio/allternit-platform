import React, { useCallback, useEffect, useState } from "react";
import {
  Receipt,
  ArrowSquareOut,
  Gauge,
  WarningCircle,
  ArrowsClockwise,
  Info,
  Coins,
  X,
} from "@phosphor-icons/react";
import {
  usePlatformOrganization,
  usePlatformUser,
  usePlatformAuth,
  useClerk,
} from "@/lib/platform-auth-client";
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

export interface CreditPack {
  id: string;
  price_usd: number;
  credits_usd: number;
  label: string;
}

export interface CreditTransaction {
  id?: string;
  source: string;
  created_at: string;
  amount_usd: number;
}

export interface BillingCredits {
  balance_usd: number;
  month_to_date_usage_usd: number;
  recent_transactions: CreditTransaction[];
}

function billingApiBaseUrl() {
  return String(
    import.meta.env.VITE_ALLTERNIT_CLOUD_API_URL || "https://allternit-cloud-api.fly.dev",
  ).replace(/\/$/, "");
}

function formatSignedUsd(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatTransactionDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export function BillingPage() {
  const { organization } = usePlatformOrganization();
  const { user } = usePlatformUser();
  const { getToken, isSignedIn } = usePlatformAuth();
  const clerk = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress || user?.userEmail || "—";

  const handleSubscribe = () => {
    if (clerk?.openSignIn) {
      clerk.openSignIn({ redirectUrl: "/billing" });
    } else {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent("/billing")}`;
    }
  };

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center rounded-sm border border-[var(--text-primary)]/40 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-[var(--text-primary)]">
            BETA
          </div>
          <h1 className="text-[32px] font-bold leading-none tracking-tight text-[var(--text-primary)]">
            Plans
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Paid tiers include monthly credits for Allternit Cloud, local + cloud models, and
            built-in tool use. Beta.
          </p>
        </div>
        <PlanPicker currentPlanName={null} title="Choose a plan" onSubscribe={handleSubscribe} />

        <div className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
          <div className="flex items-start gap-3">
            <Info size={18} className="mt-0.5 shrink-0 text-[var(--accent-primary)]" />
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
              During BETA, subscription tiers and model credits are UI-only. Cloud-model access is
              provided through upstream providers such as OpenRouter; paid bundled credits will not
              be sold until appropriate provider terms are in place.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [entitlement, setEntitlement] = useState<HostedRuntimeEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<BillingCredits | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [billingAvailable, setBillingAvailable] = useState(true);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<"success" | "cancelled" | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const value = params.get("checkout");
    if (value !== "success" && value !== "cancelled") return null;
    params.delete("checkout");
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
    );
    return value;
  });

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

      // Credits + packs are a separate billing surface; a 503 from either endpoint means billing is not
      // configured in this environment, so show the disabled state rather than an error.
      try {
        const base = billingApiBaseUrl();
        const [packsResponse, creditsResponse] = await Promise.all([
          fetch(`${base}/api/v1/billing/packs`),
          fetch(`${base}/api/v1/billing/credits`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (packsResponse.status === 503 || creditsResponse.status === 503) {
          setBillingAvailable(false);
          setCredits(null);
          setPacks([]);
          setCreditsError(null);
          return;
        }
        setBillingAvailable(true);
        const packsPayload = (packsResponse.ok
          ? await packsResponse.json().catch(() => ({}))
          : {}) as { packs?: CreditPack[] };
        setPacks(Array.isArray(packsPayload.packs) ? packsPayload.packs : []);
        if (!creditsResponse.ok) {
          const payload = await creditsResponse.json().catch(() => ({}));
          throw new Error(
            payload.message ||
              payload.error ||
              `Unable to load credit balance (${creditsResponse.status})`,
          );
        }
        const creditsPayload = (await creditsResponse.json()) as BillingCredits;
        setCredits(creditsPayload);
        setCreditsError(null);
      } catch (err) {
        setCredits(null);
        setCreditsError(formatApiError(err, "Unable to load credit balance"));
      }
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

  const handleBuyPack = async (packId: string) => {
    setBuyingPackId(packId);
    setCheckoutError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("A web account session is required to purchase credits.");
      const response = await fetch(`${billingApiBaseUrl()}/api/v1/billing/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pack_id: packId }),
      });
      if (response.status === 503) {
        setBillingAvailable(false);
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.message || payload.error || `Unable to start checkout (${response.status})`,
        );
      }
      const checkoutUrl = safePortalUrl(payload.checkout_url);
      if (!checkoutUrl) throw new Error("Checkout did not return a valid payment link.");
      window.location.href = checkoutUrl;
    } catch (err) {
      setCheckoutError(formatApiError(err, "Unable to start checkout"));
    } finally {
      setBuyingPackId(null);
    }
  };

  return (
    <div className="space-y-8">
      {checkoutNotice && (
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
          <div className="flex items-start gap-3">
            <Info
              size={18}
              className={`mt-0.5 shrink-0 ${
                checkoutNotice === "success"
                  ? "text-[var(--status-success)]"
                  : "text-[var(--status-warning)]"
              }`}
            />
            <p className="flex-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {checkoutNotice === "success"
                ? "Payment received. Your credit balance will update once Stripe confirms the checkout."
                : "Checkout cancelled. No charges were made — pick a credit pack below to try again."}
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setCheckoutNotice(null)}
              className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
          Credits
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Prepaid credits are consumed before plan-included allowances on paid usage.
        </p>
      </div>

      {!billingAvailable ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-8 text-center">
          <div className="size-12 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center mx-auto mb-4">
            <Coins size={24} />
          </div>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">
            Billing not configured
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
            Credit purchases are not enabled in this environment yet. Check back once billing is
            configured for your organization.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="size-9 shrink-0 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
                <Coins size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">Credit balance</div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  Purchased credits and recent credit activity.
                </p>
              </div>
            </div>

            {creditsError ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-[var(--status-error)]">{creditsError}</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className={QUIET_BUTTON_CLASS}
                >
                  <ArrowsClockwise size={13} /> Retry
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)]/60 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Balance</div>
                    <div className="text-[16px] font-semibold font-mono text-[var(--text-primary)]">
                      ${(credits?.balance_usd ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)]/60 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Month-to-date usage</div>
                    <div className="text-[16px] font-semibold font-mono text-[var(--text-primary)]">
                      ${(credits?.month_to_date_usage_usd ?? 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {(credits?.recent_transactions?.length ?? 0) > 0 ? (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {credits!.recent_transactions.map((tx, index) => (
                      <div
                        key={tx.id || `${tx.source}-${tx.created_at}-${index}`}
                        className="flex items-center justify-between gap-3 py-2 text-[12px]"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-[var(--text-primary)]">
                            {tx.source || "—"}
                          </div>
                          <div className="text-[11px] text-[var(--text-tertiary)]">
                            {formatTransactionDate(tx.created_at)}
                          </div>
                        </div>
                        <span
                          className={`font-mono ${
                            tx.amount_usd >= 0
                              ? "text-[var(--status-success)]"
                              : "text-[var(--text-secondary)]"
                          }`}
                        >
                          {formatSignedUsd(tx.amount_usd)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[13px] text-[var(--text-secondary)]">
                    No recent credit transactions.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4 flex flex-col"
              >
                <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
                  {pack.label}
                </div>
                <div className="text-[16px] font-semibold text-[var(--text-primary)]">
                  ${pack.credits_usd.toFixed(2)} credits
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-1 mb-3">
                  Pay ${pack.price_usd.toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => void handleBuyPack(pack.id)}
                  disabled={buyingPackId !== null || !billingAvailable}
                  className={`${QUIET_BUTTON_CLASS} mt-auto justify-center`}
                >
                  {buyingPackId === pack.id ? "Redirecting…" : "Buy credits"}
                </button>
              </div>
            ))}
          </div>

          {checkoutError && (
            <p className="text-[13px] text-[var(--status-error)]">{checkoutError}</p>
          )}
        </div>
      )}

      <PlanPicker currentPlanName={entitlement?.planDisplayName} />

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-[var(--accent-primary)]" />
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            During BETA, subscription tiers and model credits are UI-only. Cloud-model access is
            provided through upstream providers such as OpenRouter; paid bundled credits will not
            be sold until appropriate provider terms are in place.
          </p>
        </div>
      </div>

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
