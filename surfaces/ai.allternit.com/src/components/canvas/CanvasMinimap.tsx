"use client";

import React, { useState, useCallback, useRef } from 'react';
import type { CodeCanvasTile, CodeCanvasViewport } from '@/views/code/CodeModeStore';

interface CanvasMinimapProps {
  tiles: CodeCanvasTile[];
  viewport: CodeCanvasViewport;
  onViewportChange: (viewport: CodeCanvasViewport) => void;
}

const MINIMAP_SIZE = 160;

export function CanvasMinimap({ tiles, viewport, onViewportChange }: CanvasMinimapProps) {
  const [windowSize, setWindowSize] = React.useState({ w: window.innerWidth, h: window.innerHeight });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, vpX: 0, vpY: 0 });

  React.useEffect(() => {
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Compute bounding box of all tiles
  const bounds = React.useMemo(() => {
    if (tiles.length === 0) {
      return { minX: 0, minY: 0, maxX: 2000, maxY: 1500 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const tile of tiles) {
      minX = Math.min(minX, tile.x);
      minY = Math.min(minY, tile.y);
      maxX = Math.max(maxX, tile.x + tile.width);
      maxY = Math.max(maxY, tile.y + tile.height);
    }
    // Add padding
    const padding = 200;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    };
  }, [tiles]);

  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;
  const scaleX = MINIMAP_SIZE / worldWidth;
  const scaleY = MINIMAP_SIZE / worldHeight;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (MINIMAP_SIZE - worldWidth * scale) / 2;
  const offsetY = (MINIMAP_SIZE - worldHeight * scale) / 2;

  // Viewport rect in minimap coords
  const vpX = offsetX + (-viewport.x / viewport.zoom - bounds.minX) * scale;
  const vpY = offsetY + (-viewport.y / viewport.zoom - bounds.minY) * scale;
  const vpW = (windowSize.w / viewport.zoom) * scale;
  const vpH = (windowSize.h / viewport.zoom) * scale;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, vpX: viewport.x, vpY: viewport.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [viewport.x, viewport.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    // Convert minimap pixels to world pixels
    const worldDx = -dx / scale * viewport.zoom;
    const worldDy = -dy / scale * viewport.zoom;
    onViewportChange({
      x: dragStart.current.vpX + worldDx,
      y: dragStart.current.vpY + worldDy,
      zoom: viewport.zoom,
    });
  }, [onViewportChange, viewport.zoom, scale]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert minimap coords to world coords
    const worldX = (clickX - offsetX) / scale + bounds.minX;
    const worldY = (clickY - offsetY) / scale + bounds.minY;

    // Center viewport on click
    onViewportChange({
      x: -(worldX * viewport.zoom) + windowSize.w / 2,
      y: -(worldY * viewport.zoom) + windowSize.h / 2,
      zoom: viewport.zoom,
    });
  };

  if (tiles.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 100,
        width: MINIMAP_SIZE + 8,
        height: MINIMAP_SIZE + 8,
        padding: 4,
        borderRadius: 12,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass-bg-thick)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          width: MINIMAP_SIZE,
          height: MINIMAP_SIZE,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 8,
          background: 'var(--bg-hover)',
          cursor: isDragging.current ? 'grabbing' : 'pointer',
        }}
      >
        {/* Tiles */}
        {tiles.map((tile) => (
          <div
            key={tile.tileId}
            style={{
              position: 'absolute',
              left: offsetX + (tile.x - bounds.minX) * scale,
              top: offsetY + (tile.y - bounds.minY) * scale,
              width: Math.max(2, tile.width * scale),
              height: Math.max(2, tile.height * scale),
              borderRadius: 2,
              background:
                tile.type === 'session'
                  ? 'var(--status-info)'
                  : tile.type === 'preview'
                    ? 'var(--status-success)'
                    : tile.type === 'diff'
                      ? 'var(--status-warning)'
                      : tile.type === 'terminal'
                        ? 'var(--accent-cowork)'
                        : tile.type === 'knowledge'
                          ? 'var(--accent-primary)'
                          : tile.type === 'knowledge-graph'
                            ? '#8b5cf6'
                            : 'var(--text-muted)',
              border: tile.zIndex === Math.max(...tiles.map((t) => t.zIndex))
                ? '1px solid var(--border-strong)'
                : 'none',
            }}
            title={tile.label || tile.type}
          />
        ))}

        {/* Viewport rect */}
        <div
          style={{
            position: 'absolute',
            left: vpX,
            top: vpY,
            width: Math.max(4, vpW),
            height: Math.max(4, vpH),
            borderRadius: 2,
            border: '1.5px solid var(--border-default)',
            background: 'var(--bg-hover)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
