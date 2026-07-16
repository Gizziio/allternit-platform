"use client";

import React from 'react';
import { ArrowsIn, X } from '@phosphor-icons/react';
import { useCodeModeStore, type CodeCanvasTile, type CodeWorkspaceRecord } from './CodeModeStore';
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
  onClose: () => void;
}

export function CodeFocusView({ tile, workspace, onExit, onClose }: CodeFocusViewProps) {
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button"
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
          <button
            type="button"
            onClick={onClose}
            title="Close window"
            aria-label={`Close ${tile.label || tile.type}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              padding: 0,
              borderRadius: 10,
              border: '1px solid var(--ui-border-default)',
              background: 'transparent',
              color: 'var(--ui-text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Full-width tile content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <FocusTileContent
          tile={tile}
          workspaceId={workspace.workspace_id}
          workspacePath={workspace.root_path}
        />
      </div>
    </div>
  );
}

function FocusTileContent({
  tile,
  workspaceId,
  workspacePath,
}: {
  tile: CodeCanvasTile;
  workspaceId: string;
  workspacePath?: string;
}) {
  const updateCanvasTile = useCodeModeStore((state) => state.updateCanvasTile);

  switch (tile.type) {
    case 'session':
      return (
        <CodeCanvasTileSession
          sessionId={tile.sessionId}
          workspaceId={workspaceId}
          workspacePath={workspacePath}
          onSessionCreated={(sessionId) =>
            updateCanvasTile(
              workspaceId,
              tile.tileId,
              { sessionId },
              { recordHistory: false },
            )
          }
        />
      );
    case 'preview':
      return <CodeCanvasTilePreview url={tile.url} filePath={tile.filePath} />;
    case 'diff':
      return <CodeCanvasTileDiff diffText={tile.diffText} filePath={tile.filePath} />;
    case 'terminal':
      return (
        <CodeCanvasTileTerminal
          terminalId={tile.tileId}
          sessionId={tile.sessionId}
          workspacePath={workspacePath}
        />
      );
    case 'notes':
      return (
        <CodeCanvasTileNotes
          initialContent={tile.content ?? ''}
          onChange={(content) =>
            updateCanvasTile(
              workspaceId,
              tile.tileId,
              { content },
              { recordHistory: false },
            )
          }
        />
      );
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
