import React, { useState } from 'react';

interface InboxItem {
  id: string;
  type: 'assignment' | 'mention' | 'agent_update' | 'deadline';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

const INITIAL_ITEMS: InboxItem[] = [
  {
    id: '1',
    type: 'assignment',
    title: 'New board item assigned',
    body: 'You were assigned to "Refactor auth module"',
    read: false,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    type: 'agent_update',
    title: 'Agent completed task',
    body: 'Claude-1 finished "Write API docs"',
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'deadline',
    title: 'Deadline approaching',
    body: '"Deploy v2.0" is due in 24 hours',
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

function typeIcon(type: InboxItem['type']): string {
  switch (type) {
    case 'assignment':
      return '->';
    case 'mention':
      return '@';
    case 'agent_update':
      return 'AI';
    case 'deadline':
      return '!';
    default:
      return '•';
  }
}

export function InboxView(): React.ReactNode {
  const [items, setItems] = useState<InboxItem[]>(INITIAL_ITEMS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filtered = filter === 'unread' ? items.filter((item) => !item.read) : items;
  const unreadCount = items.filter((item) => !item.read).length;

  const markRead = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
          Inbox{' '}
          {unreadCount > 0 && (
            <span
              style={{
                background: 'var(--status-error)',
                color: '#fff',
                borderRadius: 10,
                padding: '1px 8px',
                fontSize: 12,
              }}
            >
              {unreadCount}
            </span>
          )}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button"
            onClick={() => setFilter('all')}
            style={{
              background: filter === 'all' ? 'var(--ui-border-default)' : 'transparent',
              color: 'var(--ui-text-primary)',
              border: '1px solid #374151',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          <button type="button"
            onClick={() => setFilter('unread')}
            style={{
              background: filter === 'unread' ? 'var(--ui-border-default)' : 'transparent',
              color: 'var(--ui-text-primary)',
              border: '1px solid #374151',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Unread
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ui-text-muted)', fontSize: 13 }}>
            No notifications
          </div>
        )}

        {filtered.map((item) => (
          <div
            role="button"
            tabIndex={0}
            key={item.id}
            onClick={() => markRead(item.id)}
            style={{
              display: 'flex',
              gap: 10,
              padding: 10,
              background: item.read ? 'var(--surface-canvas)' : 'var(--surface-panel)',
              border: '1px solid #374151',
              borderRadius: 6,
              cursor: 'pointer',
              opacity: item.read ? 0.7 : 1,
            }}
          >
            <div style={{ fontSize: 14, marginTop: 2, color: 'var(--ui-text-secondary)' }}>
              {typeIcon(item.type)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ui-text-primary)',
                  marginBottom: 2,
                }}
              >
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>{item.body}</div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-muted)', marginTop: 4 }}>
                {new Date(item.createdAt).toLocaleString()}
              </div>
            </div>

            <button type="button"
              onClick={(event) => {
                event.stopPropagation();
                dismiss(item.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ui-text-muted)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
