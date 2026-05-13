/**
 * DesignVariationGrid — side-by-side design variation comparison layout.
 * Ported from alchaincyf/huashu-design design_canvas.jsx
 *
 * Usage:
 *   <DesignVariationGrid title="Hero exploration" columns={3}>
 *     <Variation label="Minimal" description="Restrained version">
 *       <div>…design 1…</div>
 *     </Variation>
 *     <Variation label="Editorial">
 *       <div>…design 2…</div>
 *     </Variation>
 *   </DesignVariationGrid>
 */

import React from "react";

const s = {
  container: {
    minHeight: "100%",
    background: "var(--surface-canvas, #F5F5F0)",
    padding: "32px 40px",
    fontFamily: "var(--font-sans, -apple-system, system-ui, sans-serif)",
  } as React.CSSProperties,
  header: {
    marginBottom: 36,
    maxWidth: 900,
  } as React.CSSProperties,
  title: {
    fontSize: 28,
    fontWeight: 600,
    marginBottom: 8,
    color: "var(--text-primary, #1A1A1A)",
    letterSpacing: "-0.02em",
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary, #666)",
    lineHeight: 1.5,
    marginTop: 8,
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gap: 24,
  } as React.CSSProperties,
  cell: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  } as React.CSSProperties,
  cellHeader: {
    display: "flex",
    alignItems: "baseline" as const,
    gap: 10,
    paddingBottom: 8,
    borderBottom: "1px solid var(--border-subtle, #E0E0DA)",
  } as React.CSSProperties,
  number: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-tertiary, #999)",
    fontFamily: 'var(--font-mono)',
  } as React.CSSProperties,
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary, #1A1A1A)",
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  description: {
    fontSize: 12,
    color: "var(--text-tertiary, #888)",
  } as React.CSSProperties,
  frame: {
    background: "var(--surface-panel, #fff)",
    borderRadius: 4,
    border: "1px solid var(--border-subtle, #E0E0DA)",
    overflow: "hidden" as const,
    position: "relative" as const,
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    cursor: "pointer",
  } as React.CSSProperties,
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0, 0, 0, 0.75)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: 40,
    cursor: "zoom-out",
  } as React.CSSProperties,
  overlayInner: {
    background: "#fff",
    borderRadius: 8,
    overflow: "hidden" as const,
    maxWidth: "90vw",
    maxHeight: "90vh",
    position: "relative" as const,
  } as React.CSSProperties,
};

// Internal context so Variation components know their index + expanded state
interface VariationContext {
  index: number;
  expanded: boolean;
  onToggle: () => void;
}

const VariationCtx = React.createContext<VariationContext | null>(null);

interface DesignVariationGridProps {
  title?: string;
  subtitle?: string;
  columns?: number;
  children: React.ReactNode;
}

export function DesignVariationGrid({
  title,
  subtitle,
  columns = 3,
  children,
}: DesignVariationGridProps) {
  const [expanded, setExpanded] = React.useState<number | null>(null);

  const childArray = React.Children.toArray(children);

  return (
    <div style={s.container}>
      {(title || subtitle) && (
        <div style={s.header}>
          {title && <h2 style={s.title}>{title}</h2>}
          {subtitle && <p style={s.subtitle}>{subtitle}</p>}
        </div>
      )}

      <div style={{ ...s.grid, gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {childArray.map((child, idx) =>
          React.isValidElement(child) ? (
            <VariationCtx.Provider
              key={idx}
              value={{
                index: idx,
                expanded: expanded === idx,
                onToggle: () => setExpanded(expanded === idx ? null : idx),
              }}
            >
              {child}
            </VariationCtx.Provider>
          ) : child
        )}
      </div>

      {expanded !== null && (
        <div style={s.overlay} onClick={() => setExpanded(null)}>
          <div style={s.overlayInner} onClick={(e) => e.stopPropagation()}>
            {childArray[expanded]}
          </div>
        </div>
      )}
    </div>
  );
}

interface VariationProps {
  label: string;
  description?: string;
  number?: string;
  aspectRatio?: string;
  children: React.ReactNode;
}

export function Variation({
  label,
  description,
  number,
  aspectRatio = "4 / 3",
  children,
}: VariationProps) {
  const ctx = React.useContext(VariationCtx);
  const displayNumber = number ?? String((ctx?.index ?? 0) + 1).padStart(2, "0");
  const [hovered, setHovered] = React.useState(false);

  return (
    <div style={s.cell}>
      <div style={s.cellHeader}>
        <span style={s.number}>{displayNumber}</span>
        <span style={s.label}>{label}</span>
        {description && <span style={s.description}>— {description}</span>}
      </div>

      <div
        onClick={ctx?.onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...s.frame,
          aspectRatio,
          boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.08)" : "none",
        }}
      >
        <div style={{ position: "relative", width: "100%" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
