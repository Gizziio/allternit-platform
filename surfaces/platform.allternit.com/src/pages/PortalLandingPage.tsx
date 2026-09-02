import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cloud, Cpu, PuzzlePiece, Star, Wallet } from "@phosphor-icons/react";
import { PlanPicker } from "@/components/PlanPicker";
import { PublicPageShell } from "@/components/PublicPageShell";
import { usePlatformAuth, useClerk } from "@/lib/platform-auth-client";

const WHY_CARDS = [
  {
    icon: <Wallet size={22} />,
    title: "One account",
    description: "A single login and credit balance for every Allternit Cloud service.",
  },
  {
    icon: <Cpu size={22} />,
    title: "Model catalog",
    description: "Browse local and cloud models with transparent per-token pricing.",
  },
  {
    icon: <PuzzlePiece size={22} />,
    title: "Hosted tools",
    description: "Use built-in tools on the same credits — no separate billing or API keys.",
  },
  {
    icon: <Cloud size={22} />,
    title: "Cloud + local",
    description: "Run small models on your own hardware or scale out to managed cloud compute.",
  },
];

const TEASERS = [
  {
    eyebrow: "Models",
    title: "Local and cloud inference",
    description:
      "Pull from a growing catalog of open-weights models, or call frontier cloud providers through a unified interface.",
    cta: { to: "/models", label: "Browse the catalog" },
  },
  {
    eyebrow: "Tools",
    title: "Built-in tool use",
    description:
      "Search, browse, execute code, and call custom capabilities from any model that supports tool use.",
    cta: { to: "/billing", label: "See the plans" },
  },
];

export function PortalLandingPage() {
  const auth = usePlatformAuth();
  const clerk = useClerk();
  const isSignedIn = auth.isLoaded && auth.isSignedIn;

  const handleSubscribe = () => {
    if (isSignedIn) return;
    if (clerk?.openSignIn) {
      clerk.openSignIn({ redirectUrl: "/billing" });
    } else {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent("/billing")}`;
    }
  };

  return (
    <PublicPageShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-[#0A0A0A] px-6 pb-16 pt-12 md:pb-24 md:pt-20">
        <div
          className="pointer-events-none absolute inset-0 -z-10 text-[#FDF8F3]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.06,
          }}
        />
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D97757]/40 bg-[#D97757]/10 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#D97757]">
            <Star size={12} /> Allternit Cloud is in beta
          </div>
          <h1 className="text-[38px] font-bold leading-[1.05] tracking-tight text-[#FDF8F3] md:text-[56px]">
            One account for Allternit Cloud
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-[#A1A1AA] md:text-[18px]">
            Local + cloud models, hosted tools, and managed compute — all on a single set of
            credits.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {isSignedIn ? (
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg bg-[#D97757] px-5 py-2.5 text-[14px] font-semibold text-[#FDF8F3] transition-colors hover:brightness-110"
              >
                Open console <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  to="/sign-up"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D97757] px-5 py-2.5 text-[14px] font-semibold text-[#FDF8F3] transition-colors hover:brightness-110"
                >
                  Sign up <ArrowRight size={16} />
                </Link>
                <Link
                  to="/sign-in"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#FDF8F3]/20 px-5 py-2.5 text-[14px] font-semibold text-[#FDF8F3] transition-colors hover:bg-[#FDF8F3]/5"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Why Allternit Cloud */}
      <section className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-[24px] font-bold tracking-tight text-[var(--text-primary)] md:text-[30px]">
            Why Allternit Cloud?
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_CARDS.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 transition-colors hover:border-[var(--accent-primary)]/30"
              >
                <div className="mb-3 inline-flex rounded-lg bg-[var(--accent-primary)]/10 p-2 text-[var(--accent-primary)]">
                  {card.icon}
                </div>
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{card.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 px-6 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-[24px] font-bold tracking-tight text-[var(--text-primary)] md:text-[30px]">
            What's included
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {TEASERS.map((teaser) => (
              <div
                key={teaser.eyebrow}
                className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-6"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
                  {teaser.eyebrow}
                </span>
                <h3 className="mt-2 text-[20px] font-semibold text-[var(--text-primary)]">
                  {teaser.title}
                </h3>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                  {teaser.description}
                </p>
                <Link
                  to={teaser.cta.to}
                  className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  {teaser.cta.label} <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <PlanPicker
            currentPlanName={null}
            title="Choose a plan"
            onSubscribe={isSignedIn ? undefined : handleSubscribe}
          />
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-[var(--border-subtle)] bg-[#0A0A0A] px-6 py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[24px] font-bold tracking-tight text-[#FDF8F3] md:text-[32px]">
            Get started with Allternit Cloud
          </h2>
          <p className="mt-3 text-[15px] text-[#A1A1AA]">
            Create a free account, browse the model catalog, and upgrade when you need managed
            compute.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {isSignedIn ? (
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg bg-[#D97757] px-5 py-2.5 text-[14px] font-semibold text-[#FDF8F3] transition-colors hover:brightness-110"
              >
                Open console <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  to="/sign-up"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D97757] px-5 py-2.5 text-[14px] font-semibold text-[#FDF8F3] transition-colors hover:brightness-110"
                >
                  Create free account <ArrowRight size={16} />
                </Link>
                <Link
                  to="/sign-in"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#FDF8F3]/20 px-5 py-2.5 text-[14px] font-semibold text-[#FDF8F3] transition-colors hover:bg-[#FDF8F3]/5"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
