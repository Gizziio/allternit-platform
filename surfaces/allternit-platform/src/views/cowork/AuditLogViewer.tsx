"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
  ClockCounterClockwise,
  User,
  Robot,
  Gear,
  X,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { useToast } from '@/hooks/use-toast';

interface AuditLogEntry {
  id: string;
  taskId: string;
  action: string;
  actorType: string;
  actorId: string;
  payload: string | null;
  createdAt: string;
}

interface AuditLogViewerProps {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

export function AuditLogViewer({ taskId, taskTitle, onClose }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const { addToast } = useToast();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/audit-logs?taskId=${taskId}&page=${page}&limit=20`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch {
      addToast({ title: 'Error', description: 'Failed to load audit logs', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [taskId, page, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actorIcon = (type: string) => {
    switch (type) {
      case 'agent': return <Robot size={14} color="#3b82f6" />;
      case 'system': return <Gear size={14} color="#f59e0b" />;
      default: return <User size={14} color="#10b981" />;
    }
  };

  const actionColor = (action: string) => {
    switch (action) {
      case 'created': return 'var(--status-success)';
      case 'deleted': return 'var(--status-error)';
      case 'status_changed': return 'var(--status-info)';
      case 'assigned': return '#a855f7';
      case 'commented': return 'var(--status-info)';
      case 'time_tracked': return 'var(--status-warning)';
      default: return 'var(--text-secondary)';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const parsePayload = (payload: string | null) => {
    if (!payload) return null;
    try { return JSON.parse(payload); } catch { return null; }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'var(--shell-overlay-backdrop)',
      zIndex: 180,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-lg)',
    }} onClick={onClose}>
      <GlassSurface
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-md) var(--spacing-lg)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <ClockCounterClockwise size={20} color="#6b7280" />
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>Audit Log</h3>
              <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '12px' }}>{taskTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Log List */}
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-md) var(--spacing-lg)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--spacing-xl)', fontSize: '14px' }}>
              Loading audit logs…
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--spacing-xl)', fontSize: '14px' }}>
              No audit entries for this task yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {logs.map((log) => {
                const payload = parsePayload(log.payload);
                return (
                  <div key={log.id} style={{
                    display: 'flex',
                    gap: 'var(--spacing-sm)',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                  }}>
                    <div style={{ marginTop: 2, flexShrink: 0 }}>
                      {actorIcon(log.actorType)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: `${actionColor(log.action)}20`,
                          color: actionColor(log.action),
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {log.actorType === 'human' ? 'User' : log.actorType === 'agent' ? 'Agent' : 'System'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                          {formatTime(log.createdAt)}
                        </span>
                      </div>
                      {payload && (
                        <pre style={{
                          margin: 0,
                          fontSize: '11px',
                          color: 'var(--text-tertiary)',
                          backgroundColor: 'var(--surface-hover)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          overflow: 'auto',
                          maxHeight: 120,
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {JSON.stringify(payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: page <= 1 ? 'var(--bg-secondary)' : 'rgba(59, 130, 246, 0.15)',
                color: page <= 1 ? 'var(--text-tertiary)' : 'var(--status-info)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <CaretLeft size={14} /> Prev
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Page {page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: page >= pagination.pages ? 'var(--bg-secondary)' : 'rgba(59, 130, 246, 0.15)',
                color: page >= pagination.pages ? 'var(--text-tertiary)' : 'var(--status-info)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: page >= pagination.pages ? 'not-allowed' : 'pointer',
              }}
            >
              Next <CaretRight size={14} />
            </button>
          </div>
        )}
      </GlassSurface>
    </div>
  );
}
