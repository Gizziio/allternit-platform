"use client";

import React from 'react';
import { ArrowsIn } from '@phosphor-icons/react';
import type { CodeCanvasTile, CodeWorkspaceRecord } from './CodeModeStore';
import { CodeCanvasTileSession } from '@/components/canvas/CodeCanvasTileSession';
import { CodeCanvasTilePreview } from '@/components/canvas/CodeCanvasTilePreview';
import { CodeCanvasTileDiff } from '@/components/canvas/CodeCanvasTileDiff';
import { CodeCanvasTileTerminal } from '@/components/canvas/CodeCanvasTileTerminal';
import { CodeCanvasTileNotes } from '@/components/canvas/CodeCanvasTileNotes';
import { CodeCanvasTileKnowledge } from '@/components/canvas/CodeCanvasTileKnowledge';
import { CodeCanvasTileKnowledgeGraph } from '@/components/canvas/CodeCanvasTileKnowledgeGraph';

interface CodeFocusViewProps {
  tile: CodeCanvasTile;
  workspace: CodeWorkspaceRecord;
  onExit: () => void;
}

export function CodeFocusView({ tile, workspace, onExit }: CodeFocusViewProps) {
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
          borderBottom: '1px solid var(--ui-border-muted)',
          background: 'var(--surface-floating)',
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
                              : 'var(--ui-text-muted)',
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ui-text-secondary)',
            }}
          >
            {tile.label || tile.type} — Focus Mode
          </span>
        </div>

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
            border: '1px solid var(--ui-border-default)',
            background: 'var(--surface-hover)',
            color: 'var(--ui-text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <ArrowsIn size={14} />
          Back to Canvas
        </button>
      </div>

      {/* Full-width tile content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <FocusTileContent tile={tile} workspacePath={workspace?.root_path} />
      </div>
    </div>
  );
}

function FocusTileContent({ tile, workspacePath }: { tile: CodeCanvasTile; workspacePath?: string }) {
  switch (tile.type) {
    case 'session':
      if (!tile.sessionId) {
        return (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ui-text-muted)', fontSize: 13 }}>
            No session linked
          </div>
        );
      }
      return <CodeCanvasTileSession sessionId={tile.sessionId} workspacePath={workspacePath} />;
    case 'preview':
      return <CodeCanvasTilePreview url={tile.url} filePath={tile.filePath} />;
    case 'diff':
      return <CodeCanvasTileDiff diffText={tile.diffText} filePath={tile.filePath} />;
    case 'terminal':
      return <CodeCanvasTileTerminal workspacePath={workspacePath} />;
    case 'notes':
      return <CodeCanvasTileNotes />;
    case 'knowledge':
      return workspacePath ? <CodeCanvasTileKnowledge workspacePath={workspacePath} /> : null;
    case 'knowledge-graph':
      return <CodeCanvasTileKnowledgeGraph workspacePath={workspacePath} />;
    default:
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ui-text-muted)', fontSize: 13 }}>
          Unknown tile type: {tile.type}
        </div>
      );
  }
}
