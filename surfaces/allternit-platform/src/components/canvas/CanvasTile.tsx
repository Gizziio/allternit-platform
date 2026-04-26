"use client";

import React, { useRef, useCallback, useState } from 'react';
import type { CodeCanvasTile } from '@/views/code/CodeModeStore';
import { X, ArrowsOut, ArrowsIn } from '@phosphor-icons/react';

interface CanvasTileProps {
  tile: CodeCanvasTile;
  onMove: (updates: { x: number; y: number }) => void;
  onResize: (updates: { width: number; height: number }) => void;
  onFocus: () => void;
  onClose?: () => void;
  onBringToFront?: () => void;
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

export function CanvasTile({
  tile,
  onMove,
  onResize,
  onFocus,
  onClose,
  onBringToFront,
  children,
}: CanvasTileProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tileX: 0, tileY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      onBringToFront?.();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, tileX: tile.x, tileY: tile.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [tile.x, tile.y, onBringToFront],
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
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      resizeStart.current = { x: e.clientX, y: e.clientY, w: tile.width, h: tile.height };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [tile.width, tile.height],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      onResize({
        width: Math.min(MAX_W, Math.max(MIN_W, snap(resizeStart.current.w + dx, SNAP))),
        height: Math.min(MAX_H, Math.max(MIN_H, snap(resizeStart.current.h + dy, SNAP))),
      });
    },
    [isResizing, onResize],
  );

  const handleResizePointerUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  return (
    <div
      data-canvas-tile
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
        border: '1px solid var(--glass-border)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-lg)',
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
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Tile Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>

      {/* Resize Handle */}
      <div
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerLeave={handleResizePointerUp}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          padding: '0 4px 4px 0',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRight: '2px solid rgba(255,255,255,0.2)',
            borderBottom: '2px solid rgba(255,255,255,0.2)',
            borderRadius: '0 0 2px 0',
          }}
        />
      </div>
    </div>
  );
}
