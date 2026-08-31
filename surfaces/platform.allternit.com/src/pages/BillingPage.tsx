import React from "react";
import { CreditCard, Receipt, ArrowSquareOut } from "@phosphor-icons/react";
import { usePlatformOrganization, usePlatformUser } from "@/lib/platform-auth-client";

export function BillingPage() {
  const { organization } = usePlatformOrganization();
  const { user } = usePlatformUser();
  const email = user?.primaryEmailAddress?.emailAddress || user?.userEmail || "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
          Billing
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
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">Free</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">No active subscription</div>
        </div>

        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Next invoice</div>
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">—</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">No upcoming charges</div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-8 text-center">
        <div className="size-12 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center mx-auto mb-4">
          <Receipt size={24} />
        </div>
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">
          Billing management coming soon
        </h2>
        <p className="text-[13px] text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
          Invoices, usage exports, and payment-method management will live here.
          For now, compute charges and plan changes are handled through the billing portal.
        </p>
        <a
          href="https://allternit.com/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-lg text-[13px] font-semibold bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] hover:brightness-110 transition-all"
        >
          View plans <ArrowSquareOut size={14} />
        </a>
      </div>
    </div>
  );
}
