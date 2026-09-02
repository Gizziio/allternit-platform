import React from "react";
import { Cloud, DesktopTower, Key } from "@phosphor-icons/react";

const CAPABILITIES = [
  {
    icon: <DesktopTower size={28} weight="duotone" />,
    title: "Local-first compute",
    description:
      "Run Llama, Qwen, Mistral, and other open-weights models on your own hardware. No per-token cost, no separate provider account.",
  },
  {
    icon: <Cloud size={28} weight="duotone" />,
    title: "Intelligent cloud routing",
    description:
      "Allternit selects the best supplier for each request — cost, speed, capacity, or compliance — while you keep one API key and one credit balance.",
  },
  {
    icon: <Key size={28} weight="duotone" />,
    title: "Bring your own keys",
    description:
      "Enterprise users can attach their own provider accounts. Allternit orchestrates the request, while you keep direct commercial and data relationships.",
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
            Allternit is a model broker, not a single supplier. Use local open-weights, let Allternit route to cloud providers, or plug in your own keys.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
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
