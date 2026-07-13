'use client';

import { ArrowSquareOut, ArrowsClockwise, CheckCircle, CircleNotch, Download, Terminal, Warning } from '@phosphor-icons/react';
import React, { useCallback, useEffect, useState } from 'react';
import { openInBrowser } from '@/lib/openInBrowser';

const HERMES_REPO = 'https://github.com/NousResearch/hermes-agent';
const HERMES_DOCS = 'https://hermes-agent.nousresearch.com/docs';
const HERMES_DASHBOARD = 'http://127.0.0.1:9119';

type RuntimeStatus = { managed: boolean; running: boolean; port: number | null };
type Phase = 'checking' | 'idle' | 'installing' | 'starting' | 'error';

export function HermesView() {
  const miniApps = typeof window !== 'undefined' ? window.allternit?.miniApps : undefined;
  const [status, setStatus] = useState<RuntimeStatus>({ managed: false, running: false, port: null });
  const [phase, setPhase] = useState<Phase>('checking');
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!miniApps) { setPhase('idle'); return; }
    setStatus(await miniApps.getStatus('hermes'));
    setPhase('idle');
  }, [miniApps]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => miniApps?.onProgress((event) => {
    if (event.id === 'hermes') setLogs((current) => [...current.slice(-80), event.line]);
  }), [miniApps]);

  const install = async () => {
    if (!miniApps) return;
    setPhase('installing'); setMessage(''); setLogs([]);
    const result = await miniApps.install('hermes');
    if (!result.success) { setPhase('error'); setMessage(result.error ?? 'Install failed'); return; }
    setPhase('idle');
  };

  const start = async () => {
    if (!miniApps) return;
    setPhase('starting'); setMessage('');
    const result = await miniApps.start('hermes');
    if (!result.success) { setPhase('error'); setMessage(result.error ?? 'Gateway failed to start'); return; }
    await refresh();
  };

  const launchDesktop = async () => {
    if (!miniApps) return;
    const result = await miniApps.launchDesktop('hermes');
    if (!result.success) { setPhase('error'); setMessage(result.error ?? 'Hermes Desktop failed to launch'); }
  };

  const busy = phase === 'checking' || phase === 'installing' || phase === 'starting';
  return (
    <div className="h-full overflow-auto bg-[var(--bg-primary)] p-8 text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-primary)]">Official upstream runtime</div>
            <h1 className="mt-2 text-2xl font-semibold">Hermes Agent</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Nous Research’s self-improving agent with persistent memory, skills, scheduled automation, subagents, and messaging gateways.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => openInBrowser(HERMES_DOCS)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs">Docs</button>
            <button type="button" onClick={() => openInBrowser(HERMES_REPO)} className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs"><ArrowSquareOut size={13}/>GitHub</button>
            <button type="button" onClick={() => void launchDesktop()} disabled={!miniApps} className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-xs text-[var(--bg-primary)] disabled:opacity-50"><ArrowSquareOut size={13}/>Launch Hermes Desktop</button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <div className="flex items-center gap-3">
            {status.running ? <CheckCircle size={22} className="text-green-500"/> : <Warning size={22} className="text-[var(--text-muted)]"/>}
            <div className="flex-1"><div className="font-medium">{status.running ? 'Official Hermes dashboard is running' : 'Hermes dashboard is not running'}</div><div className="mt-1 text-xs text-[var(--text-muted)]">Installed and managed from the official Nous Research distribution.</div></div>
            <button type="button" onClick={() => void refresh()} disabled={busy} title="Refresh status" className="rounded-lg p-2"><ArrowsClockwise size={15} className={phase === 'checking' ? 'animate-spin' : ''}/></button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => void install()} disabled={!miniApps || busy} className="flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm text-[var(--bg-primary)] disabled:opacity-50"><Download size={15}/>{phase === 'installing' ? 'Installing…' : 'Install or update'}</button>
            <button type="button" onClick={() => void start()} disabled={!miniApps || busy || status.running} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm disabled:opacity-50"><Terminal size={15}/>{phase === 'starting' ? 'Starting…' : 'Start official dashboard'}</button>
          </div>
          {!miniApps && <p className="mt-4 text-xs text-[var(--text-muted)]">Installation and gateway controls are available in Allternit Desktop. Official command: <code>hermes gateway setup</code>, then <code>hermes gateway start</code>.</p>}
          {message && <p className="mt-4 text-xs text-red-500">{message}</p>}
          {logs.length > 0 && <pre className="mt-4 max-h-52 overflow-auto rounded-xl bg-black/80 p-3 text-[11px] leading-5 text-neutral-300">{logs.join('\n')}</pre>}
          {busy && <CircleNotch size={16} className="mt-4 animate-spin text-[var(--accent-primary)]"/>}
        </div>
        {status.running && <div className="h-[720px] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"><iframe src={HERMES_DASHBOARD} title="Hermes official dashboard" className="size-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads" /></div>}
      </div>
    </div>
  );
}
