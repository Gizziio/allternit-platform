"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowsClockwise, Warning } from '@phosphor-icons/react';

interface CodeCanvasTileTerminalProps {
  sessionId?: string;
  workspacePath?: string;
}

export function CodeCanvasTileTerminal({ sessionId: linkedSessionId, workspacePath }: CodeCanvasTileTerminalProps) {
  const outputRef = useRef<HTMLPreElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const termSessionId = useRef<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [output, setOutput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [retryKey, setRetryKey] = useState(0);

  const initTerminal = useCallback(async () => {
    setStatus('connecting');
    setErrorMsg('');
    setOutput('');
    termSessionId.current = null;

    let disposed = false;
    let es: EventSource | null = null;

    try {
      const createRes = await fetch('/api/terminal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shell: '/bin/zsh',
          cols: 80,
          rows: 24,
          cwd: workspacePath,
        }),
      });

      if (!createRes.ok) {
        const errBody = await createRes.json().catch(() => ({}));
        throw new Error(errBody.details || `Failed to create terminal session: ${createRes.status}`);
      }

      const { sessionId } = (await createRes.json()) as { sessionId: string };
      if (disposed) return;
      termSessionId.current = sessionId;

      es = new EventSource(`/api/terminal/${sessionId}/stream`);
      esRef.current = es;

      es.onopen = () => {
        if (!disposed) setStatus('connected');
      };

      es.onmessage = (event) => {
        if (disposed) return;
        try {
          const msg = JSON.parse(event.data) as { type: string; data?: string };
          if (msg.type === 'data' && msg.data) {
            setOutput((prev) => prev + msg.data);
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        if (!disposed) {
          setStatus('error');
          setErrorMsg('Terminal stream disconnected');
        }
      };
    } catch (err) {
      if (!disposed) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Terminal init failed');
      }
    }

    return () => {
      disposed = true;
      es?.close();
      const sid = termSessionId.current;
      if (sid) {
        fetch(`/api/terminal/${sid}/close`, { method: 'POST' }).catch(() => {});
      }
    };
  }, [workspacePath]);

  useEffect(() => {
    const cleanupPromise = initTerminal();
    return () => {
      void cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [initTerminal, retryKey]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleSend = () => {
    const data = inputRef.current?.value;
    if (!data) return;
    const sid = termSessionId.current;
    if (!sid) return;
    fetch(`/api/terminal/${sid}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: data + '\r' }),
    }).catch(() => {});
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = () => {
    esRef.current?.close();
    setRetryKey((k) => k + 1);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0b0e10',
        color: '#e2e8f0',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        position: 'relative',
      }}
    >
      <pre
        ref={outputRef}
        style={{
          flex: 1,
          margin: 0,
          padding: 8,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {output}
      </pre>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          gap: 8,
        }}
      >
        <span style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>$</span>
        {linkedSessionId && (
          <span
            title={`Linked to session: ${linkedSessionId}`}
            style={{
              fontSize: 12,
              color: 'var(--accent-primary)',
              background: 'rgba(176, 141, 110, 0.15)',
              padding: '1px 6px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
            }}
          >
            #{linkedSessionId.slice(-6)}
          </span>
        )}
        <input
          ref={inputRef}
          onKeyDown={handleKeyDown}
          disabled={status !== 'connected'}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#e2e8f0',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            outline: 'none',
          }}
          placeholder={
            status === 'connecting'
              ? 'Starting...'
              : status === 'error'
                ? 'Disconnected'
                : 'Type command...'
          }
        />
      </div>

      {status === 'connecting' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(11,14,16,0.92)',
            color: 'var(--ui-text-muted)',
            fontSize: 12,
            gap: 12,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              border: '2px solid rgba(255,255,255,0.1)',
              borderTopColor: 'var(--accent-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span>Starting terminal…</span>
        </div>
      )}

      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(11,14,16,0.92)',
            color: 'var(--status-error)',
            fontSize: 12,
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <Warning size={24} />
          <div style={{ maxWidth: 320, lineHeight: 1.5 }}>{errorMsg}</div>
          <button
            onClick={handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--ui-border-default)',
              background: 'var(--surface-floating)',
              color: 'var(--ui-text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <ArrowsClockwise size={14} />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
