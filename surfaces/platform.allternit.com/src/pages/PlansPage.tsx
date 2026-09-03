import React from "react";
import { Info } from "@phosphor-icons/react";
import { PlanPicker } from "@/components/PlanPicker";
import { PublicPageShell } from "@/components/PublicPageShell";

export function PlansPage() {
  return (
    <PublicPageShell>
      <div className="mx-auto max-w-7xl px-6 py-12">
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

        <PlanPicker currentPlanName={null} title="Choose a plan" />

        <div className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
          <div className="flex items-start gap-3">
            <Info size={18} className="mt-0.5 shrink-0 text-[var(--accent-primary)]" />
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
              During BETA, subscription tiers and model credits are UI-only. Cloud-model access is
              provided through upstream providers including OpenRouter, Together AI, Fireworks AI,
              and DeepInfra; paid bundled credits will not be sold until appropriate provider terms
              are in place.
            </p>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
