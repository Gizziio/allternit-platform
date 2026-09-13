import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface FormPageSection {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

interface FormPageProps {
  title: string;
  /** e.g. ["Manage", "Members"] rendered above the title. */
  breadcrumb?: string[];
  sections: FormPageSection[];
  /** Defaults to a Cancel link (to `cancelTo`) + a Primary submit button. */
  footerActions?: React.ReactNode;
  cancelTo?: string;
  cancelLabel?: string;
  primaryLabel?: string;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
}

/**
 * Settings-style form layout: section descriptions in a left rail, fields on
 * the right, sticky footer with Cancel + Primary actions.
 */
export function FormPage({
  title,
  breadcrumb,
  sections,
  footerActions,
  cancelTo = "..",
  cancelLabel = "Cancel",
  primaryLabel = "Save",
  onSubmit,
  className,
}: FormPageProps): React.ReactNode {
  return (
    <form
      onSubmit={onSubmit}
      className={cn("flex flex-col", className)}
    >
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-1 flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
          {breadcrumb.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span>/</span>}
              <span className={i === breadcrumb.length - 1 ? "text-[var(--text-secondary)]" : undefined}>
                {part}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}
      <h1 className="m-0 text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h1>

      <div className="mt-6 flex-1 space-y-8 pb-20">
        {sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="grid gap-4 border-t border-solid border-[var(--border-subtle)] pt-6 first:border-t-0 first:pt-0 lg:grid-cols-[220px_1fr] lg:gap-8"
          >
            <div>
              <h2 className="m-0 text-[14px] font-semibold text-[var(--text-primary)]">
                {section.title}
              </h2>
              <p className="m-0 mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
                {section.description}
              </p>
            </div>
            <div className="min-w-0">{section.children}</div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-2 border-t border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)]/90 px-4 py-3 backdrop-blur-sm lg:-mx-8 lg:px-8">
        {footerActions ?? (
          <div className="flex items-center justify-end gap-2">
            <Link
              to={cancelTo}
              className="inline-flex items-center rounded-lg border border-solid border-[var(--border-subtle)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)]"
            >
              {cancelLabel}
            </Link>
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110"
            >
              {primaryLabel}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
