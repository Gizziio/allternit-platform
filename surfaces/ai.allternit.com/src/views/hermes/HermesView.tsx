'use client';

import { ArrowSquareOut, ArrowsClockwise, CheckCircle, CircleNotch, Download, Terminal, Warning } from '@phosphor-icons/react';
import React, { useCallback, useEffect, useState } from 'react';
import { openInBrowser } from '@/lib/openInBrowser';
import { MiniAppRuntimeSurface } from '@/views/aci/MiniAppRuntimeSurface';
import type { InstalledMiniApp } from '@/views/aci/mini-app.types';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/typography/Text';
import { Skeleton } from '@/components/ui/skeleton';

const HERMES_REPO = 'https://github.com/NousResearch/hermes-agent';
const HERMES_DOCS = 'https://hermes-agent.nousresearch.com/docs';
const HERMES_DASHBOARD = 'http://127.0.0.1:9119';
const HERMES_APP: InstalledMiniApp = {
  id: 'hermes', name: 'Hermes', description: 'Nous Research self-improving agent and messaging gateway.',
  category: 'connector', source: 'builtin', url: HERMES_DASHBOARD, status: 'offline',
  presentation: { mode: 'hybrid', uiUrl: HERMES_DASHBOARD, healthUrl: HERMES_DASHBOARD, electronPartition: 'persist:allternit-hermes', nativeRenderer: 'hermes', fallback: 'external-browser' },
};

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

  const setupAndOpen = async () => {
    if (!miniApps) return;
    setMessage('');
    let nextStatus = await miniApps.getStatus('hermes');
    if (!nextStatus.running) {
      setPhase('starting');
      let result = await miniApps.start('hermes');
      if (!result.success) {
        setPhase('installing');
        const installed = await miniApps.install('hermes');
        if (!installed.success) {
          setPhase('error');
          setMessage(installed.error ?? 'Hermes installation failed');
          return;
        }
        setPhase('starting');
        result = await miniApps.start('hermes');
        if (!result.success) {
          setPhase('error');
          setMessage(result.error ?? 'Hermes dashboard failed to start');
          return;
        }
      }
      nextStatus = await miniApps.getStatus('hermes');
    }
    setStatus(nextStatus);
    setPhase('idle');
  };

  const busy = phase === 'checking' || phase === 'installing' || phase === 'starting';

  return (
    <div className="h-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl px-8 pt-10 pb-12 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Terminal size={22} className="text-[var(--accent-primary)] shrink-0" />
            <div>
              <Text variant="label" className="text-[10px] uppercase tracking-wide text-[var(--accent-primary)]">Official upstream runtime</Text>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Hermes Agent</h1>
            </div>
            <Pill
              size="sm"
              icon={status.running
                ? <CheckCircle size={11} className="text-[var(--status-success)]" />
                : <Warning size={11} className="text-[var(--status-warning)]" />}
              className={status.running
                ? 'border-[var(--status-success)]/30 bg-[var(--status-success)]/10 text-[var(--status-success)]'
                : 'border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 text-[var(--status-warning)]'}
            >
              {status.running ? 'Running' : 'Offline'}
            </Pill>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openInBrowser(HERMES_DOCS)}>Docs</Button>
            <Button variant="outline" size="sm" onClick={() => openInBrowser(HERMES_REPO)}>
              <ArrowSquareOut size={13} />
              GitHub
            </Button>
            <Button size="sm" onClick={() => void setupAndOpen()} disabled={!miniApps || busy}>
              <ArrowSquareOut size={13} />
              {status.running ? 'Open embedded dashboard' : 'Set up embedded dashboard'}
            </Button>
          </div>
        </div>

        <Text variant="body" className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          Nous Research’s self-improving agent with persistent memory, skills, scheduled automation, subagents, and messaging gateways.
        </Text>

        {phase === 'checking' ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
            <Skeleton variant="rounded" width="100%" height={120} />
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-5">
            <div className="flex items-center gap-3">
              {status.running
                ? <CheckCircle size={22} className="text-[var(--status-success)]" />
                : <Warning size={22} className="text-[var(--status-warning)]" />}
              <div className="flex-1">
                <Text variant="body" className="font-medium text-[var(--text-primary)]">
                  {status.running ? 'Official Hermes dashboard is running' : 'Hermes dashboard is not running'}
                </Text>
                <Text variant="caption" className="text-[var(--text-tertiary)]">
                  Installed and managed from the official Nous Research distribution.
                </Text>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void refresh()} disabled={busy} title="Refresh status">
                <ArrowsClockwise size={15} className={busy ? 'animate-spin' : ''} />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void install()} disabled={!miniApps || busy}>
                <Download size={15} />
                {phase === 'installing' ? 'Installing…' : 'Install or update'}
              </Button>
              <Button variant="outline" onClick={() => void start()} disabled={!miniApps || busy || status.running}>
                <Terminal size={15} />
                {phase === 'starting' ? 'Starting…' : 'Start official dashboard'}
              </Button>
            </div>

            {!miniApps && (
              <Text variant="caption" className="text-[var(--text-tertiary)] block">
                Installation and gateway controls are available in Allternit Desktop. Official command: <code>hermes gateway setup</code>, then <code>hermes gateway start</code>.
              </Text>
            )}

            {message && (
              <div className="rounded-lg bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 p-3 text-xs text-[var(--status-error)]">
                {message}
              </div>
            )}

            {logs.length > 0 && (
              <pre className="max-h-52 overflow-auto rounded-xl bg-black/80 p-3 text-[11px] leading-5 text-neutral-300">
                {logs.join('\n')}
              </pre>
            )}

            {busy && <CircleNotch size={16} className="animate-spin text-[var(--accent-primary)]" />}
          </div>
        )}

        {status.running && (
          <MiniAppRuntimeSurface app={HERMES_APP} title="Hermes official dashboard" className="h-[720px] rounded-xl border border-[var(--border-subtle)]" />
        )}
      </div>
    </div>
  );
}
