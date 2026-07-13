'use client';

import { ArrowSquareOut, CheckCircle, CircleNotch, Download, Terminal } from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';
import { openInBrowser } from '@/lib/openInBrowser';

export function OhMyPiView() {
  const miniApps = typeof window !== 'undefined' ? window.allternit?.miniApps : undefined;
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<'install' | 'start' | null>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const refresh = async () => {
    if (miniApps) setRunning((await miniApps.getStatus('oh-my-pi')).running);
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

  return <div className="h-full overflow-auto bg-[var(--bg-primary)] p-8 text-[var(--text-primary)]">
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-primary)]">Coding harness</div><h1 className="mt-2 text-2xl font-semibold">Oh My Pi</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">The official OMP coding agent with its optimized tool harness, LSP, browser, subagents, SDK, ACP, and NDJSON RPC mode.</p></div><button type="button" onClick={() => openInBrowser('https://github.com/can1357/oh-my-pi')} className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs"><ArrowSquareOut size={13}/>GitHub</button></div>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
        <div className="flex items-center gap-3">{running ? <CheckCircle size={22} className="text-green-500"/> : <Terminal size={22} className="text-[var(--text-muted)]"/>}<div><div className="font-medium">{running ? 'OMP RPC harness is running' : 'OMP RPC harness is stopped'}</div><div className="mt-1 text-xs text-[var(--text-muted)]">Allternit launches the upstream runtime as <code>omp --mode rpc --no-session</code>.</div></div></div>
        <div className="mt-5 flex gap-2"><button type="button" disabled={!miniApps || !!busy} onClick={() => void install()} className="flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm text-[var(--bg-primary)] disabled:opacity-50"><Download size={15}/>{busy === 'install' ? 'Installing…' : 'Install or update'}</button><button type="button" disabled={!miniApps || !!busy || running} onClick={() => void start()} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm disabled:opacity-50"><Terminal size={15}/>{busy === 'start' ? 'Starting…' : 'Start RPC harness'}</button></div>
        {!miniApps && <p className="mt-4 text-xs text-[var(--text-muted)]">Desktop controls unavailable. Install with <code>bun install -g @oh-my-pi/pi-coding-agent</code>, then run <code>omp</code>.</p>}
        {busy && <CircleNotch size={16} className="mt-4 animate-spin text-[var(--accent-primary)]"/>}{error && <p className="mt-4 text-xs text-red-500">{error}</p>}{logs.length > 0 && <pre className="mt-4 max-h-52 overflow-auto rounded-xl bg-black/80 p-3 text-[11px] leading-5 text-neutral-300">{logs.join('\n')}</pre>}
      </div>
    </div>
  </div>;
}
