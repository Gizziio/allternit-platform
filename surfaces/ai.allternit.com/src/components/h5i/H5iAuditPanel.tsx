"use client";

import React, { useState, useCallback } from 'react';
import { ShieldCheck, ShieldWarning, Shield, X } from '@phosphor-icons/react';
import { fetchH5iVibe, initH5i, fetchH5iStatus } from '@/lib/h5i/client';
import { cn } from '@/lib/utils';

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
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[180] w-[480px] max-h-[80vh] flex flex-col rounded-2xl border border-solid border-[var(--ui-border-muted)] bg-[rgba(11,14,16,0.96)] backdrop-blur-md shadow-[0_20px_50px_var(--shell-overlay-backdrop)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-[14px_16px] border-b border-solid border-[var(--ui-border-muted)]">
        <div className="flex items-center gap-2.5">
          <Shield size={18} className="text-[var(--accent-code)]" />
          <span className="text-[14px] font-bold text-[var(--text-primary)]">
            Workspace Audit
          </span>
          {status && (
            <span className={cn(
              "text-[12px] font-semibold px-2 py-0.5 rounded-full",
              status.initialized ? "bg-green-500/15 text-[var(--status-success)]" : "bg-amber-500/15 text-[var(--status-warning)]"
            )}>
              {status.initialized ? 'Active' : 'Not Initialized'}
            </span>
          )}
        </div>
        <button type="button"
          onClick={onClose}
          className="bg-transparent border-none text-[var(--text-muted)] cursor-pointer p-1 transition-colors hover:text-[var(--text-primary)]"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 overflow-auto flex-1">
        {status && !status.initialized && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-solid border-amber-500/20 text-[13px] text-[var(--status-warning)] mb-3">
            h5i is not initialized in this workspace.
          </div>
        )}

        <button type="button"
          onClick={handleAudit}
          disabled={loading}
          className={cn(
            "w-full p-[10px_14px] rounded-xl border-none text-white text-[13px] font-bold flex items-center justify-center gap-2 mb-4 transition-all duration-200",
            loading ? "bg-[var(--ui-border-muted)] opacity-50 cursor-default" : "bg-[var(--accent-code)] cursor-pointer hover:opacity-90"
          )}
        >
          {loading ? (
            <>
              <span className="animate-spin inline-block">⟳</span>
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
          <div className="p-3 rounded-xl bg-[var(--status-error-bg)] border border-solid border-red-500/20 text-[12px] text-[var(--status-error)] mb-3">
            {error}
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-3.5">
            {/* AI Ratio */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)]">
              <div className="text-[12px] font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wider">
                AI FOOTPRINT
              </div>
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${riskColor}20` }}
                >
                  <ShieldWarning size={24} style={{ color: riskColor }} />
                </div>
                <div>
                  <div className="text-[24px] font-black leading-none" style={{ color: riskColor }}>
                    {result.aiRatio.toFixed(1)}%
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)] mt-1">
                    AI-generated code ratio
                  </div>
                </div>
              </div>
            </div>

            {/* Riskiest Files */}
            {result.riskiestFiles.length > 0 && (
              <div>
                <div className="text-[12px] font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">
                  RISKIEST FILES
                </div>
                <div className="flex flex-col gap-1">
                  {result.riskiestFiles.map((f) => (
                    <div
                      key={`${f}-${workspacePath}`}
                      className="p-[6px_10px] rounded-lg bg-[var(--surface-hover)] text-[12px] text-[var(--text-secondary)] font-mono border border-solid border-white/5"
                    >
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaked Tokens */}
            {result.leakedTokens.length > 0 && (
              <div className="p-3 rounded-xl bg-[var(--status-error-bg)] border border-solid border-red-500/20">
                <div className="text-[12px] font-semibold text-[var(--status-error)] mb-1.5 uppercase tracking-wider">
                  LEAKED TOKENS DETECTED
                </div>
                <div className="flex flex-col gap-1">
                  {result.leakedTokens.map((t) => (
                    <div key={`${t}-${workspacePath}`} className="text-[12px] text-[var(--status-error)] font-mono">
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt Injection Hits */}
            {result.promptInjectionHits.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-solid border-amber-500/20">
                <div className="text-[12px] font-semibold text-[var(--status-warning)] mb-1.5 uppercase tracking-wider">
                  PROMPT INJECTION HITS
                </div>
                <div className="flex flex-col gap-1">
                  {result.promptInjectionHits.map((h) => (
                    <div key={`${h}-${workspacePath}`} className="text-[12px] text-[var(--status-warning)] font-mono">
                      {h}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Directories */}
            {result.aiDirectories.length > 0 && (
              <div>
                <div className="text-[12px] font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">
                  AI-WRITTEN DIRECTORIES
                </div>
                <div className="flex flex-col gap-1">
                  {result.aiDirectories.map((d) => (
                    <div
                      key={`${d}-${workspacePath}`}
                      className="p-[6px_10px] rounded-lg bg-[var(--surface-hover)] text-[12px] text-[var(--text-secondary)] font-mono border border-solid border-white/5"
                    >
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw output toggle */}
            {raw && (
              <details className="group">
                <summary className="text-[12px] text-[var(--text-muted)] cursor-pointer select-none outline-none group-open:mb-2">
                  Raw h5i output
                </summary>
                <pre className="p-2.5 rounded-lg bg-[var(--surface-hover)] text-[12px] font-mono text-[var(--text-secondary)] overflow-auto max-h-[200px] border border-solid border-white/5">
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
