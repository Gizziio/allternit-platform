import React from "react";
import { Cloud, DesktopTower } from "@phosphor-icons/react";

const CAPABILITIES = [
  {
    icon: <DesktopTower size={28} weight="duotone" />,
    title: "Local models",
    description:
      "Run Llama, Qwen, Mistral, and other open-weights models on your own hardware. No per-token cost, no separate provider account.",
  },
  {
    icon: <Cloud size={28} weight="duotone" />,
    title: "Cloud routing",
    description:
      "Call frontier and open models through the Allternit API. We are wiring provider integrations so you do not manage keys per vendor.",
  },
];

export function ModelCapabilitiesSection() {
  return (
    <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] md:text-[36px]">
            Run the models you choose
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)] md:text-[16px]">
            Allternit Cloud is model-agnostic. Use open-weights models locally, or route to cloud providers through a single API as we expand the catalog.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {CAPABILITIES.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-6"
            >
              <div className="mb-4 inline-flex rounded-xl bg-[#D97757]/10 p-3 text-[#D97757]">
                {card.icon}
              </div>
              <h3 className="text-[18px] font-semibold text-[var(--text-primary)]">{card.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
