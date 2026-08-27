'use client';

import { ArrowSquareOut, ArrowsClockwise, BookOpen, CheckCircle, CircleNotch, Warning } from '@phosphor-icons/react';
import React, { useCallback, useEffect, useState } from 'react';
import { openInBrowser } from '@/lib/openInBrowser';
import { MiniAppRuntimeSurface } from '@/views/aci/MiniAppRuntimeSurface';
import type { InstalledMiniApp } from '@/views/aci/mini-app.types';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/typography/Text';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

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
    <div className="h-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-8 pt-10 pb-12 gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <BookOpen size={22} className="text-[var(--accent-primary)] shrink-0" />
            <div>
              <Text variant="label" className="text-[10px] uppercase tracking-wide text-[var(--accent-primary)]">Knowledge vault</Text>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Vault Viewer</h1>
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
            {editingVaultName ? (
              <Input
                autoFocus
                defaultValue={obsidianVaultName}
                placeholder="Obsidian vault name"
                onBlur={(e) => { saveVaultName(e.target.value.trim()); setEditingVaultName(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-44 h-8 text-xs"
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => (obsidianVaultName ? openInObsidian() : setEditingVaultName(true))}
                onDoubleClick={() => setEditingVaultName(true)}
                disabled={!status.running}
                title={obsidianVaultName ? `Open in Obsidian (vault: ${obsidianVaultName})` : 'Set your Obsidian vault name first'}
              >
                <BookOpen size={13} />
                {obsidianVaultName ? 'Open in Obsidian' : 'Set Obsidian vault…'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => openInBrowser(VAULT_VIEWER_URL)}
              disabled={!status.running}
            >
              <ArrowSquareOut size={13} />
              Open in browser tab
            </Button>
            <Button
              size="sm"
              onClick={() => void openVault()}
              disabled={!miniApps || busy}
            >
              <ArrowSquareOut size={13} />
              {status.running ? 'Vault open' : phase === 'installing' ? 'Installing…' : phase === 'starting' ? 'Starting…' : 'Open Vault'}
            </Button>
          </div>
        </div>

        <Text variant="body" className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          Browse, search, and edit your Allternit knowledge vault — wikilinks, backlinks, graph view, and live
          editing, powered by a self-hosted, Obsidian-compatible editor pointed at your real vault files.
        </Text>

        {phase === 'checking' ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
            <Skeleton variant="rounded" width="100%" height={120} />
          </div>
        ) : !status.running ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-5">
            <div className="flex items-center gap-3">
              <Warning size={22} className="text-[var(--status-warning)]" />
              <div className="flex-1">
                <Text variant="body" className="font-medium text-[var(--text-primary)]">Vault Viewer is not running</Text>
                <Text variant="caption" className="text-[var(--text-tertiary)]">Click "Open Vault" to install (first run only) and start it.</Text>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void refresh()} disabled={busy} title="Refresh status">
                <ArrowsClockwise size={15} className={busy ? 'animate-spin' : ''} />
              </Button>
            </div>

            {!miniApps && (
              <Text variant="caption" className="text-[var(--text-tertiary)] block">
                Vault Viewer is available in Allternit Desktop.
              </Text>
            )}

            {message && (
              <div className="rounded-lg bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 p-3 text-xs text-[var(--status-error)]">
                {message}
              </div>
            )}

            {busy && <CircleNotch size={16} className="animate-spin text-[var(--accent-primary)]" />}
          </div>
        ) : null}

        {status.running && (
          <MiniAppRuntimeSurface app={VAULT_VIEWER_APP} title="Vault Viewer" className="min-h-[600px] flex-1 rounded-xl border border-[var(--border-subtle)]" />
        )}
      </div>
    </div>
  );
}
