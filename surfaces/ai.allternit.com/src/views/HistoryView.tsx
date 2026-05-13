/**
 * HistoryView
 *
 * UI for browsing recent conversation sessions.
 * Shows session history grouped by date with search and session details.
 */

'use client';

import { useIsClient } from '@/lib/hooks/use-is-client';
import React, { useMemo, useState } from 'react';
import { GlassSurface } from '../design/GlassSurface';
import {
  Clock,
  MagnifyingGlass,
  Plus,
  Trash,
  DotsThreeVertical,
  ChatCircleText,
  Code as CodeIcon,
  Robot,
  TerminalWindow,
} from '@phosphor-icons/react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionMode = 'chat' | 'code' | 'agent' | 'terminal';

interface Session {
  id: string;
  title: string;
  lastActivity: string;
  messageCount: number;
  mode: SessionMode;
}

interface GroupedSessions {
  [key: string]: Session[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MODE_COLORS: Record<SessionMode, string> = {
  chat: 'var(--accent-chat)',
  code: 'var(--accent-primary)',
  agent: 'var(--status-success)',
  terminal: 'var(--status-warning)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function groupSessionsByDate(sessions: Session[]): GroupedSessions {
  const groups: GroupedSessions = {
    'Today': [],
    'Yesterday': [],
    'Previous 7 Days': [],
    'Older': [],
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);

  sessions.forEach((session) => {
    const date = new Date(session.lastActivity);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === now.getTime()) {
      groups['Today'].push(session);
    } else if (date.getTime() === yesterday.getTime()) {
      groups['Yesterday'].push(session);
    } else if (date.getTime() >= lastWeek.getTime()) {
      groups['Previous 7 Days'].push(session);
    } else {
      groups['Older'].push(session);
    }
  });

  return groups;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SessionRowProps {
  session: Session;
  selected: boolean;
  onSelect: (id: string) => void;
}

function SessionRow({ session, selected, onSelect }: SessionRowProps) {
  return (
    <div
      onClick={() => onSelect(session.id)}
      className={`group cursor-pointer transition-colors duration-200 p-3 px-4 rounded-lg flex items-center justify-between gap-3 border border-solid ${
        selected 
          ? 'bg-[var(--bg-secondary)] border-[var(--border-subtle)]' 
          : 'bg-transparent border-transparent hover:bg-[var(--bg-secondary)]'
      }`}
    >
      {/* Left: Mode indicator + Title */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div
          className="size-2 rounded-full shrink-0"
          style={{
            backgroundColor: MODE_COLORS[session.mode],
          }}
        />
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--text-primary)] truncate">
            {session.title}
          </div>
        </div>
      </div>

      {/* Right: Message count badge + timestamp */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-[12px] text-[var(--text-tertiary)] bg-[var(--bg-primary)] px-2.5 py-1 rounded-xl whitespace-nowrap border border-solid border-[var(--border-subtle)]">
          {session.messageCount} msg
        </div>
        <div className="text-[12px] text-[var(--text-tertiary)] whitespace-nowrap min-w-[60px] text-right">
          {formatRelativeTime(session.lastActivity)}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HistoryView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Mock initial data
  useState(() => {
    const mock: Session[] = [
      { id: '1', title: 'Refactor login validation logic', lastActivity: new Date().toISOString(), messageCount: 12, mode: 'code' },
      { id: '2', title: 'Brainstorm product launch names', lastActivity: new Date().toISOString(), messageCount: 8, mode: 'chat' },
      { id: '3', title: 'Automated test suite run #42', lastActivity: new Date(Date.now() - 90000000).toISOString(), messageCount: 45, mode: 'agent' },
      { id: '4', title: 'System architecture review', lastActivity: new Date(Date.now() - 200000000).toISOString(), messageCount: 22, mode: 'chat' },
      { id: '5', title: 'Database migration scripts', lastActivity: new Date(Date.now() - 800000000).toISOString(), messageCount: 15, mode: 'code' },
    ];
    setSessions(mock);
  });

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    return sessions.filter((s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(
    () => groupSessionsByDate(filteredSessions),
    [filteredSessions]
  );

  const isEmpty = filteredSessions.length === 0;

  return (
    <GlassSurface className="w-full h-full flex flex-col border-r border-solid border-[var(--border-subtle)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-solid border-[var(--border-subtle)] flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-[var(--accent-primary)]" />
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            History
          </h2>
        </div>
        <button
          className="size-8 rounded-lg border-none bg-[var(--accent-primary)] text-white cursor-pointer flex items-center justify-center transition-all duration-200 hover:brightness-110 active:scale-95"
          title="New conversation"
        >
          <Plus size={18} weight="bold" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Search Input */}
        <div className="p-4 border-b border-solid border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 p-2.5 px-3.5 bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-lg transition-colors duration-200">
            <MagnifyingGlass
              size={16}
              className="text-[var(--text-tertiary)] shrink-0"
            />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] text-sm"
            />
          </div>
        </div>

        {/* Sessions List or Empty State */}
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 px-6 text-center">
            <Clock className="size-16 text-[var(--text-tertiary)] mb-4 opacity-30" />
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
              No recent conversations
            </h3>
            <p className="text-sm text-[var(--text-tertiary)]">
              {searchQuery
                ? "No sessions match your search"
                : 'Start a new conversation to get started'}
            </p>
          </div>
        ) : (
          <div className="p-1">
            {Object.entries(groupedSessions).map(([groupName, sessions]) => {
              if (sessions.length === 0) return null;

              return (
                <div key={groupName} className="mb-6">
                  {/* Group Header */}
                  <div className="p-3 px-4 pb-2 text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {groupName}
                  </div>

                  {/* Sessions in group */}
                  <div className="flex flex-col gap-1">
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
