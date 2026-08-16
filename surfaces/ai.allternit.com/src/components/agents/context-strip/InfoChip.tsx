import React from "react";
import type { SurfacePalette } from "./context-strip.types";

export function InfoChip({
  icon: Icon,
  label,
  palette,
}: {
  icon: React.ComponentType<any>;
  label: string;
  palette: SurfacePalette;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 bg-[var(--surface-hover)] border border-[var(--palette-border)] text-[var(--text-secondary)] text-[11px] leading-none"
      style={{
        "--palette-border": palette.border,
        "--palette-accent": palette.accent,
      } as React.CSSProperties}
    >
      <Icon size={11} weight="bold" className="text-[var(--palette-accent)]" />
      {label}
    </span>
  );
}
