import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlass, Warning } from "@phosphor-icons/react";
import { DRAFT_MODEL_CATALOG } from "@/lib/model-catalog";
import { usePlatformAuth } from "@/lib/platform-auth-client";
import { PublicPageShell } from "@/components/PublicPageShell";

export function ModelsPage() {
  const [query, setQuery] = useState("");
  const auth = usePlatformAuth();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DRAFT_MODEL_CATALOG;
    return DRAFT_MODEL_CATALOG.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <PublicPageShell>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[32px] font-bold leading-none tracking-tight text-[var(--text-primary)]">
              Model catalog
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
              Local and cloud models available through Allternit Cloud. DRAFT — more providers and
              pricing will be added before public launch.
            </p>
          </div>
          {auth.isLoaded && auth.isSignedIn && (
            <Link
              to="/billing"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-[13px] font-medium text-[#FDF8F3] transition-colors hover:brightness-110"
            >
              Manage subscription
            </Link>
          )}
        </div>

        <div className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-secondary)] focus-within:border-[var(--accent-primary)]/40 focus-within:ring-1 focus-within:ring-[var(--accent-primary)]/20">
          <MagnifyingGlass size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models, families, or providers..."
            className="flex-1 bg-transparent text-[13px] placeholder:text-[var(--text-tertiary)] outline-none text-[var(--text-primary)]"
          />
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--accent-primary)]/5 px-4 py-3 text-[12px] font-medium text-[var(--accent-primary)]">
            <Warning size={14} />
            Draft catalog. Prices shown are representative cloud provider rates; local models run on
            your own hardware at no compute cost.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[var(--bg-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Family</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Input / 1M tokens</th>
                  <th className="px-4 py-3">Output / 1M tokens</th>
                  <th className="px-4 py-3">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((model) => (
                  <tr key={model.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{model.name}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{model.family}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          model.provider === "local"
                            ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                            : "bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)]"
                        }`}
                      >
                        {model.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{model.inputPrice}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{model.outputPrice}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{model.context}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-[13px] text-[var(--text-secondary)]"
                    >
                      No models match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
