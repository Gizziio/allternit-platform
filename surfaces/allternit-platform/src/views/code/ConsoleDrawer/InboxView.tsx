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

export function InboxView() {
  const [items, setItems] = useState<InboxItem[]>([
    {
      id: '1',
      type: 'assignment',
      title: 'New board item assigned',
      body: 'You were assigned to "Refactor auth module"',
      read: false,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '2',
      type: 'agent_update',
      title: 'Agent completed task',
      body: 'Claude-1 finished "Write API docs"',
      read: false,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: '3',
      type: 'deadline',
      title: 'Deadline approaching',
      body: '"Deploy v2.0" is due in 24 hours',
      read: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filtered = filter === 'unread' ? items.filter((i) => !i.read) : items;
  const unreadCount = items.filter((i) => !i.read).length;

  const markRead = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
  };

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'assignment': return '->';
      case 'mention': return '@';
      case 'agent_update': return '🤖';
      case 'deadline': return '⏰';
      default: return '•';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6' }}>
          Inbox {unreadCount > 0 && <span style={{ background: '#ff3b30', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{unreadCount}</span>}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setFilter('all')}
            style={{ background: filter === 'all' ? '#374151' : 'transparent', color: '#d1d5db', border: '1px solid #374151', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            style={{ background: filter === 'unread' ? '#374151' : 'transparent', color: '#d1d5db', border: '1px solid #374151', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
          >
            Unread
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No notifications</div>
        )}
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => markRead(item.id)}
            style={{
              display: 'flex',
              gap: 10,
              padding: 10,
              background: item.read ? '#111827' : '#1f2937',
              border: '1px solid #374151',
              borderRadius: 6,
              cursor: 'pointer',
              opacity: item.read ? 0.7 : 1,
            }}
          >
            <div style={{ fontSize: 14, marginTop: 2 }}>{typeIcon(item.type)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f3f4f6', marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{item.body}</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                {new Date(item.createdAt).toLocaleString()}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(item.id); }}
              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
