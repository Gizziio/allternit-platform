import React from "react";
import { Rocket, Users, Wrench } from "@phosphor-icons/react";

const USE_CASES = [
  {
    icon: <Rocket size={24} weight="duotone" />,
    title: "For builders",
    description:
      "Developers shipping AI apps who want one API for local and cloud models, plus hosted tools.",
  },
  {
    icon: <Users size={24} weight="duotone" />,
    title: "For teams",
    description:
      "Engineering teams that need shared billing, member access, and usage visibility in one console.",
  },
  {
    icon: <Wrench size={24} weight="duotone" />,
    title: "For automation",
    description:
      "Schedulers and approval workflows for long-running jobs, agents, and managed compute.",
  },
];

export function UseCasesSection() {
  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] md:text-[36px]">
            Who is it for?
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)] md:text-[16px]">
            Allternit Cloud is built for people who want flexibility across models and compute without stitching providers together.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {USE_CASES.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-6"
            >
              <div className="mb-4 inline-flex rounded-xl bg-[#D97757]/10 p-3 text-[#D97757]">
                {item.icon}
              </div>
              <h3 className="text-[17px] font-semibold text-[var(--text-primary)]">{item.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
