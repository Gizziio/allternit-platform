import React, { useEffect, useMemo, useState } from "react";

export type PlanId = "free" | "plus" | "super" | "ultra";

interface Plan {
  id: PlanId;
  label: string;
  price: string;
  bonus: boolean;
  hero: boolean;
  features: string[];
  art: string;
}

const IVORY = "#FDF8F3";
const CORAL = "#D97757";
const GRAPHITE = "#111111";

const PLANS: Plan[] = [
  {
    id: "free",
    label: "FREE",
    price: "$0",
    bonus: false,
    hero: false,
    features: [
      "LOCAL MODELS ONLY",
      "STANDARD RATE LIMITS",
      "$0 MONTHLY CREDITS",
    ],
    art: "/billing/free.png",
  },
  {
    id: "plus",
    label: "PLUS",
    price: "$20",
    bonus: true,
    hero: false,
    features: [
      "$22 MONTHLY CREDITS",
      "$10 ROLLOVER CAP",
      "LOCAL + CLOUD MODELS",
      "HOSTED TOOL USAGE",
      "HIGH RATE LIMITS",
    ],
    art: "/billing/plus.png",
  },
  {
    id: "super",
    label: "SUPER",
    price: "$100",
    bonus: true,
    hero: true,
    features: [
      "$110 MONTHLY CREDITS",
      "$50 ROLLOVER CAP",
      "LOCAL + CLOUD MODELS",
      "HOSTED TOOL USAGE",
      "HIGH RATE LIMITS",
    ],
    art: "/billing/super.png",
  },
  {
    id: "ultra",
    label: "ULTRA",
    price: "$200",
    bonus: true,
    hero: false,
    features: [
      "$220 MONTHLY CREDITS",
      "$100 ROLLOVER CAP",
      "LOCAL + CLOUD MODELS",
      "HOSTED TOOL USAGE",
      "HIGH RATE LIMITS",
    ],
    art: "/billing/ultra.png",
  },
];

function planFromDisplayName(name?: string | null): PlanId {
  const n = (name || "").toLowerCase();
  if (n.includes("ultra")) return "ultra";
  if (n.includes("super")) return "super";
  if (n.includes("plus")) return "plus";
  return "free";
}

export function PlanPicker({
  currentPlanName,
}: {
  currentPlanName?: string | null;
}) {
  const inferred = useMemo(() => planFromDisplayName(currentPlanName), [currentPlanName]);
  const [selected, setSelected] = useState<PlanId>(inferred);

  useEffect(() => {
    setSelected(inferred);
  }, [inferred]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center rounded-sm border border-[var(--text-primary)]/40 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-[var(--text-primary)]">
            BETA
          </div>
          <h2 className="text-[28px] font-bold leading-none tracking-tight text-[var(--text-primary)]">
            Manage Subscription
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Paid tiers include monthly credits for Allternit Cloud, local + cloud models, and
            built-in tool use. Beta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = selected === plan.id;
          const hero = plan.hero;
          const bg = hero ? CORAL : GRAPHITE;
          const text = IVORY;

          return (
            <article
              key={plan.id}
              className="flex h-full flex-col rounded-2xl border border-[var(--border-subtle)] p-4"
              style={{ backgroundColor: bg, color: text }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em]"
                  style={{ borderColor: `${text}40` }}
                >
                  {plan.label}
                </span>
                {plan.bonus && (
                  <span
                    className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em]"
                    style={{ borderColor: `${text}40` }}
                  >
                    10% BONUS
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div className="text-[34px] font-bold leading-none tracking-tight">{plan.price}</div>
                <div className="mt-1 text-[10px] font-semibold tracking-[0.16em] opacity-80">
                  PER MONTH
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-md">
                <img
                  src={plan.art}
                  alt=""
                  className="aspect-[2.4/1] w-full object-cover"
                />
              </div>

              <ul className="mt-4 flex-1 space-y-1.5 text-[11px] font-medium tracking-[0.08em]">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 inline-block size-1.5 shrink-0 bg-current opacity-80" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setSelected(plan.id)}
                className="mt-5 self-start rounded-md px-4 py-2 text-[11px] font-semibold tracking-[0.14em] transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: hero ? "#0A0A0A" : IVORY,
                  color: hero ? IVORY : "#0A0A0A",
                }}
              >
                {isCurrent ? "CURRENT" : "SUBSCRIBE"}
              </button>
            </article>
          );
        })}
      </div>

      <p className="text-[11px] text-[var(--text-tertiary)]">
        Beta picker only. Credits are not billed yet. Current selection:{" "}
        {PLANS.find((p) => p.id === selected)?.label}.
      </p>
    </section>
  );
}
