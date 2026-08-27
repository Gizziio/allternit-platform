'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  MagnifyingGlass,
  Clock,
  FileText,
  Code,
  BookOpen,
  X,
  ChatTeardropText,
  UsersThree,
  TerminalWindow,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { useChatSessionStore } from './chat/ChatSessionStore';
import { useCodeSessionStore } from './code/CodeSessionStore';
import { useCoworkSessionStore } from './cowork/CoworkSessionStore';

type FilterType = 'All' | 'History' | 'Files' | 'Code' | 'Documents';

interface SearchResult {
  id: string;
  sessionId: string;
  title: string;
  subtitle: string;
  category: 'History' | 'Files' | 'Code' | 'Documents';
  timestamp: string;
  surface: 'chat' | 'cowork' | 'code';
}

function relativeLabel(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = ms / 86400000;
  if (days < 1) return 'Today';
  if (days < 7) return 'This week';
  if (days < 30) return 'This month';
  if (days < 365) return 'This year';
  return 'Older';
}

const SURFACE_ICON: Record<string, React.ElementType> = {
  chat:   ChatTeardropText,
  cowork: UsersThree,
  code:   TerminalWindow,
};

const SURFACE_COLOR: Record<string, string> = {
  chat:   '#D97757',
  cowork: '#A78BFA',
  code:   '#79C47C',
};

const SURFACE_TO_VIEW: Record<string, string> = {
  chat:   'chat',
  cowork: 'workspace',
  code:   'code',
};

const CATEGORY_ICONS: Record<FilterType, React.ElementType> = {
  All:       MagnifyingGlass,
  History:   Clock,
  Files:     FileText,
  Code:      Code,
  Documents: BookOpen,
};

function isAgentSession(sessionId: string, surface: 'chat' | 'cowork' | 'code'): boolean {
  let session;
  if (surface === 'chat') {
    session = useChatSessionStore.getState().sessions.find((s) => s.id === sessionId);
  } else if (surface === 'code') {
    session = useCodeSessionStore.getState().sessions.find((s) => s.id === sessionId);
  } else {
    session = useCoworkSessionStore.getState().sessions.find((s) => s.id === sessionId);
  }
  return session?.metadata?.sessionMode === 'agent';
}

function navigateToSession(sessionId: string, surface: 'chat' | 'cowork' | 'code') {
  // Set the session as active in the right store
  if (surface === 'chat') {
    useChatSessionStore.getState().setActiveSession(sessionId);
  } else if (surface === 'code') {
    useCodeSessionStore.getState().setActiveSession(sessionId);
  } else if (surface === 'cowork') {
    useCoworkSessionStore.getState().setActiveSession(sessionId);
  }

  // Navigate via the global event bus (picked up by ShellApp)
  const defaultView = SURFACE_TO_VIEW[surface] ?? 'chat';
  const isAgent = isAgentSession(sessionId, surface);
  const viewType = isAgent ? `${surface}-agent-session` : defaultView;
  window.dispatchEvent(
    new CustomEvent('allternit:open-view', {
      detail: {
        viewType,
        context: isAgent ? { sessionId, originView: defaultView } : undefined,
      },
    }),
  );
}

export function SearchView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');

  const filters: FilterType[] = ['All', 'History', 'Files', 'Code', 'Documents'];

  const chatSessions   = useChatSessionStore((s) => s.sessions);
  const codeSessions   = useCodeSessionStore((s) => s.sessions);
  const coworkSessions = useCoworkSessionStore((s) => s.sessions);

  const allResults: SearchResult[] = useMemo(() => {
    const results: SearchResult[] = [];

    for (const s of chatSessions) {
      const mode = s.metadata?.sessionMode;
      results.push({
        id:        `chat-${s.id}`,
        sessionId: s.id,
        title:     s.name || 'Untitled chat',
        subtitle:  mode === 'agent' ? 'Chat · Agent' : 'Chat',
        category:  'History',
        timestamp: s.updatedAt,
        surface:   'chat',
      });
    }

    for (const s of coworkSessions) {
      const taskId = (s.metadata as Record<string, unknown>)?.taskId;
      results.push({
        id:        `cowork-${s.id}`,
        sessionId: s.id,
        title:     s.name || 'Untitled cowork session',
        subtitle:  taskId ? 'Cowork · Task session' : 'Cowork',
        category:  'History',
        timestamp: s.updatedAt,
        surface:   'cowork',
      });
    }

    for (const s of codeSessions) {
      results.push({
        id:        `code-${s.id}`,
        sessionId: s.id,
        title:     s.name || 'Untitled code session',
        subtitle:  'Code',
        category:  'Code',
        timestamp: s.updatedAt,
        surface:   'code',
      });
    }

    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return results;
  }, [chatSessions, codeSessions, coworkSessions]);

  const filteredResults = useMemo(() => {
    let base = allResults;

    if (activeFilter !== 'All') {
      base = base.filter((r) => r.category === activeFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q.length >= 2) {
      base = base.filter((r) =>
        r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)
      );
    }

    return base.slice(0, 50);
  }, [allResults, searchQuery, activeFilter]);

  const groupedResults = useMemo(() => {
    return filteredResults.reduce(
      (groups, result) => {
        if (!groups[result.category]) groups[result.category] = [];
        groups[result.category].push(result);
        return groups;
      },
      {} as Record<string, SearchResult[]>
    );
  }, [filteredResults]);

  const isQuerying  = searchQuery.trim().length >= 2;
  const hasResults  = filteredResults.length > 0;
  const noDataTab   = activeFilter === 'Files' || activeFilter === 'Documents';

  const handleClear = useCallback(() => setSearchQuery(''), []);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Escape') handleClear(); },
    [handleClear]
  );

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <GlassSurface className="flex-shrink-0 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Search input */}
          <div
            className="relative mb-4"
            style={{
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div className="flex items-center px-4 py-3">
              <MagnifyingGlass size={20} style={{ color: 'var(--text-secondary)' }} />
              <input aria-label="Input" type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search conversations, files, code, docs…"
                className="flex-1 ml-3 bg-transparent outline-none text-base"
                style={{ color: 'var(--text-primary)', fontSize: 16, padding: '12px 0' }}
                autoFocus
              />
              {searchQuery && (
                <button type="button" onClick={handleClear} className="ml-2 p-1 hover:opacity-70 transition-opacity">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 flex-wrap">
            {filters.map((filter) => {
              const Icon = CATEGORY_ICONS[filter];
              const isActive = activeFilter === filter;
              return (
                <button type="button"
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5"
                  style={{
                    backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color:           isActive ? '#000' : 'var(--text-secondary)',
                    border:          isActive ? 'none' : '1px solid var(--border-subtle)',
                  }}
                >
                  <Icon size={13} />
                  {filter}
                </button>
              );
            })}
          </div>
        </div>
      </GlassSurface>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto">

          {noDataTab ? (
            <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
              {activeFilter === 'Files' ? <FileText size={32} className="mx-auto mb-3 opacity-30" />
                : <BookOpen size={32} className="mx-auto mb-3 opacity-30" />}
              <p className="text-sm">
                {activeFilter === 'Files' ? 'File search' : 'Document search'} is not yet available.
              </p>
            </div>
          ) : !isQuerying ? (
            /* Recent sessions landing */
            <>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
                Recent
              </h2>
              {filteredResults.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  No sessions yet. Start a chat or code session and it will appear here.
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredResults.map((r) => (
                    <SessionRow key={r.id} result={r} onClick={() => navigateToSession(r.sessionId, r.surface)} />
                  ))}
                </div>
              )}
            </>
          ) : !hasResults ? (
            <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
              <MagnifyingGlass size={32} className="mx-auto mb-3 opacity-50" />
              <p>No results for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedResults).map(([category, results]) => (
                <div key={category}>
                  <h3
                    className="text-sm font-semibold mb-3"
                    style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}
                  >
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {results.map((r) => (
                      <SessionRow key={r.id} result={r} onClick={() => navigateToSession(r.sessionId, r.surface)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionRow({ result, onClick }: { result: SearchResult; onClick: () => void }) {
  const Icon  = SURFACE_ICON[result.surface]  ?? ChatTeardropText;
  const color = SURFACE_COLOR[result.surface] ?? 'var(--accent-primary)';

  return (
    <button type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg transition-colors hover:opacity-80 flex items-center gap-3 cursor-pointer"
      style={{ backgroundColor: 'var(--bg-secondary)', border: 'none' }}
    >
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {result.title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          {result.subtitle}
        </p>
      </div>
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
        {relativeLabel(result.timestamp)}
      </span>
    </button>
  );
}

export default SearchView;
