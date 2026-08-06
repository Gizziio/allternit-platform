'use client';

import { ArrowSquareOut, ArrowsClockwise, BookOpen, CheckCircle, CircleNotch, Warning } from '@phosphor-icons/react';
import React, { useCallback, useEffect, useState } from 'react';
import { openInBrowser } from '@/lib/openInBrowser';
import { MiniAppRuntimeSurface } from '@/views/aci/MiniAppRuntimeSurface';
import type { InstalledMiniApp } from '@/views/aci/mini-app.types';

const VAULT_VIEWER_URL = 'http://127.0.0.1:8787';
const OBSIDIAN_VAULT_NAME_KEY = 'allternit:vault-viewer:obsidian-vault-name';

const VAULT_VIEWER_APP: InstalledMiniApp = {
  id: 'vault-viewer',
  name: 'Vault Viewer',
  description: 'Obsidian-compatible viewer/editor for your Allternit knowledge vault (vendored WebObsidian).',
  category: 'tool',
  source: 'builtin',
  url: VAULT_VIEWER_URL,
  status: 'offline',
  presentation: {
    mode: 'embedded',
    uiUrl: VAULT_VIEWER_URL,
    healthUrl: VAULT_VIEWER_URL,
    electronPartition: 'persist:allternit-vault-viewer',
    nativeRenderer: 'vault-viewer',
    fallback: 'external-browser',
  },
};

type RuntimeStatus = { managed: boolean; running: boolean; port: number | null };
type Phase = 'checking' | 'idle' | 'installing' | 'starting' | 'error';

export function VaultViewerView() {
  const miniApps = typeof window !== 'undefined' ? window.allternit?.miniApps : undefined;
  const [status, setStatus] = useState<RuntimeStatus>({ managed: false, running: false, port: null });
  const [phase, setPhase] = useState<Phase>('checking');
  const [message, setMessage] = useState('');
  const [obsidianVaultName, setObsidianVaultName] = useState('');
  const [editingVaultName, setEditingVaultName] = useState(false);

  useEffect(() => {
    setObsidianVaultName(typeof window !== 'undefined' ? window.localStorage.getItem(OBSIDIAN_VAULT_NAME_KEY) || '' : '');
  }, []);

  const refresh = useCallback(async () => {
    if (!miniApps) { setPhase('idle'); return; }
    setStatus(await miniApps.getStatus('vault-viewer'));
    setPhase('idle');
  }, [miniApps]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openVault = async () => {
    if (!miniApps) return;
    setMessage('');
    let nextStatus = await miniApps.getStatus('vault-viewer');
    if (!nextStatus.running) {
      setPhase('starting');
      let result = await miniApps.start('vault-viewer');
      if (!result.success) {
        setPhase('installing');
        const installed = await miniApps.install('vault-viewer');
        if (!installed.success) {
          setPhase('error');
          setMessage(installed.error ?? 'Vault Viewer installation failed');
          return;
        }
        setPhase('starting');
        result = await miniApps.start('vault-viewer');
        if (!result.success) {
          setPhase('error');
          setMessage(result.error ?? 'Vault Viewer failed to start');
          return;
        }
      }
      nextStatus = await miniApps.getStatus('vault-viewer');
    }
    setStatus(nextStatus);
    setPhase('idle');
  };

  const saveVaultName = (value: string) => {
    setObsidianVaultName(value);
    if (typeof window !== 'undefined') window.localStorage.setItem(OBSIDIAN_VAULT_NAME_KEY, value);
  };

  const openInObsidian = () => {
    if (!obsidianVaultName || typeof window === 'undefined') return;
    void window.allternit?.shell?.openExternal(`obsidian://open?vault=${encodeURIComponent(obsidianVaultName)}`);
  };

  const busy = phase === 'checking' || phase === 'installing' || phase === 'starting';

  return (
    <div className="h-full overflow-auto bg-[var(--bg-primary)] p-8 text-[var(--text-primary)]">
      <div className="mx-auto flex h-full max-w-6xl flex-col space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-primary)]">Knowledge vault</div>
            <h1 className="mt-2 text-2xl font-semibold">Vault Viewer</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Browse, search, and edit your Allternit knowledge vault — wikilinks, backlinks, graph view, and live
              editing, powered by a self-hosted, Obsidian-compatible editor pointed at your real vault files.
            </p>
          </div>
          <div className="flex gap-2">
            {editingVaultName ? (
              <input
                autoFocus
                defaultValue={obsidianVaultName}
                placeholder="Obsidian vault name"
                onBlur={(e) => { saveVaultName(e.target.value.trim()); setEditingVaultName(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-xs"
              />
            ) : (
              <button
                type="button"
                onClick={() => (obsidianVaultName ? openInObsidian() : setEditingVaultName(true))}
                onDoubleClick={() => setEditingVaultName(true)}
                disabled={!status.running}
                title={obsidianVaultName ? `Open in Obsidian (vault: ${obsidianVaultName})` : 'Set your Obsidian vault name first'}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs disabled:opacity-50"
              >
                <BookOpen size={13} />
                {obsidianVaultName ? 'Open in Obsidian' : 'Set Obsidian vault…'}
              </button>
            )}
            <button
              type="button"
              onClick={() => openInBrowser(VAULT_VIEWER_URL)}
              disabled={!status.running}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs disabled:opacity-50"
            >
              <ArrowSquareOut size={13} />
              Open in browser tab
            </button>
            <button
              type="button"
              onClick={() => void openVault()}
              disabled={!miniApps || busy}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-xs text-[var(--bg-primary)] disabled:opacity-50"
            >
              <ArrowSquareOut size={13} />
              {status.running ? 'Vault open' : phase === 'installing' ? 'Installing…' : phase === 'starting' ? 'Starting…' : 'Open Vault'}
            </button>
          </div>
        </div>

        {!status.running && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
            <div className="flex items-center gap-3">
              {status.running ? <CheckCircle size={22} className="text-green-500" /> : <Warning size={22} className="text-[var(--text-muted)]" />}
              <div className="flex-1">
                <div className="font-medium">Vault Viewer is not running</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">Click "Open Vault" to install (first run only) and start it.</div>
              </div>
              <button type="button" onClick={() => void refresh()} disabled={busy} title="Refresh status" className="rounded-lg p-2">
                <ArrowsClockwise size={15} className={phase === 'checking' ? 'animate-spin' : ''} />
              </button>
            </div>
            {!miniApps && <p className="mt-4 text-xs text-[var(--text-muted)]">Vault Viewer is available in Allternit Desktop.</p>}
            {message && <p className="mt-4 text-xs text-red-500">{message}</p>}
            {busy && <CircleNotch size={16} className="mt-4 animate-spin text-[var(--accent-primary)]" />}
          </div>
        )}

        {status.running && (
          <MiniAppRuntimeSurface app={VAULT_VIEWER_APP} title="Vault Viewer" className="min-h-[600px] flex-1 rounded-2xl border border-[var(--border-subtle)]" />
        )}
      </div>
    </div>
  );
}
