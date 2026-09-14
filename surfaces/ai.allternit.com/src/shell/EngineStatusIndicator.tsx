/**
 * Engine status indicator (consumer-packaged Cowork P1).
 *
 * One green/yellow/red pill in the app chrome over the four managed engines:
 * Allternit API, gizzi runtime, Fabric Transport worker, office engine.
 * Data comes from the desktop preload bridge (`window.allternit.engines`) —
 * the main process is the authoritative source since it spawns and monitors
 * every engine. Renders nothing in browser/cloud builds where the bridge is
 * absent, so the surface degrades by disappearing, never by lying.
 */

import { useEffect, useState } from 'react';

type ComponentStatus = 'pending' | 'up' | 'down';

interface EngineComponentStatus {
  status: ComponentStatus;
  detail: string;
}

interface EnginesStatus {
  api: EngineComponentStatus;
  gizzi: EngineComponentStatus;
  fabricWorker: EngineComponentStatus;
  office: EngineComponentStatus;
}

interface EnginesBridge {
  getStatus: () => Promise<EnginesStatus>;
  onStatusChange: (handler: (status: EnginesStatus) => void) => () => void;
}

const ENGINES: Array<{ key: keyof EnginesStatus; label: string }> = [
  { key: 'api', label: 'API' },
  { key: 'gizzi', label: 'Gizzi' },
  { key: 'fabricWorker', label: 'Fabric worker' },
  { key: 'office', label: 'Office' },
];

const POLL_MS = 5_000;

function worst(statuses: ComponentStatus[]): ComponentStatus {
  if (statuses.includes('down')) return 'down';
  if (statuses.includes('pending')) return 'pending';
  return 'up';
}

const COLORS: Record<ComponentStatus, string> = {
  up: 'var(--status-success, #22c55e)',
  pending: 'var(--status-warning, #eab308)',
  down: 'var(--status-danger, #ef4444)',
};

export function EngineStatusIndicator() {
  const bridge = typeof window !== 'undefined'
    ? (window as unknown as { allternit?: { engines?: EnginesBridge } }).allternit?.engines
    : undefined;
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

  if (!bridge) return null;
  const overall = status ? worst(ENGINES.map((e) => status[e.key].status)) : 'pending';
  const title = ENGINES.map((e) => {
    const s = status?.[e.key];
    return `${e.label}: ${s ? s.detail || s.status : 'checking…'}`;
  }).join('\n');

  return (
    <div
      title={title}
      aria-label="Engine status"
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        zIndex: 180,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 999,
        background: 'var(--ui-bg-elevated, rgba(20,20,22,0.85))',
        border: '1px solid var(--ui-border, rgba(255,255,255,0.12))',
        backdropFilter: 'blur(6px)',
        fontSize: 11,
        color: 'var(--ui-text, #e5e5e5)',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: COLORS[overall],
          boxShadow: overall === 'down' ? `0 0 6px ${COLORS.down}` : 'none',
        }}
      />
      <span style={{ opacity: 0.85 }}>Engines</span>
      <span style={{ display: 'flex', gap: 4 }}>
        {ENGINES.map((engine) => {
          const s = status?.[engine.key]?.status ?? 'pending';
          return (
            <span
              key={engine.key}
              title={`${engine.label}: ${status?.[engine.key]?.detail || s}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: COLORS[s],
                opacity: 0.9,
              }}
            />
          );
        })}
      </span>
    </div>
  );
}

export default EngineStatusIndicator;
