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
