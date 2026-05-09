"use client";

import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { CodeCanvasViewport } from '@/views/code/CodeModeStore';
import { CanvasGrid } from './CanvasGrid';

interface InfiniteCanvasProps {
  viewport: CodeCanvasViewport;
  onViewportChange: (viewport: CodeCanvasViewport) => void;
  children: React.ReactNode;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;
const INERTIA_DECAY = 0.92;
const INERTIA_THRESHOLD = 0.5;

export function InfiniteCanvas({ viewport, onViewportChange, children }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const viewportStart = useRef({ x: 0, y: 0 });
  const [cursor, setCursor] = useState<'grab' | 'grabbing'>('grab');

  // Touch pinch zoom state
  const touchStartDist = useRef(0);
  const touchStartZoom = useRef(1);
  const touchCenter = useRef({ x: 0, y: 0 });

  // Momentum / inertia
  const velocity = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0, t: 0 });
  const rafId = useRef<number>(0);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const updateViewport = useCallback(
    (updater: (v: CodeCanvasViewport) => CodeCanvasViewport) => {
      onViewportChange(updater(viewport));
    },
    [onViewportChange, viewport],
  );

  const stopInertia = useCallback(() => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
    velocity.current = { x: 0, y: 0 };
  }, []);

  const startInertia = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    const step = () => {
      velocity.current.x *= INERTIA_DECAY;
      velocity.current.y *= INERTIA_DECAY;
      if (
        Math.abs(velocity.current.x) < INERTIA_THRESHOLD &&
        Math.abs(velocity.current.y) < INERTIA_THRESHOLD
      ) {
        rafId.current = 0;
        return;
      }
      onViewportChange({
        ...viewport,
        x: viewport.x + velocity.current.x,
        y: viewport.y + velocity.current.y,
      });
      rafId.current = requestAnimationFrame(step);
    };
    rafId.current = requestAnimationFrame(step);
  }, [onViewportChange, viewport]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only pan on middle mouse or when not clicking a tile
      if (e.button !== 1 && (e.target as HTMLElement).closest('[data-canvas-tile]')) {
        return;
      }
      e.preventDefault();
      stopInertia();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      viewportStart.current = { x: viewport.x, y: viewport.y };
      lastPos.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      velocity.current = { x: 0, y: 0 };
      setCursor('grabbing');
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [viewport.x, viewport.y, stopInertia],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      onViewportChange({
        ...viewport,
        x: viewportStart.current.x + dx,
        y: viewportStart.current.y + dy,
      });
      const now = performance.now();
      const dt = now - lastPos.current.t;
      if (dt > 0) {
        velocity.current = {
          x: (e.clientX - lastPos.current.x) / dt * 16,
          y: (e.clientY - lastPos.current.y) / dt * 16,
        };
      }
      lastPos.current = { x: e.clientX, y: e.clientY, t: now };
    },
    [onViewportChange, viewport],
  );

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
    setCursor('grab');
    const speed = Math.hypot(velocity.current.x, velocity.current.y);
    if (speed > INERTIA_THRESHOLD) {
      startInertia();
    }
  }, [startInertia]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        // Allow normal scroll if not zooming
        return;
      }
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = -e.deltaY * 0.001;
      const newZoom = clampZoom(viewport.zoom + delta);

      // Zoom toward mouse pointer
      const scaleRatio = newZoom / viewport.zoom;
      const newX = mouseX - (mouseX - viewport.x) * scaleRatio;
      const newY = mouseY - (mouseY - viewport.y) * scaleRatio;

      onViewportChange({ x: newX, y: newY, zoom: newZoom });
    },
    [onViewportChange, viewport],
  );

  // Touch pinch-to-zoom
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist.current = Math.hypot(dx, dy);
        touchStartZoom.current = viewport.zoom;
        touchCenter.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    },
    [viewport.zoom],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / touchStartDist.current;
        const newZoom = clampZoom(touchStartZoom.current * scale);

        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const centerX = touchCenter.current.x - rect.left;
        const centerY = touchCenter.current.y - rect.top;

        const scaleRatio = newZoom / viewport.zoom;
        const newX = centerX - (centerX - viewport.x) * scaleRatio;
        const newY = centerY - (centerY - viewport.y) * scaleRatio;

        onViewportChange({ x: newX, y: newY, zoom: newZoom });
      }
    },
    [onViewportChange, viewport],
  );

  const handleTouchEnd = useCallback(() => {
    touchStartDist.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="infinite-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <CanvasGrid viewport={viewport} />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export { MIN_ZOOM, MAX_ZOOM };
