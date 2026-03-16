'use client';

import React, { useState } from 'react';
import { MessageSquare, Plus, ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react';
import GlassSurface from '@/design/GlassSurface';

interface ThreadMessage {
  id: string;
  author: string;
  avatar: string;
  avatarColor: string;
  message: string;
  timestamp: string;
}

interface CodeThread {
  id: string;
  title: string;
  linkedFile: string;
  linkedLine: number;
  lastMessage: string;
  replyCount: number;
  unreadCount: number;
  timestamp: string;
  status: 'open' | 'resolved';
  messages: ThreadMessage[];
}

const mockThreads: CodeThread[] = [
  {
    id: '1',
    title: 'Refactor authentication flow',
    linkedFile: 'ShellApp.tsx',
    linkedLine: 247,
    lastMessage: 'I think we should also add OAuth2 support here',
    replyCount: 5,
    unreadCount: 2,
    timestamp: '2 hours ago',
    status: 'open',
    messages: [
      {
        id: 'm1',
        author: 'Sarah Chen',
        avatar: 'SC',
        avatarColor: '#ec4899',
        message: 'Looking at the current auth implementation, should we refactor this to be more modular?',
        timestamp: '4 hours ago',
      },
      {
        id: 'm2',
        author: 'Marcus Dev',
        avatar: 'MD',
        avatarColor: '#3b82f6',
        message: 'I think we should also add OAuth2 support here',
        timestamp: '2 hours ago',
      },
    ],
  },
  {
    id: '2',
    title: 'Performance optimization needed',
    linkedFile: 'ChatView.tsx',
    linkedLine: 89,
    lastMessage: 'Can we use useMemo for this calculation?',
    replyCount: 3,
    unreadCount: 0,
    timestamp: '5 hours ago',
    status: 'open',
    messages: [
      {
        id: 'm1',
        author: 'Alex Quinn',
        avatar: 'AQ',
        avatarColor: '#f59e0b',
        message: 'This component is rendering too often. Need to optimize.',
        timestamp: '6 hours ago',
      },
      {
        id: 'm2',
        author: 'Casey Moore',
        avatar: 'CM',
        avatarColor: '#06b6d4',
        message: 'Can we use useMemo for this calculation?',
        timestamp: '5 hours ago',
      },
    ],
  },
  {
    id: '3',
    title: 'Type safety improvements',
    linkedFile: 'ShellRail.tsx',
    linkedLine: 156,
    lastMessage: 'Let me check the component props first',
    replyCount: 2,
    unreadCount: 0,
    timestamp: '1 day ago',
    status: 'resolved',
    messages: [
      {
        id: 'm1',
        author: 'Jordan Park',
        avatar: 'JP',
        avatarColor: '#8b5cf6',
        message: 'We need stricter types for the navigation props',
        timestamp: '1 day ago',
      },
    ],
  },
  {
    id: '4',
    title: 'CSS Grid layout bug',
    linkedFile: 'EvolutionLayerView.tsx',
    linkedLine: 312,
    lastMessage: 'Fixed in commit a3f2b91',
    replyCount: 4,
    unreadCount: 1,
    timestamp: '1 day ago',
    status: 'resolved',
    messages: [
      {
        id: 'm1',
        author: 'Casey Moore',
        avatar: 'CM',
        avatarColor: '#06b6d4',
        message: 'The grid layout is broken on mobile',
        timestamp: '2 days ago',
      },
      {
        id: 'm2',
        author: 'Sarah Chen',
        avatar: 'SC',
        avatarColor: '#ec4899',
        message: 'Fixed in commit a3f2b91',
        timestamp: '1 day ago',
      },
    ],
  },
  {
    id: '5',
    title: 'Documentation for API endpoints',
    linkedFile: 'colors.ts',
    linkedLine: 42,
    lastMessage: 'I can help with the OpenAPI spec',
    replyCount: 1,
    unreadCount: 0,
    timestamp: '3 days ago',
    status: 'open',
    messages: [
      {
        id: 'm1',
        author: 'Marcus Dev',
        avatar: 'MD',
        avatarColor: '#3b82f6',
        message: 'We need to document all API endpoints properly',
        timestamp: '3 days ago',
      },
    ],
  },
];

type FilterType = 'all' | 'open' | 'resolved';

export const ThreadsView: React.FC = () => {
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredThreads = mockThreads.filter((thread) => {
    if (filter === 'open') return thread.status === 'open';
    if (filter === 'resolved') return thread.status === 'resolved';
    return true;
  });

  const toggleThreadExpand = (threadId: string) => {
    setExpandedThread((prev) => (prev === threadId ? null : threadId));
  };

  return (
    <GlassSurface>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-secondary)' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={20} color="var(--accent-primary)" />
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Threads</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Contextual code discussions</div>
              </div>
            </div>
            <button
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.opacity = '0.85';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.opacity = '1';
              }}
            >
              <Plus size={14} />
              New Thread
            </button>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['all', 'open', 'resolved'] as const).map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                style={{
                  padding: '6px 12px',
                  backgroundColor:
                    filter === filterOption ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                  color: filter === filterOption ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textTransform: 'capitalize',
                }}
                onMouseEnter={(e) => {
                  if (filter !== filterOption) {
                    (e.target as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (filter !== filterOption) {
                    (e.target as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
              >
                {filterOption}
              </button>
            ))}
          </div>
        </div>

        {/* Thread List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
            {filteredThreads.map((thread) => {
              const isExpanded = expandedThread === thread.id;

              return (
                <div
                  key={thread.id}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }}
                >
                  {/* Thread Header */}
                  <div
                    onClick={() => toggleThreadExpand(thread.id)}
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <div style={{ marginTop: '2px' }}>
                      {isExpanded ? (
                        <ChevronUp size={16} color="var(--text-secondary)" />
                      ) : (
                        <ChevronDown size={16} color="var(--text-secondary)" />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {thread.title}
                        </div>
                        {thread.unreadCount > 0 && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '700',
                              padding: '2px 6px',
                              backgroundColor: 'var(--accent-primary)',
                              color: 'white',
                              borderRadius: '3px',
                            }}
                          >
                            {thread.unreadCount} new
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '2px 6px',
                            backgroundColor: 'rgba(52, 199, 89, 0.15)',
                            color: '#34c759',
                            borderRadius: '3px',
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                          }}
                        >
                          {thread.linkedFile}:{thread.linkedLine}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-tertiary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: '6px',
                        }}
                      >
                        {thread.lastMessage}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '11px',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        <span>
                          {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{thread.timestamp}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {thread.status === 'open' ? (
                              <>
                                <Circle size={8} fill="#34c759" color="#34c759" />
                                <span>Open</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={10} color="var(--text-tertiary)" />
                                <span>Resolved</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Messages */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
                        {thread.messages.map((msg) => (
                          <div key={msg.id} style={{ display: 'flex', gap: '8px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: msg.avatarColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: '700',
                                flexShrink: 0,
                              }}
                            >
                              {msg.avatar}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginBottom: '4px',
                                }}
                              >
                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                  {msg.author}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                  {msg.timestamp}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                {msg.message}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </GlassSurface>
  );
};

export default ThreadsView;
