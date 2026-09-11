import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AProtocolWordmark } from '@/components/AProtocolWordmark';
import { NativeOriginBanner } from '@/components/native-sessions/NativeOriginBanner';
import { OfficeSuiteSection } from './OfficeSuiteSection';

/**
 * Allternit Office as a popped-out desktop window (the ACI rail's
 * "Allternit Office" tab). Deliberately mirrors the Design window's UX:
 * flex-column root, NativeOriginBanner, and a 56px header bar with the same
 * inline spacing, here carrying the A://TERNIT OFFICE wordmark.
 *
 * Editor opens: plain targets go to the main window via the desktop
 * openOffice bridge (same as the old in-shell hub); file handoffs (the
 * in-memory handoff store is per-renderer) and targets the bridge can't
 * carry ('sign', 'markdown-preview') open as routes inside this window.
 */
export function OfficeDesktopView() {
  const navigate = useNavigate();

  const openOfficeTarget = (
    window as {
      allternit?: { openOffice?: (target?: string, artifactId?: string) => Promise<void> };
    }
  ).allternit?.openOffice;

  const openView = (viewType: string, context?: unknown) => {
    const ctx = context as { handoffId?: string; artifactId?: string } | undefined;
    const bridgeTarget =
      viewType === 'markdown-preview' ? 'markdown' : viewType;
    if (
      openOfficeTarget &&
      !ctx?.handoffId &&
      bridgeTarget !== 'sign' &&
      ['docs', 'sheets', 'slides', 'pdf', 'markdown'].includes(bridgeTarget)
    ) {
      void openOfficeTarget(bridgeTarget, ctx?.artifactId);
      return;
    }
    if (viewType === 'sign') {
      navigate('/sign');
      return;
    }
    navigate(
      `/${viewType}`,
      ctx?.handoffId ? { state: { handoffId: ctx.handoffId } } : undefined,
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--shell-view-bg)',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-primary)',
      }}
    >
      <NativeOriginBanner sessionId={null} />
      <header
        style={{
          height: '56px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-panel)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          flexShrink: 0,
          gap: '12px',
        }}
      >
        <span data-testid="office-wordmark" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <AProtocolWordmark suffix="OFFICE" height={18} theme="adaptive" />
        </span>
      </header>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="mx-auto flex w-full max-w-6xl flex-col px-8 pb-12 pt-10">
          <OfficeSuiteSection openView={openView} />
        </div>
      </div>
    </div>
  );
}

export default OfficeDesktopView;
