"use client";

import React, { useCallback } from 'react';
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

export function CodeCanvasView({ workspace }: CodeCanvasViewProps) {
  const updateCanvasTile = useCodeModeStore((s) => s.updateCanvasTile);
  const setCanvasViewport = useCodeModeStore((s) => s.setCanvasViewport);
  const setCanvasFocusTile = useCodeModeStore((s) => s.setCanvasFocusTile);
  const removeCanvasTile = useCodeModeStore((s) => s.removeCanvasTile);
  const addCanvasTile = useCodeModeStore((s) => s.addCanvasTile);
  const autoArrange = useCodeModeStore((s) => s.autoArrangeCanvasTiles);
  const activeSessionId = useCodeModeStore((s) => s.activeSessionId);

  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [auditOpen, setAuditOpen] = React.useState(false);
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [diffOpen, setDiffOpen] = React.useState(false);
  const [hooksOpen, setHooksOpen] = React.useState(false);
  const [mcpOpen, setMcpOpen] = React.useState(false);
  const codeSessions = useCodeSessionStore((s) => s.sessions);

  // h5i Tier 1: Track files touched for the active session (SSE)
  useFilesTouched(workspace?.root_path, activeSessionId);

  const tiles = workspace?.canvasTiles ?? [];
  const viewport = workspace?.canvasViewport ?? { x: 0, y: 0, zoom: 1 };
  const focusTileId = workspace?.canvasFocusTileId ?? null;
  const workspaceId = workspace?.workspace_id ?? '';

  const existingSessions = React.useMemo(() => {
    return codeSessions
      .filter((s) => s.metadata.workspaceId === workspaceId || !s.metadata.workspaceId)
      .map((s) => ({ id: s.id, name: s.name }));
  }, [codeSessions, workspaceId]);

  // Auto-create a tile for the active session when canvas is empty
  React.useEffect(() => {
    if (!workspaceId || tiles.length > 0) return;
    const sessionToShow = activeSessionId || workspace?.sessions[0];
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
      updateCanvasTile(workspaceId, tileId, pos);
    },
    [workspaceId, updateCanvasTile],
  );

  const handleResize = useCallback(
    (tileId: string, size: { width: number; height: number }) => {
      if (!workspaceId) return;
      updateCanvasTile(workspaceId, tileId, size);
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
      removeCanvasTile(workspaceId, tileId);
    },
    [workspaceId, removeCanvasTile],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Don't show context menu if clicking on a tile
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
          const store = useCodeModeStore.getState();
          const workspaces = store.workspaces as unknown as Record<string, CodeWorkspaceRecord>;
          const ws = workspaces[workspaceId];
          if (ws) {
            workspaces[workspaceId] = {
              ...ws,
              canvasTiles: data.tiles,
              canvasViewport: data.viewport ?? ws.canvasViewport,
            };
          }
        }
      } catch (err) {
        console.error('[Canvas] Import failed:', err);
      }
    };
    input.click();
  }, [workspaceId]);

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
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--shell-frame-bg)',
        backgroundImage: 'var(--bg-grid), var(--bg-gradient)',
        backgroundSize: '40px 40px, 100% 100%',
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
                void handleSpawnTile('preview', undefined, 'http://localhost:7150')
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
            onMove={(pos) => handleMove(tile.tileId, pos)}
            onResize={(size) => handleResize(tile.tileId, size)}
            onFocus={() => handleFocus(tile.tileId)}
            onClose={() => handleClose(tile.tileId)}
            onBringToFront={() => handleBringToFront(tile.tileId)}
          >
            <TileContent tile={tile} workspacePath={workspace?.root_path} />
          </CanvasTile>
        ))}
      </InfiniteCanvas>

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
      return <CodeCanvasTileTerminal />;
    case 'notes':
      return <CodeCanvasTileNotes />;
    case 'knowledge':
      return workspacePath ? <CodeCanvasTileKnowledge workspacePath={workspacePath} /> : null;
    case 'knowledge-graph':
      return <CodeCanvasTileKnowledgeGraph />;
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
