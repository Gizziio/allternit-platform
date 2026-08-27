import React from "react";

export function MetaCard({
  accent,
  label,
  value,
}: {
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1"
        style={{ color: accent }}
      >
        {label}
      </div>
      <div className="text-[12px] leading-relaxed text-[var(--text-secondary)] break-words">
        {value}
      </div>
    </div>
  );
}
