import React from "react";
import { PublicHeader } from "@/components/PublicHeader";

export function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-[12px] text-[var(--text-tertiary)] sm:flex-row">
          <span>© {new Date().getFullYear()} Allternit. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a
              href="https://allternit.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Terms
            </a>
            <a
              href="https://allternit.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Privacy
            </a>
            <a
              href="https://status.allternit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Status
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
