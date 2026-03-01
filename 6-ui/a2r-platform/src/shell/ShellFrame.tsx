import React, { useCallback, useRef } from 'react';
import { WorkspaceBackground } from '../components/WorkspaceBackground';
import { useMode } from '../providers/mode-provider';
import { useSidecarStore } from '../stores/sidecar-store';

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
  const sidecarWidth = useSidecarStore((s) => s.width);
  const setWidth = useSidecarStore((s) => s.setWidth);
  const setResizing = useSidecarStore((s) => s.setResizing);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const isImmersive = mode === 'cowork' || mode === 'code';

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
        ? `0px 1fr ${sidecarOpen ? sidecarWidth + 'px' : '0px'}`
        : `284px 1fr ${sidecarOpen ? sidecarWidth + 'px' : '0px'}`,
      gridTemplateRows: '1fr',
      height: '100vh',
      background: '#161616',
      color: 'var(--text-primary)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <WorkspaceBackground />

      {/* Rail Container */}
      {!isRailCollapsed && (
        <div style={{
          gridRow: '1',
          gridColumn: '1',
          display: 'flex',
          overflow: 'hidden',
          padding: '12px 0 12px 12px',
          zIndex: 1,
        }}>
          {rail}
        </div>
      )}

      {/* Main Canvas */}
      <div style={{
        gridRow: '1',
        gridColumn: '2',
        position: 'relative',
        overflow: 'hidden',
        padding: '12px',
        zIndex: 1,
      }}>
        <div data-shell-card style={{
          height: '100%',
          width: '100%',
          borderRadius: isImmersive ? 0 : 24,
          border: isImmersive ? 'none' : '1px solid #333',
          background: isImmersive ? 'transparent' : '#1e1e1e',
          overflow: isImmersive ? 'visible' : 'hidden',
          boxShadow: isImmersive ? 'none' : '0 10px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'none',
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
          padding: '12px 12px 12px 0',
          zIndex: 1,
          position: 'relative',
        }}>
          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            style={{
              position: 'absolute',
              left: 0,
              top: 12,
              bottom: 12,
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
            borderRadius: 24,
            border: '1px solid #333',
            background: '#1e1e1e',
            overflow: 'hidden',
          }}>
            {sidecar}
          </div>
        </div>
      )}

      {consoleDrawer}
    </div>
  );
}
