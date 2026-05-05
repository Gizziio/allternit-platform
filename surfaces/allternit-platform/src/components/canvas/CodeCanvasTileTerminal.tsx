"use client";

import React, { useEffect, useRef, useState } from 'react';

interface CodeCanvasTileTerminalProps {
  sessionId?: string;
  workspacePath?: string;
}

export function CodeCanvasTileTerminal({ workspacePath }: CodeCanvasTileTerminalProps) {
  const outputRef = useRef<HTMLPreElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const termSessionId = useRef<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [output, setOutput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let disposed = false;

    async function init() {
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
          throw new Error(`Failed to create terminal session: ${createRes.status}`);
        }

        const { sessionId } = await createRes.json() as { sessionId: string };
        termSessionId.current = sessionId;

        const es = new EventSource(`/api/terminal/${sessionId}/stream`);
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
    }

    init();

    return () => {
      disposed = true;
      esRef.current?.close();
      const sid = termSessionId.current;
      if (sid) {
        fetch(`/api/terminal/${sid}/close`, { method: 'POST' }).catch(() => {});
      }
    };
  }, [workspacePath]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0b0e10', color: '#e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
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
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderTop: '1px solid var(--ui-border-muted)', gap: 8 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>$</span>
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
          placeholder={status === 'connecting' ? 'Starting...' : status === 'error' ? 'Disconnected' : 'Type command...'}
        />
      </div>
      {status === 'connecting' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,14,16,0.9)', color: 'var(--text-muted)', fontSize: 12 }}>
          Starting terminal...
        </div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,14,16,0.9)', color: 'var(--status-error)', fontSize: 12, gap: 8 }}>
          <div>{errorMsg}</div>
        </div>
      )}
    </div>
  );
}
