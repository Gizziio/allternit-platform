'use client';

import React, { useState } from 'react';
import { ArrowClockwise, Trash, Play, ClockCountdown } from '@phosphor-icons/react';
import { useCoworkSessionList, extractCheckpointContext, type CoworkSessionRecord } from '@/lib/cowork/useCoworkSession';
import { createCoworkSession, useCoworkSessionStore } from './CoworkSessionStore';

interface SessionHistoryPanelProps {
  onResume?: (sessionId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#4ade80',
  paused: '#fbbf24',
  completed: 'var(--ui-text-muted)',
  idle: 'var(--ui-text-muted)',
  error: '#f87171',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function SessionHistoryPanel({ onResume }: SessionHistoryPanelProps) {
  const { sessions, loading, error, refresh, deleteSession } = useCoworkSessionList();
  const [resumingId, setResumingId] = useState<string | null>(null);

  const handleResume = async (session: CoworkSessionRecord) => {
    if (resumingId) return;
    setResumingId(session.id);
    try {
      const checkpointContext = extractCheckpointContext(session.checkpoint);
      const newSessionId = await createCoworkSession({
        name: `Resume: ${session.title ?? 'Session'}`,
        sessionMode: 'regular',
      });

      // Inject checkpoint context into the new session metadata
      if (checkpointContext) {
        const existing = useCoworkSessionStore.getState().sessions.find((s) => s.id === newSessionId)?.metadata;
        useCoworkSessionStore.getState().updateSession(newSessionId, {
          metadata: {
            ...existing,
            originSurface: 'cowork',
            resumedFrom: session.id,
            memoryContext: checkpointContext,
          },
        });
      }

      useCoworkSessionStore.getState().setActiveSession(newSessionId);
      onResume?.(newSessionId);
    } finally {
      setResumingId(null);
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--ui-text-primary)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--ui-border-muted)',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{
            fontFamily: "'Allternit Serif', Georgia, ui-serif, serif",
            fontSize: 18,
            fontWeight: 600,
            margin: '0 0 4px',
          }}>
            Session History
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-muted)' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} on record
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            background: 'transparent',
            border: '1px solid var(--ui-border-muted)',
            borderRadius: 8,
            padding: '6px 10px',
            color: 'var(--ui-text-secondary)',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
          }}
        >
          <ArrowClockwise size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading && sessions.length === 0 ? (
          <p style={{ color: 'var(--ui-text-muted)', fontSize: 13 }}>Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p style={{ color: 'var(--ui-text-muted)', fontSize: 13 }}>No sessions yet. Start a cowork session to see history here.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isResuming={resumingId === session.id}
                onResume={() => handleResume(session)}
                onDelete={() => deleteSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SessionRow({
  session,
  isResuming,
  onResume,
  onDelete,
}: {
  session: CoworkSessionRecord;
  isResuming: boolean;
  onResume: () => void;
  onDelete: () => void;
}) {
  const hasCheckpoint = Boolean(session.checkpoint);
  const statusColor = STATUS_COLORS[session.status] ?? 'var(--ui-text-muted)';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      background: 'var(--surface-raised, rgba(255,255,255,0.03))',
      border: '1px solid var(--ui-border-muted)',
      borderRadius: 10,
    }}>
      {/* Status dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: statusColor,
        flexShrink: 0,
      }} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session.title ?? 'Untitled Session'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{formatDate(session.startedAt ?? session.createdAt)}</span>
          <span>·</span>
          <span style={{ textTransform: 'capitalize' }}>{session.status}</span>
          {hasCheckpoint && (
            <>
              <span>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#fbbf24' }}>
                <ClockCountdown size={11} />
                checkpoint
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onResume}
          disabled={isResuming}
          title="Resume session"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            background: 'rgba(124,106,247,0.12)',
            border: '1px solid rgba(124,106,247,0.25)',
            borderRadius: 7,
            color: '#a78bfa',
            fontSize: 12,
            fontWeight: 600,
            cursor: isResuming ? 'not-allowed' : 'pointer',
            opacity: isResuming ? 0.6 : 1,
          }}
        >
          <Play size={12} />
          {isResuming ? 'Starting…' : 'Resume'}
        </button>
        <button
          onClick={onDelete}
          title="Delete session"
          style={{
            padding: '5px 8px',
            background: 'transparent',
            border: '1px solid var(--ui-border-muted)',
            borderRadius: 7,
            color: 'var(--ui-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Trash size={13} />
        </button>
      </div>
    </div>
  );
}
