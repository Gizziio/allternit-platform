import React, { useEffect, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft, House } from '@phosphor-icons/react';
import { isElectronShell } from '@/lib/platform';

/**
 * Chrome for the standalone office routes (/docs, /sheets, /slides, /pdf,
 * /office). These pages render their editors full-viewport OUTSIDE the shell,
 * so the shell's RailControls (FloatingWidgets.tsx) never mounts and there is
 * no UI way back to the app home — the exact gap the owner hit on /docs.
 *
 * The row is DOCKED in normal flow (not absolutely positioned) on purpose:
 * these editors render their own ribbon at viewport top with only 84px of
 * macOS traffic-light padding (ribbon-tabs-mac), so a floating `fixed top-0`
 * row would cover the ribbon's File tab. A 44px docked bar cannot collide
 * with editor chrome, keeps the RailControls look (same button visual
 * language copied from TitleBarButton, same traffic-light clearance), and
 * restores a drag region for the frameless Electron window.
 */

function ChromeButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}): React.ReactNode {
  // Visual language copied from TitleBarButton in FloatingWidgets.tsx (that
  // symbol is not exported, and the shell file is left untouched on purpose).
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      title={title}
      disabled={disabled}
      className="bg-transparent border-none rounded-md w-11 h-11 md:w-7 md:h-7 flex items-center justify-center text-[var(--shell-item-muted)] cursor-pointer transition-all duration-150 shrink-0 [WebkitAppRegion:no-drag] hover:bg-[var(--shell-item-hover)] hover:text-[var(--shell-item-fg)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function OfficePageChrome(): React.ReactNode {
  const navigate = useNavigate();
  // Re-render on browser back/forward so the Back button's disabled state
  // tracks React Router's `idx` counter in history.state.
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener('popstate', forceUpdate);
    return () => window.removeEventListener('popstate', forceUpdate);
  }, []);

  const canGoBack = (window.history.state?.idx ?? 0) > 0;

  // Same traffic-light clearance as RailControls: the frameless Electron
  // window reserves the top-left for macOS window controls.
  const trafficLightClearance = isElectronShell() ? 72 : 4;

  return (
    <div
      data-testid="office-page-chrome"
      className="h-11 shrink-0 flex items-center gap-0.5 rounded-none border-0 border-b border-solid border-[var(--border-subtle)] bg-[var(--shell-control-bg)] px-2"
    >
      <div
        className="flex items-center gap-0.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--shell-control-bg)] px-1 py-0.5 [WebkitAppRegion:no-drag]"
        style={{ marginLeft: trafficLightClearance }}
      >
        <ChromeButton
          onClick={() => {
            if (canGoBack) window.history.back();
          }}
          title="Back"
          disabled={!canGoBack}
        >
          <CaretLeft size={15} weight="bold" />
        </ChromeButton>
        <ChromeButton onClick={() => navigate('/')} title="Home">
          <House size={15} weight="bold" />
        </ChromeButton>
      </div>
      {/* Draggable title-bar area across the rest of the bar (frameless Electron) */}
      <div className="flex-1 h-full [WebkitAppRegion:drag]" />
    </div>
  );
}

export default OfficePageChrome;
