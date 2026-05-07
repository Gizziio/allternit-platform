"use client";

import React from 'react';
import {
  Minus,
  Plus,
  ArrowsOutSimple,
  GridFour,
  ChatTeardropText,
  Browser,
  GitDiff,
  SquaresFour,
  Terminal as TerminalIcon,
  NotePencil,
  Shield,
  BookBookmark,
  GitCommit,
  Monitor,
  Plugs,
  Graph,
  DownloadSimple,
  UploadSimple,
} from '@phosphor-icons/react';
import {
  useCodeModeStore,
  type CodeCanvasTile,
  type CodeCanvasViewport,
} from '@/views/code/CodeModeStore';
import { useCodeSessionStore } from '@/views/code/CodeSessionStore';

interface CanvasToolbarProps {
  workspaceId: string;
  viewport: CodeCanvasViewport;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitView?: () => void;
  onAudit?: () => void;
  onCommit?: () => void;
  onDiff?: () => void;
  onDashboard?: () => void;
  onHooks?: () => void;
  onMcp?: () => void;
  onExport?: () => void;
  onImport?: () => void;
}

export function CanvasToolbar({
  workspaceId,
  viewport,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitView,
  onAudit,
  onCommit,
  onDiff,
  onDashboard,
  onHooks,
  onMcp,
  onExport,
  onImport,
}: CanvasToolbarProps) {
  const addCanvasTile = useCodeModeStore((s) => s.addCanvasTile);
  const autoArrange = useCodeModeStore((s) => s.autoArrangeCanvasTiles);
  const setWorkspaceLayoutMode = useCodeModeStore((s) => s.setWorkspaceLayoutMode);
  const createCodeSession = useCodeSessionStore((s) => s.createSession);

  const spawnTile = async (type: CodeCanvasTile['type']) => {
    const centerX = -viewport.x / viewport.zoom + (window.innerWidth / 2 / viewport.zoom) - 240;
    const centerY = -viewport.y / viewport.zoom + (window.innerHeight / 2 / viewport.zoom) - 180;

    let sessionId: string | undefined;
    if (type === 'session') {
      try {
        sessionId = await createCodeSession({
          name: 'Canvas Session',
          workspaceId,
        });
      } catch (err) {
        console.error('[CanvasToolbar] Failed to create session:', err);
      }
    }

    addCanvasTile(workspaceId, {
      type,
      sessionId,
      x: Math.round(centerX),
      y: Math.round(centerY),
      width: 480,
      height: 360,
      zIndex: Date.now(),
      label: type === 'session' ? 'New Session' : type,
    });
  };

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 32,
    padding: '0 12px',
    borderRadius: 10,
    border: '1px solid var(--glass-border)',
    background: 'var(--glass-bg)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 14,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Zoom controls */}
      <button onClick={onZoomOut} style={{ ...buttonStyle, padding: '0 8px', width: 32 }}>
        <Minus size={14} />
      </button>
      <button onClick={onResetZoom} style={{ ...buttonStyle, minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(viewport.zoom * 100)}%
      </button>
      <button onClick={onZoomIn} style={{ ...buttonStyle, padding: '0 8px', width: 32 }}>
        <Plus size={14} />
      </button>
      {onFitView && (
        <button onClick={onFitView} style={{ ...buttonStyle, padding: '0 8px', width: 32 }} title="Fit all tiles">
          <ArrowsOutSimple size={14} />
        </button>
      )}

      <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />

      {/* Spawn tiles */}
      <button onClick={() => void spawnTile('session')} style={buttonStyle}>
        <ChatTeardropText size={14} />
        Session
      </button>
      <button onClick={() => void spawnTile('preview')} style={buttonStyle}>
        <Browser size={14} />
        Preview
      </button>
      <button onClick={() => void spawnTile('diff')} style={buttonStyle}>
        <GitDiff size={14} />
        Diff
      </button>
      <button onClick={() => void spawnTile('terminal')} style={buttonStyle}>
        <TerminalIcon size={14} />
        Terminal
      </button>
      <button onClick={() => void spawnTile('notes')} style={buttonStyle}>
        <NotePencil size={14} />
        Notes
      </button>
      <button onClick={() => void spawnTile('knowledge')} style={buttonStyle}>
        <BookBookmark size={14} />
        Knowledge
      </button>

      <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />

      <button onClick={() => autoArrange(workspaceId)} style={buttonStyle}>
        <SquaresFour size={14} />
        Arrange
      </button>

      <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />

      <button onClick={() => setWorkspaceLayoutMode(workspaceId, 'thread')} style={buttonStyle}>
        Thread View
      </button>

      {onAudit && (
        <>
          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />
          <button onClick={onAudit} style={buttonStyle} title="Workspace Audit">
            <Shield size={14} />
            Audit
          </button>
        </>
      )}

      {onCommit && (
        <button onClick={onCommit} style={buttonStyle} title="Commit with Provenance">
          <GitCommit size={14} />
          Commit
        </button>
      )}

      {onDiff && (
        <button onClick={onDiff} style={buttonStyle} title="Reasoning Diff">
          <GitDiff size={14} />
          Diff
        </button>
      )}

      {onDashboard && (
        <button onClick={onDashboard} style={buttonStyle} title="h5i Dashboard">
          <Monitor size={14} />
          Dashboard
        </button>
      )}

      {onHooks && (
        <button onClick={onHooks} style={buttonStyle} title="Install Agent Hooks">
          <Plugs size={14} />
          Hooks
        </button>
      )}

      {onMcp && (
        <button onClick={onMcp} style={buttonStyle} title="MCP Server Config">
          <Plugs size={14} />
          MCP
        </button>
      )}

      <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />

      {onExport && (
        <button onClick={onExport} style={{ ...buttonStyle, padding: '0 8px', width: 32 }} title="Export layout">
          <DownloadSimple size={14} />
        </button>
      )}
      {onImport && (
        <button onClick={onImport} style={{ ...buttonStyle, padding: '0 8px', width: 32 }} title="Import layout">
          <UploadSimple size={14} />
        </button>
      )}
    </div>
  );
}
