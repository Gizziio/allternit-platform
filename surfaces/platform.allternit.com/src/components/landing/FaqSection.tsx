import React, { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

const FAQS = [
  {
    question: "What is included in the free tier?",
    answer:
      "The free tier includes local models and standard rate limits. You can generate an API key, pair a local runtime, and run open-weights models at no compute cost.",
  },
  {
    question: "Which model providers does Allternit use?",
    answer:
      "Allternit is a model broker. Local models run on your hardware first. For cloud inference we prioritize direct relationships and high-performance wholesalers (Together, Fireworks, DeepInfra, Groq, Cerebras) and use OpenRouter as a long-tail fallback. Enterprise customers can also route through AWS Bedrock or attach their own provider keys.",
  },
  {
    question: "Do I need accounts with OpenAI, Anthropic, or other providers?",
    answer:
      "No. Allternit manages supplier relationships and routing. You send requests to one OpenAI-compatible endpoint and draw from one credit balance.",
  },
  {
    question: "Can I use my own API keys?",
    answer:
      "Yes. Bring-your-own-key (BYOK) is a permanent part of the architecture. Enterprise users can attach their own provider accounts while still using Allternit's orchestration, scheduling, and team features.",
  },
  {
    question: "How do credits work?",
    answer:
      "Paid tiers include pre-paid monthly credits with rollover caps. During beta the subscription picker is UI-only; credits are not billed yet.",
  },
  {
    question: "Can I run models on my own hardware?",
    answer:
      "Yes. Pair a local runtime and run open-weights models on your own machines. You pay nothing for the compute.",
  },
  {
    question: "When will billing go live?",
    answer:
      "Stripe integration is in progress. While the console shows plans and a subscription picker, no charges are processed during beta.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] md:text-[36px]">
          Frequently asked questions
        </h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {faq.question}
                  </span>
                  <CaretDown
                    size={18}
                    className={`shrink-0 text-[var(--text-secondary)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
