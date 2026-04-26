import React, { useCallback, useRef, useState } from 'react';
import { WorkspaceBackground } from '../components/WorkspaceBackground';
import { useMode } from '../providers/mode-provider';
import { useSidecarStore } from '../stores/sidecar-store';
import { getAgentModeSurfaceTheme } from '../views/chat/agentModeSurfaceTheme';
import { useAgentSurfaceModeStore } from '../stores/agent-surface-mode.store';
import type { AgentModeSurface } from '../stores/agent-surface-mode.store';

const SIDECAR_MIN_WIDTH = 260;
const SIDECAR_MAX_WIDTH = 700;

const RAIL_MIN_WIDTH = 180;
const RAIL_MAX_WIDTH = 420;
const RAIL_DEFAULT_WIDTH = 248;

// =============================================================================
// ResizeGrip — shared visual indicator shown on resize handle hover
// =============================================================================

function ResizeGrip({ hovered }: { hovered: boolean }) {
  return (
    <div style={{
      width: 3,
      height: 40,
      borderRadius: 2,
      background: '#D4B08C',
      opacity: hovered ? 1 : 0,
      transition: 'opacity 0.15s',
    }} />
  );
}

// =============================================================================
// ShellFrame
// =============================================================================

export function ShellFrame({
  rail,
  canvas,
  sidecar,
  sidecarOpen,
  overlays,
  consoleDrawer,
  dock,
  isRailCollapsed,
  railWidth: railWidthProp,
  onRailWidthChange,
}: {
  rail: React.ReactNode;
  header?: React.ReactNode;
  canvas: React.ReactNode;
  sidecar?: React.ReactNode;
  sidecarOpen?: boolean;
  overlays?: React.ReactNode;
  consoleDrawer?: React.ReactNode;
  dock?: React.ReactNode;
  isRailCollapsed?: boolean;
  /** Controlled rail width in px. Falls back to RAIL_DEFAULT_WIDTH. */
  railWidth?: number;
  /** Called when the user drags the rail resize handle. */
  onRailWidthChange?: (width: number) => void;
}) {
  const { mode } = useMode();
  const selectedAgentIdBySurface = useAgentSurfaceModeStore((s) => s.selectedAgentIdBySurface);

  const currentSurface: AgentModeSurface =
    mode === 'cowork' ? 'cowork' :
    mode === 'code' ? 'code' : 'chat';

  const isAgentActive = !!selectedAgentIdBySurface[currentSurface];

  const railGradient = isAgentActive
    ? 'linear-gradient(180deg, ' + getAgentModeSurfaceTheme(currentSurface).wash + ' 0%, ' + getAgentModeSurfaceTheme(currentSurface).soft + ' 50%, transparent 100%)'
    : 'transparent';
  const canvasGradient = isAgentActive
    ? 'radial-gradient(100% 80% at 50% 0%, ' + getAgentModeSurfaceTheme(currentSurface).fog + ' 0%, ' + getAgentModeSurfaceTheme(currentSurface).soft + ' 60%, ' + getAgentModeSurfaceTheme(currentSurface).panelTint + ' 100%)'
    : 'transparent';

  const sidecarWidth = useSidecarStore((s) => s.width);
  const setWidth = useSidecarStore((s) => s.setWidth);
  const setResizing = useSidecarStore((s) => s.setResizing);

  const isImmersive = mode === 'cowork' || mode === 'code' || mode === 'chat';

  // ----------------------------------------------------------------
  // Sidecar resize (existing logic, unchanged)
  // ----------------------------------------------------------------
  const sidecarDragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onSidecarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidecarDragRef.current = { startX: e.clientX, startW: sidecarWidth };
    setResizing(true);

    const onMove = (ev: MouseEvent) => {
      if (!sidecarDragRef.current) return;
      const delta = sidecarDragRef.current.startX - ev.clientX;
      const next = Math.min(SIDECAR_MAX_WIDTH, Math.max(SIDECAR_MIN_WIDTH, sidecarDragRef.current.startW + delta));
      setWidth(next);
    };

    const onUp = () => {
      sidecarDragRef.current = null;
      setResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidecarWidth, setWidth, setResizing]);

  // ----------------------------------------------------------------
  // Rail resize (new)
  // ----------------------------------------------------------------
  const resolvedRailWidth = railWidthProp ?? RAIL_DEFAULT_WIDTH;
  const railDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const [railHandleHovered, setRailHandleHovered] = useState(false);
  const [railResizing, setRailResizing] = useState(false);

  const onRailResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    railDragRef.current = { startX: e.clientX, startW: resolvedRailWidth };
    setRailResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!railDragRef.current) return;
      const delta = ev.clientX - railDragRef.current.startX;
      const next = Math.min(RAIL_MAX_WIDTH, Math.max(RAIL_MIN_WIDTH, railDragRef.current.startW + delta));
      onRailWidthChange?.(next);
    };

    const onUp = () => {
      railDragRef.current = null;
      setRailResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [resolvedRailWidth, onRailWidthChange]);

  // ----------------------------------------------------------------
  // Grid template
  // ----------------------------------------------------------------
  const railCol = isRailCollapsed ? '0px' : resolvedRailWidth + 'px';
  const sidecarCol = sidecarOpen ? ('minmax(200px, ' + sidecarWidth + 'px)') : '0px';
  const gridCols = railCol + ' 1fr ' + sidecarCol;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: gridCols,
      gridTemplateRows: 'minmax(0, 1fr)',
      height: '100dvh',
      background: 'var(--shell-frame-bg)',
      color: 'var(--shell-item-fg)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <WorkspaceBackground />

      {/* Rail Container with Agent Glow */}
      {!isRailCollapsed && (
        <div style={{
          gridRow: '1',
          gridColumn: '1',
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
          padding: '0px',
          zIndex: 1,
          background: railGradient,
          position: 'relative',
        }}>
          {rail}

          {/* Rail → Canvas resize handle (right edge of rail) */}
          <div
            onMouseDown={onRailResizeStart}
            onMouseEnter={() => setRailHandleHovered(true)}
            onMouseLeave={() => setRailHandleHovered(false)}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 6,
              cursor: 'col-resize',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ResizeGrip hovered={railHandleHovered || railResizing} />
          </div>
        </div>
      )}

      {/* Main Canvas with Agent Glow */}
      <div style={{
        gridRow: '1',
        gridColumn: '2',
        position: 'relative',
        overflow: isImmersive ? 'visible' : 'auto',
        padding: '0px',
        zIndex: 1,
        minWidth: 0,
        background: canvasGradient,
        transition: 'background 0.3s ease',
      }}>
        <div data-shell-card style={{
          height: '100%',
          width: '100%',
          minWidth: 0,
          borderRadius: 0,
          border: 'none',
          background: 'transparent',
          overflow: isImmersive ? 'hidden' : 'auto',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          transition: 'none',
          WebkitAppRegion: 'no-drag'
        }}>
          {canvas}
        </div>
        {dock}
        {overlays}
      </div>

      {/* Sidecar Panel */}
      {sidecarOpen && (
        <div style={{
          gridRow: '1',
          gridColumn: '3',
          overflow: 'hidden',
          padding: '0px',
          zIndex: 1,
          position: 'relative',
        }}>
          {/* Sidecar ← resize handle */}
          <SidecarResizeHandle onMouseDown={onSidecarResizeStart} />
          <div style={{
            height: '100%',
            width: '100%',
            borderRadius: 0,
            border: 'none',
            background: 'var(--shell-panel-bg)',
            overflow: 'hidden',
            WebkitAppRegion: 'no-drag'
          }}>
            {sidecar}
          </div>
        </div>
      )}

      {consoleDrawer}
    </div>
  );
}

// =============================================================================
// SidecarResizeHandle — extracted for clarity
// =============================================================================

function SidecarResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: 'col-resize',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ResizeGrip hovered={hovered} />
    </div>
  );
}
