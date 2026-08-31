import React from "react";
import { BookOpen, ArrowSquareOut, Code, Cloud, Gear } from "@phosphor-icons/react";

const docLinks = [
  {
    icon: Code,
    title: "Platform API reference",
    description: "Endpoints, authentication, and request/response schemas for the Allternit gateway.",
    href: "https://docs.allternit.com/api",
  },
  {
    icon: Cloud,
    title: "Hosted compute",
    description: "Provision managed Fly runtimes, regions, limits, and enterprise BYOC setup.",
    href: "https://docs.allternit.com/compute",
  },
  {
    icon: Gear,
    title: "Organization & billing",
    description: "Roles, organizations, metered billing, and invoice exports.",
    href: "https://docs.allternit.com/billing",
  },
];

export function DocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
          Docs
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Reference documentation for the Allternit platform and cloud API.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {docLinks.map((link) => (
          <a
            key={link.title}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4 hover:border-[var(--accent-primary)]/30 hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="size-9 shrink-0 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
                <link.icon size={18} />
              </div>
              <ArrowSquareOut size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors" />
            </div>
            <div className="text-[14px] font-semibold text-[var(--text-primary)] mt-3">{link.title}</div>
            <p className="text-[12px] text-[var(--text-secondary)] mt-1 leading-relaxed">{link.description}</p>
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-5">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-primary)] mb-2">
          <BookOpen size={18} className="text-[var(--accent-primary)]" /> Need help?
        </div>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed m-0">
          Documentation links above are placeholders for the canonical docs site. Reach out to your
          Allternit contact or open the in-app help from{" "}
          <a
            href="https://ai.allternit.com/shell"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-primary)] hover:underline"
          >
            ai.allternit.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
