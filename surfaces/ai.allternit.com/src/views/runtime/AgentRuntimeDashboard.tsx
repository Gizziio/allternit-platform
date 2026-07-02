"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
  Cpu,
  Circle,
  Plus,
  Trash,
  PencilSimple,
  Check,
  X,
  ClockCounterClockwise,
  WifiHigh,
  WifiSlash,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { useToast } from '@/hooks/use-toast';
import { ConfirmModal } from '@/components/ConfirmModal';

interface AgentRuntimeItem {
  id: string;
  name: string;
  host: string;
  agentClis: string | null;
  status: string;
  lastHeartbeat: string | null;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
  workspace?: { id: string; name: string } | null;
}

export function AgentRuntimeDashboard() {
  const [runtimes, setRuntimes] = useState<AgentRuntimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', host: '', status: 'offline' as string });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', host: '', status: 'offline' as string });
  const [confirmDialog, setConfirmDialog] = useState<{ id: string } | null>(null);
  const { addToast } = useToast();

  const fetchRuntimes = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/agent-runtimes');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRuntimes(data.runtimes || []);
    } catch {
      addToast({ title: 'Error', description: 'Failed to load agent runtimes', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchRuntimes();
  }, [fetchRuntimes]);

  const handleDelete = (id: string) => {
    setConfirmDialog({ id });
  };

  const commitDelete = async (id: string) => {
    setConfirmDialog(null);
    try {
      const res = await fetch(`/api/v1/agent-runtimes?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setRuntimes((prev) => prev.filter((r) => r.id !== id));
      addToast({ title: 'Deleted', description: 'Runtime removed', type: 'success' });
    } catch {
      addToast({ title: 'Error', description: 'Failed to delete runtime', type: 'error' });
    }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch('/api/v1/agent-runtimes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      setRuntimes((prev) => prev.map((r) => (r.id === id ? data.runtime : r)));
      setEditingId(null);
      addToast({ title: 'Updated', description: 'Runtime saved', type: 'success' });
    } catch {
      addToast({ title: 'Error', description: 'Failed to update runtime', type: 'error' });
    }
  };

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.host.trim()) return;
    try {
      const res = await fetch('/api/v1/agent-runtimes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) throw new Error('Failed to create');
      const data = await res.json();
      setRuntimes((prev) => [data.runtime, ...prev]);
      setShowAdd(false);
      setAddForm({ name: '', host: '', status: 'offline' });
      addToast({ title: 'Created', description: 'Runtime added', type: 'success' });
    } catch {
      addToast({ title: 'Error', description: 'Failed to create runtime', type: 'error' });
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'online': return 'var(--status-success)';
      case 'busy': return 'var(--status-warning)';
      case 'offline': return 'var(--ui-text-muted)';
      default: return 'var(--ui-text-muted)';
    }
  };

  const parseClis = (clis: string | null) => {
    if (!clis) return [];
    try { return JSON.parse(clis) as string[]; } catch { return []; }
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <Cpu size={24} color="#3b82f6" />
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600 }}>Agent Runtimes</h2>
        </div>
        <button type="button"
          onClick={() => setShowAdd(!showAdd)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--status-info)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} weight="bold" />
          Add Runtime
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <GlassSurface style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Name</div>
              <input aria-label="Input" value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="e.g. Production Cluster"
                className="focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] focus-visible:outline-none"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Host</div>
              <input aria-label="Input" value={addForm.host}
                onChange={(e) => setAddForm({ ...addForm, host: e.target.value })}
                placeholder="e.g. 192.168.1.10"
                className="focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] focus-visible:outline-none"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
            </div>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Status</div>
              <select aria-label="Selection" value={addForm.status}
                onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                className="focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] focus-visible:outline-none"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <option value="online">Online</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button type="button" onClick={handleAdd} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--status-success)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                <Check size={16} weight="bold" />
              </button>
              <button type="button" onClick={() => setShowAdd(false)} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                <X size={16} weight="bold" />
              </button>
            </div>
          </div>
        </GlassSurface>
      )}

      {/* Runtime Cards */}
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: 'var(--spacing-xl)' }}>Loading runtimes…</div>
      ) : runtimes.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: '14px', textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <Cpu size={48} style={{ opacity: 0.3, marginBottom: 'var(--spacing-md)' }} />
          <p>No agent runtimes registered yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--spacing-lg)' }}>
          {runtimes.map((rt) => (
            <GlassSurface key={rt.id} style={{ padding: 'var(--spacing-md)', position: 'relative' }}>
              {editingId === rt.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  <input aria-label="Input" value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] focus-visible:outline-none"
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}
                  />
                  <input aria-label="Input" value={editForm.host}
                    onChange={(e) => setEditForm({ ...editForm, host: e.target.value })}
                    className="focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] focus-visible:outline-none"
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}
                  />
                  <select aria-label="Selection" value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] focus-visible:outline-none"
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                  >
                    <option value="online">Online</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                  </select>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => handleSaveEdit(rt.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--status-success)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      <Check size={14} weight="bold" />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      <X size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                      <Circle size={12} weight="fill" color={statusColor(rt.status)} />
                      <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>{rt.name}</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button"
                        onClick={() => { setEditingId(rt.id); setEditForm({ name: rt.name, host: rt.host, status: rt.status }); }}
                        title="Edit"
                        style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button type="button"
                        onClick={() => handleDelete(rt.id)}
                        title="Delete"
                        style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--status-error)', cursor: 'pointer' }}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {rt.status === 'online' ? <WifiHigh size={14} color="#22c55e" /> : <WifiSlash size={14} color="#6b7280" />}
                      <span>{rt.host}</span>
                    </div>
                    {rt.workspace && (
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        Workspace: {rt.workspace.name}
                      </div>
                    )}
                    {rt.lastHeartbeat && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        <ClockCounterClockwise size={11} />
                        Last heartbeat: {new Date(rt.lastHeartbeat).toLocaleString()}
                      </div>
                    )}
                    {parseClis(rt.agentClis).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {parseClis(rt.agentClis).map((cli) => (
                          <span key={cli} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--status-info)', fontWeight: 500 }}>
                            {cli}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </GlassSurface>
          ))}
        </div>
      )}
      <ConfirmModal
        isOpen={confirmDialog !== null}
        title="Delete Runtime"
        message="Delete this runtime?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirmDialog && commitDelete(confirmDialog.id)}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
