"use client";

import React from 'react';
import type { CodeCanvasViewport } from '@/views/code/CodeModeStore';

interface CanvasGridProps {
  viewport: CodeCanvasViewport;
}

export function CanvasGrid({ viewport }: CanvasGridProps) {
  const majorSize = 64;
  const minorSize = 22;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Major scanline grid */}
      <div
        style={{
          position: 'absolute',
          inset: '-200%',
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: `${majorSize}px ${majorSize}px`,
          transform: `translate(${viewport.x % majorSize}px, ${viewport.y % majorSize}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          width: '400%',
          height: '400%',
        }}
      />
      {/* Minor dot grid */}
      <div
        style={{
          position: 'absolute',
          inset: '-200%',
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: `${minorSize}px ${minorSize}px`,
          transform: `translate(${viewport.x % minorSize}px, ${viewport.y % minorSize}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          width: '400%',
          height: '400%',
        }}
      />
    </div>
  );
}
