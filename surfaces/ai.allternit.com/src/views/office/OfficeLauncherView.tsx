import React from 'react';
import { OfficeSuiteSection } from './OfficeSuiteSection';

export interface OfficeLauncherViewProps {
  /**
   * Shell context: open editors as ACI shell views instead of navigating to
   * the full-page routes. Provided by the ViewRegistry (same pattern as
   * LibraryView); absent on the standalone /office route.
   */
  openView?: (viewType: string, context?: unknown) => void;
  children?: React.ReactNode;
}

/**
 * Unified Documents & Office launcher — the single entry point to the four
 * Allternit Office editors. The suite section itself lives in
 * OfficeSuiteSection, shared with the shell's "Office & Extensions" view.
 * Layout follows the platform's standard shell-view recipe (same as
 * Artifacts Library / Automation Tasks) for light/dark theme consistency.
 */
export function OfficeLauncherView({ openView, children }: OfficeLauncherViewProps) {
  return (
    <div
      className="h-full w-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] overflow-auto"
      data-testid="office-launcher"
    >
      <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12 flex flex-col">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="m-0 text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
              Allternit Office
            </h1>
            <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
              Create and edit Word, Excel, PowerPoint, and PDF files in Allternit — saved as Allternit artifacts.
            </p>
          </div>
          <a
            href="https://office.allternit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
          >
            Open standalone office
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>

        <div className="mt-8">
          <OfficeSuiteSection openView={openView} />
        </div>

        <section className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 transition-all duration-200 hover:border-[var(--border-hover)]">
          <h2 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">Engine-backed, artifact-native</h2>
          <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Every editor runs on the forked GenOffice engines through the Allternit office-engine service, and work is saved as Allternit artifacts — open the same document on the web surface, the desktop app, or hand it to an agent.
          </p>
        </section>
        {children}
      </div>
    </div>
  )
}

export default OfficeLauncherView
