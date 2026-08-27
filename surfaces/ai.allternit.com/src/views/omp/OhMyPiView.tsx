'use client';

import { ArrowSquareOut, CheckCircle, CircleNotch, Download, Terminal, Warning } from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';
import { openInBrowser } from '@/lib/openInBrowser';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/typography/Text';
import { Skeleton } from '@/components/ui/skeleton';

export function OhMyPiView() {
  const miniApps = typeof window !== 'undefined' ? window.allternit?.miniApps : undefined;
  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState<'install' | 'start' | null>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const refresh = async () => {
    if (miniApps) setRunning((await miniApps.getStatus('oh-my-pi')).running);
    setChecking(false);
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => miniApps?.onProgress((event) => {
    if (event.id === 'oh-my-pi') setLogs((current) => [...current.slice(-80), event.line]);
  }), [miniApps]);

  const install = async () => {
    if (!miniApps) return;
    setBusy('install'); setError(''); setLogs([]);
    const result = await miniApps.install('oh-my-pi');
    setBusy(null); if (!result.success) setError(result.error ?? 'Installation failed');
  };
  const start = async () => {
    if (!miniApps) return;
    setBusy('start'); setError('');
    const result = await miniApps.start('oh-my-pi');
    setBusy(null); if (!result.success) setError(result.error ?? 'RPC runtime failed to start');
    await refresh();
  };

  const isBusy = Boolean(busy) || checking;

  return (
    <div className="h-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl px-8 pt-10 pb-12 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Terminal size={22} className="text-[var(--accent-primary)] shrink-0" />
            <div>
              <Text variant="label" className="text-[10px] uppercase tracking-wide text-[var(--accent-primary)]">Coding harness</Text>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Oh My Pi</h1>
            </div>
            <Pill
              size="sm"
              icon={running
                ? <CheckCircle size={11} className="text-[var(--status-success)]" />
                : <Warning size={11} className="text-[var(--status-warning)]" />}
              className={running
                ? 'border-[var(--status-success)]/30 bg-[var(--status-success)]/10 text-[var(--status-success)]'
                : 'border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 text-[var(--status-warning)]'}
            >
              {running ? 'Running' : 'Offline'}
            </Pill>
          </div>
          <Button variant="outline" size="sm" onClick={() => openInBrowser('https://github.com/can1357/oh-my-pi')}>
            <ArrowSquareOut size={13} />
            GitHub
          </Button>
        </div>

        <Text variant="body" className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          The official OMP coding agent with its optimized tool harness, LSP, browser, subagents, SDK, ACP, and NDJSON RPC mode.
        </Text>

        {checking ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
            <Skeleton variant="rounded" width="100%" height={120} />
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-5">
            <div className="flex items-center gap-3">
              {running
                ? <CheckCircle size={22} className="text-[var(--status-success)]" />
                : <Terminal size={22} className="text-[var(--text-muted)]" />}
              <div>
                <Text variant="body" className="font-medium text-[var(--text-primary)]">
                  {running ? 'OMP RPC harness is running' : 'OMP RPC harness is stopped'}
                </Text>
                <Text variant="caption" className="text-[var(--text-tertiary)]">
                  Allternit launches the upstream runtime as <code>omp --mode rpc --no-session</code>.
                </Text>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void install()} disabled={!miniApps || isBusy}>
                <Download size={15} />
                {busy === 'install' ? 'Installing…' : 'Install or update'}
              </Button>
              <Button variant="outline" onClick={() => void start()} disabled={!miniApps || isBusy || running}>
                <Terminal size={15} />
                {busy === 'start' ? 'Starting…' : 'Start RPC harness'}
              </Button>
            </div>

            {!miniApps && (
              <Text variant="caption" className="text-[var(--text-tertiary)] block">
                Desktop controls unavailable. Install with <code>bun install -g @oh-my-pi/pi-coding-agent</code>, then run <code>omp</code>.
              </Text>
            )}

            {isBusy && <CircleNotch size={16} className="animate-spin text-[var(--accent-primary)]" />}

            {error && (
              <div className="rounded-lg bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 p-3 text-xs text-[var(--status-error)]">
                {error}
              </div>
            )}

            {logs.length > 0 && (
              <pre className="max-h-52 overflow-auto rounded-xl bg-black/80 p-3 text-[11px] leading-5 text-neutral-300">
                {logs.join('\n')}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
