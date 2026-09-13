import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronDownIcon, ChevronRightIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";

interface ModelCardProps {
  name: string;
  tagline: string;
  badges?: string[];
  /** Pricing / capability detail shown in the expandable region. */
  children: React.ReactNode;
  className?: string;
}

export function ModelCard({
  name,
  tagline,
  badges,
  children,
  className,
}: ModelCardProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 font-mono text-[14px] font-semibold text-[var(--text-primary)]">
              {name}
            </h3>
            {badges?.map((badge) => <Badge key={badge}>{badge}</Badge>)}
          </div>
          <p className="m-0 mt-1 text-[13px] text-[var(--text-secondary)]">{tagline}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          {expanded ? "Hide details" : "Details"}
          <HugeiconsIcon
            icon={expanded ? ChevronDownIcon : ChevronRightIcon}
            size={13}
          />
        </button>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-solid border-[var(--border-subtle)] pt-3 text-[13px] text-[var(--text-secondary)]">
          {children}
        </div>
      )}
    </div>
  );
}
