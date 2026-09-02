import React from "react";
import { Key, ShieldCheck, Users, LockKey } from "@phosphor-icons/react";

const SECURITY_FEATURES = [
  {
    icon: <ShieldCheck size={22} weight="duotone" />,
    title: "Clerk authentication",
    description: "Production sign-in, session management, and organization switching out of the box.",
  },
  {
    icon: <Key size={22} weight="duotone" />,
    title: "Org-scoped API keys",
    description: "Create and rotate keys per organization. Revoke access instantly when someone leaves.",
  },
  {
    icon: <Users size={22} weight="duotone" />,
    title: "Role-based access",
    description: "Invite members and assign roles so billing and resources stay under team control.",
  },
  {
    icon: <LockKey size={22} weight="duotone" />,
    title: "Bearer-token API",
    description: "Every API request is authenticated with a short-lived, org-scoped bearer token.",
  },
];

export function SecuritySection() {
  return (
    <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] md:text-[36px]">
            Built for production
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)] md:text-[16px]">
            Auth, access control, and API security are first-class, not bolted on later.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECURITY_FEATURES.map((feature) => (
            <div key={feature.title} className="flex flex-col items-start gap-3">
              <div className="inline-flex rounded-xl bg-[#D97757]/10 p-2.5 text-[#D97757]">
                {feature.icon}
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{feature.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
