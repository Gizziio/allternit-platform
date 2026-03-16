/**
 * ArchivedView
 *
 * UI for browsing archived conversation sessions.
 * Shows archived sessions with restore functionality.
 */

'use client';

import React, { useMemo, useState } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import { Archive, Search } from 'lucide-react';

/**
 * Archived session data structure
 */
interface ArchivedSession {
  id: string;
  title: string;
  messageCount: number;
  archivedAt: Date;
  mode: 'chat' | 'cowork' | 'code';
}

/**
 * Mode color indicators
 */
const MODE_COLORS = {
  chat: '#007aff',
  cowork: '#af52de',
  code: '#34c759',
} as const;

/**
 * Mock archived session data for development
 */
const MOCK_ARCHIVED_SESSIONS: ArchivedSession[] = [
  {
    id: 'archived-1',
    title: 'Legacy Codebase Analysis',
    messageCount: 22,
    archivedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    mode: 'code',
  },
  {
    id: 'archived-2',
    title: 'Q1 Planning Session',
    messageCount: 34,
    archivedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    mode: 'cowork',
  },
  {
    id: 'archived-3',
    title: 'Customer Feedback Notes',
    messageCount: 9,
    archivedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    mode: 'chat',
  },
  {
    id: 'archived-4',
    title: 'Mobile App Prototype Review',
    messageCount: 16,
    archivedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    mode: 'code',
  },
];

/**
 * Format archive date (e.g., "archived 2 weeks ago")
 */
function formatArchiveDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffDays < 7) return `archived ${diffDays}d ago`;
  if (diffWeeks < 4) return `archived ${diffWeeks}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Archived session row component with restore button
 */
interface ArchivedSessionRowProps {
  session: ArchivedSession;
  selected: boolean;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
}

function ArchivedSessionRow({
  session,
  selected,
  onSelect,
  onRestore,
}: ArchivedSessionRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={() => onSelect(session.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group cursor-pointer transition-all duration-200"
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: selected ? 'var(--bg-secondary)' : isHovered ? 'var(--bg-secondary)' : 'transparent',
        border: selected ? '1px solid var(--border-subtle)' : isHovered ? '1px solid var(--border-subtle)' : '1px solid transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      {/* Left: Mode indicator + Title */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: MODE_COLORS[session.mode],
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session.title}
          </div>
        </div>
      </div>

      {/* Right: Message count badge + archive date + restore button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            backgroundColor: 'var(--bg-primary)',
            padding: '4px 10px',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {session.messageCount} msg
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
            minWidth: '75px',
            textAlign: 'right',
          }}
        >
          {formatArchiveDate(session.archivedAt)}
        </div>

        {/* Restore button - shown on hover */}
        {isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestore(session.id);
            }}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent-primary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--accent-primary)',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(0, 122, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            Restore
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * ArchivedView component
 */
export function ArchivedView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [restoredSessions, setRestoredSessions] = useState<Set<string>>(new Set());

  // Filter sessions based on search query and exclude restored sessions
  const filteredSessions = useMemo(() => {
    return MOCK_ARCHIVED_SESSIONS.filter(
      (session) =>
        !restoredSessions.has(session.id) &&
        session.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, restoredSessions]);

  // Sort sessions by archive date (newest first)
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort(
      (a, b) => b.archivedAt.getTime() - a.archivedAt.getTime()
    );
  }, [filteredSessions]);

  const handleRestore = (sessionId: string) => {
    const newRestored = new Set(restoredSessions);
    newRestored.add(sessionId);
    setRestoredSessions(newRestored);
    setSelectedSessionId(null);

    // In a real implementation, this would trigger a toast notification
    console.log(`Session ${sessionId} restored`);
  };

  const isEmpty = sortedSessions.length === 0;

  return (
    <GlassSurface className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <Archive className="w-6 h-6 text-[var(--accent-primary)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Archived Sessions
            </h2>
            <p className="text-sm text-[var(--text-tertiary)]">Sessions you've put aside</p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Search Input */}
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
          >
            <Search
              className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0"
              strokeWidth={2}
            />
            <input
              type="text"
              placeholder="Search archived sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        {/* Sessions List or Empty State */}
        {isEmpty ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <Archive className="w-16 h-16 text-[var(--text-tertiary)] mb-4 opacity-30" />
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              Nothing archived yet
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
              {searchQuery
                ? 'No archived sessions match your search'
                : 'Archive sessions to organize your workspace'}
            </p>
          </div>
        ) : (
          <div style={{ padding: '4px' }}>
            {/* Archived group header */}
            <div
              style={{
                padding: '12px 16px 8px 16px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-tertiary)',
              }}
            >
              ARCHIVED
            </div>

            {/* Archived sessions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {sortedSessions.map((session) => (
                <ArchivedSessionRow
                  key={session.id}
                  session={session}
                  selected={selectedSessionId === session.id}
                  onSelect={setSelectedSessionId}
                  onRestore={handleRestore}
                />
              ))}
            </div>

            {/* Restored sessions info (optional) */}
            {restoredSessions.size > 0 && (
              <div
                style={{
                  padding: '16px 16px',
                  marginTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                }}
              >
                {restoredSessions.size} session{restoredSessions.size !== 1 ? 's' : ''} restored
              </div>
            )}
          </div>
        )}
      </div>
    </GlassSurface>
  );
}

export default ArchivedView;
