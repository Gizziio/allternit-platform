/**
 * Local engine status — Settings → Diagnostics.
 *
 * The four processes Allternit Desktop spawns: API, gizzi, Fabric worker,
 * office engine. Main process is the source (`window.allternit.engines`).
 * Web/cloud builds have no bridge; the panel says so instead of inventing
 * a status. Not a viewport chrome chip — that sat on top of the rail footer.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { SettingsTable, SettingsTableCell } from '@/components/settings/SettingsTable';

type ComponentStatus = 'pending' | 'up' | 'down';

interface EngineComponentStatus {
  status: ComponentStatus;
  detail: string;
}

export interface EnginesStatus {
  api: EngineComponentStatus;
  gizzi: EngineComponentStatus;
  fabricWorker: EngineComponentStatus;
  office: EngineComponentStatus;
}

interface EnginesBridge {
  getStatus: () => Promise<EnginesStatus>;
  onStatusChange: (handler: (status: EnginesStatus) => void) => () => void;
}

const ENGINES: Array<{ key: keyof EnginesStatus; label: string; what: string }> = [
  { key: 'api', label: 'API', what: 'Local allternit-api — chat, cowork, files' },
  { key: 'gizzi', label: 'Gizzi', what: 'Agent runtime' },
  { key: 'fabricWorker', label: 'Fabric worker', what: 'Fabric Transport' },
  { key: 'office', label: 'Office', what: 'Documents, sheets, and slides' },
];

const POLL_MS = 5_000;

const STATUS_LABEL: Record<ComponentStatus, string> = {
  up: 'Running',
  pending: 'Starting',
  down: 'Stopped',
};

const STATUS_DOT: Record<ComponentStatus, string> = {
  up: 'bg-[var(--status-success)]',
  pending: 'bg-[var(--status-warning)]',
  down: 'bg-[var(--status-error,var(--status-danger))]',
};

function enginesBridge(): EnginesBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { allternit?: { engines?: EnginesBridge } }).allternit?.engines;
}

export function EngineStatusPanel(): ReactNode {
  const bridge = enginesBridge();
  const [status, setStatus] = useState<EnginesStatus | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    bridge.getStatus().then((s) => { if (!cancelled) setStatus(s); }).catch(() => {});
    const unsubscribe = bridge.onStatusChange((s) => setStatus(s));
    const timer = window.setInterval(() => {
      bridge.getStatus().then((s) => { if (!cancelled) setStatus(s); }).catch(() => {});
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [bridge]);

  return (
    <div data-testid="engine-status-panel">
      <SectionHeading>Local engines</SectionHeading>
      <p className="text-[13px] text-[var(--text-secondary)] -mt-1 mb-3">
        Processes this desktop app starts. They are not interactive from here —
        this list is only whether each one is up.
      </p>
      {!bridge ? (
        <p className="text-[13px] text-[var(--text-secondary)] p-4 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50">
          Engine status is only available in Allternit Desktop. This session is web.
        </p>
      ) : (
        <SettingsTable columns={['Engine', 'Status', 'Detail']}>
          {ENGINES.map((engine) => {
            const row = status?.[engine.key];
            const s: ComponentStatus = row?.status ?? 'pending';
            return (
              <tr key={engine.key}>
                <SettingsTableCell>
                  <div className="text-[14px] font-medium text-[var(--text-primary)]">{engine.label}</div>
                  <div className="text-[12px] text-[var(--text-secondary)]">{engine.what}</div>
                </SettingsTableCell>
                <SettingsTableCell>
                  <span className="flex items-center gap-2">
                    <span className={cn('size-1.5 rounded-full shrink-0', STATUS_DOT[s])} />
                    <span className="font-mono text-[12px]">{STATUS_LABEL[s]}</span>
                  </span>
                </SettingsTableCell>
                <SettingsTableCell className="text-[12px] text-[var(--text-secondary)]">
                  {row?.detail || 'Checking…'}
                </SettingsTableCell>
              </tr>
            );
          })}
        </SettingsTable>
      )}
    </div>
  );
}

/** @deprecated Use EngineStatusPanel in Settings → Diagnostics. */
export function EngineStatusIndicator(): ReactNode {
  return null;
}

export default EngineStatusPanel;
