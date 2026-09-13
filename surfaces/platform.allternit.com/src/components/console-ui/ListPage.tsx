import React from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export interface ListPagePagination {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

export interface ListPageAction {
  label: string;
  onClick?: () => void;
  to?: string;
}

interface ListPageProps {
  title: string;
  subtitle?: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  /** Optional filter controls rendered next to the search field. */
  filters?: React.ReactNode;
  primaryAction?: ListPageAction;
  pagination?: ListPagePagination;
  /** Rendered in place of children when the list has no rows. */
  emptyState?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Anthropic-console list pattern: header row (title left, primary action
 * right), search + filter row, content, footer pager.
 */
export function ListPage({
  title,
  subtitle,
  searchPlaceholder,
  onSearch,
  filters,
  primaryAction,
  pagination,
  emptyState,
  children,
  className,
}: ListPageProps): React.ReactNode {
  return (
    <div className={cn("flex min-h-full flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
            {title}
          </h1>
          {subtitle && (
            <p className="m-0 mt-1 text-[13px] text-[var(--text-secondary)]">{subtitle}</p>
          )}
        </div>
        {primaryAction &&
          (primaryAction.to ? (
            <Link
              to={primaryAction.to}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110"
            >
              {primaryAction.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110"
            >
              {primaryAction.label}
            </button>
          ))}
      </div>

      {(searchPlaceholder || onSearch || filters) && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {searchPlaceholder !== undefined && onSearch !== undefined && (
            <input
              type="text"
              placeholder={searchPlaceholder}
              onChange={(event) => onSearch(event.target.value)}
              className="min-w-[220px] flex-1 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-default)]"
            />
          )}
          {filters}
        </div>
      )}

      <div className="mt-4 flex-1">{children ?? emptyState}</div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-[12px] text-[var(--text-secondary)]">
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            aria-label="Previous page"
            disabled={pagination.page <= 1}
            onClick={() => pagination.onPage(pagination.page - 1)}
            className="inline-flex size-7 items-center justify-center rounded-md border border-solid border-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => pagination.onPage(pagination.page + 1)}
            className="inline-flex size-7 items-center justify-center rounded-md border border-solid border-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
