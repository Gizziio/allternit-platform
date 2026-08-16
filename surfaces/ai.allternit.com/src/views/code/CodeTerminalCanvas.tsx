"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal as TerminalIcon, X, Plus, PushPin } from '@phosphor-icons/react';
import { TerminalSurface } from '@/components/workspace/UnifiedTerminal';
import {
  createTerminalSession,
  closeTerminalSession,
  probeTerminalSession,
} from '@/lib/terminal-api';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CodeTerminalCanvas');

interface TerminalContext {
  repoName?: string;
  branch?: string;
  shortSha?: string;
}

type TerminalTileStatus = 'connecting' | 'connected' | 'error';

interface TerminalTile {
  id: string;
  remoteSessionId: string;
  name: string;
  status: TerminalTileStatus;
  errorMsg: string;
}

export interface CodeTerminalCanvasProps {
  /** Whether the terminal canvas is visible. */
  isOpen: boolean;
  /** Toggle canvas visibility. */
  onToggle: () => void;
  /** Namespace used for persisting the canvas tile set. */
  sessionId?: string;
  /** Working directory passed to new shells. */
  workingDir?: string;
  /** Optional repo/branch/sha metadata shown in the terminal chrome. */
  terminalContext?: TerminalContext;
}

interface PersistedTerminalCanvasState {
  tiles: TerminalTile[];
}

const CANVAS_PERSIST_KEY = 'allternit.code.terminal.canvas.v1';
const MAX_TILES = 8;

function generateTileId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function readPersistedCanvasState(sessionId: string): PersistedTerminalCanvasState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${CANVAS_PERSIST_KEY}:${sessionId}`);
    return raw ? (JSON.parse(raw) as PersistedTerminalCanvasState) : null;
  } catch {
    return null;
  }
}

function writePersistedCanvasState(sessionId: string, state: PersistedTerminalCanvasState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${CANVAS_PERSIST_KEY}:${sessionId}`, JSON.stringify(state));
  } catch {
    // Persistence is best-effort.
  }
}

function deletePersistedCanvasState(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${CANVAS_PERSIST_KEY}:${sessionId}`);
  } catch {
    // Ignore.
  }
}

/**
 * Malleable terminal canvas for Code mode.
 *
 * - Shows multiple terminal sessions as a responsive grid of live tiles.
 * - Hovering (or clicking) a tile pops it into a focused overlay for interaction.
 * - New sessions can be spawned and individual sessions can be closed.
 * - Built on top of the shared terminal backend (terminal-api + TerminalSurface)
 *   so sessions survive canvas toggles and page reloads.
 */
export function CodeTerminalCanvas({
  isOpen,
  onToggle,
  sessionId = 'code-canvas-terminals',
  workingDir,
  terminalContext,
}: CodeTerminalCanvasProps): React.ReactNode {
  const [tiles, setTiles] = useState<TerminalTile[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayTileId, setOverlayTileId] = useState<string | null>(null);
  const [overlayPinned, setOverlayPinned] = useState(false);
  const overlayHoveredRef = useRef(false);
  const tileHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tilesRef = useRef<TerminalTile[]>([]);
  tilesRef.current = tiles;

  // Restore persisted tiles on mount and create a first session when empty.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const init = async () => {
      setIsInitializing(true);
      setError(null);

      const persisted = readPersistedCanvasState(sessionId);
      if (persisted?.tiles.length) {
        const liveTiles: TerminalTile[] = [];
        for (const tile of persisted.tiles) {
          const alive = await probeTerminalSession(tile.remoteSessionId);
          if (alive) {
            liveTiles.push({ ...tile, status: 'connecting', errorMsg: '' });
          } else {
            try {
              const remoteSessionId = await createTerminalSession({ cwd: workingDir });
              liveTiles.push({ ...tile, remoteSessionId, status: 'connecting', errorMsg: '' });
            } catch (err) {
              logger.warn({ err, tile }, 'Failed to recreate terminal tile');
            }
          }
        }
        if (!cancelled) {
          setTiles(liveTiles);
          setIsInitializing(false);
          return;
        }
      }

      try {
        const remoteSessionId = await createTerminalSession({ cwd: workingDir });
        if (cancelled) {
          void closeTerminalSession(remoteSessionId);
          return;
        }
        setTiles([
          {
            id: generateTileId(),
            remoteSessionId,
            name: 'Terminal 1',
            status: 'connecting',
            errorMsg: '',
          },
        ]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Terminal service unavailable');
        }
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [isOpen, sessionId, workingDir]);

  // Persist tiles whenever they change so reloads/canvas toggles restore them.
  useEffect(() => {
    if (isInitializing) return;
    if (tiles.length > 0) {
      writePersistedCanvasState(sessionId, { tiles });
    } else {
      deletePersistedCanvasState(sessionId);
    }
  }, [tiles, isInitializing, sessionId]);

  const handleStatusChange = useCallback((tileId: string, status: TerminalTileStatus, errorMsg?: string) => {
    setTiles((prev) =>
      prev.map((tile) =>
        tile.id === tileId ? { ...tile, status, errorMsg: errorMsg || '' } : tile,
      ),
    );
  }, []);

  const handleCreateTile = useCallback(async () => {
    if (tiles.length >= MAX_TILES) return;
    setIsLoading(true);
    setError(null);
    try {
      const remoteSessionId = await createTerminalSession({ cwd: workingDir });
      const nextNumber = tiles.length + 1;
      setTiles((prev) => [
        ...prev,
        {
          id: generateTileId(),
          remoteSessionId,
          name: `Terminal ${nextNumber}`,
          status: 'connecting',
          errorMsg: '',
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create terminal');
    } finally {
      setIsLoading(false);
    }
  }, [tiles.length, workingDir]);

  const clearTimers = useCallback(() => {
    if (tileHoverTimerRef.current) {
      clearTimeout(tileHoverTimerRef.current);
      tileHoverTimerRef.current = null;
    }
    if (overlayCloseTimerRef.current) {
      clearTimeout(overlayCloseTimerRef.current);
      overlayCloseTimerRef.current = null;
    }
  }, []);

  const openOverlay = useCallback((tileId: string, pin = false) => {
    clearTimers();
    setOverlayTileId(tileId);
    setOverlayOpen(true);
    if (pin) setOverlayPinned(true);
  }, [clearTimers]);

  const closeOverlay = useCallback(() => {
    clearTimers();
    setOverlayOpen(false);
    setOverlayPinned(false);
    setOverlayTileId(null);
    overlayHoveredRef.current = false;
  }, [clearTimers]);

  const handleCloseTile = useCallback((tileId: string) => {
    const target = tilesRef.current.find((t) => t.id === tileId);
    if (target) void closeTerminalSession(target.remoteSessionId);
    setTiles((prev) => prev.filter((t) => t.id !== tileId));
    if (overlayTileId === tileId) {
      closeOverlay();
    }
  }, [overlayTileId, closeOverlay]);

  const handleTileMouseEnter = useCallback(
    (tileId: string) => {
      if (overlayPinned) return;
      clearTimers();
      tileHoverTimerRef.current = setTimeout(() => {
        openOverlay(tileId);
      }, 250);
    },
    [clearTimers, openOverlay, overlayPinned],
  );

  const handleTileMouseLeave = useCallback(() => {
    if (overlayPinned) return;
    clearTimers();
    overlayCloseTimerRef.current = setTimeout(() => {
      if (!overlayHoveredRef.current) closeOverlay();
    }, 150);
  }, [clearTimers, closeOverlay, overlayPinned]);

  const handleOverlayMouseEnter = useCallback(() => {
    overlayHoveredRef.current = true;
    clearTimers();
  }, [clearTimers]);

  const handleOverlayMouseLeave = useCallback(() => {
    overlayHoveredRef.current = false;
    if (overlayPinned) return;
    clearTimers();
    overlayCloseTimerRef.current = setTimeout(() => {
      if (!overlayHoveredRef.current) closeOverlay();
    }, 150);
  }, [clearTimers, closeOverlay, overlayPinned]);

  const handleTileClick = useCallback(
    (tileId: string) => {
      openOverlay(tileId, true);
    },
    [openOverlay],
  );

  const handleTogglePin = useCallback(() => {
    if (overlayPinned) {
      closeOverlay();
    } else {
      setOverlayPinned(true);
    }
  }, [closeOverlay, overlayPinned]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const overlayTile = useMemo(
    () => tiles.find((t) => t.id === overlayTileId) ?? null,
    [tiles, overlayTileId],
  );

  if (!isOpen) return null;

  return (
    <div
      data-testid="code-terminal-canvas"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--surface-canvas)',
      }}
    >
      {/* Canvas chrome */}
      <div
        style={{
          height: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 12px 0 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-panel)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 6,
              background:
                'linear-gradient(135deg, var(--accent-code), color-mix(in srgb, var(--accent-code) 55%, #000))',
              boxShadow: '0 0 12px color-mix(in srgb, var(--accent-code) 45%, transparent)',
            }}
          >
            <TerminalIcon size={13} weight="fill" color="#fff" />
          </div>
          <span>Terminals</span>
          {terminalContext?.branch && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-panel-muted)',
              }}
            >
              {terminalContext.branch}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={handleCreateTile}
            disabled={isLoading || tiles.length >= MAX_TILES}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 999,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-panel-muted)',
              color: 'var(--accent-code)',
              fontSize: 11,
              fontWeight: 600,
              cursor: isLoading || tiles.length >= MAX_TILES ? 'not-allowed' : 'pointer',
              opacity: isLoading || tiles.length >= MAX_TILES ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={13} />
            {isLoading ? '…' : 'New'}
          </button>
          <IconButton
            aria-label="Close terminal canvas"
            title="Close"
            onClick={onToggle}
            hoverColor="var(--status-error)"
            hoverBg="var(--status-error-bg)"
          >
            <X size={14} />
          </IconButton>
        </div>
      </div>

      {/* Service-level error */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--status-error-bg)',
            borderBottom: '1px solid color-mix(in srgb, var(--status-error) 28%, var(--border-subtle))',
            color: 'var(--status-error)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={handleCreateTile}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-hover)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <Plus size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Tile grid */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: 12,
        }}
      >
        {isInitializing ? (
          <EmptyState message="Starting terminals…" />
        ) : tiles.length === 0 ? (
          <EmptyState
            message="No terminal sessions"
            hint="Click New to start a terminal session."
            action={{ label: 'New terminal', onClick: handleCreateTile }}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gridAutoRows: 'minmax(220px, 1fr)',
              gap: 12,
              height: '100%',
            }}
          >
            {tiles.map((tile) => (
              <div
                key={tile.id}
                data-testid={`code-terminal-tile-${tile.id}`}
                onMouseEnter={() => handleTileMouseEnter(tile.id)}
                onMouseLeave={handleTileMouseLeave}
                onClick={() => handleTileClick(tile.id)}
                style={{
                  borderRadius: 14,
                  border: `1px solid ${overlayTileId === tile.id ? 'var(--accent-code)' : 'var(--border-subtle)'}`,
                  background: 'var(--surface-panel)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: 180,
                  boxShadow:
                    overlayTileId === tile.id
                      ? '0 0 0 1px color-mix(in srgb, var(--accent-code) 24%, transparent), var(--shadow-lg)'
                      : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  transition: 'border-color 120ms ease, box-shadow 120ms ease',
                }}
              >
                <div
                  style={{
                    height: 36,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '0 8px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--surface-panel-muted)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <StatusDot status={tile.status} />
                    {tile.name}
                  </span>
                  <IconButton
                    aria-label={`Close ${tile.name}`}
                    title="Close"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTile(tile.id);
                    }}
                    hoverColor="var(--status-error)"
                    hoverBg="var(--status-error-bg)"
                  >
                    <X size={12} />
                  </IconButton>
                </div>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <TerminalSurface
                    remoteSessionId={tile.remoteSessionId}
                    isActive
                    onStatusChange={(status, errorMsg) =>
                      handleStatusChange(tile.id, status as TerminalTileStatus, errorMsg)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Focused overlay */}
      {overlayOpen && overlayTile && (
        <div
          data-testid="code-terminal-canvas-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeOverlay();
          }}
          onMouseEnter={handleOverlayMouseEnter}
          onMouseLeave={handleOverlayMouseLeave}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'color-mix(in srgb, var(--shell-overlay-backdrop) 55%, transparent)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              width: 'min(1100px, 100%)',
              height: 'min(800px, 100%)',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 16,
              border: '1px solid var(--glass-border, var(--border-subtle))',
              background: 'var(--surface-floating)',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                height: 44,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '0 12px 0 16px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'color-mix(in srgb, var(--accent-code) 8%, transparent)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                <TerminalIcon size={15} />
                {overlayTile.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconButton
                  aria-label={overlayPinned ? 'Unpin overlay' : 'Pin overlay'}
                  title={overlayPinned ? 'Unpin' : 'Pin'}
                  onClick={handleTogglePin}
                >
                  <PushPin size={14} weight={overlayPinned ? 'fill' : 'regular'} />
                </IconButton>
                <IconButton
                  aria-label="Close overlay"
                  title="Close"
                  onClick={closeOverlay}
                  hoverColor="var(--status-error)"
                  hoverBg="var(--status-error-bg)"
                >
                  <X size={14} />
                </IconButton>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <TerminalSurface
                key={overlayTile.remoteSessionId}
                remoteSessionId={overlayTile.remoteSessionId}
                isActive
                onStatusChange={(status, errorMsg) =>
                  handleStatusChange(overlayTile.id, status as TerminalTileStatus, errorMsg)
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: TerminalTileStatus }) {
  const color =
    status === 'connected'
      ? 'var(--status-success)'
      : status === 'connecting'
        ? 'var(--status-warning)'
        : 'var(--status-error)';
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}`,
      }}
    />
  );
}

function IconButton({
  children,
  onClick,
  'aria-label': ariaLabel,
  title,
  hoverColor,
  hoverBg,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  'aria-label': string;
  title: string;
  hoverColor?: string;
  hoverBg?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28,
        height: 28,
        display: 'grid',
        placeItems: 'center',
        border: '1px solid transparent',
        borderRadius: 7,
        background: hovered && hoverBg ? hoverBg : 'transparent',
        color: hovered && hoverColor ? hoverColor : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'background 120ms ease, color 120ms ease',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({
  message,
  hint,
  action,
}: {
  message: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-tertiary)',
        gap: 12,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-panel)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <TerminalIcon size={24} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{message}</div>
        {hint && <div style={{ fontSize: 12, marginTop: 4 }}>{hint}</div>}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 14px',
            borderRadius: 999,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
            color: 'var(--accent-code)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          {action.label}
        </button>
      )}
    </div>
  );
}
