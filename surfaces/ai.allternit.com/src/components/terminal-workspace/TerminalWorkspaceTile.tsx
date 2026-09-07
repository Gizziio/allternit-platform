"use client";

/**
 * Per-tile terminal surface for the global terminal workspace.
 *
 * Owns the PTY lifecycle for one workspace tile: reattaches to the remote
 * session persisted per tile id (probing liveness first), or creates a fresh
 * one lazily on mount. The remote session id is registered with the
 * terminal-workspace store so `removeTile` can dispose the PTY without this
 * component. A catalogue tile's `spawnCommand` is typed into the shell once
 * per remote session after it connects.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, Warning } from '@phosphor-icons/react';
import { TerminalSurface } from '@/components/workspace/UnifiedTerminal';
import {
  closeTerminalSession,
  createTerminalSession,
  probeTerminalSession,
  sendTerminalInput,
} from '@/lib/terminal-api';
import { useTerminalWorkspaceStore, type TerminalTile } from '@/stores/terminal-workspace.store';

export type WorkspaceTileStatus = 'connecting' | 'connected' | 'error';

const TILE_PERSIST_PREFIX = 'allternit.terminal.workspace.tile.v1';

function readTileRemoteSession(tileId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(`${TILE_PERSIST_PREFIX}:${tileId}`);
  } catch {
    return null;
  }
}

function writeTileRemoteSession(tileId: string, remoteSessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${TILE_PERSIST_PREFIX}:${tileId}`, remoteSessionId);
  } catch {
    // Persistence is best-effort.
  }
}

function clearTileRemoteSession(tileId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${TILE_PERSIST_PREFIX}:${tileId}`);
  } catch {
    // Ignore.
  }
}

export function TerminalWorkspaceSurface({
  tile,
  isActive,
  onStatusChange,
}: {
  tile: TerminalTile;
  isActive: boolean;
  onStatusChange: (status: WorkspaceTileStatus, errorMsg?: string) => void;
}): React.ReactNode {
  const [remoteSessionId, setRemoteSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const registerTileSession = useTerminalWorkspaceStore((s) => s.registerTileSession);
  const unregisterTileSession = useTerminalWorkspaceStore((s) => s.unregisterTileSession);
  const injectedForRef = useRef<string | null>(null);

  // Create or reattach the remote PTY for this tile.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setError(null);

      // Reattach to the session the mux kept alive across a remount/reload.
      // Dead ids (backend restarted) degrade to a fresh shell.
      const persisted = readTileRemoteSession(tile.id);
      if (persisted && (await probeTerminalSession(persisted))) {
        if (!cancelled) setRemoteSessionId(persisted);
        return;
      }
      if (persisted) clearTileRemoteSession(tile.id);

      try {
        const created = await createTerminalSession({ cwd: tile.cwd });
        if (cancelled) {
          void closeTerminalSession(created);
          return;
        }
        writeTileRemoteSession(tile.id, created);
        setRemoteSessionId(created);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Terminal service unavailable');
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [tile.id, tile.cwd, attempt]);

  // Let the store dispose this PTY when the tile is removed.
  useEffect(() => {
    if (!remoteSessionId) return;
    registerTileSession(tile.id, remoteSessionId);
    return () => unregisterTileSession(tile.id);
  }, [tile.id, remoteSessionId, registerTileSession, unregisterTileSession]);

  const handleStatusChange = useCallback(
    (status: 'connecting' | 'connected' | 'error', errorMsg?: string) => {
      onStatusChange(status, errorMsg);
      if (
        status !== 'connected' ||
        !remoteSessionId ||
        !tile.spawnCommand ||
        injectedForRef.current === remoteSessionId
      ) {
        return;
      }
      injectedForRef.current = remoteSessionId;
      const target = remoteSessionId;
      const command = tile.spawnCommand;
      // Give the shell a beat to finish its rc startup before typing the command.
      setTimeout(() => {
        void sendTerminalInput(target, `${command}\n`).catch(() => {
          // The tile shows stream errors; a failed injection is non-fatal.
        });
      }, 250);
    },
    [remoteSessionId, tile.spawnCommand, onStatusChange],
  );

  if (error) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: 16,
          color: 'var(--status-error)',
          background: 'var(--surface-panel)',
        }}
      >
        <Warning size={18} />
        <span style={{ fontSize: 12, textAlign: 'center', color: 'var(--text-secondary)' }}>{error}</span>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 12px',
            borderRadius: 999,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-hover)',
            color: 'var(--text-secondary)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          <ArrowsClockwise size={12} />
          Retry
        </button>
      </div>
    );
  }

  if (!remoteSessionId) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          color: 'var(--text-tertiary)',
          fontSize: 12,
          background: 'var(--surface-panel)',
        }}
      >
        Starting terminal…
      </div>
    );
  }

  return (
    <TerminalSurface
      remoteSessionId={remoteSessionId}
      isActive={isActive}
      onStatusChange={handleStatusChange}
    />
  );
}
