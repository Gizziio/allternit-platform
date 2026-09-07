"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { GitCommit, X, Check, FileText, Eye } from '@phosphor-icons/react';
import { commitWithH5i } from '@/lib/h5i/client';
import { API_BASE_URL } from '@/lib/agents/api-config';

interface H5iCommitPanelProps {
  workspacePath: string;
  sessionId?: string;
  onClose: () => void;
}

interface GitDiffFile {
  path: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diff: string;
}

interface GitDiffResult {
  files: GitDiffFile[];
  totalAdditions: number;
  totalDeletions: number;
}

async function fetchGitDiff(workspacePath: string, file?: string): Promise<GitDiffResult> {
  const res = await fetch(`${API_BASE_URL}/git/diff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: workspacePath, file }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `git diff failed: ${res.status}`);
  }
  return res.json();
}

export function H5iCommitPanel({ workspacePath, sessionId, onClose }: H5iCommitPanelProps) {
  const [message, setMessage] = useState('');
  const [model, setModel] = useState('claude-sonnet-4');
  const [agent, setAgent] = useState('allternit-canvas');
  const [prompt, setPrompt] = useState('');
  const [filePaths, setFilePaths] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; hash?: string; error?: string } | null>(null);

  const [diffPreview, setDiffPreview] = useState<GitDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState('');

  const selectedFiles = filePaths
    .split('\n')
    .map(f => f.trim())
    .filter(Boolean);

  const loadDiffPreview = useCallback(async () => {
    setDiffLoading(true);
    setDiffError('');
    setDiffPreview(null);
    try {
      const data = await fetchGitDiff(workspacePath);
      setDiffPreview(data);
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : 'Failed to load diff preview');
    } finally {
      setDiffLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    // Auto-load diff preview when the panel opens if the backend supports it.
    loadDiffPreview();
  }, [loadDiffPreview]);

  const handleCommit = useCallback(async () => {
    if (!message.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const files = selectedFiles.length > 0 ? selectedFiles : undefined;
      const data = await commitWithH5i(workspacePath, message, {
        model: model || undefined,
        agent: agent || undefined,
        prompt: prompt || undefined,
        files,
      });
      setResult(data);
      if (data.success) {
        setMessage('');
        setPrompt('');
        setFilePaths('');
        setDiffPreview(null);
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Commit failed' });
    } finally {
      setLoading(false);
    }
  }, [workspacePath, message, model, agent, prompt, selectedFiles]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 180,
        width: 520,
        maxHeight: '85vh',
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
          <GitCommit size={18} color="#10b981" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Commit with Provenance
          </span>
        </div>
        <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Commit Message *
          </div>
          <input aria-label="Input" type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Refactor auth module"
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
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Model
            </div>
            <input aria-label="Input" type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
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
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Agent
            </div>
            <input aria-label="Input" type="text"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
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
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Files to include
          </div>
          <textarea aria-label="Text Area" value={filePaths}
            onChange={(e) => setFilePaths(e.target.value)}
            placeholder={`One file path per line, e.g.\nsrc/index.ts\nsrc/utils.ts`}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--ui-border-muted)',
              background: 'var(--surface-hover)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          {selectedFiles.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Prompt / Reasoning
          </div>
          <textarea aria-label="Text Area" value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What prompted this change?"
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--ui-border-muted)',
              background: 'var(--surface-hover)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Diff preview */}
        <div style={{ border: '1px solid var(--ui-border-muted)', borderRadius: 10, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'var(--surface-hover)',
              borderBottom: '1px solid var(--ui-border-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                Diff preview
              </span>
            </div>
            <button
              type="button"
              onClick={loadDiffPreview}
              disabled={diffLoading}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent-code)',
                background: 'transparent',
                border: 'none',
                cursor: diffLoading ? 'default' : 'pointer',
                opacity: diffLoading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {diffLoading ? (
                <>
                  <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
                  Loading…
                </>
              ) : (
                <>
                  <FileText size={12} />
                  Refresh
                </>
              )}
            </button>
          </div>

          <div style={{ padding: 12, maxHeight: 220, overflow: 'auto', background: 'rgba(0,0,0,0.2)' }}>
            {diffLoading && !diffPreview ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading diff preview…</div>
            ) : diffError ? (
              <div style={{ fontSize: 12, color: 'var(--status-error)' }}>{diffError}</div>
            ) : diffPreview && diffPreview.files.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {diffPreview.files.map((f) => (
                  <div key={f.path}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                      {f.changeType} {f.path} (+{f.additions}/-{f.deletions})
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: 8,
                        borderRadius: 6,
                        background: 'var(--surface-hover)',
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        maxHeight: 120,
                        overflow: 'auto',
                      }}
                    >
                      {f.diff}
                    </pre>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Total: +{diffPreview.totalAdditions}/-{diffPreview.totalDeletions}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                No diff preview available. Add file paths above and click Refresh.
              </div>
            )}
          </div>
        </div>

        <button type="button"
          onClick={handleCommit}
          disabled={loading || !message.trim()}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: loading ? 'var(--ui-border-muted)' : 'var(--status-success)',
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
              Committing…
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
              background: result.success ? 'rgba(16,185,129,0.08)' : 'var(--status-error-bg)',
              border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {result.success ? (
              <>
                <Check size={16} color="#10b981" />
                <span style={{ fontSize: 12, color: 'var(--status-success)' }}>
                  Committed {result.hash ? `(${result.hash.slice(0, 7)})` : ''}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--status-error)' }}>{result.error}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
