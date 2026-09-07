"use client";

/**
 * Global multi-terminal workspace.
 *
 * A responsive grid of live terminal tiles with click-to-focus zoom. Global
 * (not per code session): tiles spawned from a code/chat/cowork session carry
 * a source tag the grid can filter on. Tile metadata lives in the persisted
 * terminal-workspace store; each tile's PTY is created lazily by
 * TerminalWorkspaceSurface and disposed when the tile is removed.
 *
 * The focus-zoom overlay follows the interaction pattern from
 * src/views/code/CodeTerminalCanvas.tsx (full-surface takeover, Esc or close
 * to return to the grid) without the tile cap.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Plus,
  SquaresFour,
  Terminal as TerminalIcon,
  X,
} from '@phosphor-icons/react';
import { TerminalWorkspaceSurface, type WorkspaceTileStatus } from './TerminalWorkspaceTile';
import { WorkspaceSessionCatalog, type WorkspaceCatalogPick } from './WorkspaceSessionCatalog';
import { useTerminalWorkspaceStore, type TerminalTile } from '@/stores/terminal-workspace.store';

function generateTileId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function StatusDot({ status }: { status: WorkspaceTileStatus }): React.ReactNode {
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
        flexShrink: 0,
      }}
    />
  );
}

export function TerminalWorkspace(): React.ReactNode {
  const tiles = useTerminalWorkspaceStore((s) => s.tiles);
  const focusedTileId = useTerminalWorkspaceStore((s) => s.focusedTileId);
  const filterTag = useTerminalWorkspaceStore((s) => s.filterTag);
  const addTile = useTerminalWorkspaceStore((s) => s.addTile);
  const removeTile = useTerminalWorkspaceStore((s) => s.removeTile);
  const renameTile = useTerminalWorkspaceStore((s) => s.renameTile);
  const setFocused = useTerminalWorkspaceStore((s) => s.setFocused);
  const setFilterTag = useTerminalWorkspaceStore((s) => s.setFilterTag);

  const [statuses, setStatuses] = useState<Record<string, WorkspaceTileStatus>>({});
  const [catalogOpen, setCatalogOpen] = useState(false);

  const handleStatusChange = useCallback((tileId: string, status: WorkspaceTileStatus) => {
    setStatuses((prev) => (prev[tileId] === status ? prev : { ...prev, [tileId]: status }));
  }, []);

  const handleAddTile = useCallback(() => {
    addTile({
      id: generateTileId(),
      label: `Terminal ${tiles.length + 1}`,
      createdAt: Date.now(),
    });
  }, [addTile, tiles.length]);

  const handleCatalogPick = useCallback(
    (pick: WorkspaceCatalogPick) => {
      addTile({
        id: generateTileId(),
        label: pick.label,
        cwd: pick.cwd,
        spawnCommand: pick.spawnCommand ?? undefined,
        createdAt: Date.now(),
      });
    },
    [addTile],
  );

  const focusedTile = useMemo(
    () => tiles.find((t) => t.id === focusedTileId) ?? null,
    [tiles, focusedTileId],
  );

  // Esc returns from the focus overlay to the grid.
  useEffect(() => {
    if (!focusedTileId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocused(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [focusedTileId, setFocused]);

  // One chip per distinct source tag (session id + title).
  const tagChips = useMemo(() => {
    const bySession = new Map<string, string>();
    for (const tile of tiles) {
      if (tile.sourceTag && !bySession.has(tile.sourceTag.sessionId)) {
        bySession.set(tile.sourceTag.sessionId, tile.sourceTag.title);
      }
    }
    return [...bySession.entries()].map(([sessionId, title]) => ({ sessionId, title }));
  }, [tiles]);

  const visibleTiles = useMemo(
    () => (filterTag ? tiles.filter((t) => t.sourceTag?.sessionId === filterTag) : tiles),
    [tiles, filterTag],
  );

  return (
    <div
      data-testid="terminal-workspace"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--surface-canvas)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Workspace chrome */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
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
              flexShrink: 0,
            }}
          >
            <SquaresFour size={13} weight="fill" color="#fff" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>Workspace</span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}
          >
            {tiles.length} terminal{tiles.length === 1 ? '' : 's'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 999,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-panel-muted)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-panel-muted)';
            }}
          >
            <BookOpen size={13} />
            From catalogue…
          </button>
          <button
            type="button"
            onClick={handleAddTile}
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
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-panel-muted)';
            }}
          >
            <Plus size={13} />
            New terminal
          </button>
        </div>
      </div>

      {/* Source-tag filter bar */}
      {tagChips.length > 0 && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
          }}
        >
          <FilterChip active={filterTag === null} onClick={() => setFilterTag(null)} label="All" />
          {tagChips.map((chip) => (
            <FilterChip
              key={chip.sessionId}
              active={filterTag === chip.sessionId}
              onClick={() => setFilterTag(filterTag === chip.sessionId ? null : chip.sessionId)}
              label={chip.title}
            />
          ))}
        </div>
      )}

      {/* Tile grid */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12 }}>
        {tiles.length === 0 ? (
          <WorkspaceEmptyState
            onNewTerminal={handleAddTile}
            onOpenCatalog={() => setCatalogOpen(true)}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gridAutoRows: 'minmax(240px, auto)',
              gap: 12,
            }}
          >
            {visibleTiles.map((tile) => (
              <WorkspaceTileCard
                key={tile.id}
                tile={tile}
                status={statuses[tile.id] ?? 'connecting'}
                isFocusedOverlayOpen={focusedTileId !== null}
                onStatusChange={handleStatusChange}
                onFocus={() => setFocused(tile.id)}
                onClose={() => removeTile(tile.id)}
                onRename={(label) => renameTile(tile.id, label)}
              />
            ))}
            <NewTileCard onClick={handleAddTile} />
          </div>
        )}
      </div>

      {/* Focus zoom overlay */}
      {focusedTile && (
        <div
          data-testid="terminal-workspace-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFocused(null);
          }}
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
                  minWidth: 0,
                }}
              >
                <StatusDot status={statuses[focusedTile.id] ?? 'connecting'} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {focusedTile.label}
                </span>
                {focusedTile.sourceTag && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      padding: '2px 8px',
                      borderRadius: 999,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-panel)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {focusedTile.sourceTag.title}
                  </span>
                )}
              </div>
              <OverlayIconButton
                ariaLabel="Close overlay"
                title="Close (Esc)"
                hoverColor="var(--status-error)"
                hoverBg="var(--status-error-bg)"
                onClick={() => setFocused(null)}
              >
                <X size={14} />
              </OverlayIconButton>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <TerminalWorkspaceSurface
                tile={focusedTile}
                isActive
                onStatusChange={(status) => handleStatusChange(focusedTile.id, status)}
              />
            </div>
          </div>
        </div>
      )}

      <WorkspaceSessionCatalog
        isOpen={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onPick={handleCatalogPick}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tile card
// ─────────────────────────────────────────────────────────────────────────────

function WorkspaceTileCard({
  tile,
  status,
  isFocusedOverlayOpen,
  onStatusChange,
  onFocus,
  onClose,
  onRename,
}: {
  tile: TerminalTile;
  status: WorkspaceTileStatus;
  isFocusedOverlayOpen: boolean;
  onStatusChange: (tileId: string, status: WorkspaceTileStatus) => void;
  onFocus: () => void;
  onClose: () => void;
  onRename: (label: string) => void;
}): React.ReactNode {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tile.label);

  const commitRename = useCallback(() => {
    setEditing(false);
    onRename(draft);
  }, [draft, onRename]);

  return (
    <div
      data-testid={`terminal-workspace-tile-${tile.id}`}
      style={{
        borderRadius: 14,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-panel)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 200,
        boxShadow: 'var(--shadow-sm)',
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
          padding: '0 6px 0 10px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-panel-muted)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            minWidth: 0,
            flex: 1,
          }}
        >
          <StatusDot status={status} />
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setDraft(tile.label);
                  setEditing(false);
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-primary)',
                background: 'var(--surface-panel)',
                border: '1px solid var(--accent-code)',
                borderRadius: 5,
                padding: '2px 6px',
                outline: 'none',
              }}
            />
          ) : (
            <span
              title="Double-click to rename"
              onDoubleClick={() => {
                setDraft(tile.label);
                setEditing(true);
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'text',
                userSelect: 'none',
              }}
            >
              {tile.label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <TileIconButton ariaLabel={`Focus ${tile.label}`} title="Focus" onClick={onFocus}>
            <SquaresFour size={12} />
          </TileIconButton>
          <TileIconButton
            ariaLabel={`Close ${tile.label}`}
            title="Close"
            hoverColor="var(--status-error)"
            hoverBg="var(--status-error-bg)"
            onClick={onClose}
          >
            <X size={12} />
          </TileIconButton>
        </div>
      </div>
      <div
        style={{ flex: 1, minHeight: 0, position: 'relative' }}
        onDoubleClick={onFocus}
      >
        <TerminalWorkspaceSurface
          tile={tile}
          isActive={!isFocusedOverlayOpen}
          onStatusChange={(nextStatus) => onStatusChange(tile.id, nextStatus)}
        />
      </div>
    </div>
  );
}

function NewTileCard({ onClick }: { onClick: () => void }): React.ReactNode {
  return (
    <button
      type="button"
      data-testid="terminal-workspace-new-tile"
      onClick={onClick}
      style={{
        borderRadius: 14,
        border: '1.5px dashed var(--border-subtle)',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 200,
        color: 'var(--text-tertiary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-code)';
        e.currentTarget.style.color = 'var(--accent-code)';
        e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-code) 6%, transparent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.color = 'var(--text-tertiary)';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <Plus size={18} />
      New terminal
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small chrome pieces
// ─────────────────────────────────────────────────────────────────────────────

function FilterChip({
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
        background: active ? 'var(--surface-active)' : 'var(--surface-panel-muted)',
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

function TileIconButton({
  children,
  onClick,
  ariaLabel,
  title,
  hoverColor,
  hoverBg,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  title: string;
  hoverColor?: string;
  hoverBg?: string;
}): React.ReactNode {
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
        width: 26,
        height: 26,
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

function OverlayIconButton({
  children,
  onClick,
  ariaLabel,
  title,
  hoverColor,
  hoverBg,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  title: string;
  hoverColor?: string;
  hoverBg?: string;
}): React.ReactNode {
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

function WorkspaceEmptyState({
  onNewTerminal,
  onOpenCatalog,
}: {
  onNewTerminal: () => void;
  onOpenCatalog: () => void;
}): React.ReactNode {
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
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Your terminal workspace is empty
        </div>
        <div style={{ fontSize: 12, marginTop: 4, maxWidth: 420 }}>
          Run several terminals side by side in one grid. Focus any tile to zoom in; tiles spawned
          from a code session get a tag you can filter by.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onNewTerminal}
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
          New terminal
        </button>
        <button
          type="button"
          onClick={onOpenCatalog}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 14px',
            borderRadius: 999,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <BookOpen size={13} />
          From catalogue…
        </button>
      </div>
    </div>
  );
}
