"use client";

/**
 * Workspace session catalogue modal.
 *
 * A trimmed port of main's NativeSessionPicker (commit 441ed7495) for the
 * terminal workspace: same searchable harness-filtered catalogue, but instead
 * of picking a session up into a chat/code surface, the chosen session is
 * launched as a terminal tile via its harness resume command.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, MagnifyingGlass, Terminal as TerminalIcon } from '@phosphor-icons/react';
import { Modal, ModalBody, ModalHeader } from '@/components/ui/Modal';
import {
  nativeSessionsApi,
  type NativeCatalogSession,
  type NativeHarnessInfo,
} from '@/lib/agents/native-sessions-api';

/**
 * Splice a catalogued session id into a harness adapter's resume hint
 * (e.g. `claude --resume <id>`). Hints without a placeholder launch the CLI's
 * most recent session interactively. Returns null when no command exists.
 */
function deriveSpawnCommand(resumeHint: string | undefined, sessionId: string): string | null {
  const hint = resumeHint?.trim();
  if (!hint) return null;
  if (hint.includes('<id>')) return hint.replace(/<id>/g, sessionId);
  return hint;
}

export interface WorkspaceCatalogPick {
  harness: NativeHarnessInfo;
  session: NativeCatalogSession;
  /** Shell command that resumes/launches the harness CLI, or null if unknown. */
  spawnCommand: string | null;
  /** Working directory for the new tile. */
  cwd?: string;
  /** Tile label, e.g. "Claude Code · my session". */
  label: string;
}

function formatWhen(ts: number): string {
  if (!ts) return '';
  const date = new Date(ts > 1e12 ? ts : ts * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function WorkspaceSessionCatalog({
  isOpen,
  onClose,
  onPick,
}: {
  isOpen: boolean;
  onClose: () => void;
  onPick: (pick: WorkspaceCatalogPick) => void;
}): React.ReactNode {
  const [harnesses, setHarnesses] = useState<NativeHarnessInfo[]>([]);
  const [sessions, setSessions] = useState<NativeCatalogSession[]>([]);
  const [harness, setHarness] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, s] = await Promise.all([
        nativeSessionsApi.listHarnesses(),
        nativeSessionsApi.list(harness === 'all' ? {} : { harness }),
      ]);
      setHarnesses(h);
      setSessions(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [harness]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions.slice(0, 200);
    return sessions
      .filter((s) =>
        [s.harness, s.sessionId, s.title, s.cwd, s.path]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 200);
  }, [query, sessions]);

  const handlePick = (session: NativeCatalogSession) => {
    const harnessInfo =
      harnesses.find((h) => h.id === session.harness) ?? null;
    if (!harnessInfo) return;
    onPick({
      harness: harnessInfo,
      session,
      spawnCommand: deriveSpawnCommand(harnessInfo.resumeHint, session.sessionId),
      cwd: session.cwd || harnessInfo.home || undefined,
      label: `${harnessInfo.label} · ${session.title?.trim() || session.sessionId}`,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <ModalHeader title="Launch from catalogue" onClose={onClose} />
      <ModalBody className="">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 320 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-panel)',
              color: 'var(--text-primary)',
            }}
          >
            <MagnifyingGlass size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search native CLI sessions…"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <CatalogChip active={harness === 'all'} onClick={() => setHarness('all')} label="All" />
            {harnesses.map((h) => (
              <CatalogChip
                key={h.id}
                active={harness === h.id}
                onClick={() => setHarness(h.id)}
                label={h.label}
              />
            ))}
          </div>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: 'var(--status-error-bg)',
                color: 'var(--status-error)',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {loading ? (
              <CatalogNote>Loading catalogue…</CatalogNote>
            ) : filtered.length === 0 ? (
              <CatalogNote>No native CLI sessions found.</CatalogNote>
            ) : (
              filtered.map((s) => {
                const h = harnesses.find((hh) => hh.id === s.harness);
                return (
                  <button
                    key={`${s.harness}:${s.sessionId}`}
                    type="button"
                    onClick={() => handlePick(s)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-panel)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--surface-panel)';
                    }}
                  >
                    <TerminalIcon size={14} style={{ color: 'var(--accent-code)', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.title?.trim() || s.sessionId}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-tertiary)',
                          fontFamily: 'var(--font-mono)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {[h?.label ?? s.harness, s.cwd, formatWhen(s.updatedAt)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <ArrowRight size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

function CatalogChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}): React.ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '3px 10px',
        borderRadius: 999,
        border: '1px solid var(--border-subtle)',
        background: active ? 'var(--surface-active)' : 'var(--surface-panel)',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
    >
      {label}
    </button>
  );
}

function CatalogNote({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-tertiary)',
        fontSize: 12,
      }}
    >
      {children}
    </div>
  );
}
