'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Folder, Plus, Warning, X } from '@phosphor-icons/react';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SkeletonRow } from '@/components/settings/SkeletonRow';
import { QUIET_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { cn } from '@/lib/utils';

interface CoworkPreferences {
  trusted_folders: string[];
  global_instructions: string;
}

async function coworkPreferencesRequest(init?: RequestInit): Promise<CoworkPreferences> {
  const res = await fetch('/api/v1/cowork-preferences', init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string; error?: string };
    throw new Error(err.message ?? err.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<CoworkPreferences>;
}

/**
 * Real backend-backed replacement for the "Coming soon" Trusted folders /
 * Global instructions rows — persisted via GET/PUT /api/v1/cowork-preferences
 * (user_cowork_preferences table), the same storage pattern as the Response
 * style panel's user_agent_preferences. Not yet consumed by Cowork run
 * execution itself (cowork.runtime.ts lives in a separate gizzi-code
 * service) — this stores the real, user-editable source of truth for when
 * that wiring lands, rather than faking local-only state.
 */
export function CoworkPreferencesPanel(): React.ReactNode {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trustedFolders, setTrustedFolders] = useState<string[]>([]);
  const [newFolder, setNewFolder] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);

  const [globalInstructions, setGlobalInstructions] = useState('');
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [instructionsSaving, setInstructionsSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await coworkPreferencesRequest();
      setTrustedFolders(data.trusted_folders ?? []);
      setGlobalInstructions(data.global_instructions ?? '');
      setInstructionsDraft(data.global_instructions ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Cowork preferences');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveFolders = useCallback(async (next: string[]) => {
    setFolderBusy(true);
    setError(null);
    try {
      const data = await coworkPreferencesRequest({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trusted_folders: next }),
      });
      setTrustedFolders(data.trusted_folders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trusted folders');
    } finally {
      setFolderBusy(false);
    }
  }, []);

  const addFolder = () => {
    const path = newFolder.trim();
    if (!path) return;
    if (trustedFolders.includes(path)) { setNewFolder(''); return; }
    setNewFolder('');
    void saveFolders([...trustedFolders, path]);
  };

  const removeFolder = (path: string) => {
    void saveFolders(trustedFolders.filter((f) => f !== path));
  };

  const saveInstructions = useCallback(async () => {
    setInstructionsSaving(true);
    setError(null);
    try {
      const data = await coworkPreferencesRequest({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ global_instructions: instructionsDraft }),
      });
      setGlobalInstructions(data.global_instructions ?? '');
      setInstructionsDraft(data.global_instructions ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save global instructions');
    } finally {
      setInstructionsSaving(false);
    }
  }, [instructionsDraft]);

  const instructionsDirty = instructionsDraft !== globalInstructions;

  if (loading) {
    return <SkeletonRow lines={4} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-solid border-[var(--status-error)]/40 bg-[var(--status-error)]/10 text-[12px] text-[var(--status-error)]">
          <Warning size={16} weight="fill" /> {error}
        </div>
      )}

      <SettingsCard
        title="Trusted folders"
        description="Folders Cowork agents may read and write."
      >
        <div className="flex flex-col gap-2">
          {trustedFolders.length === 0 && (
            <p className="text-[13px] text-[var(--text-tertiary)] py-1">No trusted folders yet — Cowork agents can't read or write local files until you add one.</p>
          )}
          {trustedFolders.map((folder) => (
            <div
              key={folder}
              className="flex items-center gap-2 py-2 border-t border-solid border-[var(--border-subtle)] first:border-t-0"
            >
              <Folder size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <span className="flex-1 min-w-0 text-[13px] font-mono text-[var(--text-primary)] truncate">{folder}</span>
              <button
                type="button"
                onClick={() => removeFolder(folder)}
                disabled={folderBusy}
                aria-label={`Remove ${folder}`}
                className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error)]/10 transition-colors disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 border-t border-solid border-[var(--border-subtle)]">
            <input
              type="text"
              value={newFolder}
              onChange={(event) => setNewFolder(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') addFolder(); }}
              placeholder="/Users/you/Projects/my-repo"
              aria-label="Add trusted folder"
              className="min-w-0 flex-1 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
            <button
              type="button"
              onClick={addFolder}
              disabled={folderBusy || !newFolder.trim()}
              className={cn(QUIET_BUTTON_CLASS, 'shrink-0')}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Global instructions"
        description="Instructions applied to every Cowork session."
        action={instructionsDirty && (
          <button
            type="button"
            onClick={() => void saveInstructions()}
            disabled={instructionsSaving}
            className={QUIET_BUTTON_CLASS}
          >
            {instructionsSaving ? 'Saving…' : 'Save'}
          </button>
        )}
      >
        <textarea
          value={instructionsDraft}
          onChange={(event) => setInstructionsDraft(event.target.value)}
          placeholder="e.g. Always run tests before committing. Prefer small, reviewable diffs."
          rows={4}
          aria-label="Global instructions"
          className="w-full resize-y rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] leading-relaxed outline-none focus:border-[var(--accent-primary)]"
        />
      </SettingsCard>
    </div>
  );
}
