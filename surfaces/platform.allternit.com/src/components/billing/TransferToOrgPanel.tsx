import React, { useCallback, useEffect, useState } from "react";
import { ArrowsLeftRight, Buildings, Check, Warning } from "@phosphor-icons/react";
import {
  formatCreditsUsd,
  getOrgCreditsBalance,
  transferWalletToOrg,
  type OrgCreditsBalance,
} from "@/lib/credits";

/**
 * Move credits from the user's Stripe-backed wallet into the active
 * organization's fabric compute ledger (the consolidated money flow:
 * wallet → org ledger → provisioning holds + metered usage).
 */
export function TransferToOrgPanel({ onTransferred }: { onTransferred?: () => void }) {
  const [orgBalance, setOrgBalance] = useState<OrgCreditsBalance | null>(null);
  const [orgUnavailable, setOrgUnavailable] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refreshOrgBalance = useCallback(async () => {
    try {
      const balance = await getOrgCreditsBalance();
      setOrgBalance(balance);
      setOrgUnavailable(balance === null);
    } catch {
      setOrgUnavailable(true);
    }
  }, []);

  useEffect(() => {
    void refreshOrgBalance();
  }, [refreshOrgBalance]);

  const submit = async () => {
    const usd = Number(amount);
    if (!Number.isFinite(usd) || usd <= 0) {
      setError("Enter a positive amount in USD.");
      return;
    }
    const amountCents = Math.round(usd * 100);
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await transferWalletToOrg(amountCents, crypto.randomUUID());
      setSuccess(
        `Transferred ${formatCreditsUsd(usd)} to ${result.organization_id}. Wallet balance: ${formatCreditsUsd(result.wallet_balance_usd)}.`,
      );
      setAmount("");
      setOrgBalance((prev) =>
        prev
          ? {
              ...prev,
              balance_cents: result.balance_cents,
              available_cents: result.available_cents,
            }
          : prev,
      );
      onTransferred?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setBusy(false);
    }
  };

  if (orgUnavailable) {
    return null; // No active org (or ledger unavailable) — nothing to transfer to.
  }

  return (
    <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="size-9 shrink-0 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
          <Buildings size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">
            Organization compute credits
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            Fabric provisioning and metered usage charge the organization ledger. Transfer
            wallet balance here to fund it.
          </p>
        </div>
        {orgBalance && (
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Org balance</div>
            <div className="text-[16px] font-semibold font-mono text-[var(--text-primary)]">
              {formatCreditsUsd(orgBalance.balance_cents / 100)}
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              {formatCreditsUsd(orgBalance.available_cents / 100)} available
              {orgBalance.held_cents > 0 &&
                ` · ${formatCreditsUsd(orgBalance.held_cents / 100)} held`}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)]/60 px-3 py-2 flex-1">
          <span className="text-[13px] text-[var(--text-tertiary)]">$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Amount to transfer"
            className="flex-1 bg-transparent text-[13px] placeholder:text-[var(--text-tertiary)] outline-none text-[var(--text-primary)]"
          />
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !amount}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-[13px] font-medium text-[#FDF8F3] transition-colors hover:brightness-110 disabled:opacity-50"
        >
          <ArrowsLeftRight size={14} /> {busy ? "Transferring…" : "Transfer to organization"}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--status-error)]">
          <Warning size={14} /> {error}
        </div>
      )}
      {success && (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--status-success)]">
          <Check size={14} /> {success}
        </div>
      )}
    </div>
  );
}
