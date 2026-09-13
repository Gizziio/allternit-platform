import React from "react";
import { Link } from "react-router-dom";

interface ResourceCardProps {
  title: string;
  description: string;
  action: { label: string; to?: string; onClick?: () => void };
  className?: string;
}

export function ResourceCard({
  title,
  description,
  action,
  className,
}: ResourceCardProps): React.ReactNode {
  return (
    <div
      className={
        "flex flex-col rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 " +
        (className ?? "")
      }
    >
      <h3 className="m-0 text-[14px] font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="m-0 mt-1 flex-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>
      {action.to ? (
        <Link
          to={action.to}
          className="mt-3 inline-flex items-center self-start rounded-lg border border-solid border-[var(--border-subtle)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-primary)]"
        >
          {action.label}
        </Link>
      ) : (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 inline-flex items-center self-start rounded-lg border border-solid border-[var(--border-subtle)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-primary)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
