"use client";

import React, { useCallback, useRef, useState } from "react";
import { X, ArrowsOut } from '@phosphor-icons/react';
import { CodeCanvasTile } from "@/views/code/CodeModeStore";

interface CanvasTileProps {
  tile: CodeCanvasTile;
  selected?: boolean;
  zoom?: number;
  onMove: (updates: { x: number; y: number }) => void;
  onResize: (updates: { x?: number; y?: number; width: number; height: number }) => void;
  onFocus: () => void;
  onClose?: () => void;
  onBringToFront?: () => void;
  onInteractionStart?: () => void;
  onSelect?: (additive: boolean) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
  /** Optional status badge rendered next to the label (e.g. executor state). */
  badge?: React.ReactNode;
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
  zoom = 1,
  onMove,
  onResize,
  onFocus,
  onClose,
  onBringToFront,
  onInteractionStart,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onClick,
  badge,
  children,
}: CanvasTileProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const dragStart = useRef({ x: 0, y: 0, tileX: 0, tileY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, tileX: 0, tileY: 0, w: 0, h: 0 });

  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button')) return;
      e.stopPropagation();
      onInteractionStart?.();
      onBringToFront?.();
      onSelect?.(e.shiftKey);
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, tileX: tile.x, tileY: tile.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [tile.x, tile.y, onBringToFront, onInteractionStart, onSelect],
  );

  const handleHeaderPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      onMove({
        x: snap(dragStart.current.tileX + dx, SNAP),
        y: snap(dragStart.current.tileY + dy, SNAP),
      });
    },
    [isDragging, onMove, zoom],
  );

  const handleHeaderPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, handle: ResizeHandle) => {
      e.stopPropagation();
      e.preventDefault();
      onInteractionStart?.();
      onBringToFront?.();
      onSelect?.(e.shiftKey);
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
    [tile.x, tile.y, tile.width, tile.height, onBringToFront, onInteractionStart, onSelect],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeHandle) return;
      const dx = (e.clientX - resizeStart.current.x) / zoom;
      const dy = (e.clientY - resizeStart.current.y) / zoom;

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
    [activeHandle, onResize, zoom],
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
      onPointerCancel={handleResizePointerUp}
      onClick={(e) => e.stopPropagation()}
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
      role="group"
      aria-label={`${tile.label || tile.type} canvas tile`}
      data-canvas-tile
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(e.shiftKey);
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
        borderRadius: 12,
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
        onPointerCancel={handleHeaderPointerUp}
        onClick={(e) => e.stopPropagation()}
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
                              : tile.type === 'executor'
                                ? 'var(--status-info)'
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
          {badge}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button type="button"
            aria-label={`Focus ${tile.label || tile.type}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
            }}
            title="Focus"
            className="flex items-center justify-center rounded-md border-0 bg-transparent text-[var(--text-muted)] cursor-pointer transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
            style={{
              width: 24,
              height: 24,
            }}
          >
            <ArrowsOut size={13} />
          </button>
          <button type="button"
            aria-label={`Close ${tile.label || tile.type}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            title="Close"
            className="flex items-center justify-center rounded-md border-0 bg-transparent text-[var(--text-muted)] cursor-pointer transition-colors hover:bg-[var(--status-error-bg)] hover:text-[var(--status-error)]"
            style={{
              width: 24,
              height: 24,
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Tile Content */}
      <div
        style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(e.shiftKey);
          onClick?.();
        }}
      >
        {children}
      </div>

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
