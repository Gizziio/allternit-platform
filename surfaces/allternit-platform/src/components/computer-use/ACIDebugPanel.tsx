"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Pulse as Activity,
  List,
  Eye,
  Bug,
} from '@phosphor-icons/react';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/allternit.tokens';

// ============================================================================
// Types
// ============================================================================

interface ActionRecord {
  action_id: string;
  step: number;
  action_type: string;
  result_success: boolean;
  result_error?: string;
  duration_ms: number;
  url_before?: string;
  url_after?: string;
  after_screenshot?: string;
}

interface EvidenceBundle {
  session_id: string;
  records: ActionRecord[];
  started_at?: string;
  finalized_at?: string;
}

interface FleetWorker {
  worker_id: string;
  sessions_active: number;
  capacity: number;
  is_healthy: boolean;
}

interface FleetHealth {
  workers: FleetWorker[];
  total_sessions: number;
  total_capacity: number;
}

interface ACIDebugPanelProps {
  sessionId?: string;
  operatorBaseUrl?: string;
  onClose: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: ok ? STATUS.success : STATUS.error,
        flexShrink: 0,
      }}
    />
  );
}

function ActionRow({ record }: { record: ActionRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        borderRadius: 6,
        background: record.result_success ? 'rgba(16,185,129,0.06)' : 'var(--status-error-bg)',
        border: `1px solid ${record.result_success ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.2)'}`,
        marginBottom: 4,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: TEXT.primary,
          fontSize: 12,
          textAlign: 'left',
        }}
      >
        <span style={{ color: `${SAND[500]}80`, width: 24, flexShrink: 0 }}>
          {record.step}
        </span>
        <StatusDot ok={record.result_success} />
        <span style={{ flex: 1, fontFamily: 'monospace' }}>{record.action_type}</span>
        <span style={{ color: `${SAND[500]}70`, fontSize: 10 }}>{record.duration_ms}ms</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 10px 8px', borderTop: `1px solid var(--surface-hover)` }}>
          {record.url_after && (
            <p style={{ margin: '4px 0', fontSize: 11, color: `${SAND[500]}90`, wordBreak: 'break-all' }}>
              {record.url_after}
            </p>
          )}
          {record.result_error && (
            <p style={{ margin: '4px 0', fontSize: 11, color: STATUS.error }}>
              {record.result_error}
            </p>
          )}
          {record.after_screenshot && (
            <img
              src={`data:image/png;base64,${record.after_screenshot}`}
              alt={`step ${record.step}`}
              style={{ maxWidth: '100%', borderRadius: 4, marginTop: 6, opacity: 0.9 }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ACIDebugPanel
// ============================================================================

type TabId = 'actions' | 'evidence' | 'fleet' | 'metrics';

export function ACIDebugPanel({
  sessionId,
  operatorBaseUrl = 'http://127.0.0.1:3010',
  onClose,
}: ACIDebugPanelProps) {
  // Debug panel is dev-only — renders nothing in production builds
  if (process.env.NODE_ENV !== 'development') return null;
  const [activeTab, setActiveTab] = useState<TabId>('actions');
  const [bundle, setBundle] = useState<EvidenceBundle | null>(null);
  const [fleet, setFleet] = useState<FleetHealth | null>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBundle = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${operatorBaseUrl}/v1/sessions/${sessionId}/evidence`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setBundle({
        session_id: sessionId,
        records: data.actions || [],
        started_at: data.started_at,
      });
    } catch (e) {
      setError(String(e));
    }
  };

  const fetchFleet = async () => {
    try {
      const res = await fetch(`${operatorBaseUrl}/v1/fleet/health`);
      if (!res.ok) throw new Error(`${res.status}`);
      setFleet(await res.json());
    } catch (e) {
      setError(String(e));
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${operatorBaseUrl}/v1/metrics/snapshot`);
      if (!res.ok) throw new Error(`${res.status}`);
      setMetrics(await res.json());
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchBundle(), fetchFleet(), fetchMetrics()]).finally(() =>
      setLoading(false)
    );

    // Poll every 3 seconds
    pollRef.current = setInterval(() => {
      fetchBundle();
      fetchFleet();
      fetchMetrics();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, operatorBaseUrl]);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'actions', label: 'Actions', icon: <List size={13} /> },
    { id: 'evidence', label: 'Evidence', icon: <Eye size={13} /> },
    { id: 'fleet', label: 'Fleet', icon: <Activity size={13} /> },
    { id: 'metrics', label: 'Metrics', icon: <Bug size={13} /> },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 360,
        background: BACKGROUND.elevated,
        borderLeft: `1px solid var(--ui-border-muted)`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9000,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        color: TEXT.primary,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--ui-border-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <Bug size={15} color={SAND[500]} />
        <span style={{ fontWeight: 600, fontSize: 13, color: SAND[400] }}>ACI Debug</span>
        {sessionId && (
          <code style={{ fontSize: 10, color: `${SAND[500]}70`, marginLeft: 4 }}>
            {sessionId.slice(0, 8)}
          </code>
        )}
        <div style={{ flex: 1 }} />
        {loading && (
          <span style={{ fontSize: 10, color: `${SAND[500]}60` }}>syncing...</span>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: `${SAND[500]}80`,
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--ui-border-muted)',
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '8px 0',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id
                ? `2px solid ${SAND[500]}`
                : '2px solid transparent',
              color: activeTab === tab.id ? SAND[400] : `${SAND[500]}60`,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '6px 16px',
            background: 'var(--status-error-bg)',
            borderBottom: '1px solid rgba(239,68,68,0.2)',
            fontSize: 11,
            color: STATUS.error,
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>

        {/* Actions tab */}
        {activeTab === 'actions' && (
          <div>
            {!bundle ? (
              <p style={{ color: `${SAND[500]}50`, fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                {sessionId ? 'No evidence yet' : 'No session selected'}
              </p>
            ) : (
              <>
                <div style={{ marginBottom: 8, fontSize: 11, color: `${SAND[500]}70` }}>
                  {bundle.records.length} actions recorded
                  {bundle.started_at && ` · started ${new Date(bundle.started_at).toLocaleTimeString()}`}
                </div>
                {bundle.records.map((r) => (
                  <ActionRow key={r.action_id} record={r} />
                ))}
              </>
            )}
          </div>
        )}

        {/* Evidence tab */}
        {activeTab === 'evidence' && bundle && (
          <div>
            {bundle.records.filter((r) => r.after_screenshot).map((r) => (
              <div key={r.action_id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: `${SAND[500]}70`, marginBottom: 4 }}>
                  Step {r.step} — {r.action_type}
                </div>
                <img
                  src={`data:image/png;base64,${r.after_screenshot}`}
                  alt={`step ${r.step}`}
                  style={{ width: '100%', borderRadius: 6, border: '1px solid var(--ui-border-muted)' }}
                />
              </div>
            ))}
            {bundle.records.every((r) => !r.after_screenshot) && (
              <p style={{ color: `${SAND[500]}50`, fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                No screenshots captured yet
              </p>
            )}
          </div>
        )}

        {/* Fleet tab */}
        {activeTab === 'fleet' && (
          <div>
            {!fleet ? (
              <p style={{ color: `${SAND[500]}50`, fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                Fleet data unavailable
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ background: 'var(--surface-hover)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: `${SAND[500]}70` }}>Active Sessions</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: SAND[300], marginTop: 4 }}>
                      {fleet.total_sessions}
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface-hover)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: `${SAND[500]}70` }}>Capacity</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: SAND[300], marginTop: 4 }}>
                      {fleet.total_capacity}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: `${SAND[500]}70`, marginBottom: 6 }}>Workers</div>
                {fleet.workers.map((w) => (
                  <div
                    key={w.worker_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 10px',
                      background: 'var(--surface-hover)',
                      borderRadius: 6,
                      marginBottom: 4,
                      fontSize: 12,
                    }}
                  >
                    <StatusDot ok={w.is_healthy} />
                    <code style={{ color: `${SAND[500]}90`, fontSize: 10, flex: 1 }}>
                      {w.worker_id.slice(0, 8)}
                    </code>
                    <span style={{ color: `${SAND[500]}70` }}>
                      {w.sessions_active}/{w.capacity}
                    </span>
                    <div
                      style={{
                        width: 48,
                        height: 4,
                        borderRadius: 2,
                        background: 'var(--ui-border-default)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${(w.sessions_active / Math.max(w.capacity, 1)) * 100}%`,
                          height: '100%',
                          background: w.sessions_active === w.capacity ? STATUS.error : STATUS.success,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Metrics tab */}
        {activeTab === 'metrics' && (
          <div>
            {!metrics ? (
              <p style={{ color: `${SAND[500]}50`, fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                Metrics unavailable
              </p>
            ) : (
              <pre
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: `${SAND[400]}e0`,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  lineHeight: 1.6,
                }}
              >
                {JSON.stringify(metrics, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--ui-border-muted)',
          fontSize: 10,
          color: `${SAND[500]}50`,
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span>Allternit ACI Debug · {operatorBaseUrl}</span>
        <span>polling 3s</span>
      </div>
    </div>
  );
}

export default ACIDebugPanel;
