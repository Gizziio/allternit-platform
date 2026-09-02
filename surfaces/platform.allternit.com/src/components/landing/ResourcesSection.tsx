import React from "react";
import { ArrowRight, BookOpen, Code, Lightning } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const RESOURCES = [
  {
    icon: <Lightning size={24} weight="duotone" />,
    title: "Quickstart",
    description: "Generate an API key, pair a runtime, and send your first request in minutes.",
    href: "/docs",
  },
  {
    icon: <BookOpen size={24} weight="duotone" />,
    title: "API reference",
    description: "Bearer-token authentication, chat completions, run scheduling, and hosted tools.",
    href: "/docs",
  },
  {
    icon: <Code size={24} weight="duotone" />,
    title: "Examples",
    description: "Sample scripts and patterns for local inference, cloud routing, and tool use.",
    href: "/docs",
  },
];

export function ResourcesSection() {
  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] md:text-[36px]">
            Everything you need to start
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)] md:text-[16px]">
            Docs, reference, and examples for the Allternit Cloud API and console.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((item) => (
            <Link
              key={item.title}
              to={item.href}
              className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-6 transition-all hover:border-[#D97757]/30 hover:bg-[var(--bg-secondary)]"
            >
              <div className="mb-4 inline-flex w-fit rounded-xl bg-[#D97757]/10 p-3 text-[#D97757]">
                {item.icon}
              </div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">{item.title}</h3>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                {item.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#D97757]">
                Open docs <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
