"use client";

import React from 'react';
import type { CodeCanvasViewport } from '@/views/code/CodeModeStore';

interface CanvasGridProps {
  viewport: CodeCanvasViewport;
}

export function CanvasGrid({ viewport }: CanvasGridProps) {
  const majorSize = 64;
  const minorSize = 22;
  const majorScreenSize = majorSize * viewport.zoom;
  const minorScreenSize = minorSize * viewport.zoom;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 50%), var(--view-code-bg, var(--surface-canvas))',
      }}
    >
      {/* Major scanline grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: `${majorScreenSize}px ${majorScreenSize}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
        }}
      />
      {/* Minor dot grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: `${minorScreenSize}px ${minorScreenSize}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />
    </div>
  );
}
