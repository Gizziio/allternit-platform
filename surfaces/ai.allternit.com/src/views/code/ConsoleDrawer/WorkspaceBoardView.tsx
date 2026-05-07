import React, { useEffect, useState, useMemo } from 'react';
import { useBoardStore, type BoardItem } from '@/stores/board.store';
import { useWorkspaceStore } from '@/stores/workspace.store';

const COLUMNS: { id: BoardItem['status']; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'var(--ui-text-muted)' },
  { id: 'todo', label: 'Todo', color: 'var(--status-info)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--status-warning)' },
  { id: 'in_review', label: 'In Review', color: '#8b5cf6' },
  { id: 'done', label: 'Done', color: 'var(--status-success)' },
  { id: 'blocked', label: 'Blocked', color: 'var(--status-error)' },
];

export function WorkspaceBoardView() {
  const { workspaces, activeWorkspaceId, fetchWorkspaces } = useWorkspaceStore();
  const { items, fetchItems, moveItem, createItem, isLoading, activeItemId, setActiveItem, comments, addComment } = useBoardStore();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [commentText, setCommentText] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchItems(activeWorkspaceId);
    }
  }, [activeWorkspaceId, fetchItems]);

  const activeItem = useMemo(() => items.find((i) => i.id === activeItemId), [items, activeItemId]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDropTarget(columnId);
  };

  const handleDrop = async (e: React.DragEvent, status: BoardItem['status']) => {
    e.preventDefault();
    setDropTarget(null);
    if (!draggedId) return;
    await moveItem(draggedId, status);
    setDraggedId(null);
  };

  const handleCreate = async () => {
    if (!activeWorkspaceId || !newTitle.trim()) return;
    await createItem(activeWorkspaceId, { title: newTitle.trim() });
    setNewTitle('');
  };

  const handleAddComment = async () => {
    if (!activeItemId || !commentText.trim()) return;
    await addComment(activeItemId, commentText.trim());
    setCommentText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <select
          value={activeWorkspaceId ?? ''}
          onChange={(e) => useWorkspaceStore.getState().setActiveWorkspace(e.target.value || null)}
          style={{ background: 'var(--surface-panel)', color: 'var(--ui-text-primary)', border: '1px solid #374151', borderRadius: 6, padding: '6px 12px' }}
        >
          <option value="">Select workspace...</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>{ws.name}</option>
          ))}
        </select>
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="New board item..."
            style={{ flex: 1, background: 'var(--surface-panel)', color: 'var(--ui-text-primary)', border: '1px solid #374151', borderRadius: 6, padding: '6px 12px' }}
          />
          <button onClick={handleCreate} style={{ background: 'var(--status-info)', color: 'var(--ui-text-inverse)', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer' }}>
            Add
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div style={{ display: 'flex', gap: 12, flex: 1, overflowX: 'auto' }}>
        {COLUMNS.map((col) => {
          const colItems = items.filter((i) => i.status === col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              onDragLeave={() => setDropTarget(null)}
              style={{
                minWidth: 220,
                maxWidth: 280,
                background: dropTarget === col.id ? 'var(--status-info-bg)' : 'var(--surface-panel)',
                border: `1px solid ${dropTarget === col.id ? 'var(--status-info)' : 'var(--ui-border-default)'}`,
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                padding: 8,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '4px 8px' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)', textTransform: 'uppercase' }}>{col.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ui-text-muted)', background: 'var(--ui-border-default)', padding: '2px 6px', borderRadius: 10 }}>{colItems.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
                {colItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onClick={() => { setActiveItem(item.id); setShowDetail(true); }}
                    style={{
                      background: activeItemId === item.id ? 'var(--ui-border-default)' : 'var(--surface-canvas)',
                      border: '1px solid #374151',
                      borderRadius: 6,
                      padding: 10,
                      cursor: 'grab',
                      opacity: draggedId === item.id ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'var(--ui-text-primary)', marginBottom: 4 }}>{item.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {item.priority > 50 && (
                        <span style={{ fontSize: 10, color: 'var(--status-warning)', background: 'rgba(245,158,11,0.15)', padding: '1px 6px', borderRadius: 4 }}>High</span>
                      )}
                      {item.estimatedMinutes && (
                        <span style={{ fontSize: 10, color: 'var(--ui-text-muted)' }}>{item.estimatedMinutes}m</span>
                      )}
                      {item.assigneeName && (
                        <span style={{ fontSize: 10, color: 'var(--status-info)' }}>@{item.assigneeName}</span>
                      )}
                      {item.deadline && (
                        <span style={{ fontSize: 10, color: new Date(item.deadline) < new Date() ? 'var(--status-error)' : 'var(--ui-text-muted)' }}>
                          {new Date(item.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Panel */}
      {showDetail && activeItem && (
        <div style={{
          position: 'absolute',
          right: 16,
          top: 16,
          bottom: 16,
          width: 340,
          background: 'var(--surface-panel)',
          border: '1px solid #374151',
          borderRadius: 8,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, color: 'var(--ui-text-primary)' }}>{activeItem.title}</h3>
            <button onClick={() => setShowDetail(false)} style={{ background: 'none', border: 'none', color: 'var(--ui-text-muted)', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>{activeItem.description || 'No description'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {activeItem.labels?.map((l) => (
              <span key={l} style={{ fontSize: 10, background: 'var(--ui-border-default)', color: 'var(--ui-text-secondary)', padding: '2px 8px', borderRadius: 4 }}>{l}</span>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #374151', paddingTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ui-text-muted)', marginBottom: 6 }}>Comments</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {(comments[activeItem.id] || []).map((c) => (
                <div key={c.id} style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>
                  <span style={{ color: 'var(--status-info)' }}>{c.authorType === 'agent' ? '🤖' : '👤'} {c.authorId.slice(0, 8)}</span>: {c.body}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Add comment..."
                style={{ flex: 1, background: 'var(--surface-canvas)', color: 'var(--ui-text-primary)', border: '1px solid #374151', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
              />
              <button onClick={handleAddComment} style={{ background: 'var(--status-info)', color: 'var(--ui-text-inverse)', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>Post</button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <div style={{ position: 'absolute', top: 8, right: 16, fontSize: 11, color: 'var(--ui-text-muted)' }}>Loading...</div>}
    </div>
  );
}
