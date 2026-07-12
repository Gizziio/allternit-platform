'use client';

import React, { useState } from 'react';
import { Sparkle, ArrowsClockwise, CaretDown, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useFileSystem } from '../../plugins/fileSystem';
import { PanelHeader } from '@/components/settings/PanelHeader';
import { SettingsTable, SettingsTableCell } from '@/components/settings/SettingsTable';
import { SkeletonRow } from '@/components/settings/SkeletonRow';
import { EmptyState } from '@/components/settings/EmptyState';
import { Toggle } from '@/components/settings/Toggle';
import { QUIET_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { cn } from '@/lib/utils';

interface SkillsSettingsPanelProps {
  /** Navigate to the Allternit Plugins section (full capabilities manager). */
  onBrowse: () => void;
}

/**
 * Settings › Customize › Skills — Claude-Desktop-style table of installed
 * skills, backed by the same filesystem scanner the capabilities manager uses.
 */
export function SkillsSettingsPanel({ onBrowse }: SkillsSettingsPanelProps): React.ReactNode {
  const { skills, isLoading, error, refresh, toggleCapabilityEnabled } = useFileSystem();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isEnabled = (id: string, fallback: boolean) => overrides[id] ?? fallback;

  const handleToggle = async (id: string, next: boolean) => {
    setOverrides((prev) => ({ ...prev, [id]: next }));
    const result = await toggleCapabilityEnabled('skill', id, next);
    if (!result.success) setOverrides((prev) => ({ ...prev, [id]: !next }));
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? skills.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    : skills;

  return (
    <div>
      <PanelHeader title="Skills">
        {searchOpen ? (
          <span className="relative">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills"
              aria-label="Search skills"
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
            aria-label="Search skills"
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

      {isLoading && skills.length === 0 ? (
        <SkeletonRow lines={4} />
      ) : error ? (
        <EmptyState
          icon={<Sparkle size={40} weight="thin" />}
          caption={error}
          ctaLabel="Retry"
          onCtaClick={() => void refresh()}
        />
      ) : skills.length === 0 ? (
        <EmptyState
          icon={<Sparkle size={40} weight="thin" />}
          caption="No skills installed yet."
          ctaLabel="Browse skills"
          onCtaClick={onBrowse}
        />
      ) : visible.length === 0 ? (
        <p className="text-[13px] text-[var(--text-tertiary)] py-6 text-center">No skills match “{query}”.</p>
      ) : (
        <SettingsTable columns={['Skill', 'Last updated', 'Author', '']}>
          {visible.map((skill) => (
            <tr key={skill.id}>
              <SettingsTableCell>
                <span className="block font-medium">{skill.name}</span>
                {skill.description && (
                  <span className="block text-[12px] text-[var(--text-secondary)] truncate max-w-[320px]">{skill.description}</span>
                )}
              </SettingsTableCell>
              <SettingsTableCell className="text-[var(--text-secondary)]">
                {skill.updatedAt ? new Date(skill.updatedAt).toLocaleDateString() : '—'}
              </SettingsTableCell>
              <SettingsTableCell className="text-[var(--text-secondary)]">{skill.author || '—'}</SettingsTableCell>
              <SettingsTableCell className="text-right">
                <Toggle
                  value={isEnabled(skill.id, skill.enabled)}
                  onChange={(v) => void handleToggle(skill.id, v)}
                  aria-label={`Toggle ${skill.name}`}
                />
              </SettingsTableCell>
            </tr>
          ))}
        </SettingsTable>
      )}
    </div>
  );
}
