"use client";

import React, { useState, useCallback } from 'react';
import { ShieldCheck, ShieldWarning, Shield, X } from '@phosphor-icons/react';
import { fetchH5iVibe, initH5i, fetchH5iStatus } from '@/lib/h5i/client';

interface H5iAuditPanelProps {
  workspacePath: string;
  onClose: () => void;
}

export function H5iAuditPanel({ workspacePath, onClose }: H5iAuditPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    aiRatio: number;
    aiDirectories: string[];
    riskiestFiles: string[];
    leakedTokens: string[];
    promptInjectionHits: string[];
  } | null>(null);
  const [raw, setRaw] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [status, setStatus] = useState<{ initialized: boolean; notesCount: number; sessionCount: number } | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const s = await fetchH5iStatus(workspacePath);
      setStatus(s);
      return s;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status check failed');
      return null;
    }
  }, [workspacePath]);

  const handleInit = useCallback(async () => {
    try {
      await initH5i(workspacePath);
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Init failed');
    }
  }, [workspacePath, checkStatus]);

  const handleAudit = useCallback(async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setRaw('');
    try {
      const s = await checkStatus();
      if (s && !s.initialized) {
        await handleInit();
      }
      const data = await fetchH5iVibe(workspacePath);
      if (data.success) {
        setResult(data.result || null);
        setRaw(data.raw || '');
      } else {
        setError(data.error || 'Audit failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed');
    } finally {
      setLoading(false);
    }
  }, [workspacePath, checkStatus, handleInit]);

  React.useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const riskColor = result
    ? result.aiRatio > 0.7
      ? 'var(--status-error)'
      : result.aiRatio > 0.4
        ? 'var(--status-warning)'
        : 'var(--status-success)'
    : 'var(--ui-text-muted)';

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 180,
        width: 480,
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
          <Shield size={18} color="var(--accent-code)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Workspace Audit
          </span>
          {status && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 10,
                background: status.initialized
                  ? 'rgba(16,185,129,0.15)'
                  : 'rgba(245,158,11,0.15)',
                color: status.initialized
                  ? 'var(--status-success)'
                  : 'var(--status-warning)',
              }}
            >
              {status.initialized ? 'Active' : 'Not Initialized'}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
        {status && !status.initialized && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
              fontSize: 13,
              color: 'var(--status-warning)',
              marginBottom: 12,
            }}
          >
            h5i is not initialized in this workspace.
          </div>
        )}

        <button
          onClick={handleAudit}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: loading ? 'var(--ui-border-muted)' : 'var(--accent-code)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
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
              Auditing...
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              Run h5i Vibe Audit
            </>
          )}
        </button>

        {error && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
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

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* AI Ratio */}
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: 'var(--surface-hover)',
                border: '1px solid var(--ui-border-muted)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                AI FOOTPRINT
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: `${riskColor}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldWarning size={24} color={riskColor} />
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: riskColor }}>
                    {result.aiRatio.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    AI-generated code ratio
                  </div>
                </div>
              </div>
            </div>

            {/* Riskiest Files */}
            {result.riskiestFiles.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  RISKIEST FILES
                </div>
                {result.riskiestFiles.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: 'var(--surface-hover)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      fontFamily: 'monospace',
                      marginBottom: 4,
                    }}
                  >
                    {f}
                  </div>
                ))}
              </div>
            )}

            {/* Leaked Tokens */}
            {result.leakedTokens.length > 0 && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--status-error-bg)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--status-error)', marginBottom: 6 }}>
                  LEAKED TOKENS DETECTED
                </div>
                {result.leakedTokens.map((t, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--status-error)', fontFamily: 'monospace' }}>
                    {t}
                  </div>
                ))}
              </div>
            )}

            {/* Prompt Injection Hits */}
            {result.promptInjectionHits.length > 0 && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.2)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--status-warning)', marginBottom: 6 }}>
                  PROMPT INJECTION HITS
                </div>
                {result.promptInjectionHits.map((h, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--status-warning)', fontFamily: 'monospace' }}>
                    {h}
                  </div>
                ))}
              </div>
            )}

            {/* AI Directories */}
            {result.aiDirectories.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  AI-WRITTEN DIRECTORIES
                </div>
                {result.aiDirectories.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: 'var(--surface-hover)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      fontFamily: 'monospace',
                      marginBottom: 4,
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>
            )}

            {/* Raw output toggle */}
            {raw && (
              <details>
                <summary style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Raw h5i output
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 8,
                    background: 'var(--surface-hover)',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: 'var(--text-secondary)',
                    overflow: 'auto',
                    maxHeight: 200,
                  }}
                >
                  {raw}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
