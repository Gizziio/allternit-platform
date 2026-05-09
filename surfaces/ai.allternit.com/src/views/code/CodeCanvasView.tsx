"use client";

import React, { useCallback, useRef } from 'react';
import {
  useCodeModeStore,
  type CodeWorkspaceRecord,
  type CodeCanvasTile,
  type CodeCanvasViewport,
} from './CodeModeStore';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { CanvasTile } from '@/components/canvas/CanvasTile';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';
import { CanvasHUD } from '@/components/canvas/CanvasHUD';
import { CodeCanvasTileSession } from '@/components/canvas/CodeCanvasTileSession';
import { CodeCanvasTilePreview } from '@/components/canvas/CodeCanvasTilePreview';
import { CodeCanvasTileDiff } from '@/components/canvas/CodeCanvasTileDiff';
import { CodeCanvasTileTerminal } from '@/components/canvas/CodeCanvasTileTerminal';
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

interface CodeCanvasViewProps {
  workspace: CodeWorkspaceRecord | undefined;
}

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:7150';

export function CodeCanvasView({ workspace }: CodeCanvasViewProps) {
  const updateCanvasTile = useCodeModeStore((s) => s.updateCanvasTile);
  const setCanvasViewport = useCodeModeStore((s) => s.setCanvasViewport);
  const setCanvasFocusTile = useCodeModeStore((s) => s.setCanvasFocusTile);
  const removeCanvasTile = useCodeModeStore((s) => s.removeCanvasTile);
  const addCanvasTile = useCodeModeStore((s) => s.addCanvasTile);
  const autoArrange = useCodeModeStore((s) => s.autoArrangeCanvasTiles);
  const importCanvasState = useCodeModeStore((s) => s.importCanvasState);
  const undoCanvas = useCodeModeStore((s) => s.undoCanvas);
  const redoCanvas = useCodeModeStore((s) => s.redoCanvas);
  const selectCanvasTiles = useCodeModeStore((s) => s.selectCanvasTiles);
  const clearCanvasSelection = useCodeModeStore((s) => s.clearCanvasSelection);
  const activeSessionId = useCodeModeStore((s) => s.activeSessionId);

  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [auditOpen, setAuditOpen] = React.useState(false);
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [diffOpen, setDiffOpen] = React.useState(false);
  const [hooksOpen, setHooksOpen] = React.useState(false);
  const [mcpOpen, setMcpOpen] = React.useState(false);
  const codeSessions = useCodeSessionStore((s) => s.sessions);

  // Multi-select / marquee
  const [marquee, setMarquee] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeRef = useRef({ active: false, startX: 0, startY: 0 });
  const dragOffsetsRef = useRef<Record<string, { dx: number; dy: number }>>({});

  // h5i Tier 1: Track files touched for the active session (SSE)
  useFilesTouched(workspace?.root_path, activeSessionId);

  const tiles = workspace?.canvasTiles ?? [];
  const viewport = workspace?.canvasViewport ?? { x: 0, y: 0, zoom: 1 };
  const focusTileId = workspace?.canvasFocusTileId ?? null;
  const workspaceId = workspace?.workspace_id ?? '';
  const selectedIds = workspace?.canvasSelectedIds ?? [];

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
    autoInitRef.current.add(workspaceId);
    const sessionToShow = activeSessionId || workspace?.sessions?.[0];
    if (sessionToShow) {
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
  }, [workspaceId, tiles.length, activeSessionId, workspace?.sessions, addCanvasTile]);

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
      if (selectedIds.length > 1 && selectedIds.includes(tileId)) {
        // Bulk move: compute delta from the dragged tile's original position
        const draggedTile = tiles.find((t) => t.tileId === tileId);
        if (!draggedTile) return;
        const dx = pos.x - draggedTile.x;
        const dy = pos.y - draggedTile.y;
        selectedIds.forEach((id) => {
          const t = tiles.find((tt) => tt.tileId === id);
          if (!t) return;
          updateCanvasTile(workspaceId, id, { x: t.x + dx, y: t.y + dy });
        });
      } else {
        updateCanvasTile(workspaceId, tileId, pos);
      }
    },
    [workspaceId, tiles, selectedIds, updateCanvasTile],
  );

  const handleResize = useCallback(
    (tileId: string, updates: { x?: number; y?: number; width: number; height: number }) => {
      if (!workspaceId) return;
      updateCanvasTile(workspaceId, tileId, updates);
    },
    [workspaceId, updateCanvasTile],
  );

  const handleBringToFront = useCallback(
    (tileId: string) => {
      if (!workspaceId) return;
      const maxZ = tiles.reduce((max, t) => Math.max(max, t.zIndex), 0);
      updateCanvasTile(workspaceId, tileId, { zIndex: maxZ + 1 });
    },
    [workspaceId, tiles, updateCanvasTile],
  );

  const handleFocus = useCallback(
    (tileId: string) => {
      if (!workspaceId) return;
      setCanvasFocusTile(workspaceId, tileId);
    },
    [workspaceId, setCanvasFocusTile],
  );

  const handleClose = useCallback(
    (tileId: string) => {
      if (!workspaceId) return;
      if (selectedIds.length > 1 && selectedIds.includes(tileId)) {
        selectedIds.forEach((id) => removeCanvasTile(workspaceId, id));
        clearCanvasSelection(workspaceId);
      } else {
        removeCanvasTile(workspaceId, tileId);
      }
    },
    [workspaceId, selectedIds, removeCanvasTile, clearCanvasSelection],
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
      } else {
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
        marqueeRef.current = { active: true, startX: e.clientX, startY: e.clientY };
        setMarquee({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
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
      setMarquee({ x, y, w, h });
    },
    [],
  );

  const handleCanvasPointerUp = useCallback(() => {
    if (!marqueeRef.current.active) return;
    marqueeRef.current.active = false;
    const m = marquee;
    setMarquee(null);
    if (!m || !workspaceId) return;

    // Convert screen marquee to world coordinates
    const worldX1 = (m.x - viewport.x) / viewport.zoom;
    const worldY1 = (m.y - viewport.y) / viewport.zoom;
    const worldX2 = (m.x + m.w - viewport.x) / viewport.zoom;
    const worldY2 = (m.y + m.h - viewport.y) / viewport.zoom;

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
    }
  }, [marquee, viewport, workspaceId, tiles, selectCanvasTiles]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-canvas-tile]')) return;
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleSpawnTile = useCallback(
    async (type: CodeCanvasTile['type'], sessionId?: string, url?: string) => {
      if (!workspaceId) return;
      const centerX = -viewport.x / viewport.zoom + (window.innerWidth / 2 / viewport.zoom) - 240;
      const centerY = -viewport.y / viewport.zoom + (window.innerHeight / 2 / viewport.zoom) - 180;

      let newSessionId: string | undefined = sessionId;
      if (type === 'session' && !sessionId) {
        try {
          const createSession = useCodeSessionStore.getState().createSession;
          newSessionId = await createSession({
            name: 'Canvas Session',
            workspaceId,
          });
        } catch (err) {
          console.error('[CodeCanvasView] Failed to create session:', err);
        }
      }

      addCanvasTile(workspaceId, {
        type,
        sessionId: newSessionId,
        x: Math.round(centerX),
        y: Math.round(centerY),
        width: 480,
        height: 360,
        zIndex: Date.now(),
        label: type === 'session' ? (sessionId ? 'Session' : 'New Session') : type === 'preview' && url ? 'Dashboard' : type,
        url: type === 'preview' ? (url || 'http://localhost:3000') : undefined,
      });
    },
    [workspaceId, viewport, addCanvasTile],
  );

  const handleFitView = useCallback(() => {
    if (!workspaceId || tiles.length === 0) return;
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
    const scaleX = window.innerWidth / contentW;
    const scaleY = window.innerHeight / contentH;
    const zoom = Math.min(scaleX, scaleY, 1);
    const x = -minX * zoom + (window.innerWidth - contentW * zoom) / 2;
    const y = -minY * zoom + (window.innerHeight - contentH * zoom) / 2;
    setCanvasViewport(workspaceId, { x, y, zoom });
  }, [workspaceId, tiles, setCanvasViewport]);

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
        console.error('[Canvas] Import failed:', err);
      }
    };
    input.click();
  }, [workspaceId, importCanvasState]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redoCanvas(workspaceId);
        } else {
          undoCanvas(workspaceId);
        }
        return;
      }
      if (isMod && (e.key === '0' || e.key === 'º')) {
        e.preventDefault();
        handleViewportChange({ ...viewport, zoom: 1 });
      } else if (isMod && (e.key === '=' || e.key === '+' || e.key === 'Equal')) {
        e.preventDefault();
        handleViewportChange({ ...viewport, zoom: Math.min(3, viewport.zoom + 0.1) });
      } else if (isMod && (e.key === '-' || e.key === 'Minus')) {
        e.preventDefault();
        handleViewportChange({ ...viewport, zoom: Math.max(0.25, viewport.zoom - 0.1) });
      } else if (e.key === 'Escape' && focusTileId) {
        setCanvasFocusTile(workspaceId, null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !focusTileId) {
        e.preventDefault();
        selectedIds.forEach((id) => removeCanvasTile(workspaceId, id));
        clearCanvasSelection(workspaceId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewport, focusTileId, workspaceId, selectedIds, handleViewportChange, setCanvasFocusTile, undoCanvas, redoCanvas, removeCanvasTile, clearCanvasSelection]);

  // Focus mode: render only the focused tile
  if (focusTileId && workspace) {
    const focusedTile = tiles.find((t) => t.tileId === focusTileId);
    if (focusedTile) {
      return (
        <CodeFocusView
          tile={focusedTile}
          workspace={workspace}
          onExit={() => setCanvasFocusTile(workspaceId, null)}
        />
      );
    }
  }

  return (
    <div
      data-testid="code-canvas-view"
      onContextMenu={handleContextMenu}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      <CanvasToolbar
        workspaceId={workspaceId}
        viewport={viewport}
        onZoomIn={() =>
          handleViewportChange({ ...viewport, zoom: Math.min(3, viewport.zoom + 0.1) })
        }
        onZoomOut={() =>
          handleViewportChange({ ...viewport, zoom: Math.max(0.25, viewport.zoom - 0.1) })
        }
        onResetZoom={() => handleViewportChange({ ...viewport, zoom: 1 })}
        onFitView={handleFitView}
        onAudit={workspace?.root_path ? () => setAuditOpen(true) : undefined}
        onCommit={workspace?.root_path ? () => setCommitOpen(true) : undefined}
        onDiff={workspace?.root_path ? () => setDiffOpen(true) : undefined}
        onDashboard={
          workspace?.root_path
            ? () =>
                void handleSpawnTile('preview', undefined, DASHBOARD_URL)
            : undefined
        }
        onHooks={workspace?.root_path ? () => setHooksOpen(true) : undefined}
        onMcp={workspace?.root_path ? () => setMcpOpen(true) : undefined}
        onExport={tiles.length > 0 ? handleExport : undefined}
        onImport={handleImport}
      />

      <CanvasHUD tiles={tiles} />
      <CanvasMinimap tiles={tiles} viewport={viewport} onViewportChange={handleViewportChange} />

      <InfiniteCanvas viewport={viewport} onViewportChange={handleViewportChange}>
        {tiles.map((tile) => (
          <CanvasTile
            key={tile.tileId}
            tile={tile}
            selected={selectedIds.includes(tile.tileId)}
            onMove={(pos) => handleMove(tile.tileId, pos)}
            onResize={(size) => handleResize(tile.tileId, size)}
            onFocus={() => handleFocus(tile.tileId)}
            onClose={() => handleClose(tile.tileId)}
            onBringToFront={() => handleBringToFront(tile.tileId)}
            onSelect={(e) => handleTileSelect(tile.tileId, e?.shiftKey ?? false)}
          >
            <TileContent tile={tile} workspacePath={workspace?.root_path} />
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

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSpawnTile={(type) => void handleSpawnTile(type)}
          onArrange={() => autoArrange(workspaceId)}
          onResetZoom={() => handleViewportChange({ ...viewport, zoom: 1 })}
          existingSessions={existingSessions}
          onSpawnExistingSession={(sessionId) => void handleSpawnTile('session', sessionId)}
        />
      )}

      {auditOpen && workspace?.root_path && (
        <H5iAuditPanel
          workspacePath={workspace.root_path}
          onClose={() => setAuditOpen(false)}
        />
      )}

      {commitOpen && workspace?.root_path && (
        <H5iCommitPanel
          workspacePath={workspace.root_path}
          sessionId={activeSessionId}
          onClose={() => setCommitOpen(false)}
        />
      )}

      {diffOpen && workspace?.root_path && (
        <H5iDiffPanel
          workspacePath={workspace.root_path}
          sessions={existingSessions}
          onClose={() => setDiffOpen(false)}
        />
      )}

      {hooksOpen && workspace?.root_path && (
        <H5iAgentHooksPanel
          workspacePath={workspace.root_path}
          onClose={() => setHooksOpen(false)}
        />
      )}

      {mcpOpen && (
        <H5iMcpPanel
          onClose={() => setMcpOpen(false)}
        />
      )}
    </div>
  );
}

function TileContent({ tile, workspacePath }: { tile: CodeCanvasTile; workspacePath?: string }) {
  const workspaceId = useCodeModeStore.getState().activeWorkspaceId;
  const updateTile = useCodeModeStore.getState().updateCanvasTile;

  switch (tile.type) {
    case 'session':
      if (!tile.sessionId) {
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
            No session linked
          </div>
        );
      }
      return <CodeCanvasTileSession sessionId={tile.sessionId} workspacePath={workspacePath} />;
    case 'preview':
      return <CodeCanvasTilePreview url={tile.url} filePath={tile.filePath} />;
    case 'diff':
      return <CodeCanvasTileDiff diffText={tile.diffText} filePath={tile.filePath} />;
    case 'terminal':
      return <CodeCanvasTileTerminal sessionId={tile.sessionId} workspacePath={workspacePath} />;
    case 'notes':
      return (
        <CodeCanvasTileNotes
          initialContent={tile.content || ''}
          onChange={(content) => updateTile(workspaceId, tile.tileId, { content })}
        />
      );
    case 'knowledge':
      return workspacePath ? <CodeCanvasTileKnowledge workspacePath={workspacePath} /> : null;
    case 'knowledge-graph':
      return <CodeCanvasTileKnowledgeGraph workspacePath={workspacePath} />;
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
