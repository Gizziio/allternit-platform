"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Minus,
  Plus,
  ArrowsOutSimple,
  ChatTeardropText,
  Browser,
  GitDiff,
  SquaresFour,
  Terminal as TerminalIcon,
  NotePencil,
  Shield,
  BookBookmark,
  Graph,
  GitCommit,
  Monitor,
  Plugs,
  DownloadSimple,
  UploadSimple,
  DotsThree,
} from '@phosphor-icons/react';
import {
  useCodeModeStore,
  type CodeCanvasTile,
  type CodeCanvasViewport,
} from '@/views/code/CodeModeStore';
import { useCodeSessionStore } from '@/views/code/CodeSessionStore';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CanvasToolbar');

interface CanvasToolbarProps {
  workspaceId: string;
  viewport: CodeCanvasViewport;
  canvasSize: { width: number; height: number };
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
  canvasSize,
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
  const createCodeSession = useCodeSessionStore((s) => s.createSession);

  const spawnTile = async (type: CodeCanvasTile['type']) => {
    if (!workspaceId) return;
    const centerX = (canvasSize.width / 2 - viewport.x) / viewport.zoom - 240;
    const centerY = (canvasSize.height / 2 - viewport.y) / viewport.zoom - 180;

    let sessionId: string | undefined;
    if (type === 'session') {
      try {
        sessionId = await createCodeSession({
          name: 'Canvas Session',
          workspaceId,
        });
      } catch (err) {
        logger.error({ err: err }, 'Failed to create session');
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
    width: 34,
    height: 34,
    padding: 0,
    borderRadius: 9,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
  };

  return (
    <div
      role="toolbar"
      aria-label="Canvas tools"
      style={{
        position: 'absolute',
        top: '50%',
        left: 14,
        transform: 'translateY(-50%)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: 5,
        borderRadius: 13,
        border: '1px solid var(--glass-border)',
        background: 'var(--surface-floating)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'var(--shadow-md)',
        maxHeight: 'calc(100% - 112px)',
      }}
    >
      <SpawnMenu onSpawn={spawnTile} buttonStyle={buttonStyle} />
      <ToolbarButton label="Arrange tiles" onClick={() => autoArrange(workspaceId)} style={buttonStyle}>
        <SquaresFour size={16} />
      </ToolbarButton>
      {onFitView && (
        <ToolbarButton label="Fit all tiles" onClick={onFitView} style={buttonStyle}>
          <ArrowsOutSimple size={16} />
        </ToolbarButton>
      )}

      {(onAudit || onCommit || onDiff || onDashboard || onHooks || onMcp) && (
        <>
          <ToolbarSeparator />
          <CanvasActionsMenu
            buttonStyle={buttonStyle}
            items={[
              ...(onAudit ? [{ label: 'Workspace audit', icon: <Shield size={15} />, onClick: onAudit }] : []),
              ...(onCommit ? [{ label: 'Commit with provenance', icon: <GitCommit size={15} />, onClick: onCommit }] : []),
              ...(onDiff ? [{ label: 'Reasoning diff', icon: <GitDiff size={15} />, onClick: onDiff }] : []),
              ...(onDashboard ? [{ label: 'Open dashboard', icon: <Monitor size={15} />, onClick: onDashboard }] : []),
              ...(onHooks ? [{ label: 'Agent hooks', icon: <Plugs size={15} />, onClick: onHooks }] : []),
              ...(onMcp ? [{ label: 'MCP server settings', icon: <Graph size={15} />, onClick: onMcp }] : []),
            ]}
          />
        </>
      )}

      <ToolbarSeparator />

      {onExport && (
        <ToolbarButton label="Export canvas" onClick={onExport} style={buttonStyle}>
          <DownloadSimple size={16} />
        </ToolbarButton>
      )}
      {onImport && (
        <ToolbarButton label="Import canvas" onClick={onImport} style={buttonStyle}>
          <UploadSimple size={16} />
        </ToolbarButton>
      )}

      <ToolbarSeparator />
      <ToolbarButton label="Zoom in" onClick={onZoomIn} style={buttonStyle}>
        <Plus size={16} />
      </ToolbarButton>
      <ToolbarButton
        label={`Reset zoom (${Math.round(viewport.zoom * 100)}%)`}
        onClick={onResetZoom}
        style={buttonStyle}
      >
        <span style={{ fontSize: 9, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(viewport.zoom * 100)}
        </span>
      </ToolbarButton>
      <ToolbarButton label="Zoom out" onClick={onZoomOut} style={buttonStyle}>
        <Minus size={16} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarSeparator() {
  return <div aria-hidden="true" style={{ width: 22, height: 1, margin: '3px 0', background: 'var(--border-subtle)' }} />;
}

function ToolbarButton({
  label,
  onClick,
  style,
  children,
}: {
  label: string;
  onClick: () => void;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={style}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'var(--surface-hover)';
        event.currentTarget.style.color = 'var(--text-primary)';
        event.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
        event.currentTarget.style.color = 'var(--text-secondary)';
        event.currentTarget.style.borderColor = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function CanvasActionsMenu({
  items,
  buttonStyle,
}: {
  items: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;
  buttonStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="More canvas actions"
        title="More canvas actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          ...buttonStyle,
          ...(open
            ? {
                background: 'var(--surface-hover)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)',
              }
            : {}),
        }}
      >
        <DotsThree size={18} weight="bold" />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 0,
            left: 42,
            zIndex: 110,
            width: 210,
            padding: 6,
            borderRadius: 12,
            border: '1px solid var(--glass-border)',
            background: 'var(--surface-floating)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              style={{
                width: '100%',
                minHeight: 32,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '0 9px',
                border: 'none',
                borderRadius: 7,
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'var(--surface-hover)';
                event.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
                event.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SpawnMenuProps {
  onSpawn: (type: CodeCanvasTile['type']) => void | Promise<void>;
  buttonStyle: React.CSSProperties;
}

const SPAWN_ITEMS: Array<{ type: CodeCanvasTile['type']; label: string; icon: typeof Plus }> = [
  { type: 'session', label: 'Session', icon: ChatTeardropText },
  { type: 'terminal', label: 'Terminal', icon: TerminalIcon },
  { type: 'diff', label: 'Diff', icon: GitDiff },
  { type: 'preview', label: 'Preview', icon: Browser },
  { type: 'notes', label: 'Notes', icon: NotePencil },
  { type: 'knowledge', label: 'Knowledge', icon: BookBookmark },
  { type: 'knowledge-graph', label: 'Graph', icon: Graph },
];

function SpawnMenu({ onSpawn, buttonStyle }: SpawnMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const menuButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 10px',
    border: 'none',
    borderRadius: 7,
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          ...buttonStyle,
          ...(open
            ? {
                background: 'var(--surface-hover)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)',
              }
            : {}),
        }}
        aria-label="Add canvas tile"
        title="Add canvas tile"
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = 'var(--surface-hover)';
          event.currentTarget.style.color = 'var(--text-primary)';
          event.currentTarget.style.borderColor = 'var(--border-subtle)';
        }}
        onMouseLeave={(event) => {
          if (open) return;
          event.currentTarget.style.background = 'transparent';
          event.currentTarget.style.color = 'var(--text-secondary)';
          event.currentTarget.style.borderColor = 'transparent';
        }}
      >
        <Plus size={17} weight="bold" />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 0,
            left: 42,
            zIndex: 110,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 160,
            padding: 6,
            borderRadius: 12,
            border: '1px solid var(--glass-border)',
            background: 'var(--surface-floating)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {SPAWN_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void onSpawn(item.type);
                }}
                style={menuButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
