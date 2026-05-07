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
  ChartLine,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { useToast } from '@/hooks/use-toast';

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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this runtime?')) return;
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
        <button
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
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Name</label>
              <input
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="e.g. Production Cluster"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Host</label>
              <input
                value={addForm.host}
                onChange={(e) => setAddForm({ ...addForm, host: e.target.value })}
                placeholder="e.g. 192.168.1.10"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ minWidth: 140 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Status</label>
              <select
                value={addForm.status}
                onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="online">Online</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button onClick={handleAdd} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--status-success)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                <Check size={16} weight="bold" />
              </button>
              <button onClick={() => setShowAdd(false)} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
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
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                  />
                  <input
                    value={editForm.host}
                    onChange={(e) => setEditForm({ ...editForm, host: e.target.value })}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                  />
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="online">Online</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                  </select>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleSaveEdit(rt.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--status-success)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      <Check size={14} weight="bold" />
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
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
                      <button
                        onClick={() => { setEditingId(rt.id); setEditForm({ name: rt.name, host: rt.host, status: rt.status }); }}
                        title="Edit"
                        style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        <ClockCounterClockwise size={11} />
                        Last heartbeat: {new Date(rt.lastHeartbeat).toLocaleString()}
                      </div>
                    )}
                    {parseClis(rt.agentClis).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {parseClis(rt.agentClis).map((cli) => (
                          <span key={cli} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--status-info)', fontWeight: 500 }}>
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
    </div>
  );
}
