'use client';

import React, { useState } from 'react';
import { Play, ClockCountdown } from '@phosphor-icons/react';
import { useCoworkSessionList, extractCheckpointContext, type CoworkSessionRecord } from '@/lib/cowork/useCoworkSession';
import { createCoworkSession, useCoworkSessionStore } from './CoworkSessionStore';

interface RecentSessionsStripProps {
  onResume: (newSessionId: string) => void;
  maxItems?: number;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function RecentSessionsStrip({ onResume, maxItems = 3 }: RecentSessionsStripProps) {
  const { sessions, loading } = useCoworkSessionList();
  const [resumingId, setResumingId] = useState<string | null>(null);

  if (loading || sessions.length === 0) return null;

  const recent = sessions.slice(0, maxItems);

  const handleResume = async (session: CoworkSessionRecord) => {
    if (resumingId) return;
    setResumingId(session.id);
    try {
      const checkpointContext = extractCheckpointContext(session.checkpoint);
      const newSessionId = await createCoworkSession({
        name: `Resume: ${session.title ?? 'Session'}`,
        sessionMode: 'regular',
      });
      if (checkpointContext) {
        const existing = useCoworkSessionStore.getState().sessions.find((s) => s.id === newSessionId)?.metadata;
        useCoworkSessionStore.getState().updateSession(newSessionId, {
          metadata: { ...existing, originSurface: 'cowork', resumedFrom: session.id, memoryContext: checkpointContext },
        });
      }
      useCoworkSessionStore.getState().setActiveSession(newSessionId);
      onResume(newSessionId);
    } finally {
      setResumingId(null);
    }
  };

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ui-text-muted)', marginBottom: 10 }}>
        Recent Sessions
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recent.map((session) => (
          <div
            key={session.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 14px',
              background: 'var(--surface-raised, rgba(255,255,255,0.03))',
              border: '1px solid var(--ui-border-muted)',
              borderRadius: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
              <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session.title ?? 'Untitled Session'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span>{formatRelative(session.startedAt ?? session.createdAt)}</span>
                {session.checkpoint && (
                  <>
                    <span>·</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#fbbf24' }}>
                      <ClockCountdown size={10} weight="fill" />
                      saved
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => handleResume(session)}
              disabled={Boolean(resumingId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                background: 'transparent',
                border: '1px solid var(--ui-border-muted)',
                borderRadius: 7,
                color: 'var(--ui-text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: resumingId ? 'not-allowed' : 'pointer',
                opacity: resumingId === session.id ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              <Play size={11} />
              {resumingId === session.id ? '…' : 'Resume'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
