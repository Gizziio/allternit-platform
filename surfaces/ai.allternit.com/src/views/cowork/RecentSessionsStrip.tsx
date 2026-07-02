'use client';

import React, { useState } from 'react';
import { Play, ClockCountdown, ChatTeardrop } from '@phosphor-icons/react';
import { useCoworkSessionList, extractCheckpointContext, type CoworkSessionRecord } from '@/lib/cowork/useCoworkSession';
import { createCoworkSession, useCoworkSessionStore } from './CoworkSessionStore';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('RecentSessionsStrip');

interface RecentSessionsStripProps {
  onResume: (newSessionId: string) => void;
  maxItems?: number;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getExcerpt(session: CoworkSessionRecord): string | null {
  const ctx = extractCheckpointContext(session.checkpoint);
  if (!ctx) return null;
  // extractCheckpointContext returns a string or object; grab a readable snippet
  const raw = typeof ctx === 'string' ? ctx : (ctx as any)?.lastMessage ?? JSON.stringify(ctx);
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  return trimmed.length > 72 ? trimmed.slice(0, 72) + '…' : trimmed;
}

function getMessageCount(session: CoworkSessionRecord): number | null {
  const cp = session.checkpoint as any;
  if (cp && typeof cp.messageCount === 'number') return cp.messageCount;
  return null;
}

export function RecentSessionsStrip({ onResume, maxItems = 4 }: RecentSessionsStripProps) {
  const { sessions, loading } = useCoworkSessionList();
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
    } catch (err) {
      logger.error({ err: err }, 'Failed to resume session');
    } finally {
      setResumingId(null);
    }
  };

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--ui-text-muted)', marginBottom: 10,
      }}>
        Recent Sessions
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recent.map((session) => {
          const excerpt = getExcerpt(session);
          const msgCount = getMessageCount(session);
          const hasSave = Boolean(session.checkpoint);
          const isHovered = hoveredId === session.id;
          const isResuming = resumingId === session.id;

          return (
            <div
              key={session.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 14px',
                background: isHovered
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(255,255,255,0.025)',
                border: `1px solid ${hasSave && isHovered ? 'rgba(200,169,110,0.25)' : 'var(--ui-border-muted)'}`,
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'background 0.12s, border-color 0.12s',
              }}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleResume(session)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title row */}
                <div style={{
                  fontWeight: 500, fontSize: 13,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: 'var(--ui-text-primary)',
                }}>
                  {session.title ?? 'Untitled Session'}
                </div>

                {/* Excerpt from checkpoint */}
                {excerpt && (
                  <div style={{
                    fontSize: 11, color: 'var(--ui-text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginTop: 2, lineHeight: 1.4, fontStyle: 'italic',
                  }}>
                    {excerpt}
                  </div>
                )}

                {/* Meta row */}
                <div style={{
                  fontSize: 11, color: 'var(--ui-text-muted)',
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
                }}>
                  <span>{formatRelative(session.startedAt ?? session.createdAt)}</span>
                  {msgCount !== null && (
                    <>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <ChatTeardrop size={10} />
                        {msgCount}
                      </span>
                    </>
                  )}
                  {hasSave && (
                    <>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--accent-cowork)' }}>
                        <ClockCountdown size={10} weight="fill" />
                        saved
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Resume button */}
              <button type="button"
                onClick={(e) => { e.stopPropagation(); handleResume(session); }}
                disabled={Boolean(resumingId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', flexShrink: 0,
                  background: isHovered ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: '1px solid var(--ui-border-muted)',
                  borderRadius: 7,
                  color: isHovered ? 'var(--ui-text-primary)' : 'var(--ui-text-secondary)',
                  fontSize: 12, fontWeight: 600,
                  cursor: resumingId ? 'not-allowed' : 'pointer',
                  opacity: isResuming ? 0.5 : 1,
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                <Play size={11} weight={isHovered ? 'fill' : 'regular'} />
                {isResuming ? '…' : 'Resume'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
