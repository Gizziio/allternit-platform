"use client";

import React, { useRef, useCallback, useState } from 'react';
import type { CodeCanvasTile } from '@/views/code/CodeModeStore';
import { X, ArrowsOut } from '@phosphor-icons/react';

interface CanvasTileProps {
  tile: CodeCanvasTile;
  selected?: boolean;
  onMove: (updates: { x: number; y: number }) => void;
  onResize: (updates: { x?: number; y?: number; width: number; height: number }) => void;
  onFocus: () => void;
  onClose?: () => void;
  onBringToFront?: () => void;
  onSelect?: () => void;
  children: React.ReactNode;
}

const MIN_W = 320;
const MIN_H = 240;
const MAX_W = 1200;
const MAX_H = 900;
const SNAP = 8;

function snap(value: number, grid: number) {
  return Math.round(value / grid) * grid;
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
};

export function CanvasTile({
  tile,
  selected,
  onMove,
  onResize,
  onFocus,
  onClose,
  onBringToFront,
  onSelect,
  children,
}: CanvasTileProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const dragStart = useRef({ x: 0, y: 0, tileX: 0, tileY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, tileX: 0, tileY: 0, w: 0, h: 0 });

  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      onBringToFront?.();
      onSelect?.();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, tileX: tile.x, tileY: tile.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [tile.x, tile.y, onBringToFront, onSelect],
  );

  const handleHeaderPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      onMove({
        x: snap(dragStart.current.tileX + dx, SNAP),
        y: snap(dragStart.current.tileY + dy, SNAP),
      });
    },
    [isDragging, onMove],
  );

  const handleHeaderPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, handle: ResizeHandle) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect?.();
      setActiveHandle(handle);
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        tileX: tile.x,
        tileY: tile.y,
        w: tile.width,
        h: tile.height,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [tile.x, tile.y, tile.width, tile.height, onSelect],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeHandle) return;
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;

      let newX = resizeStart.current.tileX;
      let newY = resizeStart.current.tileY;
      let newW = resizeStart.current.w;
      let newH = resizeStart.current.h;

      if (activeHandle.includes('e')) {
        newW = Math.min(MAX_W, Math.max(MIN_W, snap(resizeStart.current.w + dx, SNAP)));
      }
      if (activeHandle.includes('w')) {
        const rawW = resizeStart.current.w - dx;
        const clampedW = Math.min(MAX_W, Math.max(MIN_W, snap(rawW, SNAP)));
        newX = resizeStart.current.tileX + (resizeStart.current.w - clampedW);
        newW = clampedW;
      }
      if (activeHandle.includes('s')) {
        newH = Math.min(MAX_H, Math.max(MIN_H, snap(resizeStart.current.h + dy, SNAP)));
      }
      if (activeHandle.includes('n')) {
        const rawH = resizeStart.current.h - dy;
        const clampedH = Math.min(MAX_H, Math.max(MIN_H, snap(rawH, SNAP)));
        newY = resizeStart.current.tileY + (resizeStart.current.h - clampedH);
        newH = clampedH;
      }

      onResize({ x: newX, y: newY, width: newW, height: newH });
    },
    [activeHandle, onResize],
  );

  const handleResizePointerUp = useCallback(() => {
    setActiveHandle(null);
  }, []);

  const makeHandle = (handle: ResizeHandle, style: React.CSSProperties) => (
    <div
      key={handle}
      onPointerDown={(e) => handleResizePointerDown(e, handle)}
      onPointerMove={handleResizePointerMove}
      onPointerUp={handleResizePointerUp}
      onPointerLeave={handleResizePointerUp}
      style={{
        position: 'absolute',
        zIndex: 10,
        ...style,
        cursor: HANDLE_CURSORS[handle],
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: handle.length === 2 ? 6 : handle === 'n' || handle === 's' ? 16 : 6,
            height: handle.length === 2 ? 6 : handle === 'e' || handle === 'w' ? 16 : 6,
            background: activeHandle === handle ? 'var(--accent-primary)' : 'rgba(255,255,255,0.25)',
            borderRadius: handle.length === 2 ? '50%' : 2,
            transition: 'background 0.15s',
          }}
        />
      </div>
    </div>
  );

  return (
    <div
      data-canvas-tile
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      style={{
        position: 'absolute',
        left: tile.x,
        top: tile.y,
        width: tile.width,
        height: tile.height,
        zIndex: tile.zIndex,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-floating)',
        border: selected
          ? '2px solid var(--accent-primary)'
          : '1px solid var(--glass-border)',
        borderRadius: 14,
        boxShadow: selected ? '0 0 0 4px rgba(176,141,110,0.15), var(--shadow-lg)' : 'var(--shadow-lg)',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        animation: 'canvasTileSpawn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Tile Header */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerLeave={handleHeaderPointerUp}
        onDoubleClick={onFocus}
        style={{
          height: 36,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px 0 14px',
          borderBottom: '1px solid var(--border-subtle)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background:
                tile.type === 'session'
                  ? 'var(--status-info)'
                  : tile.type === 'preview'
                    ? 'var(--status-success)'
                    : tile.type === 'diff'
                      ? 'var(--status-warning)'
                      : tile.type === 'terminal'
                        ? 'var(--accent-cowork)'
                        : tile.type === 'notes'
                          ? 'var(--accent-secondary)'
                          : tile.type === 'knowledge'
                            ? 'var(--accent-primary)'
                            : tile.type === 'knowledge-graph'
                              ? '#8b5cf6'
                              : 'var(--text-muted)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {tile.label || tile.type}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
            }}
            title="Focus"
            style={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <ArrowsOut size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            title="Close"
            style={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
              e.currentTarget.style.color = 'var(--status-error)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Tile Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>

      {/* Resize Handles */}
      {makeHandle('nw', { top: -4, left: -4, width: 12, height: 12 })}
      {makeHandle('n', { top: -4, left: 12, right: 12, height: 8 })}
      {makeHandle('ne', { top: -4, right: -4, width: 12, height: 12 })}
      {makeHandle('e', { top: 12, right: -4, bottom: 12, width: 8 })}
      {makeHandle('se', { bottom: -4, right: -4, width: 12, height: 12 })}
      {makeHandle('s', { bottom: -4, left: 12, right: 12, height: 8 })}
      {makeHandle('sw', { bottom: -4, left: -4, width: 12, height: 12 })}
      {makeHandle('w', { top: 12, left: -4, bottom: 12, width: 8 })}
    </div>
  );
}
