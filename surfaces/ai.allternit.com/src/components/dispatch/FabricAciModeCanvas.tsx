'use client';

import React, { Suspense, useEffect } from 'react';
import { Spinner } from '@phosphor-icons/react';
import { BrowserPaneWrapper } from '@/shell/BrowserPane';
import {
  getFabricAciRunner,
  setFabricAciRunner,
} from '@/capsules/browser/browserAgent.store';
import { ErrorBoundary } from '@/components/error-boundary';
import type { FabricSessionWithStatus } from '@/lib/dispatch/fabric-session-client';

const BrowserCapsuleEnhanced = React.lazy(() =>
  import('@/capsules/browser/BrowserCapsuleEnhanced').then((m) => ({
    default: m.BrowserCapsuleEnhanced,
  })),
);

/**
 * FabricAciModeCanvas — desktop ACI/browser mode inside the fabric session
 * surface: the actual embedded browser (tabs, address bar, web content) plus
 * the Allternit Computer Agent chat pane, exactly the view the desktop shell
 * mounts for browser mode. Agent runs are delegated to the paired node via
 * the fabric ACI runner (see browserAgent.store) — the capsule's agent bar
 * calls startAciSession, which routes to onRunGoal here, and the run's live
 * frames stream back into the shared browser agent store.
 */
export function FabricAciModeCanvas({
  session,
  hostName,
  onRunGoal,
  onStopRun,
}: {
  session: FabricSessionWithStatus | null;
  hostName?: string;
  onRunGoal: (goal: string) => void;
  onStopRun: () => void;
}) {
  useEffect(() => {
    const runner = {
      start: (goal: string) => onRunGoal(goal),
      stop: () => onStopRun(),
    };
    setFabricAciRunner(runner);
    return () => {
      if (getFabricAciRunner() === runner) setFabricAciRunner(null);
    };
  }, [onRunGoal, onStopRun]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col bg-[var(--shell-view-bg)]">
      <ErrorBoundary componentName="FabricAciBrowser">
        <BrowserPaneWrapper>
          <Suspense
            fallback={(
              <div className="flex h-full items-center justify-center text-[var(--shell-item-muted)]">
                <Spinner className="animate-spin mr-2" size={20} />
                Loading browser…
              </div>
            )}
          >
            <BrowserCapsuleEnhanced />
          </Suspense>
        </BrowserPaneWrapper>
      </ErrorBoundary>
    </div>
  );
}
