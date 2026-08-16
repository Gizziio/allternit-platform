import React from 'react';
import { cn } from "@/lib/utils";
import type { SurfacePalette } from "./context-strip.types";

export function ActionChip({
  active,
  icon: Icon,
  label,
  palette,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<any>;
  label: string;
  palette: SurfacePalette;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-solid px-2.5 py-1.5 text-[12px] font-bold cursor-pointer transition-colors",
        active 
          ? "bg-[var(--palette-soft)] border-[var(--palette-border)] text-[var(--palette-accent)]" 
          : "bg-white/5 backdrop-blur-sm border-[var(--ui-border-default)] text-[var(--ui-text-muted)]"
      )}
      style={{
        '--palette-soft': palette.soft,
        '--palette-border': palette.border,
        '--palette-accent': palette.accent,
      } as React.CSSProperties}
    >
      <Icon size={13} weight={active ? "fill" : "bold"} />
      {label}
    </button>
  );
}
