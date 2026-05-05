'use client';

import React, { useState } from 'react';
import {
  Chat,
  Plus,
  CaretDown,
  CaretUp,
  CheckCircle,
  Circle,
} from '@phosphor-icons/react';
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


type FilterType = 'all' | 'open' | 'resolved';

export const ThreadsView: React.FC = () => {
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [threads, setThreads] = useState<CodeThread[]>([]);

  const filteredThreads = threads.filter((thread) => {
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
              <Chat size={20} color="var(--accent-primary)" />
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
                        <CaretUp size={16} color="var(--text-secondary)" />
                      ) : (
                        <CaretDown size={16} color="var(--text-secondary)" />
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
                            color: 'var(--status-success)',
                            borderRadius: '3px',
                            fontFamily: "'Allternit Mono', 'SFMono-Regular', ui-monospace, monospace",
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
                                <CheckCircle size={10} color="var(--text-tertiary)" />
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
