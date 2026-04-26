"use client";

import React, { useState, useCallback } from 'react';
import { Plugs, CheckCircle, X, Warning } from '@phosphor-icons/react';
import { installAgentHooks } from '@/lib/h5i/client';

const AGENTS = [
  { id: 'claude-code', name: 'Claude Code', icon: '🅲' },
  { id: 'cursor', name: 'Cursor', icon: '🖱️' },
  { id: 'gemini', name: 'Gemini CLI', icon: '♊' },
  { id: 'github-copilot-cli', name: 'Copilot CLI', icon: '✈️' },
  { id: 'opencode', name: 'OpenCode', icon: '🔓' },
];

interface H5iAgentHooksPanelProps {
  workspacePath: string;
  onClose: () => void;
}

export function H5iAgentHooksPanel({ workspacePath, onClose }: H5iAgentHooksPanelProps) {
  const [selected, setSelected] = useState<string[]>(['claude-code']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ installed: string[]; errors: string[] } | null>(null);

  const toggleAgent = useCallback((agent: string) => {
    setSelected((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent],
    );
  }, []);

  const handleInstall = useCallback(async () => {
    if (selected.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await installAgentHooks(workspacePath, selected);
      setResult(data);
    } catch (err) {
      setResult({ installed: [], errors: [err instanceof Error ? err.message : 'Install failed'] });
    } finally {
      setLoading(false);
    }
  }, [workspacePath, selected]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
        width: 420,
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
          <Plugs size={18} color="#3b82f6" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Install Agent Hooks
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Install h5i hook configurations for your preferred AI agents. Hooks capture session metadata automatically.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => toggleAgent(agent.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: selected.includes(agent.id) ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 16 }}>{agent.icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                {agent.name}
              </span>
              {selected.includes(agent.id) && (
                <CheckCircle size={16} color="#3b82f6" />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={handleInstall}
          disabled={loading || selected.length === 0}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: loading ? 'rgba(255,255,255,0.06)' : '#3b82f6',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading || selected.length === 0 ? 'default' : 'pointer',
            opacity: loading || selected.length === 0 ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <>
              <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
              Installing...
            </>
          ) : (
            <>
              <Plugs size={16} />
              Install {selected.length} Agent Hook{selected.length !== 1 ? 's' : ''}
            </>
          )}
        </button>

        {result && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.installed.length > 0 && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: '#10b981', marginBottom: 4 }}>
                  Installed
                </div>
                {result.installed.map((a) => (
                  <div key={a} style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={12} /> {a}
                  </div>
                ))}
              </div>
            )}
            {result.errors.length > 0 && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>
                  Errors
                </div>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Warning size={12} /> {e}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
