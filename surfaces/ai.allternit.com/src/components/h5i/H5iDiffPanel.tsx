"use client";

import React, { useState, useCallback } from 'react';
import { GitDiff, X, Brain } from '@phosphor-icons/react';
import { diffH5iContext, type H5iDiffEntry } from '@/lib/h5i/client';

interface H5iDiffPanelProps {
  workspacePath: string;
  sessions: Array<{ id: string; name: string }>;
  onClose: () => void;
}

const sideConfig = {
  A: { label: 'Session A', color: 'var(--status-info)', bg: 'rgba(59,130,246,0.08)' },
  B: { label: 'Session B', color: 'var(--status-error)', bg: 'var(--status-error-bg)' },
  both: { label: 'Both', color: 'var(--status-success)', bg: 'rgba(16,185,129,0.08)' },
};

const typeConfig = {
  OBSERVE: { color: 'var(--status-info)' },
  THINK: { color: '#8b5cf6' },
  ACT: { color: 'var(--status-success)' },
  NOTE: { color: 'var(--status-warning)' },
};

export function H5iDiffPanel({ workspacePath, sessions, onClose }: H5iDiffPanelProps) {
  const [sessionA, setSessionA] = useState('');
  const [sessionB, setSessionB] = useState('');
  const [diff, setDiff] = useState<H5iDiffEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDiff = useCallback(async () => {
    if (!sessionA || !sessionB) return;
    setLoading(true);
    setError('');
    setDiff([]);
    try {
      const data = await diffH5iContext(workspacePath, sessionA, sessionB);
      if (data.success && data.diff) {
        setDiff(data.diff);
      } else {
        setError(data.error || 'Diff failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diff failed');
    } finally {
      setLoading(false);
    }
  }, [workspacePath, sessionA, sessionB]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 180,
        width: 560,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        border: '1px solid var(--ui-border-muted)',
        background: 'rgba(11,14,16,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 20px 50px var(--shell-overlay-backdrop)',
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
          borderBottom: '1px solid var(--ui-border-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GitDiff size={18} color="#f59e0b" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Reasoning Diff
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
        {/* Session selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, marginBottom: 16, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Session A
            </label>
            <select
              value={sessionA}
              onChange={(e) => setSessionA(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--ui-border-muted)',
                background: 'var(--surface-hover)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="">Select...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ paddingBottom: 8, color: 'var(--text-muted)' }}>
            <Brain size={16} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Session B
            </label>
            <select
              value={sessionB}
              onChange={(e) => setSessionB(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--ui-border-muted)',
                background: 'var(--surface-hover)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="">Select...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleDiff}
          disabled={loading || !sessionA || !sessionB}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: loading ? 'var(--ui-border-muted)' : 'var(--status-warning)',
            color: '#000',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading || !sessionA || !sessionB ? 'default' : 'pointer',
            opacity: loading || !sessionA || !sessionB ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {loading ? (
            <>
              <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
              Comparing...
            </>
          ) : (
            <>
              <GitDiff size={16} />
              Diff Reasoning Traces
            </>
          )}
        </button>

        {error && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: 'var(--status-error-bg)',
              border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 12,
              color: 'var(--status-error)',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Diff results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {diff.map((entry, i) => {
            const side = sideConfig[entry.side];
            const typeColor = typeConfig[entry.type].color;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: side.bg,
                  border: `1px solid ${side.color}20`,
                }}
              >
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: `${side.color}20`,
                      color: side.color,
                    }}
                  >
                    {side.label}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: typeColor,
                      marginRight: 8,
                    }}
                  >
                    {entry.type}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {entry.content}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {diff.length === 0 && !loading && !error && (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
            Select two sessions and click "Diff Reasoning Traces" to compare their OBSERVE/THINK/ACT traces.
          </div>
        )}
      </div>
    </div>
  );
}
