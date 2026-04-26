"use client";

import React from 'react';
import { ArrowsIn, X } from '@phosphor-icons/react';
import type { CodeCanvasTile, CodeWorkspaceRecord } from './CodeModeStore';
import { CodeCanvasTileSession } from '@/components/canvas/CodeCanvasTileSession';

interface CodeFocusViewProps {
  tile: CodeCanvasTile;
  workspace: CodeWorkspaceRecord;
  onExit: () => void;
}

export function CodeFocusView({ tile, onExit }: CodeFocusViewProps) {
  return (
    <div
      data-testid="code-focus-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--shell-frame-bg)',
      }}
    >
      {/* Focus header */}
      <div
        style={{
          height: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(11, 14, 16, 0.60)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#555',
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            {tile.label || tile.type} — Focus Mode
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onExit}
            title="Back to canvas"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ArrowsIn size={14} />
            Back to Canvas
          </button>
        </div>
      </div>

      {/* Full-width tile content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tile.type === 'session' && tile.sessionId ? (
          <CodeCanvasTileSession sessionId={tile.sessionId} />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
          >
            Focus view for {tile.type} tiles coming in Phase 3
          </div>
        )}
      </div>
    </div>
  );
}
