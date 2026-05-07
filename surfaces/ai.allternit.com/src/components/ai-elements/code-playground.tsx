'use client';

/**
 * Code Playground
 *
 * Interactive code editor with live execution.
 * - JavaScript: runs natively in the browser
 * - Python: executes via existing Pyodide WASM sandbox
 *
 * Zero mock data. Real execution only.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconPlayerPlay,
  IconRotate,
  IconCopy,
  IconCheck,
  IconTerminal,
  IconLoader2,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────

export type PlaygroundLanguage = 'python' | 'javascript';

export interface CodePlaygroundProps {
  /** Initial code content */
  defaultCode?: string;
  /** Language mode */
  language?: PlaygroundLanguage;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when code changes */
  onChange?: (code: string) => void;
  /** Callback when code is executed */
  onExecute?: (code: string, output: string) => void;
  className?: string;
  title?: string;
}

export interface ExecutionResult {
  output: string;
  error?: string;
  duration: number;
}

// ─── Main Component ────────────────────────────────────────────────

export function CodePlayground({
  defaultCode,
  language = 'python',
  readOnly = false,
  onChange,
  onExecute,
  className,
  title = 'Code Playground',
}: CodePlaygroundProps) {
  const [code, setCode] = useState(defaultCode ?? '');
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultCode !== undefined) setCode(defaultCode);
  }, [defaultCode]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      onChange?.(newCode);
    },
    [onChange]
  );

  const executePython = useCallback(async (source: string): Promise<ExecutionResult> => {
    const startTime = performance.now();
    try {
      const { executeInWasmSandbox } = await import('@/lib/sandbox/wasm-sandbox');
      const result = await executeInWasmSandbox({ code: source });
      return {
        output: result.output || '',
        error: result.success ? undefined : result.error,
        duration: performance.now() - startTime,
      };
    } catch (err: any) {
      return {
        output: '',
        error: err?.message || String(err),
        duration: performance.now() - startTime,
      };
    }
  }, []);

  const executeJavaScript = useCallback(async (source: string): Promise<ExecutionResult> => {
    const startTime = performance.now();
    const logs: string[] = [];

    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      logs.push(
        args
          .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
          .join(' ')
      );
    };
    console.error = (...args: any[]) => {
      logs.push(
        'Error: ' +
          args
            .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
            .join(' ')
      );
    };

    try {
      const fn = new Function(source);
      fn();

      console.log = originalLog;
      console.error = originalError;

      return {
        output: logs.join('\n') || '(No output)',
        duration: performance.now() - startTime,
      };
    } catch (err: any) {
      console.log = originalLog;
      console.error = originalError;

      return {
        output: logs.join('\n'),
        error: err?.message || String(err),
        duration: performance.now() - startTime,
      };
    }
  }, []);

  const handleExecute = useCallback(async () => {
    setIsExecuting(true);
    setOutput('');
    setError('');

    const result =
      language === 'python' ? await executePython(code) : await executeJavaScript(code);

    setOutput(result.output);
    if (result.error) setError(result.error);
    setIsExecuting(false);
    onExecute?.(code, result.output);

    setTimeout(() => {
      outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, [code, language, executePython, executeJavaScript, onExecute]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const lines = code.split('\n');

  return (
    <div
      className={cn(
        'flex h-[520px] flex-col overflow-hidden rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--ui-border-muted)] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <IconTerminal className="h-4 w-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
              language === 'python'
                ? 'bg-blue-500/10 text-blue-400'
                : 'bg-yellow-500/10 text-yellow-400'
            )}
          >
            {language}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            title="Copy code"
          >
            {copied ? <IconCheck className="h-3.5 w-3.5 text-green-400" /> : <IconCopy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting || !code.trim()}
            className={cn(
              'ml-1 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              isExecuting || !code.trim()
                ? 'bg-[var(--ui-border-muted)] text-[var(--text-muted)]'
                : 'bg-[var(--accent-primary)] text-black hover:opacity-90'
            )}
          >
            {isExecuting ? (
              <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <IconPlayerPlay className="h-3.5 w-3.5" />
            )}
            {isExecuting ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>

      {/* Editor + Output */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Editor */}
        <div className="relative flex-1 overflow-hidden">
          <div className="flex h-full overflow-auto">
            {/* Line numbers */}
            <div className="shrink-0 select-none bg-[var(--surface-elevated)] py-3 pr-3 pl-4 text-right">
              {lines.map((_, i) => (
                <div
                  key={i}
                  className="h-[22px] text-[11px] leading-[22px] text-[var(--text-muted)]"
                >
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Textarea */}
            <textarea
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              readOnly={readOnly}
              spellCheck={false}
              className={cn(
                'w-full resize-none bg-[var(--surface-panel)] py-3 pl-3 pr-4 font-mono text-xs leading-[22px] text-[var(--text-primary)] outline-none',
                readOnly && 'cursor-default'
              )}
              style={{
                tabSize: 2,
                caretColor: 'var(--accent-primary)',
              }}
            />
          </div>
        </div>

        {/* Output */}
        <AnimatePresence>
          {(output || error || isExecuting) && (
            <motion.div
              ref={outputRef}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-[var(--ui-border-muted)]"
            >
              <div className="max-h-48 overflow-auto bg-[var(--surface-elevated)] px-4 py-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <IconTerminal className="h-3 w-3 text-[var(--text-muted)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Output
                  </span>
                </div>
                {isExecuting && !output && !error && (
                  <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-muted)]">
                    <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                    Executing…
                  </div>
                )}
                {output && (
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--text-secondary)]">
                    {output}
                  </pre>
                )}
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                    <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-red-400">
                      {error}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
