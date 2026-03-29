import React, { useCallback, useRef } from 'react';
import { WorkspaceBackground } from '../components/WorkspaceBackground';
import { useMode } from '../providers/mode-provider';
import { useSidecarStore } from '../stores/sidecar-store';
import { getAgentModeSurfaceTheme } from '../views/chat/agentModeSurfaceTheme';
import { useAgentSurfaceModeStore } from '../stores/agent-surface-mode.store';
import type { AgentModeSurface } from '../stores/agent-surface-mode.store';

const SIDECAR_MIN_WIDTH = 260;
const SIDECAR_MAX_WIDTH = 700;

export function ShellFrame({
  rail,
  canvas,
  sidecar,
  sidecarOpen,
  overlays,
  consoleDrawer,
  dock,
  isRailCollapsed
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
}) {
  const { mode } = useMode();
  const selectedAgentIdBySurface = useAgentSurfaceModeStore((s) => s.selectedAgentIdBySurface);
  
  const currentSurface: AgentModeSurface = 
    mode === 'cowork' ? 'cowork' : 
    mode === 'code' ? 'code' : 'chat';
    
  const isAgentActive = !!selectedAgentIdBySurface[currentSurface];
  
  // Pre-compute gradient backgrounds to avoid SWC parser issues
  const railGradient = isAgentActive 
    ? 'linear-gradient(180deg, ' + getAgentModeSurfaceTheme(currentSurface).wash + ' 0%, ' + getAgentModeSurfaceTheme(currentSurface).soft + ' 50%, transparent 100%)'
    : 'transparent';
  const canvasGradient = isAgentActive 
    ? 'radial-gradient(100% 80% at 50% 0%, ' + getAgentModeSurfaceTheme(currentSurface).fog + ' 0%, ' + getAgentModeSurfaceTheme(currentSurface).soft + ' 60%, ' + getAgentModeSurfaceTheme(currentSurface).panelTint + ' 100%)'
    : 'transparent';

  const sidecarWidth = useSidecarStore((s) => s.width);
  const setWidth = useSidecarStore((s) => s.setWidth);
  const setResizing = useSidecarStore((s) => s.setResizing);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const isImmersive = mode === 'cowork' || mode === 'code' || mode === 'chat';

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: sidecarWidth };
    setResizing(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      const next = Math.min(SIDECAR_MAX_WIDTH, Math.max(SIDECAR_MIN_WIDTH, dragRef.current.startW + delta));
      setWidth(next);
    };

    const onUp = () => {
      dragRef.current = null;
      setResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidecarWidth, setWidth, setResizing]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isRailCollapsed
        ? ('0px 1fr ' + (sidecarOpen ? ('minmax(200px, ' + sidecarWidth + 'px)') : '0px'))
        : ('minmax(0px, 284px) 1fr ' + (sidecarOpen ? ('minmax(200px, ' + sidecarWidth + 'px)') : '0px')),
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
        }}>
          {rail}
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
          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
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
            onMouseEnter={(e) => {
              (e.currentTarget.firstElementChild as HTMLElement).style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.firstElementChild as HTMLElement).style.opacity = '0';
            }}
          >
            <div style={{
              width: 3,
              height: 40,
              borderRadius: 2,
              background: '#D4B08C',
              opacity: 0,
              transition: 'opacity 0.15s',
            }} />
          </div>
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
