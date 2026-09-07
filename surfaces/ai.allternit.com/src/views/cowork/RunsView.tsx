import React, { useState, useEffect } from 'react';
import {
  Play,
  CaretDown,
  Robot,
  ArrowCounterClockwise,
  ArrowRight,
  Broadcast,
  XCircle,
  Spinner,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import {
  useCoworkRuns,
  useCoworkRunJobs,
  useCoworkRunHandoffs,
  type CoworkRun,
} from '@/lib/cowork/useCoworkRuns';
import { useCoworkRunEvents } from '@/lib/cowork/useCoworkRunEvents';
import { CoworkRunTimeline } from './CoworkRunTimeline';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('RunsView');

type FilterType = 'All' | 'Running' | 'Completed' | 'Failed';

function formatDuration(start: string, end?: string | null): string {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const diff = Math.max(0, Math.round((endMs - startMs) / 1000));
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}m ${s}s`;
}

function getStatusColor(state: string): string {
  switch (state) {
    case 'running':
    case 'recovering':
      return 'var(--accent-cowork)';
    case 'completed':
      return 'var(--status-success)';
    case 'failed':
    case 'cancelled':
      return 'var(--status-error)';
    case 'queued':
    case 'planned':
      return 'var(--status-info)';
    default:
      return 'var(--ui-text-muted)';
  }
}

export const RunsView: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');
  const { runs, loading, error, unsupported, recoverUnavailable, handoffsUnavailable, refresh, startRun, cancelRun, recoverRun, createHandoff } =
    useCoworkRuns();

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const filteredRuns = runs.filter((run) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Running') return run.state === 'running' || run.state === 'recovering';
    if (activeFilter === 'Completed') return run.state === 'completed';
    if (activeFilter === 'Failed') return run.state === 'failed' || run.state === 'cancelled';
    return true;
  }).filter((run) => {
    if (selectedWorkspace === 'all') return true;
    return run.workspace_id === selectedWorkspace;
  });

  const counts = {
    All: runs.length,
    Running: runs.filter((r) => r.state === 'running' || r.state === 'recovering').length,
    Completed: runs.filter((r) => r.state === 'completed').length,
    Failed: runs.filter((r) => r.state === 'failed' || r.state === 'cancelled').length,
  };

  const workspaces = Array.from(new Set(runs.map((r) => r.workspace_id).filter(Boolean)));

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Play size={24} color="var(--accent-cowork)" weight="fill" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Pipeline Runs</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
          Execution history, DAG status, and handoff controls
        </p>
      </div>

      {/* Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {(['All', 'Running', 'Completed', 'Failed'] as FilterType[]).map((filter) => (
            <button type="button"
              key={filter}
              onClick={() => setActiveFilter(filter)}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-md)',
                borderRadius: '9999px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor:
                  activeFilter === filter ? 'var(--accent-cowork)' : 'var(--bg-secondary)',
                color: activeFilter === filter ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              {filter} ({counts[filter]})
            </button>
          ))}
        </div>

        {/* Workspace Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Workspace:</div>
          <select aria-label="Workspace" value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">All workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws} value={ws}>{ws}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && runs.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', padding: 'var(--spacing-md)' }}>
          <Spinner size={18} className="spin" />
          <span>Loading runs…</span>
        </div>
      )}

      {error && (
        <div style={{ padding: 'var(--spacing-md)', color: 'var(--status-error)', background: 'var(--status-error-bg)', borderRadius: 8, marginBottom: 'var(--spacing-md)' }}>
          {error}
        </div>
      )}

      {unsupported && (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-secondary)' }}>
          <p style={{ margin: 0, fontSize: '14px' }}>
            Cowork pipeline runs are not available on this deployment yet.
          </p>
        </div>
      )}

      {/* Runs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {filteredRuns.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {runs.length === 0 ? 'No runs yet.' : 'No runs match the current filter.'}
            </p>
          </div>
        )}
        {filteredRuns.map((run) => (
          <GlassSurface key={run.id} style={{ padding: 'var(--spacing-md)', cursor: 'pointer' }}>
            <div role="button" tabIndex={0} onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}>
              {/* Run Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: expandedRunId === run.id ? 'var(--spacing-md)' : 0 }}>
                {/* Status Indicator */}
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: getStatusColor(run.state),
                    ...(run.state === 'running' && {
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      opacity: 1,
                    }),
                  }}
                />

                {/* Run Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>
                      {run.entrypoint}
                    </h3>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {run.mode}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: run.state === 'running' ? 'var(--status-info-bg)' : 'var(--surface-active)',
                        color: run.state === 'running' ? 'var(--status-info)' : 'var(--text-secondary)',
                        fontWeight: 500,
                      }}
                    >
                      {run.state}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-lg)', fontSize: '13px', color: 'var(--text-secondary)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: getStatusColor(run.state), fontWeight: 500 }}>
                      {run.state}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: 'var(--status-info)',
                          color: 'var(--ui-text-inverse)',
                          fontSize: '12px',
                        }}
                      >
                        <Robot size={10} weight="fill" />
                      </span>
                      {run.initiator}
                    </span>
                    <span>Started: {new Date(run.created_at).toLocaleString()}</span>
                    <span>Duration: {formatDuration(run.created_at, run.completed_at)}</span>
                  </div>
                </div>

                {/* Expand Icon */}
                <CaretDown
                  size={18}
                  color="var(--text-tertiary)"
                  style={{
                    transform: expandedRunId === run.id ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </div>

              {/* Expanded Detail */}
              {expandedRunId === run.id && (
                <RunDetail
                  run={run}
                  onChange={refresh}
                  recoverUnavailable={recoverUnavailable}
                  handoffsUnavailable={handoffsUnavailable}
                />
              )}
            </div>
          </GlassSurface>
        ))}
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

function RunDetail({
  run,
  onChange,
  recoverUnavailable,
  handoffsUnavailable,
}: {
  run: CoworkRun;
  onChange: () => void;
  recoverUnavailable: boolean;
  handoffsUnavailable: boolean;
}) {
  const { startRun, cancelRun, recoverRun, createHandoff } = useCoworkRuns();
  const { jobs } = useCoworkRunJobs(run.id);
  const { handoffs } = useCoworkRunHandoffs(run.id);
  const { events, connected } = useCoworkRunEvents(run.id);
  const [toAgentId, setToAgentId] = useState('');
  const [note, setNote] = useState('');
  const [handoffBusy, setHandoffBusy] = useState(false);

  const canStart = run.state === 'created' || run.state === 'queued' || run.state === 'planned';
  const canCancel = run.state === 'running' || run.state === 'queued' || run.state === 'recovering';
  const canRecover = run.state === 'failed' || run.state === 'paused';

  const handleStart = async () => {
    try {
      await startRun(run.id);
      onChange();
    } catch (e) {
      logger.error({ err: e }, 'Failed to start run');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelRun(run.id);
      onChange();
    } catch (e) {
      logger.error({ err: e }, 'Failed to cancel run');
    }
  };

  const handleRecover = async () => {
    try {
      await recoverRun(run.id);
      onChange();
    } catch (e) {
      logger.error({ err: e }, 'Failed to recover run');
    }
  };

  const handleHandoff = async () => {
    if (!toAgentId.trim()) return;
    setHandoffBusy(true);
    try {
      await createHandoff(run.id, { to_agent_id: toAgentId.trim(), note: note.trim() || undefined });
      setToAgentId('');
      setNote('');
      onChange();
    } catch (e) {
      logger.error({ err: e }, 'Failed to create handoff');
    } finally {
      setHandoffBusy(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 'var(--spacing-md)',
        paddingTop: 'var(--spacing-md)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {/* Metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
        <Metadata label="Run ID" value={run.id} />
        <Metadata label="DAG ID" value={run.dag_id} />
        <Metadata label="Workspace" value={run.workspace_id} />
        <Metadata label="Policy" value={run.policy_profile} />
        {run.current_job_id && <Metadata label="Current Job" value={run.current_job_id} />}
        {run.current_checkpoint_id && <Metadata label="Checkpoint" value={run.current_checkpoint_id} />}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
        {canStart && (
          <ActionButton onClick={handleStart} color="var(--accent-cowork)" icon={<Play size={14} weight="fill" />}>
            Start
          </ActionButton>
        )}
        {canCancel && (
          <ActionButton onClick={handleCancel} color="var(--status-error)" icon={<XCircle size={14} weight="fill" />}>
            Cancel
          </ActionButton>
        )}
        {canRecover && !recoverUnavailable && (
          <ActionButton onClick={handleRecover} color="var(--status-info)" icon={<ArrowCounterClockwise size={14} weight="fill" />}>
            Recover
          </ActionButton>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--text-tertiary)' }}>
          <Broadcast size={12} color={connected ? 'var(--status-success)' : 'var(--text-tertiary)'} />
          {connected ? 'Live events' : 'Events paused'}
        </span>
      </div>

      {/* Jobs & Timeline */}
      {jobs.length > 0 && (
        <CoworkRunTimeline jobs={jobs} />
      )}

      {/* Handoffs */}
      {!handoffsUnavailable && (
      <Section title="Handoffs">
        {handoffs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 'var(--spacing-sm)' }}>
            {handoffs.map((h) => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: '12px', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 4 }}>
                <ArrowRight size={12} color="var(--accent-cowork)" />
                <span style={{ color: 'var(--text-secondary)' }}>to {h.to_agent_id}</span>
                {h.task_id && <span style={{ color: 'var(--text-tertiary)' }}>task {h.task_id}</span>}
                <span style={{ color: getStatusColor(h.status), fontWeight: 500 }}>{h.status}</span>
                {h.note && <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{h.note}</span>}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Target agent ID"
            value={toAgentId}
            onChange={(e) => setToAgentId(e.target.value)}
            style={{ flex: 1, minWidth: 140, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ flex: 2, minWidth: 180, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}
          />
          <button
            type="button"
            onClick={handleHandoff}
            disabled={handoffBusy || !toAgentId.trim()}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent-cowork)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              opacity: handoffBusy || !toAgentId.trim() ? 0.6 : 1,
            }}
          >
            {handoffBusy ? 'Handing off…' : 'Hand off'}
          </button>
        </div>
      </Section>
      )}

      {/* Event Stream */}
      <Section title="Events">
        <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {events.length === 0 && (
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Waiting for events…</span>
          )}
          {events.slice(-50).map((ev, idx) => (
            <code key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)', padding: '3px 6px', borderRadius: 4 }}>
              {ev.event_type}: {JSON.stringify(ev.payload)}
            </code>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--spacing-md)' }}>
      <p style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function ActionButton({ onClick, color, icon, children }: { onClick: () => void; color: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 6,
        border: 'none',
        background: color,
        color: '#fff',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export default RunsView;
