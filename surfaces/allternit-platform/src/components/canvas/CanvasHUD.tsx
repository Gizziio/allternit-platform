"use client";

import React from 'react';
import type { CodeCanvasTile } from '@/views/code/CodeModeStore';
import { useCodeSessionStore } from '@/views/code/CodeSessionStore';

interface CanvasHUDProps {
  tiles: CodeCanvasTile[];
}

export function CanvasHUD({ tiles }: CanvasHUDProps) {
  const streamingBySession = useCodeSessionStore((s) => s.streamingBySession);

  const sessionTiles = tiles.filter((t) => t.type === 'session' && t.sessionId);
  const streamingCount = sessionTiles.filter(
    (t) => t.sessionId && streamingBySession[t.sessionId]?.isStreaming,
  ).length;
  const idleCount = sessionTiles.length - streamingCount;

  if (sessionTiles.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 1000,
        padding: '8px 14px',
        borderRadius: 12,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: streamingCount > 0 ? 'var(--accent-secondary)' : 'var(--text-muted)',
          boxShadow: streamingCount > 0 ? 'var(--shadow-glow)' : 'none',
        }}
      />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
        {sessionTiles.length} SESSION{sessionTiles.length !== 1 ? 'S' : ''}
      </span>
      {streamingCount > 0 && (
        <span style={{ fontSize: 10, color: 'var(--accent-agent, #f97316)', fontWeight: 500 }}>
          {streamingCount} WORKING
        </span>
      )}
      {idleCount > 0 && streamingCount === 0 && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
          {idleCount} IDLE
        </span>
      )}
    </div>
  );
}
