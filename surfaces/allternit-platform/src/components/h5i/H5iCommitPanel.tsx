"use client";

import React, { useState, useCallback } from 'react';
import { GitCommit, X, Check } from '@phosphor-icons/react';
import { commitWithH5i } from '@/lib/h5i/client';

interface H5iCommitPanelProps {
  workspacePath: string;
  sessionId?: string;
  onClose: () => void;
}

export function H5iCommitPanel({ workspacePath, sessionId, onClose }: H5iCommitPanelProps) {
  const [message, setMessage] = useState('');
  const [model, setModel] = useState('claude-sonnet-4');
  const [agent, setAgent] = useState('allternit-canvas');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; hash?: string; error?: string } | null>(null);

  const handleCommit = useCallback(async () => {
    if (!message.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await commitWithH5i(workspacePath, message, {
        model: model || undefined,
        agent: agent || undefined,
        prompt: prompt || undefined,
      });
      setResult(data);
      if (data.success) {
        setMessage('');
        setPrompt('');
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Commit failed' });
    } finally {
      setLoading(false);
    }
  }, [workspacePath, message, model, agent, prompt]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
        width: 440,
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
          <GitCommit size={18} color="#10b981" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Commit with Provenance
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Commit Message *
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Refactor auth module"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Agent
            </label>
            <input
              type="text"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Prompt / Reasoning
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What prompted this change?"
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <button
          onClick={handleCommit}
          disabled={loading || !message.trim()}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: loading ? 'rgba(255,255,255,0.06)' : '#10b981',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading || !message.trim() ? 'default' : 'pointer',
            opacity: loading || !message.trim() ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <>
              <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
              Committing...
            </>
          ) : (
            <>
              <GitCommit size={16} />
              Commit with h5i Provenance
            </>
          )}
        </button>

        {result && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: result.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {result.success ? (
              <>
                <Check size={16} color="#10b981" />
                <span style={{ fontSize: 12, color: '#10b981' }}>
                  Committed {result.hash ? `(${result.hash.slice(0, 7)})` : ''}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: '#ef4444' }}>{result.error}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
