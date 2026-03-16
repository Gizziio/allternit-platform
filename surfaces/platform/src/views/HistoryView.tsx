/**
 * HistoryView
 *
 * UI for browsing recent conversation sessions.
 * Shows session history grouped by date with search and session details.
 */

'use client';

import React, { useMemo, useState } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import { Clock, Search } from 'lucide-react';

/**
 * Session data structure
 */
interface Session {
  id: string;
  title: string;
  messageCount: number;
  lastActivity: Date;
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
 * Mock session data for development
 */
const MOCK_SESSIONS: Session[] = [
  {
    id: 'session-1',
    title: 'Refactor Design System Components',
    messageCount: 12,
    lastActivity: new Date(),
    mode: 'code',
  },
  {
    id: 'session-2',
    title: 'Marketing Copy Review',
    messageCount: 8,
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
    mode: 'chat',
  },
  {
    id: 'session-3',
    title: 'Architecture Discussion',
    messageCount: 24,
    lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    mode: 'cowork',
  },
  {
    id: 'session-4',
    title: 'API Integration Planning',
    messageCount: 15,
    lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    mode: 'code',
  },
  {
    id: 'session-5',
    title: 'Feedback Collection',
    messageCount: 5,
    lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    mode: 'chat',
  },
  {
    id: 'session-6',
    title: 'Database Optimization',
    messageCount: 18,
    lastActivity: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    mode: 'code',
  },
  {
    id: 'session-7',
    title: 'Team Sync Notes',
    messageCount: 11,
    lastActivity: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    mode: 'cowork',
  },
];

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get session group (TODAY, YESTERDAY, THIS WEEK, OLDER)
 */
function getSessionGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const thisWeekStart = new Date(today.getTime() - today.getDay() * 86400000);
  const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (sessionDate.getTime() === today.getTime()) return 'TODAY';
  if (sessionDate.getTime() === yesterday.getTime()) return 'YESTERDAY';
  if (sessionDate >= thisWeekStart) return 'THIS WEEK';
  return 'OLDER';
}

/**
 * Session row component
 */
interface SessionRowProps {
  session: Session;
  selected: boolean;
  onSelect: (id: string) => void;
}

function SessionRow({ session, selected, onSelect }: SessionRowProps) {
  return (
    <div
      onClick={() => onSelect(session.id)}
      className="group cursor-pointer transition-all duration-200"
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: selected ? 'var(--bg-secondary)' : 'transparent',
        border: selected ? '1px solid var(--border-subtle)' : '1px solid transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-secondary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
        }
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

      {/* Right: Message count badge + timestamp */}
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
            minWidth: '60px',
            textAlign: 'right',
          }}
        >
          {formatRelativeTime(session.lastActivity)}
        </div>
      </div>
    </div>
  );
}

/**
 * HistoryView component
 */
export function HistoryView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Filter sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_SESSIONS;
    return MOCK_SESSIONS.filter((session) =>
      session.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Group filtered sessions by date
  const groupedSessions = useMemo(() => {
    const groups: Record<string, Session[]> = {
      TODAY: [],
      YESTERDAY: [],
      'THIS WEEK': [],
      OLDER: [],
    };

    filteredSessions.forEach((session) => {
      const group = getSessionGroup(session.lastActivity);
      groups[group].push(session);
    });

    // Sort sessions within each group by date (newest first)
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    });

    return groups;
  }, [filteredSessions]);

  const isEmpty = filteredSessions.length === 0;

  return (
    <GlassSurface className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-[var(--accent-primary)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Recent Conversations
            </h2>
            <p className="text-sm text-[var(--text-tertiary)]">Your session history</p>
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
              placeholder="Search conversations..."
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
            <Clock className="w-16 h-16 text-[var(--text-tertiary)] mb-4 opacity-30" />
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              No recent conversations
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
              {searchQuery
                ? "No sessions match your search"
                : 'Start a new conversation to get started'}
            </p>
          </div>
        ) : (
          <div style={{ padding: '4px' }}>
            {Object.entries(groupedSessions).map(([groupName, sessions]) => {
              if (sessions.length === 0) return null;

              return (
                <div key={groupName} style={{ marginBottom: '24px' }}>
                  {/* Group Header */}
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
                    {groupName}
                  </div>

                  {/* Sessions in group */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {sessions.map((session) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        selected={selectedSessionId === session.id}
                        onSelect={setSelectedSessionId}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassSurface>
  );
}

export default HistoryView;
