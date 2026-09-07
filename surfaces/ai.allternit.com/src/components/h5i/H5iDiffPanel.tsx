"use client";

import React, { useState, useCallback } from 'react';
import { GitDiff, X, Brain, FileCode } from '@phosphor-icons/react';
import { diffH5iContext, type H5iDiffEntry } from '@/lib/h5i/client';
import { API_BASE_URL } from '@/lib/agents/api-config';

interface H5iDiffPanelProps {
  workspacePath: string;
  sessions: Array<{ id: string; name: string }>;
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

type DiffMode = 'reasoning' | 'files';

export function H5iDiffPanel({ workspacePath, sessions, onClose }: H5iDiffPanelProps) {
  const [mode, setMode] = useState<DiffMode>('reasoning');

  // Reasoning trace diff state
  const [sessionA, setSessionA] = useState('');
  const [sessionB, setSessionB] = useState('');
  const [reasoningDiff, setReasoningDiff] = useState<H5iDiffEntry[]>([]);
  const [reasoningLoading, setReasoningLoading] = useState(false);
  const [reasoningError, setReasoningError] = useState('');

  // File diff state
  const [filePath, setFilePath] = useState('');
  const [fileDiff, setFileDiff] = useState<GitDiffResult | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState('');

  const handleReasoningDiff = useCallback(async () => {
    if (!sessionA || !sessionB) return;
    setReasoningLoading(true);
    setReasoningError('');
    setReasoningDiff([]);
    try {
      const data = await diffH5iContext(workspacePath, sessionA, sessionB);
      if (data.success && data.diff) {
        setReasoningDiff(data.diff);
      } else {
        setReasoningError(data.error || 'Diff failed');
      }
    } catch (err) {
      setReasoningError(err instanceof Error ? err.message : 'Diff failed');
    } finally {
      setReasoningLoading(false);
    }
  }, [workspacePath, sessionA, sessionB]);

  const handleFileDiff = useCallback(async () => {
    setFileLoading(true);
    setFileError('');
    setFileDiff(null);
    try {
      const data = await fetchGitDiff(workspacePath, filePath || undefined);
      setFileDiff(data);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to load file diff');
    } finally {
      setFileLoading(false);
    }
  }, [workspacePath, filePath]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 180,
        width: 580,
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
          <GitDiff size={18} color="#f59e0b" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            h5i Diff
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {mode === 'reasoning' ? 'Reasoning traces' : 'File changes'}
          </span>
        </div>
        <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--ui-border-muted)' }}>
        <button
          type="button"
          onClick={() => setMode('reasoning')}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: mode === 'reasoning' ? 'var(--surface-hover)' : 'transparent',
            border: 'none',
            borderBottom: mode === 'reasoning' ? '2px solid var(--status-warning)' : '2px solid transparent',
            color: mode === 'reasoning' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: mode === 'reasoning' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Brain size={14} />
          Reasoning Traces
        </button>
        <button
          type="button"
          onClick={() => setMode('files')}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: mode === 'files' ? 'var(--surface-hover)' : 'transparent',
            border: 'none',
            borderBottom: mode === 'files' ? '2px solid var(--status-warning)' : '2px solid transparent',
            color: mode === 'files' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: mode === 'files' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <FileCode size={14} />
          File Diff
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
        {mode === 'reasoning' ? (
          <>
            {/* Session selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, marginBottom: 16, alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Session A
                </div>
                <select aria-label="Selection" value={sessionA}
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
                  <option value="">Select…</option>
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
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Session B
                </div>
                <select aria-label="Selection" value={sessionB}
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
                  <option value="">Select…</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="button"
              onClick={handleReasoningDiff}
              disabled={reasoningLoading || !sessionA || !sessionB}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: reasoningLoading ? 'var(--ui-border-muted)' : 'var(--status-warning)',
                color: '#000',
                fontSize: 13,
                fontWeight: 600,
                cursor: reasoningLoading || !sessionA || !sessionB ? 'default' : 'pointer',
                opacity: reasoningLoading || !sessionA || !sessionB ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {reasoningLoading ? (
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

            {reasoningError && (
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
                {reasoningError}
              </div>
            )}

            {/* Diff results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reasoningDiff.map((entry, i) => {
                const side = sideConfig[entry.side];
                const typeColor = typeConfig[entry.type].color;
                return (
                  <div
                    key={`h5idiffpanel-${i}`}
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
                          fontSize: 12,
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
                          fontSize: 12,
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

            {reasoningDiff.length === 0 && !reasoningLoading && !reasoningError && (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                Select two sessions and click "Diff Reasoning Traces" to compare their OBSERVE/THINK/ACT traces.
              </div>
            )}
          </>
        ) : (
          <>
            {/* File diff controls */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                File path (optional)
              </div>
              <input
                aria-label="Input"
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="e.g. src/index.ts (leave empty for all changes)"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--ui-border-muted)',
                  background: 'var(--surface-hover)',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  outline: 'none',
                  marginBottom: 10,
                }}
              />
              <button
                type="button"
                onClick={handleFileDiff}
                disabled={fileLoading}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: fileLoading ? 'var(--ui-border-muted)' : 'var(--status-warning)',
                  color: '#000',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: fileLoading ? 'default' : 'pointer',
                  opacity: fileLoading ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {fileLoading ? (
                  <>
                    <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
                    Loading diff…
                  </>
                ) : (
                  <>
                    <FileCode size={16} />
                    Load File Diff
                  </>
                )}
              </button>
            </div>

            {fileError && (
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
                {fileError}
              </div>
            )}

            {/* File diff results */}
            {fileDiff && fileDiff.files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {fileDiff.files.map((f) => (
                  <div
                    key={f.path}
                    style={{
                      border: '1px solid var(--ui-border-muted)',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 10px',
                        background: 'var(--surface-hover)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {f.changeType} {f.path} (+{f.additions}/-{f.deletions})
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: 10,
                        background: 'rgba(0,0,0,0.2)',
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        maxHeight: 240,
                        overflow: 'auto',
                      }}
                    >
                      {f.diff}
                    </pre>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Total: +{fileDiff.totalAdditions}/-{fileDiff.totalDeletions}
                </div>
              </div>
            )}

            {fileDiff && fileDiff.files.length === 0 && !fileLoading && !fileError && (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                No file changes found.
              </div>
            )}

            {!fileDiff && !fileLoading && !fileError && (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                Enter a file path or leave it empty to see all workspace changes, then click "Load File Diff".
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
