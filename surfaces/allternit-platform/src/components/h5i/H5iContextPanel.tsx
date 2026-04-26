"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Eye, Lightning, Note, X, Spinner } from '@phosphor-icons/react';
import { fetchH5iContextTrace, type H5iContextEntry } from '@/lib/h5i/client';

interface H5iContextPanelProps {
  workspacePath: string;
  sessionId: string;
  onClose: () => void;
}

const typeConfig: Record<H5iContextEntry['type'], { icon: React.ReactNode; color: string; bg: string }> = {
  OBSERVE: { icon: <Eye size={14} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  THINK: { icon: <Brain size={14} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  ACT: { icon: <Lightning size={14} />, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  NOTE: { icon: <Note size={14} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
};

export function H5iContextPanel({ workspacePath, sessionId, onClose }: H5iContextPanelProps) {
  const [entries, setEntries] = useState<H5iContextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchH5iContextTrace(workspacePath, sessionId);
      if (data.success && data.trace) {
        setEntries(data.trace);
      } else {
        setError(data.error || 'No context trace found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trace');
    } finally {
      setLoading(false);
    }
  }, [workspacePath, sessionId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
        width: 520,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(11,14,16,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={18} color="#8b5cf6" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Session Context Trace
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {sessionId.slice(0, 8)}...
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
        {loading && entries.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40, color: 'var(--text-muted)' }}>
            <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
            Loading context trace...
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 12,
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry, i) => {
            const config = typeConfig[entry.type];
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: config.bg,
                  border: `1px solid ${config.color}20`,
                }}
              >
                <div style={{ color: config.color, flexShrink: 0, marginTop: 2 }}>{config.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: config.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {entry.type}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{entry.timestamp}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {entry.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {entries.length === 0 && !loading && !error && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            No context trace entries yet.<br />
            Context is captured as the agent OBSERVEs, THINKs, and ACTs.
          </div>
        )}
      </div>
    </div>
  );
}
