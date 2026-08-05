'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Database, ArrowsClockwise, Key } from '@phosphor-icons/react';
import { PanelHeader } from '@/components/settings/PanelHeader';
import { SettingsTable, SettingsTableCell } from '@/components/settings/SettingsTable';
import { SkeletonRow } from '@/components/settings/SkeletonRow';
import { EmptyState } from '@/components/settings/EmptyState';
import { Toggle } from '@/components/settings/Toggle';
import { QUIET_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { cn } from '@/lib/utils';
import {
  listVaultSources,
  setVaultSourceEnabled,
  setVaultSourceApiKey,
  syncVaultSource,
  type VaultSource,
} from '@/lib/vault-api';

// Sources that authenticate with a self-serve personal token pasted directly
// here (no OAuth app needed) — see vault/connectors/sidecar.ts for exactly
// where to generate each one. Gmail/Calendar use `gizzi vault config auth/login`
// instead (a real OAuth flow, out of scope for a text input); GitHub is
// already connected via the local `gh` CLI with nothing to configure here.
const TOKEN_SOURCES: Record<string, string> = {
  notion: 'notion.so/my-integrations → Internal Integration Secret',
  linear: 'Linear Settings → Account → Security & Access → Personal API Key',
};

function statusLabel(source: VaultSource): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  if (source.connected) return { text: 'Connected', tone: 'ok' };
  if (source.error) return { text: source.error, tone: 'warn' };
  if (!source.enabled) return { text: 'Disabled', tone: 'muted' };
  return { text: 'Not connected', tone: 'muted' };
}

/**
 * Settings › Customize › Lens Context — manage the persistent context
 * sources gizzi-code's Vault syncs on a cron schedule and serves to
 * connected AI tools via the Lens MCP server (`gizzi vault mcp-server`).
 * See docs/LENS_CONTEXT_LAYER_PLAN.md.
 */
export function LensSettingsPanel(): React.ReactNode {
  const [sources, setSources] = useState<VaultSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, string>>({});
  const [syncNote, setSyncNote] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSources(await listVaultSources());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load context sources');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = async (id: string, next: boolean) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: next } : s)));
    try {
      await setVaultSourceEnabled(id, next);
    } catch {
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !next } : s)));
    }
  };

  const handleSaveToken = async (id: string) => {
    const value = (tokenDrafts[id] || '').trim();
    if (!value) return;
    setBusy(id);
    try {
      await setVaultSourceApiKey(id, value);
      await setVaultSourceEnabled(id, true);
      setTokenDrafts((prev) => ({ ...prev, [id]: '' }));
      await refresh();
    } catch (e) {
      setSyncNote((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : 'Failed to save token' }));
    } finally {
      setBusy(null);
    }
  };

  const handleSyncNow = async (id: string) => {
    setBusy(id);
    setSyncNote((prev) => ({ ...prev, [id]: '' }));
    try {
      const result = await syncVaultSource(id);
      setSyncNote((prev) => ({
        ...prev,
        [id]: result.success ? `Synced ${result.itemsSynced} item(s)` : result.errors.join('; '),
      }));
      await refresh();
    } catch (e) {
      setSyncNote((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : 'Sync failed' }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PanelHeader title="Lens Context">
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => void refresh()} disabled={isLoading}>
          <ArrowsClockwise size={14} className={cn(isLoading && 'animate-spin')} /> Refresh
        </button>
      </PanelHeader>

      <p className="text-[13px] text-[var(--text-secondary)] mb-4 max-w-[560px]">
        Lens continuously syncs connected sources into your local knowledge vault and serves it to
        AI tools via MCP — separate from the Connectors page, which is for one-off tool actions.
      </p>

      {isLoading && sources.length === 0 ? (
        <SkeletonRow lines={4} />
      ) : error ? (
        <EmptyState icon={<Database size={40} weight="thin" />} caption={error} ctaLabel="Retry" onCtaClick={() => void refresh()} />
      ) : (
        <SettingsTable columns={['Source', 'Status', '', '']}>
          {sources.map((source) => {
            const status = statusLabel(source);
            const tokenHint = TOKEN_SOURCES[source.id];
            return (
              <tr key={source.id}>
                <SettingsTableCell>
                  <span className="block font-medium">{source.name}</span>
                  <span className="block text-[12px] text-[var(--text-secondary)] truncate max-w-[320px]">
                    {source.description}
                  </span>
                  {tokenHint && !source.connected && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <Key size={12} className="text-[var(--text-tertiary)] shrink-0" />
                      <input
                        type="password"
                        value={tokenDrafts[source.id] || ''}
                        onChange={(e) => setTokenDrafts((prev) => ({ ...prev, [source.id]: e.target.value }))}
                        placeholder={tokenHint}
                        aria-label={`${source.name} token`}
                        className="flex-1 min-w-0 px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
                      />
                      <button
                        type="button"
                        className={QUIET_BUTTON_CLASS}
                        disabled={busy === source.id || !(tokenDrafts[source.id] || '').trim()}
                        onClick={() => void handleSaveToken(source.id)}
                      >
                        Save
                      </button>
                    </div>
                  )}
                  {syncNote[source.id] && (
                    <span className="block text-[12px] text-[var(--text-tertiary)] mt-1">{syncNote[source.id]}</span>
                  )}
                </SettingsTableCell>
                <SettingsTableCell>
                  <span
                    className={cn(
                      'text-[12px]',
                      status.tone === 'ok' && 'text-[var(--accent-success,#3ba55d)]',
                      status.tone === 'warn' && 'text-[var(--accent-danger,#e5484d)]',
                      status.tone === 'muted' && 'text-[var(--text-tertiary)]',
                    )}
                  >
                    {status.text}
                  </span>
                </SettingsTableCell>
                <SettingsTableCell className="text-right">
                  <button
                    type="button"
                    className={QUIET_BUTTON_CLASS}
                    disabled={busy === source.id || !source.enabled}
                    onClick={() => void handleSyncNow(source.id)}
                  >
                    Sync now
                  </button>
                </SettingsTableCell>
                <SettingsTableCell className="text-right">
                  <Toggle
                    value={source.enabled}
                    onChange={(v) => void handleToggle(source.id, v)}
                    aria-label={`Toggle ${source.name}`}
                  />
                </SettingsTableCell>
              </tr>
            );
          })}
        </SettingsTable>
      )}
    </div>
  );
}
