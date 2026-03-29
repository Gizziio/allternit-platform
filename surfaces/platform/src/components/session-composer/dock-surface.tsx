"use client";

import { cn } from "@/lib/utils";

/**
 * Shared surface shell for dock components (todo, permission, question).
 * Encapsulates the glass-bg + strong-border base that all docks share.
 * Use `className` to override radius, shadow, or accent borders.
 */
interface DockSurfaceProps {
  children: React.ReactNode;
  className?: string;
  "data-component"?: string;
  style?: React.CSSProperties;
}

export function DockSurface({
  children,
  className,
  "data-component": dataComponent,
  style,
}: DockSurfaceProps) {
  return (
    <div
      data-component={dataComponent}
      style={style}
      className={cn(
        "w-full rounded-[16px] overflow-hidden",
        "bg-[var(--glass-bg-thick)] border border-[var(--border-strong)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
