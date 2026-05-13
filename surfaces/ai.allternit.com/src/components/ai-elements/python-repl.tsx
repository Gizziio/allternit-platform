'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface OutputLine {
  type: 'stdout' | 'stderr' | 'result' | 'input';
  text: string;
}

export interface PythonReplProps {
  initialCode?: string;
  autoRun?: boolean;
}

export function PythonRepl({ initialCode = '', autoRun = false }: PythonReplProps) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pyodideRef = useRef<unknown>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const autoRanRef = useRef(false);

  const initPyodide = useCallback(async () => {
    if (pyodideRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const { loadPyodide } = await import('pyodide');
      const py = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
        stdout: (text: string) => setOutput((prev) => [...prev, { type: 'stdout', text }]),
        stderr: (text: string) => setOutput((prev) => [...prev, { type: 'stderr', text }]),
      });
      pyodideRef.current = py;
      setIsReady(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void initPyodide(); }, [initPyodide]);

  useEffect(() => {
    if (isReady && autoRun && !autoRanRef.current && code.trim()) {
      autoRanRef.current = true;
      void runCode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  useEffect(() => {
    outputRef.current?.scrollTo(0, outputRef.current.scrollHeight);
  }, [output]);

  const runCode = useCallback(async () => {
    if (!pyodideRef.current || !code.trim()) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const py = pyodideRef.current as any;
    setOutput((prev) => [...prev, { type: 'input', text: code }]);
    setIsLoading(true);
    try {
      const result = await py.runPythonAsync(code);
      if (result !== undefined && result !== null) {
        const repr = typeof result.toString === 'function' ? result.toString() : String(result);
        setOutput((prev) => [...prev, { type: 'result', text: repr }]);
      }
    } catch (e) {
      setOutput((prev) => [...prev, { type: 'stderr', text: String(e) }]);
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void runCode();
    }
  };

  return (
    <div style={{
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
      background: '#0d1117',
      fontFamily: 'var(--font-mono, monospace)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'inherit' }}>
            Python REPL
          </span>
          {isLoading && (
            <span style={{ fontSize: 12, color: '#3b82f6' }}>
              {isReady ? 'Running…' : 'Loading Pyodide…'}
            </span>
          )}
          {isReady && !isLoading && (
            <span style={{ fontSize: 12, color: '#4ade80' }}>Ready</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setOutput([])}
            style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 5,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
          <button
            onClick={() => void runCode()}
            disabled={!isReady || isLoading}
            style={{
              fontSize: 12,
              padding: '2px 10px',
              borderRadius: 5,
              border: 'none',
              background: isReady && !isLoading ? '#3b82f6' : 'rgba(59,130,246,0.3)',
              color: '#fff',
              cursor: isReady && !isLoading ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            ▶ Run
          </button>
        </div>
      </div>

      {/* Code editor */}
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder="# Write Python here. Cmd+Enter to run."
        style={{
          width: '100%',
          minHeight: 120,
          maxHeight: 320,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          color: '#e2e8f0',
          fontSize: 13,
          lineHeight: 1.6,
          fontFamily: 'inherit',
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Output */}
      {(output.length > 0 || error) && (
        <div
          ref={outputRef}
          style={{
            maxHeight: 240,
            overflowY: 'auto',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {error && (
            <div style={{ color: '#f87171', fontSize: 12 }}>{error}</div>
          )}
          {output.map((line, i) => (
            <div key={i} style={{
              fontSize: 12,
              lineHeight: 1.6,
              color:
                line.type === 'stderr' ? '#f87171' :
                line.type === 'result' ? '#a5f3fc' :
                line.type === 'input' ? 'rgba(255,255,255,0.25)' :
                'rgba(255,255,255,0.7)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              borderLeft: line.type === 'input' ? '2px solid rgba(255,255,255,0.1)' : 'none',
              paddingLeft: line.type === 'input' ? 8 : 0,
            }}>
              {line.type === 'input' ? `>>> ${line.text.split('\n').join('\n... ')}` : line.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
