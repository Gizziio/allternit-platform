'use client';

import React, { useCallback } from 'react';
import {
  DesktopTower,
  Spinner,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { ToastProvider } from '@/components/ui/toast-provider';
import { openFabricSessionWindow } from '@/lib/open-fabric-session-window';
import { FabricSessionQrCard } from './FabricSessionQrCard';
import { MachinesPanel } from './MachinesPanel';
import { FabricSessionPanel } from './FabricSessionPanel';
import { useRuntimeSelection } from './useRuntimeSelection';
import { useRuntimes } from './useRuntimes';
import { useFabricPendingCounts } from './useFabricPendingCounts';
import { MockRuntimesBanner } from './MockRuntimesBanner';
import { FabricViewTitle } from './FabricAppChrome';

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] p-4">
      <div className="text-label text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className="text-[28px] font-medium tracking-tight text-[var(--text-primary)]">{value}</div>
      <div className="text-caption text-[var(--text-secondary)]">{sub}</div>
    </div>
  );
}

export function FabricSessionHub(): React.ReactNode {
  const auth = usePlatformAuth();
  const { runtimes, loading, isMock, lastRefreshedAt } = useRuntimes();
  const [selectedId, setSelectedId] = useRuntimeSelection();
  const selected = runtimes.find((r) => r.id === selectedId);
  const onlineCount = runtimes.filter((r) => r.status === 'online').length;
  const { permissions: pendingPermissions, questions: pendingQuestions } = useFabricPendingCounts(runtimes, auth.getToken);

  const handleOpenDashboard = useCallback(() => {
    openFabricSessionWindow(selectedId ?? undefined);
  }, [selectedId]);

  const lastRefreshedText = lastRefreshedAt
    ? `Updated ${new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : null;

  return (
    <ToastProvider>
      <div className="h-full w-full overflow-y-auto bg-[var(--shell-view-bg)] text-[var(--text-primary)]">
        <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12">
          <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
            <div>
              <FabricViewTitle
                title="Fabric Transport"
                subtitle="Monitor, hand off, and run agents across machines."
              />
              <div className="flex items-center gap-3 mt-2">
                {loading && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-tertiary)]">
                    <Spinner size={12} className="animate-spin" />
                    Refreshing machines…
                  </span>
                )}
                {lastRefreshedText && !loading && (
                  <span className="text-[12px] font-semibold text-[var(--text-tertiary)]">{lastRefreshedText}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenDashboard}
              className="inline-flex items-center h-9 px-3.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--shell-control-bg)] text-[12px] font-semibold text-[var(--shell-control-fg)] cursor-pointer shrink-0"
            >
              Open dashboard
            </button>
          </header>

          {isMock && <div className="mb-6"><MockRuntimesBanner /></div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Online Machines" value={onlineCount} sub={`of ${runtimes.length} paired`} />
            <StatCard label="Pending Permissions" value={pendingPermissions} sub="Need your approval" />
            <StatCard label="Pending Questions" value={pendingQuestions} sub="Awaiting answers" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MachinesPanel
                runtimes={runtimes}
                loading={loading}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
            <div className="space-y-6">
              {selected ? (
                <>
                  <FabricSessionQrCard runtimeId={selected.id} />
                  <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] overflow-hidden min-h-[560px] h-[min(70vh,720px)]">
                    <FabricSessionPanel runtimeId={selected.id} runtime={selected} getToken={auth.getToken} />
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-8 text-center">
                  <DesktopTower size={48} className="mx-auto mb-3 opacity-40" />
                  <p className="text-[14px] font-medium text-[var(--text-primary)] m-0 mb-1">
                    Select a machine
                  </p>
                  <p className="text-[12px] text-[var(--text-tertiary)] m-0 mb-4">
                    Choose a paired machine to hand off or start a Fabric Session.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenDashboard}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--text-primary)] text-[var(--bg-elevated)] border-none cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <ArrowSquareOut size={14} weight="bold" />
                    Open dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
