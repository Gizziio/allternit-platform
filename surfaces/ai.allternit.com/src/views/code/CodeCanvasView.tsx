"use client";

import React, { useCallback, useRef } from 'react';
import { ChatTeardropText, PushPin, Rows, X } from '@phosphor-icons/react';
import {
  useCodeModeStore,
  CANVAS_TILE_DEFAULT_SIZE,
  type CodeWorkspaceRecord,
  type CodeCanvasTile,
  type CodeCanvasViewport,
} from './CodeModeStore';
import { useOrchestratorCanvasSync } from './useOrchestratorCanvasSync';
import {
  CodeCanvasTileExecutor,
  executorBadgeFor,
} from '@/components/canvas/CodeCanvasTileExecutor';
import type { ExecutorSession } from '@/views/code/orchestrator.service';
import {
  InfiniteCanvas,
  MAX_ZOOM,
  MIN_ZOOM,
} from '@/components/canvas/InfiniteCanvas';
import { CanvasTile } from '@/components/canvas/CanvasTile';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';
import { CanvasHUD } from '@/components/canvas/CanvasHUD';
import { CodeCanvasTileSession } from '@/components/canvas/CodeCanvasTileSession';
import { CodeCanvasTilePreview } from '@/components/canvas/CodeCanvasTilePreview';
import { CodeCanvasTileDiff } from '@/components/canvas/CodeCanvasTileDiff';
import { CodeCanvasTileTerminal } from '@/components/canvas/CodeCanvasTileTerminal';
import { disposeTerminalSessions } from '@/components/workspace/UnifiedTerminal';
import { CodeCanvasTileNotes } from '@/components/canvas/CodeCanvasTileNotes';
import { CodeCanvasTileKnowledge } from '@/components/canvas/CodeCanvasTileKnowledge';
import { CodeCanvasTileKnowledgeGraph } from '@/components/canvas/CodeCanvasTileKnowledgeGraph';
import { CodeFocusView } from './CodeFocusView';
import { CanvasContextMenu } from '@/components/canvas/CanvasContextMenu';
import { CanvasMinimap } from '@/components/canvas/CanvasMinimap';
import { H5iAuditPanel } from '@/components/h5i/H5iAuditPanel';
import { H5iCommitPanel } from '@/components/h5i/H5iCommitPanel';
import { H5iDiffPanel } from '@/components/h5i/H5iDiffPanel';
import { H5iAgentHooksPanel } from '@/components/h5i/H5iAgentHooksPanel';
import { H5iMcpPanel } from '@/components/h5i/H5iMcpPanel';
import { useFilesTouched } from '@/components/h5i/useFilesTouched';
import { useCodeSessionStore } from './CodeSessionStore';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CodeCanvasView');

interface CodeCanvasViewProps {
  workspace: CodeWorkspaceRecord | undefined;
}

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:7150';
type CanvasPanel = 'audit' | 'commit' | 'diff' | 'hooks' | 'mcp';

export function CodeCanvasView({ workspace }: CodeCanvasViewProps) {
  const updateCanvasTile = useCodeModeStore((s) => s.updateCanvasTile);
  const snapshotCanvas = useCodeModeStore((s) => s.snapshotCanvas);
  const setCanvasViewport = useCodeModeStore((s) => s.setCanvasViewport);
  const setCanvasFocusTile = useCodeModeStore((s) => s.setCanvasFocusTile);
  const removeCanvasTile = useCodeModeStore((s) => s.removeCanvasTile);
  const removeCanvasTiles = useCodeModeStore((s) => s.removeCanvasTiles);
  const addCanvasTile = useCodeModeStore((s) => s.addCanvasTile);
  const autoArrange = useCodeModeStore((s) => s.autoArrangeCanvasTiles);
  const importCanvasState = useCodeModeStore((s) => s.importCanvasState);
  const undoCanvas = useCodeModeStore((s) => s.undoCanvas);
  const redoCanvas = useCodeModeStore((s) => s.redoCanvas);
  const selectCanvasTiles = useCodeModeStore((s) => s.selectCanvasTiles);
  const clearCanvasSelection = useCodeModeStore((s) => s.clearCanvasSelection);
  const setWorkspaceLayoutMode = useCodeModeStore((s) => s.setWorkspaceLayoutMode);
  const activeLegacySessionId = useCodeModeStore((s) => s.activeSessionId);
  const activeCodeSessionId = useCodeSessionStore((s) => s.activeSessionId);

  const rootRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [activePanel, setActivePanel] = React.useState<CanvasPanel | null>(null);
  const codeSessions = useCodeSessionStore((s) => s.sessions);

  // Multi-select / marquee
  const [marquee, setMarquee] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    pointerId: number | null;
    current: { x: number; y: number; w: number; h: number } | null;
  }>({ active: false, startX: 0, startY: 0, pointerId: null, current: null });

  // Terminal-session hover/click overlay
  const [hoveredOverlayTileId, setHoveredOverlayTileId] = React.useState<string | null>(null);
  const [pinnedOverlayTileId, setPinnedOverlayTileId] = React.useState<string | null>(null);
  const [terminalSessionsOpen, setTerminalSessionsOpen] = React.useState(false);
  const overlayEnterTimerRef = useRef<number | null>(null);
  const overlayLeaveTimerRef = useRef<number | null>(null);

  const activeOverlayTileId = pinnedOverlayTileId ?? hoveredOverlayTileId;

  const tiles = workspace?.canvasTiles ?? [];
  const viewport = workspace?.canvasViewport ?? { x: 0, y: 0, zoom: 1 };
  const focusTileId = workspace?.canvasFocusTileId ?? null;
  const workspaceId = workspace?.workspace_id ?? '';
  const selectedIds = workspace?.canvasSelectedIds ?? [];

  // h5i Tier 1: Track files touched for the active session (SSE)
  useFilesTouched(workspace?.root_path, activeLegacySessionId || undefined);
  const executors = useOrchestratorCanvasSync(workspaceId, workspace?.root_path);

  const clearOverlayTimers = useCallback(() => {
    if (overlayEnterTimerRef.current) {
      window.clearTimeout(overlayEnterTimerRef.current);
      overlayEnterTimerRef.current = null;
    }
    if (overlayLeaveTimerRef.current) {
      window.clearTimeout(overlayLeaveTimerRef.current);
      overlayLeaveTimerRef.current = null;
    }
  }, []);

  const openOverlayHover = useCallback((tileId: string) => {
    if (pinnedOverlayTileId) return;
    clearOverlayTimers();
    overlayEnterTimerRef.current = window.setTimeout(() => {
      setHoveredOverlayTileId(tileId);
    }, 250);
  }, [pinnedOverlayTileId, clearOverlayTimers]);

  const closeOverlayHover = useCallback(() => {
    if (pinnedOverlayTileId) return;
    clearOverlayTimers();
    overlayLeaveTimerRef.current = window.setTimeout(() => {
      setHoveredOverlayTileId(null);
    }, 150);
  }, [pinnedOverlayTileId, clearOverlayTimers]);

  const pinOverlay = useCallback((tileId: string) => {
    clearOverlayTimers();
    setHoveredOverlayTileId(null);
    setPinnedOverlayTileId(tileId);
  }, [clearOverlayTimers]);

  const unpinOverlay = useCallback(() => {
    clearOverlayTimers();
    setPinnedOverlayTileId(null);
    setHoveredOverlayTileId(null);
  }, [clearOverlayTimers]);

  React.useEffect(() => {
    return () => {
      clearOverlayTimers();
    };
  }, [clearOverlayTimers]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const { width, height } = root.getBoundingClientRect();
      setCanvasSize({ width, height });
    };
    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(root);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [focusTileId]);

  const existingSessions = React.useMemo(() => {
    return codeSessions
      .filter((s) => s.metadata.workspaceId === workspaceId || !s.metadata.workspaceId)
      .map((s) => ({ id: s.id, name: s.name }));
  }, [codeSessions, workspaceId]);

  // Auto-create a tile for the active session when canvas is empty
  // Only runs once per workspace per page load so users can intentionally clear tiles
  const autoInitRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (!workspaceId || tiles.length > 0) return;
    if (autoInitRef.current.has(workspaceId)) return;
    const sessionToShow = activeCodeSessionId || existingSessions[0]?.id;
    if (sessionToShow) {
      autoInitRef.current.add(workspaceId);
      addCanvasTile(workspaceId, {
        type: 'session',
        sessionId: sessionToShow,
        x: 48,
        y: 48,
        width: 480,
        height: 360,
        zIndex: 1,
        label: 'Session',
      });
    }
  }, [workspaceId, tiles.length, activeCodeSessionId, existingSessions, addCanvasTile]);

  const handleViewportChange = useCallback(
    (v: CodeCanvasViewport) => {
      if (!workspaceId) return;
      setCanvasViewport(workspaceId, v);
    },
    [workspaceId, setCanvasViewport],
  );

  const handleMove = useCallback(
    (tileId: string, pos: { x: number; y: number }) => {
      if (!workspaceId) return;
      const currentWorkspace = useCodeModeStore
        .getState()
        .workspaces.find((item) => item.workspace_id === workspaceId);
      const currentTiles = currentWorkspace?.canvasTiles ?? [];
      const currentSelectedIds = currentWorkspace?.canvasSelectedIds ?? [];
      if (currentSelectedIds.length > 1 && currentSelectedIds.includes(tileId)) {
        // Bulk move: compute delta from the dragged tile's original position
        const draggedTile = currentTiles.find((t) => t.tileId === tileId);
        if (!draggedTile) return;
        const dx = pos.x - draggedTile.x;
        const dy = pos.y - draggedTile.y;
        currentSelectedIds.forEach((id) => {
          const t = currentTiles.find((tt) => tt.tileId === id);
          if (!t) return;
          updateCanvasTile(
            workspaceId,
            id,
            { x: t.x + dx, y: t.y + dy },
            { recordHistory: false },
          );
        });
      } else {
        updateCanvasTile(workspaceId, tileId, pos, { recordHistory: false });
      }
    },
    [workspaceId, updateCanvasTile],
  );

  const handleResize = useCallback(
    (tileId: string, updates: { x?: number; y?: number; width: number; height: number }) => {
      if (!workspaceId) return;
      updateCanvasTile(workspaceId, tileId, updates, { recordHistory: false });
    },
    [workspaceId, updateCanvasTile],
  );

  const handleBringToFront = useCallback(
    (tileId: string) => {
      if (!workspaceId) return;
      const maxZ = tiles.reduce((max, t) => Math.max(max, t.zIndex), 0);
      const tile = tiles.find((item) => item.tileId === tileId);
      if (!tile || tile.zIndex >= maxZ) return;
      updateCanvasTile(workspaceId, tileId, { zIndex: maxZ + 1 }, { recordHistory: false });
    },
    [workspaceId, tiles, updateCanvasTile],
  );

  const handleInteractionStart = useCallback(() => {
    if (!workspaceId) return;
    snapshotCanvas(workspaceId);
  }, [snapshotCanvas, workspaceId]);

  const handleFocus = useCallback(
    (tileId: string) => {
      if (!workspaceId) return;
      setCanvasFocusTile(workspaceId, tileId);
    },
    [workspaceId, setCanvasFocusTile],
  );

  // Terminal PTYs outlive tile unmounts (see UnifiedTerminal); closing the
  // tile itself is the point where they should actually die.
  const disposeTileSessions = useCallback(
    (tileId: string) => {
      const tile = tiles.find((t) => t.tileId === tileId);
      if (tile?.type === 'terminal') {
        disposeTerminalSessions(`canvas:${tile.tileId}:${tile.sessionId || 'workspace'}`);
      }
    },
    [tiles],
  );

  const handleClose = useCallback(
    (tileId: string) => {
      if (!workspaceId) return;
      disposeTileSessions(tileId);
      removeCanvasTile(workspaceId, tileId);
    },
    [workspaceId, removeCanvasTile, disposeTileSessions],
  );

  const handleTileSelect = useCallback(
    (tileId: string, additive: boolean) => {
      if (!workspaceId) return;
      if (additive) {
        if (selectedIds.includes(tileId)) {
          selectCanvasTiles(workspaceId, selectedIds.filter((id) => id !== tileId));
        } else {
          selectCanvasTiles(workspaceId, [...selectedIds, tileId]);
        }
      } else if (!selectedIds.includes(tileId)) {
        selectCanvasTiles(workspaceId, [tileId]);
      }
    },
    [workspaceId, selectedIds, selectCanvasTiles],
  );

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // Start marquee if clicking empty canvas (not on a tile)
      if ((e.target as HTMLElement).closest('[data-canvas-tile]')) return;
      if (e.shiftKey) {
        const nextMarquee = { x: e.clientX, y: e.clientY, w: 0, h: 0 };
        marqueeRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          pointerId: e.pointerId,
          current: nextMarquee,
        };
        setMarquee(nextMarquee);
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        clearCanvasSelection(workspaceId);
      }
    },
    [workspaceId, clearCanvasSelection],
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!marqueeRef.current.active) return;
      const x = Math.min(marqueeRef.current.startX, e.clientX);
      const y = Math.min(marqueeRef.current.startY, e.clientY);
      const w = Math.abs(e.clientX - marqueeRef.current.startX);
      const h = Math.abs(e.clientY - marqueeRef.current.startY);
      const nextMarquee = { x, y, w, h };
      marqueeRef.current.current = nextMarquee;
      setMarquee(nextMarquee);
    },
    [],
  );

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    if (!marqueeRef.current.active) return;
    if (
      marqueeRef.current.pointerId !== null &&
      e.currentTarget.hasPointerCapture(marqueeRef.current.pointerId)
    ) {
      e.currentTarget.releasePointerCapture(marqueeRef.current.pointerId);
    }
    marqueeRef.current.active = false;
    const m = marqueeRef.current.current;
    marqueeRef.current.pointerId = null;
    marqueeRef.current.current = null;
    setMarquee(null);
    if (!m || !workspaceId) return;

    // Convert screen marquee to world coordinates
    const canvasRect = rootRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const worldX1 = (m.x - canvasRect.left - viewport.x) / viewport.zoom;
    const worldY1 = (m.y - canvasRect.top - viewport.y) / viewport.zoom;
    const worldX2 = (m.x + m.w - canvasRect.left - viewport.x) / viewport.zoom;
    const worldY2 = (m.y + m.h - canvasRect.top - viewport.y) / viewport.zoom;

    const selected = tiles
      .filter((t) => {
        const tx1 = t.x;
        const ty1 = t.y;
        const tx2 = t.x + t.width;
        const ty2 = t.y + t.height;
        return tx1 < worldX2 && tx2 > worldX1 && ty1 < worldY2 && ty2 > worldY1;
      })
      .map((t) => t.tileId);

    if (selected.length > 0) {
      selectCanvasTiles(workspaceId, selected);
    } else {
      clearCanvasSelection(workspaceId);
    }
  }, [viewport, workspaceId, tiles, selectCanvasTiles, clearCanvasSelection]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-canvas-tile]')) return;
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleSpawnTile = useCallback(
    async (
      type: CodeCanvasTile['type'],
      sessionId?: string,
      url?: string,
      screenPoint?: { x: number; y: number },
    ) => {
      if (!workspaceId) return;
      const canvasRect = rootRef.current?.getBoundingClientRect();
      const screenX = screenPoint
        ? screenPoint.x - (canvasRect?.left ?? 0)
        : canvasSize.width / 2;
      const screenY = screenPoint
        ? screenPoint.y - (canvasRect?.top ?? 0)
        : canvasSize.height / 2;
      const size = CANVAS_TILE_DEFAULT_SIZE[type];
      const centerX = (screenX - viewport.x) / viewport.zoom - size.width / 2;
      const centerY = (screenY - viewport.y) / viewport.zoom - size.height / 2;

      let newSessionId: string | undefined = sessionId;
      if (type === 'session' && !sessionId) {
        try {
          const createSession = useCodeSessionStore.getState().createSession;
          newSessionId = await createSession({
            name: 'Canvas Session',
            workspaceId,
          });
        } catch (err) {
          logger.error({ err: err }, 'Failed to create session');
        }
      }

      addCanvasTile(workspaceId, {
        type,
        sessionId: newSessionId,
        x: Math.round(centerX),
        y: Math.round(centerY),
        width: size.width,
        height: size.height,
        zIndex: Date.now(),
        label: type === 'session' ? (sessionId ? 'Session' : 'New Session') : type === 'preview' && url ? 'Dashboard' : type,
        url: type === 'preview' ? (url || 'http://localhost:3000') : undefined,
      });
    },
    [workspaceId, canvasSize, viewport, addCanvasTile],
  );

  const handleFitView = useCallback(() => {
    if (!workspaceId || tiles.length === 0 || canvasSize.width <= 0 || canvasSize.height <= 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tiles) {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + t.width);
      maxY = Math.max(maxY, t.y + t.height);
    }
    const pad = 60;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const scaleX = canvasSize.width / contentW;
    const scaleY = canvasSize.height / contentH;
    const zoom = Math.max(MIN_ZOOM, Math.min(scaleX, scaleY, 1));
    const x = -minX * zoom + (canvasSize.width - contentW * zoom) / 2;
    const y = -minY * zoom + (canvasSize.height - contentH * zoom) / 2;
    setCanvasViewport(workspaceId, { x, y, zoom });
  }, [workspaceId, tiles, canvasSize, setCanvasViewport]);

  const handleExport = useCallback(() => {
    if (!workspace) return;
    const data = {
      workspaceId: workspace.workspace_id,
      tiles: workspace.canvasTiles,
      viewport: workspace.canvasViewport,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-${workspace.workspace_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [workspace]);

  const handleImport = useCallback(() => {
    if (!workspaceId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as { tiles?: CodeCanvasTile[]; viewport?: CodeCanvasViewport };
        if (data.tiles) {
          importCanvasState(workspaceId, data.tiles, data.viewport);
        }
      } catch (err) {
        logger.error({ err: err }, 'Import failed');
      }
    };
    input.click();
  }, [workspaceId, importCanvasState]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing = Boolean(
        target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
      );
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key.toLowerCase() === 'z' && !isEditing) {
        e.preventDefault();
        if (e.shiftKey) {
          redoCanvas(workspaceId);
        } else {
          undoCanvas(workspaceId);
        }
        return;
      }
      if (isEditing && e.key !== 'Escape') return;

      if (isMod && (e.key === '0' || e.key === 'º')) {
        e.preventDefault();
        handleViewportChange({ ...viewport, zoom: 1 });
      } else if (isMod && (e.key === '=' || e.key === '+' || e.key === 'Equal')) {
        e.preventDefault();
          handleViewportChange({ ...viewport, zoom: Math.min(MAX_ZOOM, viewport.zoom + 0.1) });
      } else if (isMod && (e.key === '-' || e.key === 'Minus')) {
        e.preventDefault();
        handleViewportChange({ ...viewport, zoom: Math.max(MIN_ZOOM, viewport.zoom - 0.1) });
      } else if (e.key === 'Escape') {
        if (terminalSessionsOpen) {
          setTerminalSessionsOpen(false);
        } else if (pinnedOverlayTileId) {
          unpinOverlay();
        } else if (focusTileId) {
          setCanvasFocusTile(workspaceId, null);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !focusTileId) {
        e.preventDefault();
        selectedIds.forEach(disposeTileSessions);
        removeCanvasTiles(workspaceId, selectedIds);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewport, focusTileId, workspaceId, selectedIds, terminalSessionsOpen, pinnedOverlayTileId, handleViewportChange, setCanvasFocusTile, undoCanvas, redoCanvas, removeCanvasTiles, disposeTileSessions, unpinOverlay]);

  // Focus mode: render only the focused tile
  if (focusTileId && workspace) {
    const focusedTile = tiles.find((t) => t.tileId === focusTileId);
    if (focusedTile) {
      return (
        <CodeFocusView
          tile={focusedTile}
          workspace={workspace}
          onExit={() => setCanvasFocusTile(workspaceId, null)}
          onClose={() => handleClose(focusedTile.tileId)}
        />
      );
    }
  }

  return (
    <div
      ref={rootRef}
      data-testid="code-canvas-view"
      onContextMenu={handleContextMenu}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerUp}
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--view-code-bg, var(--surface-canvas))',
      }}
    >
      <CanvasToolbar
        workspaceId={workspaceId}
        viewport={viewport}
        canvasSize={canvasSize}
        onZoomIn={() =>
          handleViewportChange({ ...viewport, zoom: Math.min(MAX_ZOOM, viewport.zoom + 0.1) })
        }
        onZoomOut={() =>
          handleViewportChange({ ...viewport, zoom: Math.max(MIN_ZOOM, viewport.zoom - 0.1) })
        }
        onResetZoom={() => handleViewportChange({ ...viewport, zoom: 1 })}
        onFitView={handleFitView}
        onAudit={workspace?.root_path ? () => setActivePanel('audit') : undefined}
        onCommit={workspace?.root_path ? () => setActivePanel('commit') : undefined}
        onDiff={workspace?.root_path ? () => setActivePanel('diff') : undefined}
        onDashboard={
          workspace?.root_path
            ? () =>
                void handleSpawnTile('preview', undefined, DASHBOARD_URL)
            : undefined
        }
        onHooks={workspace?.root_path ? () => setActivePanel('hooks') : undefined}
        onMcp={workspace?.root_path ? () => setActivePanel('mcp') : undefined}
        onExport={tiles.length > 0 ? handleExport : undefined}
        onImport={handleImport}
        onOpenTerminalSessions={() => setTerminalSessionsOpen(true)}
      />

      {workspaceId && (
        <button
          type="button"
          data-testid="code-thread-mode-toggle"
          onClick={() => setWorkspaceLayoutMode(workspaceId, 'thread')}
          title="Switch to thread mode"
          aria-label="Switch to thread mode"
          style={{
            position: 'absolute',
            top: 10,
            right: 14,
            zIndex: 100,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            padding: 0,
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            background: 'var(--surface-floating)',
            boxShadow: 'var(--shadow-sm)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background 120ms ease, color 120ms ease, transform 120ms ease',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--surface-hover)';
            event.currentTarget.style.color = 'var(--text-primary)';
            event.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'var(--surface-floating)';
            event.currentTarget.style.color = 'var(--text-secondary)';
            event.currentTarget.style.transform = 'none';
          }}
        >
          <ChatTeardropText size={17} />
        </button>
      )}

      <CanvasHUD tiles={tiles} />
      <CanvasMinimap
        tiles={tiles}
        viewport={viewport}
        canvasSize={canvasSize}
        onViewportChange={handleViewportChange}
      />

      <InfiniteCanvas viewport={viewport} onViewportChange={handleViewportChange}>
        {tiles.map((tile) => (
          <CanvasTile
            key={tile.tileId}
            tile={tile}
            selected={selectedIds.includes(tile.tileId)}
            zoom={viewport.zoom}
            onMove={(pos) => handleMove(tile.tileId, pos)}
            onResize={(size) => handleResize(tile.tileId, size)}
            onFocus={() => handleFocus(tile.tileId)}
            onClose={() => handleClose(tile.tileId)}
            onBringToFront={() => handleBringToFront(tile.tileId)}
            onInteractionStart={handleInteractionStart}
            onSelect={(additive) => handleTileSelect(tile.tileId, additive)}
            onMouseEnter={() => {
              if (tile.type === 'terminal' || tile.type === 'executor') {
                openOverlayHover(tile.tileId);
              }
            }}
            onMouseLeave={() => {
              if (tile.type === 'terminal' || tile.type === 'executor') {
                closeOverlayHover();
              }
            }}
            onClick={() => {
              if (tile.type === 'terminal' || tile.type === 'executor') {
                pinOverlay(tile.tileId);
              }
            }}
            badge={
              tile.type === 'executor'
                ? executorBadgeFor(executors.get(tile.executorSlug ?? ''))
                : undefined
            }
          >
            <TileContent
              tile={tile}
              workspaceId={workspaceId}
              workspacePath={workspace?.root_path}
            />
          </CanvasTile>
        ))}
      </InfiniteCanvas>

      {/* Marquee selection overlay */}
      {marquee && (
        <div
          style={{
            position: 'fixed',
            left: marquee.x,
            top: marquee.y,
            width: marquee.w,
            height: marquee.h,
            border: '1px solid var(--accent-primary)',
            background: 'rgba(176, 141, 110, 0.1)',
            zIndex: 200,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Terminal / executor hover-click overlay */}
      {activeOverlayTileId && (
        <CanvasTileOverlay
          tile={tiles.find((t) => t.tileId === activeOverlayTileId)}
          workspaceId={workspaceId}
          workspacePath={workspace?.root_path}
          pinned={Boolean(pinnedOverlayTileId)}
          executors={executors}
          onMouseEnter={() => {
            if (activeOverlayTileId) {
              clearOverlayTimers();
            }
          }}
          onMouseLeave={() => {
            if (!pinnedOverlayTileId) {
              closeOverlayHover();
            }
          }}
          onPin={() => {
            if (activeOverlayTileId) {
              pinOverlay(activeOverlayTileId);
            }
          }}
          onClose={unpinOverlay}
        />
      )}

      {/* Terminal sessions panel */}
      {terminalSessionsOpen && (
        <TerminalSessionsPanel
          tiles={tiles}
          executors={executors}
          onClose={() => setTerminalSessionsOpen(false)}
          onSelectTile={(tileId) => {
            pinOverlay(tileId);
          }}
        />
      )}

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSpawnTile={(type) => void handleSpawnTile(type, undefined, undefined, contextMenu)}
          onArrange={() => autoArrange(workspaceId)}
          onResetZoom={() => handleViewportChange({ ...viewport, zoom: 1 })}
          existingSessions={existingSessions}
          onSpawnExistingSession={(sessionId) =>
            void handleSpawnTile('session', sessionId, undefined, contextMenu)
          }
        />
      )}

      {activePanel === 'audit' && workspace?.root_path && (
        <CanvasModalLayer onDismiss={() => setActivePanel(null)}>
          <H5iAuditPanel
            workspacePath={workspace.root_path}
            onClose={() => setActivePanel(null)}
          />
        </CanvasModalLayer>
      )}

      {activePanel === 'commit' && workspace?.root_path && (
        <CanvasModalLayer onDismiss={() => setActivePanel(null)}>
          <H5iCommitPanel
            workspacePath={workspace.root_path}
            sessionId={activeLegacySessionId || undefined}
            onClose={() => setActivePanel(null)}
          />
        </CanvasModalLayer>
      )}

      {activePanel === 'diff' && workspace?.root_path && (
        <CanvasModalLayer onDismiss={() => setActivePanel(null)}>
          <H5iDiffPanel
            workspacePath={workspace.root_path}
            sessions={existingSessions}
            onClose={() => setActivePanel(null)}
          />
        </CanvasModalLayer>
      )}

      {activePanel === 'hooks' && workspace?.root_path && (
        <CanvasModalLayer onDismiss={() => setActivePanel(null)}>
          <H5iAgentHooksPanel
            workspacePath={workspace.root_path}
            onClose={() => setActivePanel(null)}
          />
        </CanvasModalLayer>
      )}

      {activePanel === 'mcp' && (
        <CanvasModalLayer onDismiss={() => setActivePanel(null)}>
          <H5iMcpPanel onClose={() => setActivePanel(null)} />
        </CanvasModalLayer>
      )}
    </div>
  );
}

function CanvasModalLayer({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      role="presentation"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onDismiss();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 170,
        background: 'color-mix(in srgb, var(--shell-overlay-backdrop) 55%, transparent)',
      }}
    >
      {children}
    </div>
  );
}

function TileContent({
  tile,
  workspaceId,
  workspacePath,
}: {
  tile: CodeCanvasTile;
  workspaceId: string;
  workspacePath?: string;
}) {
  const updateTile = useCodeModeStore.getState().updateCanvasTile;

  switch (tile.type) {
    case 'session':
      return (
        <CodeCanvasTileSession
          sessionId={tile.sessionId}
          workspaceId={workspaceId}
          workspacePath={workspacePath}
          onSessionCreated={(sessionId) =>
            updateTile(workspaceId, tile.tileId, { sessionId }, { recordHistory: false })
          }
        />
      );
    case 'preview':
      return <CodeCanvasTilePreview url={tile.url} filePath={tile.filePath} />;
    case 'diff':
      return <CodeCanvasTileDiff diffText={tile.diffText} filePath={tile.filePath} />;
    case 'terminal':
      return (
        <CodeCanvasTileTerminal
          terminalId={tile.tileId}
          sessionId={tile.sessionId}
          workspacePath={workspacePath}
          startupCommand={tile.startupCommand}
        />
      );
    case 'notes':
      return (
        <CodeCanvasTileNotes
          initialContent={tile.content || ''}
          onChange={(content) =>
            updateTile(workspaceId, tile.tileId, { content }, { recordHistory: false })
          }
          shared={tile.shared}
          workspacePath={workspacePath}
        />
      );
    case 'knowledge':
      return workspacePath ? <CodeCanvasTileKnowledge workspacePath={workspacePath} /> : null;
    case 'knowledge-graph':
      return <CodeCanvasTileKnowledgeGraph workspacePath={workspacePath} />;
    case 'executor':
      return <CodeCanvasTileExecutor tile={tile} workspaceId={workspaceId} />;
    default:
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          Unknown tile type: {tile.type}
        </div>
      );
  }
}


  function CanvasTileOverlay({
    tile,
    workspaceId,
    workspacePath,
    pinned,
    executors,
    onMouseEnter,
    onMouseLeave,
    onPin,
    onClose,
  }: {
    tile: CodeCanvasTile | undefined;
    workspaceId: string;
    workspacePath?: string;
    pinned: boolean;
    executors: Map<string, ExecutorSession>;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onPin: () => void;
    onClose: () => void;
  }) {
    if (!tile) return null;
    const isTerminal = tile.type === 'terminal';
    const isExecutor = tile.type === 'executor';

    return (
      <div
        role="dialog"
        aria-label={`${tile.label || tile.type} overlay`}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'color-mix(in srgb, var(--shell-overlay-backdrop) 60%, transparent)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      >
        <div
          onClick={onPin}
          style={{
            width: 'min(92vw, 1100px)',
            height: 'min(86vh, 760px)',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 14,
            border: '1px solid var(--glass-border)',
            background: 'var(--surface-floating)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: 'var(--shadow-xl), 0 0 40px color-mix(in srgb, var(--accent-code) 8%, transparent)',
            overflow: 'hidden',
          }}
        >
          {/* Overlay header */}
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'color-mix(in srgb, var(--surface-floating) 80%, transparent)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isTerminal
                    ? 'var(--accent-code)'
                    : isExecutor
                      ? 'var(--status-info)'
                      : 'var(--text-muted)',
                  boxShadow: `0 0 8px ${isTerminal ? 'var(--accent-code)' : isExecutor ? 'var(--status-info)' : 'var(--text-muted)'}`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tile.label || tile.type}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--accent-code)',
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid color-mix(in srgb, var(--accent-code) 30%, transparent)',
                  background: 'color-mix(in srgb, var(--accent-code) 10%, transparent)',
                  flexShrink: 0,
                }}
              >
                {tile.type}
              </span>
              {isExecutor && tile.executorSlug && (
                <div style={{ flexShrink: 0 }}>
                  {executorBadgeFor(executors.get(tile.executorSlug))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                aria-label={pinned ? 'Unpin overlay' : 'Pin overlay'}
                title={pinned ? 'Pinned' : 'Pin overlay'}
                onClick={(e) => {
                  e.stopPropagation();
                  onPin();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  border: `1px solid ${pinned ? 'var(--accent-code)' : 'var(--border-subtle)'}`,
                  borderRadius: 8,
                  background: pinned ? 'color-mix(in srgb, var(--accent-code) 12%, transparent)' : 'transparent',
                  color: pinned ? 'var(--accent-code)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <PushPin size={14} weight={pinned ? 'fill' : 'regular'} />
              </button>
              <button
                type="button"
                aria-label="Close overlay"
                title="Close overlay"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Overlay content — reuse the same tile renderer so terminal/executor PTYs reattach */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <TileContent tile={tile} workspaceId={workspaceId} workspacePath={workspacePath} />
          </div>
        </div>
      </div>
    );
  }

  function TerminalSessionsPanel({
    tiles,
    executors,
    onClose,
    onSelectTile,
  }: {
    tiles: CodeCanvasTile[];
    executors: Map<string, ExecutorSession>;
    onClose: () => void;
    onSelectTile: (tileId: string) => void;
  }) {
    const sessionTiles = tiles.filter(
      (t): t is CodeCanvasTile & { type: 'terminal' | 'executor' } =>
        t.type === 'terminal' || t.type === 'executor',
    );

    return (
      <div
        role="complementary"
        aria-label="Terminal sessions"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          zIndex: 190,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--glass-border)',
          background: 'var(--surface-floating)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 14px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Rows size={18} style={{ color: 'var(--accent-code)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Terminal sessions
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--surface-panel)',
              }}
            >
              {sessionTiles.length}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close terminal sessions panel"
            title="Close panel"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {sessionTiles.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              No terminal or executor tiles on this canvas.
            </div>
          ) : (
            sessionTiles.map((tile) => {
              const isExecutor = tile.type === 'executor';
              return (
                <button
                  key={tile.tileId}
                  type="button"
                  onClick={() => onSelectTile(tile.tileId)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 12px',
                    marginBottom: 6,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    background: 'var(--surface-panel)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface-hover)';
                    e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-code) 40%, var(--border-subtle))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface-panel)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {tile.label || tile.type}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--accent-code)',
                          padding: '1px 6px',
                          borderRadius: 999,
                          border: '1px solid color-mix(in srgb, var(--accent-code) 30%, transparent)',
                          background: 'color-mix(in srgb, var(--accent-code) 10%, transparent)',
                        }}
                      >
                        {tile.type}
                      </span>
                      {isExecutor && tile.executorSlug && (
                        <span onClick={(e) => e.stopPropagation()}>
                          {executorBadgeFor(executors.get(tile.executorSlug))}
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }
