import React from 'react';

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
    <div className="rounded-[14px] border border-solid border-[var(--surface-hover)] bg-[rgba(16,12,10,0.24)] p-[12px_12px_11px]">
      <div
        className="text-[12px] font-extrabold text-[var(--palette-accent)] uppercase tracking-[0.08em] mb-1.5"
        style={{ '--palette-accent': accent } as React.CSSProperties}
      >
        {label}
      </div>
      <div className="text-[12px] leading-relaxed text-[#efe4da] break-words">
        {value}
      </div>
    </div>
  );
}
