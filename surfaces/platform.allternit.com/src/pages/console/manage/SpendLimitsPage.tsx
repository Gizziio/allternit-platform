import React, { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CoinsDollarIcon,
  AlertCircleIcon,
  CheckIcon,
  Timer01Icon,
} from "@hugeicons/core-free-icons";
import { formatApiError, AllternitApiError } from "@/lib/api-client";
import {
  type SpendLimit,
  type UserBalance,
  getSpendLimit,
  getUserBalance,
  requestSpendLimitIncrease,
  approveSpendLimitIncrease,
  rejectSpendLimitIncrease,
} from "@/lib/spend-limits";
import { usePlatformAuth } from "@/lib/platform-auth-client";
import { hasOrganizationAdminAccess } from "@/components/settings/OrganizationAccessPanel";
import {
  ListPage,
  EmptyState,
  SkeletonRow,
  StatCard,
  GaugeCard,
  Badge,
  QUIET_BUTTON_CLASS,
  DESTRUCTIVE_BUTTON_CLASS,
} from "@/components/console-ui";
import { cn } from "@/lib/utils";

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const STATUS_TONE: Record<string, string> = {
  pending: "text-[var(--status-warning)] bg-[var(--status-warning)]/10",
  approved: "text-[var(--status-success)] bg-[var(--status-success)]/10",
  rejected: "text-[var(--status-error)] bg-[var(--status-error)]/10",
};

/**
 * Organization monthly spend cap and the request-increase workflow.
 *
 * Every /admin/spend-limits route is owner/admin gated (403 otherwise), so a
 * non-admin member sees their own balance and an honest read-only notice —
 * the backend offers no member-scoped request endpoint to call instead.
 * Approval uses the same admin gate, so approvers are simply org admins.
 */
export function SpendLimitsPage(): React.ReactNode {
  const auth = usePlatformAuth();
  const isAdmin = hasOrganizationAdminAccess(auth.orgRole);

  const [limit, setLimit] = useState<SpendLimit | null>(null);
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    setBalanceError(null);
    try {
      setBalance(await getUserBalance());
    } catch (err) {
      setBalance(null);
      setBalanceError(formatApiError(err, "Unable to load your balance."));
    }
  }, []);

  const loadLimit = useCallback(async () => {
    setError(null);
    try {
      setLimit(await getSpendLimit());
      setForbidden(false);
    } catch (err) {
      if (err instanceof AllternitApiError && err.statusCode === 403) {
        setForbidden(true);
        setLimit(null);
      } else {
        setLimit(null);
        setError(formatApiError(err, "Unable to load spend limits."));
      }
    }
  }, []);

  useEffect(() => {
    void loadBalance();
    void loadLimit().finally(() => setLoading(false));
  }, [loadBalance, loadLimit]);

  const showFlash = useCallback((message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 3000);
  }, []);

  const handleRequest = useCallback(async () => {
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter an amount greater than $0.");
      return;
    }
    const cents = Math.round(dollars * 100);
    setSubmitting(true);
    setError(null);
    try {
      const updated = await requestSpendLimitIncrease({
        amount: cents,
        reason: reason || undefined,
      });
      setLimit(updated);
      setAmount("");
      setReason("");
      showFlash("Increase request submitted for approval.");
      await loadBalance();
    } catch (err) {
      setError(formatApiError(err, "Unable to submit the increase request."));
    } finally {
      setSubmitting(false);
    }
  }, [amount, reason, loadBalance, showFlash]);

  const handleApprove = useCallback(async () => {
    if (!limit?.increase_request_amount) return;
    setDecisionBusy(true);
    setError(null);
    try {
      const updated = await approveSpendLimitIncrease(limit.increase_request_amount);
      setLimit(updated);
      showFlash("Increase approved — the monthly cap was raised.");
      await loadBalance();
    } catch (err) {
      setError(formatApiError(err, "Unable to approve the request."));
    } finally {
      setDecisionBusy(false);
    }
  }, [limit, loadBalance, showFlash]);

  const handleReject = useCallback(async () => {
    setDecisionBusy(true);
    setError(null);
    try {
      const updated = await rejectSpendLimitIncrease();
      setLimit(updated);
      showFlash("Increase request rejected.");
    } catch (err) {
      setError(formatApiError(err, "Unable to reject the request."));
    } finally {
      setDecisionBusy(false);
    }
  }, [showFlash]);

  const pendingRequest = limit?.increase_request_status === "pending" ? limit : null;
  const usageCents = balance
    ? Math.max(0, balance.total_balance - balance.available_balance)
    : null;

  return (
    <ListPage
      title="Spend limits"
      subtitle="Organization monthly spend cap, live usage, and the request/approval workflow for raising the cap."
    >
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-solid border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-[13px] text-[var(--status-error)]">
          <HugeiconsIcon icon={AlertCircleIcon} size={14} />
          {error}
        </p>
      )}
      {flash && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-solid border-[var(--status-success)]/30 bg-[var(--status-success)]/10 px-3 py-2 text-[13px] text-[var(--status-success)]">
          <HugeiconsIcon icon={CheckIcon} size={14} />
          {flash}
        </p>
      )}

      <section className="mb-8">
        <h2 className="m-0 mb-1 text-[15px] font-semibold text-[var(--text-primary)]">
          Your balance
        </h2>
        <p className="m-0 mb-3 text-[12px] text-[var(--text-tertiary)]">
          Live headroom for the active organization this calendar month.
        </p>
        {balanceError && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-solid border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-[13px] text-[var(--status-error)]">
            <HugeiconsIcon icon={AlertCircleIcon} size={14} />
            {balanceError}
          </p>
        )}
        {!balance && !balanceError ? (
          <SkeletonRow lines={2} />
        ) : balance ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Available" value={formatUsd(balance.available_balance)} hint="Remaining this month" />
            <StatCard label="Monthly cap" value={formatUsd(balance.total_balance)} hint="Organization spend cap" />
            <StatCard
              label="Used"
              value={usageCents !== null ? formatUsd(usageCents) : "—"}
              hint="Model inference + Desktop Cloud runtime"
            />
          </div>
        ) : null}
      </section>

      {loading ? (
        <SkeletonRow lines={4} />
      ) : forbidden ? (
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
          <p className="m-0 text-[13px] text-[var(--text-secondary)]">
            Organization spend limits are managed by owners and admins. Your balance is
            shown above; ask an organization admin to review or raise the monthly cap.
          </p>
        </div>
      ) : !limit && !error ? (
        <EmptyState
          icon={<HugeiconsIcon icon={CoinsDollarIcon} size={32} />}
          title="No spend limit configured"
          caption="This organization does not have a spend-limit row yet. Submitting an increase request creates one."
          ctaLabel="Retry"
          onCtaClick={() => void loadLimit()}
        />
      ) : limit ? (
        <>
          <section className="mb-8">
            <h2 className="m-0 mb-1 text-[15px] font-semibold text-[var(--text-primary)]">
              Current limit
            </h2>
            <p className="m-0 mb-3 text-[12px] text-[var(--text-tertiary)]">
              The cap applies to every member, key, and service account in the organization.
            </p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <GaugeCard
                label="Monthly spend used"
                used={usageCents ?? Math.max(0, limit.current_month_spend)}
                limit={Math.max(1, balance?.total_balance ?? limit.monthly_usd_cap)}
                resetHint="Resets on the first of the month"
              />
              <div className="grid grid-cols-1 gap-3">
                <StatCard label="Monthly cap" value={formatUsd(limit.monthly_usd_cap)} />
                <StatCard
                  label="Recorded month spend"
                  value={formatUsd(Math.max(0, limit.current_month_spend))}
                  hint="Spend net of applied credits, as stored on the limit row"
                />
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="m-0 mb-1 text-[15px] font-semibold text-[var(--text-primary)]">
              {pendingRequest ? "Pending increase request" : "Request an increase"}
            </h2>
            <p className="m-0 mb-3 text-[12px] text-[var(--text-tertiary)]">
              {pendingRequest
                ? "An increase is awaiting an owner/admin decision. Submitting again replaces it."
                : "Ask for a higher monthly cap. An owner or admin reviews and approves or rejects it here."}
            </p>

            {pendingRequest ? (
              <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_TONE.pending}>pending</Badge>
                      <span className="text-[16px] font-semibold text-[var(--text-primary)]">
                        +{formatUsd(pendingRequest.increase_request_amount ?? 0)}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                      Requested {formatDateTime(pendingRequest.increase_request_created_at)}
                      {pendingRequest.increase_request_reason && (
                        <>
                          {" "}— “{pendingRequest.increase_request_reason}”
                        </>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={QUIET_BUTTON_CLASS}
                        disabled={decisionBusy}
                        onClick={() => void handleReject()}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={decisionBusy}
                        onClick={() => void handleApprove()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110 disabled:opacity-50"
                      >
                        {decisionBusy ? "Working…" : `Approve +${formatUsd(pendingRequest.increase_request_amount ?? 0)}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-xl rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[var(--text-secondary)]">
                      Increase amount (USD)
                    </span>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="250.00"
                      className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-default)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[var(--text-secondary)]">
                      Reason <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
                    </span>
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Growth campaign, new deployment…"
                      className="w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-default)]"
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={submitting || !amount.trim()}
                    onClick={() => void handleRequest()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Submitting…" : "Submit increase request"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {limit.increase_request_status && limit.increase_request_status !== "pending" && (
            <section>
              <h2 className="m-0 mb-1 text-[15px] font-semibold text-[var(--text-primary)]">
                Last request outcome
              </h2>
              <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                <Badge className={cn(STATUS_TONE[limit.increase_request_status])}>
                  {limit.increase_request_status}
                </Badge>
                {limit.increase_request_amount !== null && (
                  <span>of {formatUsd(limit.increase_request_amount)}</span>
                )}
                <span className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)]">
                  <HugeiconsIcon icon={Timer01Icon} size={12} />
                  {formatDateTime(limit.increase_request_updated_at)}
                </span>
              </div>
            </section>
          )}
        </>
      ) : null}
    </ListPage>
  );
}

export default SpendLimitsPage;
