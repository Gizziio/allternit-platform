"use client";

/**
 * Global multi-terminal workspace.
 *
 * Lives in the CODE MODE console drawer (DrawerRoot terminal tab), NOT in the
 * shell rail or the side pane. A vertically-scrolling canvas of live terminal
 * tiles in a fixed 3-column grid (1–2 columns below ~960px container width).
 * Each tile has a macOS streetlight header (red = close with confirm, yellow =
 * normalize, green = zoom) and a bottom-edge drag handle for per-tile height.
 *
 * Zoom is a single-mount move: the grid copy of the zoomed tile is replaced
 * by a placeholder while the overlay mounts the same tile, so exactly one
 * xterm owns the PTY stream and keyboard input at a time (the PTY itself
 * persists server-side and is reattached on remount).
 *
 * Tile metadata lives in the persisted terminal-workspace store; each tile's
 * PTY is created lazily by TerminalWorkspaceSurface and disposed when the
 * tile is removed.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Minus,
  Plus,
  Terminal as TerminalIcon,
} from '@phosphor-icons/react';
import { Modal, ModalBody, ModalFooter, ModalHeader, ModalButton } from '@/components/ui/Modal';
import { Z } from '@/design/z-index';
import { TerminalWorkspaceSurface, type WorkspaceTileStatus } from './TerminalWorkspaceTile';
import { WorkspaceSessionCatalog, type WorkspaceCatalogPick } from './WorkspaceSessionCatalog';
import { useTerminalWorkspaceStore, type TerminalTile } from '@/stores/terminal-workspace.store';

const DEFAULT_TILE_HEIGHT = 320;
const MIN_TILE_HEIGHT = 120;

/** Canonical macOS streetlight literals — the only hard-coded colors allowed. */
const STREETLIGHT_RED = 'var(--status-danger, #ff5f57)';
const STREETLIGHT_YELLOW = '#febc2e';
const STREETLIGHT_GREEN = '#28c840';

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

function columnsForWidth(width: number): number {
  if (width < 640) return 1;
  if (width < 960) return 2;
  return 3;
}

export function TerminalWorkspace(): React.ReactNode {
  const tiles = useTerminalWorkspaceStore((s) => s.tiles);
  const focusedTileId = useTerminalWorkspaceStore((s) => s.focusedTileId);
  const filterTag = useTerminalWorkspaceStore((s) => s.filterTag);
  const fontSize = useTerminalWorkspaceStore((s) => s.fontSize);
  const addTile = useTerminalWorkspaceStore((s) => s.addTile);
  const removeTile = useTerminalWorkspaceStore((s) => s.removeTile);
  const renameTile = useTerminalWorkspaceStore((s) => s.renameTile);
  const setTileHeight = useTerminalWorkspaceStore((s) => s.setTileHeight);
  const setFontSize = useTerminalWorkspaceStore((s) => s.setFontSize);
  const setFocused = useTerminalWorkspaceStore((s) => s.setFocused);
  const setFilterTag = useTerminalWorkspaceStore((s) => s.setFilterTag);

  const [statuses, setStatuses] = useState<Record<string, WorkspaceTileStatus>>({});
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [closingTileId, setClosingTileId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      setContainerWidth((prev) => (Math.abs(prev - width) < 1 ? prev : width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const columns = columnsForWidth(containerWidth);

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

  const closingTile = closingTileId ? (tiles.find((t) => t.id === closingTileId) ?? null) : null;

  const confirmClose = useCallback(() => {
    if (!closingTileId) return;
    removeTile(closingTileId);
    setClosingTileId(null);
  }, [closingTileId, removeTile]);

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
      {/* Toolbar */}
      <div
        style={{
          minHeight: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '6px 12px',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-panel)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleAddTile}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-panel-muted)',
              color: 'var(--accent-primary)',
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
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
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

          {/* Font-size controls (apply to every tile) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: 2,
              borderRadius: 999,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-panel-muted)',
            }}
          >
            <button
              type="button"
              aria-label="Decrease terminal font size"
              title="Smaller terminal font"
              disabled={fontSize <= 8}
              onClick={() => setFontSize(fontSize - 1)}
              style={fontButtonStyle}
            >
              <Minus size={11} />
            </button>
            <span
              style={{
                minWidth: 20,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {fontSize}
            </span>
            <button
              type="button"
              aria-label="Increase terminal font size"
              title="Larger terminal font"
              disabled={fontSize >= 24}
              onClick={() => setFontSize(fontSize + 1)}
              style={fontButtonStyle}
            >
              <Plus size={11} />
            </button>
          </div>
        </div>

        {/* Source-tag filter chips */}
        {tagChips.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
      </div>

      {/* Vertically-scrolling tile canvas */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {tiles.length === 0 ? (
          <WorkspaceEmptyState
            onNewTerminal={handleAddTile}
            onOpenCatalog={() => setCatalogOpen(true)}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: 12,
              padding: 12,
              alignItems: 'start',
            }}
          >
            {visibleTiles.map((tile) => (
              <WorkspaceTileCard
                key={tile.id}
                tile={tile}
                status={statuses[tile.id] ?? 'connecting'}
                isZoomed={focusedTileId === tile.id}
                overlayOpen={focusedTileId !== null}
                onStatusChange={handleStatusChange}
                onZoom={() => setFocused(tile.id)}
                onRequestClose={() => setClosingTileId(tile.id)}
                onRename={(label) => renameTile(tile.id, label)}
                onResize={(height) => setTileHeight(tile.id, height)}
              />
            ))}
            <NewTileCard onClick={handleAddTile} />
          </div>
        )}
      </div>

      {/* Focus zoom overlay — single-mount move of the zoomed tile */}
      {focusedTile && (
        <div
          data-testid="terminal-workspace-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFocused(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            // Above shell chrome; the workspace can render inside the console
            // drawer (z-index 900 stacking context), and the close-confirm
            // modal + catalogue use Z.drawerModalBackdrop to layer above this.
            zIndex: Z.drawerOverlay,
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
              borderRadius: 14,
              border: '1px solid var(--glass-border, var(--border-subtle))',
              background: 'var(--surface-floating)',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <TileHeaderBar
              tile={focusedTile}
              status={statuses[focusedTile.id] ?? 'connecting'}
              variant="overlay"
              onClose={() => setClosingTileId(focusedTile.id)}
              onNormalize={() => setFocused(null)}
              onZoom={() => {}}
              onRename={(label) => renameTile(focusedTile.id, label)}
            />
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

      {/* Close confirmation */}
      <Modal
        isOpen={closingTile !== null}
        onClose={() => setClosingTileId(null)}
        size="small"
        zIndex={Z.drawerModalBackdrop}
      >
        <ModalHeader title="Close terminal" onClose={() => setClosingTileId(null)} />
        <ModalBody>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Close &lsquo;{closingTile?.label}&rsquo;? This will terminate the shell and any process
            running in it.
          </p>
        </ModalBody>
        <ModalFooter>
          <ModalButton variant="secondary" onClick={() => setClosingTileId(null)}>
            Cancel
          </ModalButton>
          <ModalButton variant="danger" onClick={confirmClose}>
            Close &amp; Kill
          </ModalButton>
        </ModalFooter>
      </Modal>

      <WorkspaceSessionCatalog
        isOpen={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onPick={handleCatalogPick}
        zIndex={Z.drawerModalBackdrop}
      />
    </div>
  );
}

const fontButtonStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tile card
// ─────────────────────────────────────────────────────────────────────────────

function WorkspaceTileCard({
  tile,
  status,
  isZoomed,
  overlayOpen,
  onStatusChange,
  onZoom,
  onRequestClose,
  onRename,
  onResize,
}: {
  tile: TerminalTile;
  status: WorkspaceTileStatus;
  /** True while this tile is mounted in the zoom overlay (grid shows a placeholder). */
  isZoomed: boolean;
  /** True while ANY tile is zoomed — pauses refits in the remaining grid tiles. */
  overlayOpen: boolean;
  onStatusChange: (tileId: string, status: WorkspaceTileStatus) => void;
  onZoom: () => void;
  onRequestClose: () => void;
  onRename: (label: string) => void;
  onResize: (height: number) => void;
}): React.ReactNode {
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const height = dragHeight ?? tile.height ?? DEFAULT_TILE_HEIGHT;

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      const startHeight = tile.height ?? DEFAULT_TILE_HEIGHT;
      const apply = (clientY: number) =>
        Math.max(MIN_TILE_HEIGHT, startHeight + clientY - startY);

      setDragHeight(startHeight);
      const onMove = (ev: PointerEvent) => setDragHeight(apply(ev.clientY));
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        onResize(apply(ev.clientY));
        setDragHeight(null);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [tile.height, onResize],
  );

  return (
    <div
      data-testid={`terminal-workspace-tile-${tile.id}`}
      style={{
        position: 'relative',
        height,
        borderRadius: 14,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-panel)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <TileHeaderBar
        tile={tile}
        status={status}
        variant="grid"
        onClose={onRequestClose}
        onNormalize={onZoom /* unused in grid: yellow is hidden */}
        onZoom={onZoom}
        onRename={onRename}
      />
      {isZoomed ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: 'var(--text-tertiary)',
            fontSize: 12,
            background: 'var(--surface-panel)',
          }}
        >
          <TerminalIcon size={18} />
          <span>Zoomed — press Esc or the yellow button to return</span>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            overflow: 'hidden',
          }}
        >
          <TerminalWorkspaceSurface
            tile={tile}
            isActive={!overlayOpen}
            onStatusChange={(nextStatus) => onStatusChange(tile.id, nextStatus)}
          />
        </div>
      )}

      {/* Bottom-edge vertical resize handle (6px hit area) */}
      <div
        onPointerDown={startResize}
        title="Drag to resize"
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: -3,
          height: 6,
          borderRadius: 3,
          cursor: 'ns-resize',
          touchAction: 'none',
          background: dragHeight !== null ? 'var(--accent-primary)' : 'transparent',
          opacity: dragHeight !== null ? 0.6 : 1,
          transition: 'background 120ms ease',
        }}
        onMouseEnter={(e) => {
          if (dragHeight === null) e.currentTarget.style.background = 'var(--border-hover)';
        }}
        onMouseLeave={(e) => {
          if (dragHeight === null) e.currentTarget.style.background = 'transparent';
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// macOS streetlight header bar
// ─────────────────────────────────────────────────────────────────────────────

function TileHeaderBar({
  tile,
  status,
  variant,
  onClose,
  onNormalize,
  onZoom,
  onRename,
}: {
  tile: TerminalTile;
  status: WorkspaceTileStatus;
  /** Grid tiles hide the yellow streetlight; the overlay enables it. */
  variant: 'grid' | 'overlay';
  onClose: () => void;
  onNormalize: () => void;
  onZoom: () => void;
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
      style={{
        height: 28,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '0 8px 0 10px',
        borderBottom: '1px solid var(--border-subtle)',
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        background: 'linear-gradient(180deg, var(--surface-panel-muted) 0%, var(--surface-panel) 100%)',
        userSelect: 'none',
      }}
    >
      {/* Left: macOS streetlights */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <Streetlight color={STREETLIGHT_RED} title="Close" onClick={onClose} />
        {variant === 'overlay' && (
          <Streetlight
            color={STREETLIGHT_YELLOW}
            title="Back to grid (Esc)"
            onClick={onNormalize}
          />
        )}
        <Streetlight
          color={STREETLIGHT_GREEN}
          title={variant === 'overlay' ? 'Zoomed' : 'Zoom'}
          onClick={variant === 'overlay' ? () => {} : onZoom}
          disabled={variant === 'overlay'}
        />
      </div>

      {/* Right: label (double-click to rename) + live status dot */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          minWidth: 0,
          justifyContent: 'flex-end',
          flex: 1,
        }}
      >
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
              width: '60%',
              minWidth: 0,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'var(--surface-panel)',
              border: '1px solid var(--accent-primary)',
              borderRadius: 5,
              padding: '1px 6px',
              outline: 'none',
              textAlign: 'right',
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
            }}
          >
            {tile.label}
          </span>
        )}
        <StatusDot status={status} />
      </div>
    </div>
  );
}

function Streetlight({
  color,
  title,
  onClick,
  disabled,
}: {
  color: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}): React.ReactNode {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        border: 'none',
        padding: 0,
        cursor: disabled ? 'default' : 'pointer',
        background: color,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 22%, transparent)`,
        filter: hovered && !disabled ? 'brightness(1.15)' : 'none',
        opacity: disabled ? 0.7 : 1,
        flexShrink: 0,
      }}
    />
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
        height: DEFAULT_TILE_HEIGHT,
        color: 'var(--text-tertiary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
        e.currentTarget.style.color = 'var(--accent-primary)';
        e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-primary) 6%, transparent)';
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
          Run several terminals side by side in one grid. Zoom any tile with its green button;
          tiles spawned from a code session get a tag you can filter by.
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
            color: 'var(--accent-primary)',
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
