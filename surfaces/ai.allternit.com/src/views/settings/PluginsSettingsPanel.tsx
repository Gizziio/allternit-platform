'use client';

import React, { useState } from 'react';
import { PuzzlePiece, ArrowsClockwise, CaretDown, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useFileSystem } from '../../plugins/fileSystem';
import { PanelHeader } from '@/components/settings/PanelHeader';
import { SettingsTable, SettingsTableCell } from '@/components/settings/SettingsTable';
import { SkeletonRow } from '@/components/settings/SkeletonRow';
import { EmptyState } from '@/components/settings/EmptyState';
import { Toggle } from '@/components/settings/Toggle';
import { QUIET_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { cn } from '@/lib/utils';

interface PluginsSettingsPanelProps {
  /** Navigate to the Allternit Plugins section (full capabilities manager). */
  onBrowse: () => void;
}

/**
 * Settings › Customize › Allternit Plugins — real installed plugin packages,
 * disk-scanned via the same filesystem scanner the capabilities manager uses.
 * Distinct from the built-in app feature toggles (Core/Advanced/Office
 * add-ins/Chrome companion), which live under Extensions instead.
 */
export function PluginsSettingsPanel({ onBrowse }: PluginsSettingsPanelProps): React.ReactNode {
  const { plugins, isLoading, error, refresh, toggleCapabilityEnabled } = useFileSystem();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isEnabled = (id: string, fallback: boolean) => overrides[id] ?? fallback;

  const handleToggle = async (id: string, next: boolean) => {
    setOverrides((prev) => ({ ...prev, [id]: next }));
    const result = await toggleCapabilityEnabled('plugin', id, next);
    if (!result.success) setOverrides((prev) => ({ ...prev, [id]: !next }));
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? plugins.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    : plugins;

  return (
    <div>
      <PanelHeader title="Allternit Plugins">
        {searchOpen ? (
          <span className="relative">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plugins"
              aria-label="Search plugins"
              className="w-[180px] pl-3 pr-7 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
            />
            <button type="button"
              onClick={() => { setSearchOpen(false); setQuery(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center bg-transparent border-none text-[var(--text-tertiary)] cursor-pointer p-0"
              aria-label="Close search"
            >
              <X size={12} weight="bold" />
            </button>
          </span>
        ) : (
          <button type="button"
            onClick={() => setSearchOpen(true)}
            className="size-8 flex items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-tertiary)] cursor-pointer hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Search plugins"
          >
            <MagnifyingGlass size={16} />
          </button>
        )}
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => void refresh()} disabled={isLoading}>
          <ArrowsClockwise size={14} className={cn(isLoading && 'animate-spin')} /> Refresh
        </button>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={onBrowse}>Browse</button>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={onBrowse}>Add <CaretDown size={12} /></button>
      </PanelHeader>

      {isLoading && plugins.length === 0 ? (
        <SkeletonRow lines={4} />
      ) : error ? (
        <EmptyState
          icon={<PuzzlePiece size={40} weight="thin" />}
          caption={error}
          ctaLabel="Retry"
          onCtaClick={() => void refresh()}
        />
      ) : plugins.length === 0 ? (
        <EmptyState
          icon={<PuzzlePiece size={40} weight="thin" />}
          caption="No plugins installed yet."
          ctaLabel="Browse plugins"
          onCtaClick={onBrowse}
        />
      ) : visible.length === 0 ? (
        <p className="text-[13px] text-[var(--text-tertiary)] py-6 text-center">No plugins match "{query}".</p>
      ) : (
        <SettingsTable columns={['Plugin', 'Last updated', 'Author', '']}>
          {visible.map((plugin) => (
            <tr key={plugin.id}>
              <SettingsTableCell>
                <span className="block font-medium">{plugin.name}</span>
                {plugin.description && (
                  <span className="block text-[12px] text-[var(--text-secondary)] truncate max-w-[320px]">{plugin.description}</span>
                )}
              </SettingsTableCell>
              <SettingsTableCell className="text-[var(--text-secondary)]">
                {plugin.updatedAt ? new Date(plugin.updatedAt).toLocaleDateString() : '—'}
              </SettingsTableCell>
              <SettingsTableCell className="text-[var(--text-secondary)]">{plugin.author || '—'}</SettingsTableCell>
              <SettingsTableCell className="text-right">
                <Toggle
                  value={isEnabled(plugin.id, plugin.enabled)}
                  onChange={(v) => void handleToggle(plugin.id, v)}
                  aria-label={`Toggle ${plugin.name}`}
                />
              </SettingsTableCell>
            </tr>
          ))}
        </SettingsTable>
      )}
    </div>
  );
}
