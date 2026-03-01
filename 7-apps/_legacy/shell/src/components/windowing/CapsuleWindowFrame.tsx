/**
 * Capsule Window Frame
 *
 * A reusable window frame component with drag, resize, and pointer capture.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useWindowManager, type ResizeHandle } from './index';
import { useTabsetStore } from '../tabset/TabsetStore';
import { CapsuleIcon } from '../../iconography/CapsuleIconRegistry';
import { proofRecorder } from '../../proof/ProofRecorder';

// ============================================================================
// Styles


const styles = {
  window: {
    position: 'absolute' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'var(--bg-primary, #0f0f0f)',
    borderRadius: '8px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s ease',
    userSelect: 'none' as const,
  },
  focused: {
    boxShadow: '0 4px 32px rgba(59, 130, 246, 0.3)',
  },
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '32px',
    padding: '0 12px',
    backgroundColor: 'var(--bg-secondary, #1a1a2e)',
    borderBottom: '1px solid var(--border-color, #2a2a4a)',
    cursor: 'grab',
    touchAction: 'none' as const,
  },
  titleBarActive: {
    backgroundColor: 'var(--bg-tertiary, #252540)',
    cursor: 'grabbing',
  },
  title: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary, #e4e4e7)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
  },
  controls: {
    display: 'flex',
    gap: '8px',
    pointerEvents: 'auto' as const,
  },
  controlButton: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
    pointerEvents: 'auto' as const,
  },
  closeButton: {
    backgroundColor: '#ef4444',
  },
  minimizeButton: {
    backgroundColor: '#f59e0b',
  },
  maximizeButton: {
    backgroundColor: '#10b981',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative' as const,
    pointerEvents: 'auto' as const,
  },
  resizeHandle: {
    position: 'absolute' as const,
    zIndex: 10,
    touchAction: 'none' as const,
  },
  resizeHandleN: {
    top: '-4px',
    left: '8px',
    right: '8px',
    height: '8px',
    cursor: 'ns-resize' as const,
  },
  resizeHandleS: {
    bottom: '-4px',
    left: '8px',
    right: '8px',
    height: '8px',
    cursor: 'ns-resize' as const,
  },
  resizeHandleE: {
    right: '-4px',
    top: '8px',
    bottom: '8px',
    width: '8px',
    cursor: 'ew-resize' as const,
  },
  resizeHandleW: {
    left: '-4px',
    top: '8px',
    bottom: '8px',
    width: '8px',
    cursor: 'ew-resize' as const,
  },
  resizeHandleNW: {
    top: '-4px',
    left: '-4px',
    width: '16px',
    height: '16px',
    cursor: 'nwse-resize' as const,
  },
  resizeHandleNE: {
    top: '-4px',
    right: '-4px',
    width: '16px',
    height: '16px',
    cursor: 'nesw-resize' as const,
  },
  resizeHandleSW: {
    bottom: '-4px',
    left: '-4px',
    width: '16px',
    height: '16px',
    cursor: 'nesw-resize' as const,
  },
  resizeHandleSE: {
    bottom: '-4px',
    right: '-4px',
    width: '16px',
    height: '16px',
    cursor: 'nwse-resize' as const,
  },
};

// ============================================================================
// Component Props
// ============================================================================

interface CapsuleWindowFrameProps {
  windowId: string;
  children: React.ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  showControls?: boolean;
  showTitle?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const CapsuleWindowFrame: React.FC<CapsuleWindowFrameProps> = ({
  windowId,
  children,
  onClose,
  onMinimize,
  onMaximize,
  showControls = true,
  showTitle = true,
}) => {
  const {
    state: { focusedWindowId },
    getWindow,
    focusWindow,
    moveWindow,
    resizeWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    tabWindow,
  } = useWindowManager();
  const { addTab, activeTabsetId } = useTabsetStore();

  const window = getWindow(windowId);
  // Log mount event once
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current && window) {
      proofRecorder.mark('CapsuleWindowFrame mounted', { windowId: window.id, state: window.state });
      console.log(`[PROOF] CapsuleWindowFrame mounted windowId=${window.id} state=${window.state}`);
      mountedRef.current = true;
    }
  }, [window]);

  if (!window) return null;

  const isFocused = focusedWindowId === windowId;

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Title bar measurement (DOM-derived to handle theme/font variations)
  const titleBarRef = useRef<HTMLDivElement>(null);
    const [titleBarHeight, setTitleBarHeight] = useState(32);

  const getViewportBounds = useCallback((): { width: number; height: number } => {
    const viewportWidth = globalThis.innerWidth || 1200;
    const viewportHeight = globalThis.innerHeight || 800;
    return { width: viewportWidth, height: viewportHeight };
  }, []);

  const clampToViewport = useCallback((x: number, y: number, width: number, height: number) => {
    const viewport = getViewportBounds();
    return {
      x: Math.max(0, Math.min(x, viewport.width - width)),
      y: Math.max(0, Math.min(y, viewport.height - height)),
      width: Math.min(width, viewport.width),
      height: Math.min(height, viewport.height),
    };
  }, [getViewportBounds]);

  useEffect(() => {
    if (!titleBarRef.current || !showTitle) return;

    // Measure actual title bar height from DOM
    const measureTitleBar = () => {
      if (titleBarRef.current) {
        const rect = titleBarRef.current.getBoundingClientRect();
        setTitleBarHeight(rect.height);
      }
    };

    // Measure after mount and after any style changes
    measureTitleBar();
    const observer = new ResizeObserver(measureTitleBar);
    observer.observe(titleBarRef.current);
    return () => observer.disconnect();
  }, [showTitle]);

  // Focus on mount and on focus change
  useEffect(() => {
    if (!isFocused) {
      focusWindow(windowId);
    }
  }, [windowId, focusWindow, isFocused]);

  // Drag handlers using pointer events
  const handleTitleBarPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!window.draggable || window.state !== 'normal') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button')) return;

      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragOffset({ x: window.x, y: window.y });
    },
    [window, windowId]
  );

  const handleTitleBarPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      const clamped = clampToViewport(
        dragOffset.x + deltaX,
        dragOffset.y + deltaY,
        window.width,
        window.height,
      );

      moveWindow(windowId, clamped.x, clamped.y);
    },
    [isDragging, dragOffset, window, windowId, moveWindow, clampToViewport]
  );

  const handleTitleBarPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();

      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      // Check if dropped near the top (TabStrip area)
      if (e.clientY < 40 && activeTabsetId) {
        addTab(activeTabsetId, {
          id: `tab_${Date.now()}`,
          windowId: windowId,
          title: window.title || 'Capsule',
          type: window.capsuleId || 'browser'
        });
        tabWindow(windowId, activeTabsetId);
      } else {
        // Force emit final bounds to guarantee Stage sync
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        moveWindow(windowId, dragOffset.x + deltaX, dragOffset.y + deltaY, { force: true });
      }

      setIsDragging(false);
    },
    [isDragging, dragStart, dragOffset, windowId, moveWindow, addTab, activeTabsetId, tabWindow, window.title, window.capsuleId]
  );

  // Handle pointercancel (window blur, OS steal, escape key, etc.)
  // Must force-emit final bounds and release capture
  const handleTitleBarPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();

      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      // Force emit final bounds to guarantee Stage sync
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      moveWindow(windowId, dragOffset.x + deltaX, dragOffset.y + deltaY, { force: true });

      setIsDragging(false);
    },
    [isDragging, dragStart, dragOffset, windowId, moveWindow]
  );

  // Resize handlers using pointer events
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, handle: ResizeHandle) => {
      if (!window.resizable || window.state !== 'normal') return;

      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      setIsResizing(true);
      setResizeHandle(handle);
      setResizeStart({ x: e.clientX, y: e.clientY, width: window.width, height: window.height });
    },
    [window, windowId]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing || !resizeHandle) return;
      e.preventDefault();
      e.stopPropagation();

      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      const clamped = clampToViewport(
        resizeStart.x + deltaX,
        resizeStart.y + deltaY,
        window.width,
        window.height,
      );

      let newWidth = clamped.width;
      let newHeight = clamped.height;

      switch (resizeHandle) {
        case 'e':
          newWidth = clamped.width;
          break;
        case 's':
          newHeight = clamped.height;
          break;
        case 'w':
          newWidth = clamped.width;
          break;
        case 'sw':
          newWidth = clamped.width;
          newHeight = clamped.height;
          break;
        case 'n':
          newWidth = clamped.width;
          newHeight = clamped.height;
          break;
        case 'se':
          newHeight = clamped.height;
          break;
      }

      resizeWindow(windowId, newWidth, newHeight, { force: true });
    },
    [isResizing, resizeHandle, resizeStart, window, windowId, resizeWindow, clampToViewport]
  );

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      e.stopPropagation();

      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      // Force emit final bounds to guarantee Stage sync
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      let newWidth = window.width;
      let newHeight = window.height;

      switch (resizeHandle) {
        case 'e':
        case 'se':
          newWidth = resizeStart.width + deltaX;
          break;
        case 's':
          newHeight = resizeStart.height + deltaY;
          break;
        case 'w':
        case 'sw':
          newWidth = resizeStart.width - deltaX;
          break;
        case 'n':
          newHeight = resizeStart.height - deltaY;
          break;
        case 'ne':
        case 'nw':
          newWidth = resizeStart.width + deltaX;
          newHeight = resizeStart.height - deltaY;
          break;
      }

      resizeWindow(windowId, newWidth, newHeight, { force: true });

      setIsResizing(false);
      setResizeHandle(null);
    },
    [isResizing, resizeHandle, resizeStart, window, windowId, resizeWindow]
  );

  // Handle pointercancel (window blur, OS steal, escape key, etc.)
  // Must force-emit final bounds and release capture
  const handleResizePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      e.stopPropagation();

      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      // Force emit final bounds to guarantee Stage sync
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      let newWidth = window.width;
      let newHeight = window.height;

      switch (resizeHandle) {
        case 'e':
        case 'se':
          newWidth = resizeStart.width + deltaX;
          break;
        case 's':
          newHeight = resizeStart.height + deltaY;
          break;
        case 'w':
        case 'sw':
          newWidth = resizeStart.width - deltaX;
          break;
        case 'n':
          newHeight = resizeStart.height - deltaY;
          break;
        case 'ne':
        case 'nw':
          newWidth = resizeStart.width + deltaX;
          newHeight = resizeStart.height - deltaY;
          break;
      }

      resizeWindow(windowId, newWidth, newHeight, { force: true });

      setIsResizing(false);
      setResizeHandle(null);
    },
    [isResizing, resizeHandle, resizeStart, window, windowId, resizeWindow]
  );

  // Window control handlers
  const handleClose = useCallback(() => {
    closeWindow(windowId);
    onClose?.();
  }, [windowId, closeWindow, onClose]);

  const handleMinimize = useCallback(() => {
    minimizeWindow(windowId);
    onMinimize?.();
  }, [windowId, minimizeWindow, onMinimize]);

  const handleMaximize = useCallback(() => {
    if (window.state === 'maximized') {
      restoreWindow(windowId);
    } else {
      maximizeWindow(windowId);
    }
    onMaximize?.();
  }, [windowId, window.state, maximizeWindow, restoreWindow, onMaximize]);

  // Visibility state
  if (window.state === 'minimized' || window.state === 'tabbed' || window.state === 'closed') {
    return null;
  }

  return (
    <div
      ref={(el) => {
        if (el) {
          el.addEventListener('pointerdown', () => {
            if (!isFocused) focusWindow(windowId);
          });
        }
      }}
      style={{
        ...styles.window,
        left: window.x,
        top: window.y,
        width: window.width,
        height: window.height,
        zIndex: window.z,
        ...(isFocused ? styles.focused : {}),
      }}
    >
      {/* Title Bar */}
      {showTitle && (
        <div
          ref={titleBarRef}
          style={{
            ...styles.titleBar,
            height: `${titleBarHeight}px`,
            ...(isDragging ? styles.titleBarActive : {}),
            cursor: window.draggable && window.state === 'normal' ? 'grab' : 'default',
          }}
          onPointerDown={handleTitleBarPointerDown}
          onPointerMove={handleTitleBarPointerMove}
          onPointerUp={handleTitleBarPointerUp}
          onPointerCancel={handleTitleBarPointerCancel}
          onPointerLeave={isDragging ? handleTitleBarPointerUp : undefined}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CapsuleIcon type={window.capsuleId || 'browser'} size={14} />
            <span style={styles.title}>{window.title || 'Capsule'}</span>
          </div>

          {showControls && (
            <div style={styles.controls}>
              {window.minimizable && (
                <button
                  style={{ ...styles.controlButton, ...styles.minimizeButton }}
                  onClick={handleMinimize}
                  title="Minimize"
                />
              )}
              {window.maximizable && (
                <button
                  style={{ ...styles.controlButton, ...styles.maximizeButton }}
                  onClick={handleMaximize}
                  title={window.state === 'maximized' ? 'Restore' : 'Maximize'}
                />
              )}
              {window.closable && (
                <button
                  style={{ ...styles.controlButton, ...styles.closeButton }}
                  onClick={handleClose}
                  title="Close"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div style={styles.content}>{children}</div>

      {/* Resize Handles */}
      {window.resizable && window.state === 'normal' && (
        <>
          <div
            style={{ ...styles.resizeHandle, ...styles.resizeHandleN }}
            onPointerDown={(e) => handleResizePointerDown(e, 'n')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
          />
          <div
            style={{ ...styles.resizeHandle, ...styles.resizeHandleS }}
            onPointerDown={(e) => handleResizePointerDown(e, 's')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
          />
          <div
            style={{ ...styles.resizeHandle, ...styles.resizeHandleE }}
            onPointerDown={(e) => handleResizePointerDown(e, 'e')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
          />
          <div
            style={{ ...styles.resizeHandle, ...styles.resizeHandleW }}
            onPointerDown={(e) => handleResizePointerDown(e, 'w')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
          />
          <div
            style={{ ...styles.resizeHandle, ...styles.resizeHandleNW }}
            onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
          />
          <div
            style={{ ...styles.resizeHandle, ...styles.resizeHandleNE }}
            onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
          />
          <div
            style={{ ...styles.resizeHandle, ...styles.resizeHandleSW }}
            onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
          />
          <div
            style={{ ...styles.resizeHandle, ...styles.resizeHandleSE }}
            onPointerDown={(e) => handleResizePointerDown(e, 'se')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
          />
        </>
      )}
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export default CapsuleWindowFrame;
