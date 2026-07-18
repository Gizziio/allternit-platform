"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Minus,
  Plus,
  ArrowsOutSimple,
  ChatTeardropText,
  SquaresFour,
  Terminal as TerminalIcon,
  NotePencil,
  Shield,
  GitCommit,
  GitDiff,
  Monitor,
  Plugs,
  DownloadSimple,
  UploadSimple,
  DotsThree,
  Robot,
  CaretLeft,
  CaretRight,
  Rocket,
} from '@phosphor-icons/react';
import { AGENT_VENDORS, type AgentVendor } from '@/components/canvas/agentVendors';
import {
  assignExecutor,
  type ExecutorVendor,
  type ExecutorMode,
} from '@/views/code/orchestrator.service';
import {
  useCodeModeStore,
  CANVAS_TILE_DEFAULT_SIZE,
  type CodeCanvasTile,
  type CodeCanvasViewport,
} from '@/views/code/CodeModeStore';
import { useCodeSessionStore } from '@/views/code/CodeSessionStore';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CanvasToolbar');

const TOOLBAR_BUTTON_CLASS =
  'cursor-pointer border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)]';

const MENU_ITEM_CLASS = 'cursor-pointer bg-transparent hover:bg-[var(--surface-hover)]';

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
  const workspacePath = useCodeModeStore(
    (s) => s.workspaces.find((w) => w.workspace_id === workspaceId)?.root_path,
  );
  const [orchestratorDialogOpen, setOrchestratorDialogOpen] = useState(false);

  const spawnTile = async (
    type: CodeCanvasTile['type'],
    opts?: { startupCommand?: string; label?: string },
  ) => {
    if (!workspaceId) return;
    const size = CANVAS_TILE_DEFAULT_SIZE[type];
    const centerX = (canvasSize.width / 2 - viewport.x) / viewport.zoom - size.width / 2;
    const centerY = (canvasSize.height / 2 - viewport.y) / viewport.zoom - size.height / 2;

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
      width: size.width,
      height: size.height,
      zIndex: Date.now(),
      label: opts?.label ?? (type === 'session' ? 'New Session' : type === 'notes' ? 'Shared context' : type),
      startupCommand: opts?.startupCommand,
      shared: type === 'notes' ? true : undefined,
    });
  };

  const spawnAgent = (vendor: AgentVendor) =>
    spawnTile('terminal', { startupCommand: vendor.command, label: vendor.label });

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    padding: 0,
    borderRadius: 9,
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
        borderRadius: 12,
        border: '1px solid var(--glass-border)',
        background: 'var(--surface-floating)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'var(--shadow-md)',
        maxHeight: 'calc(100% - 112px)',
      }}
    >
      <SpawnMenu
        onSpawn={spawnTile}
        onSpawnAgent={spawnAgent}
        onOrchestrate={() => setOrchestratorDialogOpen(true)}
        buttonStyle={buttonStyle}
      />
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

      {orchestratorDialogOpen && (
        <OrchestratedAgentDialog
          workspacePath={workspacePath}
          onClose={() => setOrchestratorDialogOpen(false)}
        />
      )}
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
      className={TOOLBAR_BUTTON_CLASS}
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
        className={TOOLBAR_BUTTON_CLASS}
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
                fontSize: 12,
                textAlign: 'left',
              }}
              className={`${MENU_ITEM_CLASS} text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
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
  onSpawnAgent: (vendor: AgentVendor) => void | Promise<void>;
  onOrchestrate: () => void;
  buttonStyle: React.CSSProperties;
}

const SPAWN_ITEMS: Array<{ type: CodeCanvasTile['type']; label: string; icon: typeof Plus }> = [
  { type: 'session', label: 'Session', icon: ChatTeardropText },
  { type: 'terminal', label: 'Terminal', icon: TerminalIcon },
  { type: 'notes', label: 'Notes', icon: NotePencil },
];

function SpawnMenu({ onSpawn, onSpawnAgent, onOrchestrate, buttonStyle }: SpawnMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'root' | 'agents'>('root');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) setView('root');
  }, [open]);

  const menuButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 10px',
    border: 'none',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'left',
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
        className={TOOLBAR_BUTTON_CLASS}
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
          {view === 'root' ? (
            <>
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
                    className={`${MENU_ITEM_CLASS} text-[var(--text-primary)]`}
                  >
                    <Icon size={14} />
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                role="menuitem"
                onClick={() => setView('agents')}
                style={{ ...menuButtonStyle, justifyContent: 'space-between' }}
                className={`${MENU_ITEM_CLASS} text-[var(--text-primary)]`}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Robot size={14} />
                  Agent CLI
                </span>
                <CaretRight size={12} style={{ opacity: 0.6 }} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => setView('root')}
                style={menuButtonStyle}
                className={`${MENU_ITEM_CLASS} text-[var(--text-secondary)]`}
              >
                <CaretLeft size={14} />
                Back
              </button>
              {AGENT_VENDORS.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  role="menuitem"
                  title={vendor.command}
                  onClick={() => {
                    setOpen(false);
                    void onSpawnAgent(vendor);
                  }}
                  style={menuButtonStyle}
                  className={`${MENU_ITEM_CLASS} text-[var(--text-primary)]`}
                >
                  <Robot size={14} />
                  {vendor.label}
                </button>
              ))}
              <div
                aria-hidden="true"
                style={{ height: 1, margin: '3px 4px', background: 'var(--border-subtle)' }}
              />
              <button
                type="button"
                role="menuitem"
                title="Assign a background orchestrator executor"
                onClick={() => {
                  setOpen(false);
                  onOrchestrate();
                }}
                style={menuButtonStyle}
                className={`${MENU_ITEM_CLASS} text-[var(--text-primary)]`}
              >
                <Rocket size={14} />
                Orchestrated agent…
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface OrchestratedAgentDialogProps {
  workspacePath?: string;
  onClose: () => void;
}

function OrchestratedAgentDialog({ workspacePath, onClose }: OrchestratedAgentDialogProps) {
  const [vendor, setVendor] = useState<ExecutorVendor>('kimi');
  const [mode, setMode] = useState<ExecutorMode>('interactive');
  const [worktree, setWorktree] = useState(true);
  const [slug, setSlug] = useState(() => `run-${Date.now().toString(36)}`);
  const [taskFile, setTaskFile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
    background: active ? 'var(--surface-active)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 7,
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-panel)',
    color: 'var(--text-primary)',
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const submit = async () => {
    if (!workspacePath || busy) return;
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      setError('Slug is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await assignExecutor({
        slug: trimmedSlug,
        workdir: workspacePath,
        vendor,
        mode,
        backend: 'mux',
        isolation: worktree ? 'worktree' : 'none',
        taskFile: taskFile.trim() || undefined,
        notesFile: `docs/${trimmedSlug}_NOTES.md`,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign executor');
    } finally {
      setBusy(false);
    }
  };

  // Portal to body: the toolbar lives inside the canvas' transformed/clipped
  // subtree, where position:fixed resolves against the transform ancestor and
  // the dialog gets clipped off screen.
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--shell-overlay-backdrop) 55%, transparent)',
      }}
    >
      <div
        role="dialog"
        aria-label="Orchestrated agent"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--glass-border)',
          background: 'var(--surface-floating)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            <Rocket size={15} />
            Orchestrated agent
          </div>
          <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-muted)' }}>
            Background executor on the mux via the orchestrator. Its tile appears on this canvas.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {AGENT_VENDORS.map((v) => (
            <button key={v.id} type="button" style={chipStyle(vendor === v.id)} onClick={() => setVendor(v.id)}>
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={chipStyle(mode === 'interactive')} onClick={() => setMode('interactive')}>
            Interactive
          </button>
          <button type="button" style={chipStyle(mode === 'headless')} onClick={() => setMode('headless')}>
            Headless
          </button>
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={worktree} onChange={(e) => setWorktree(e.target.checked)} />
            Worktree
          </label>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Slug</div>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Task spec file (optional, relative to workdir)
          </div>
          <input
            type="text"
            value={taskFile}
            onChange={(e) => setTaskFile(e.target.value)}
            placeholder="docs/TASK.md"
            style={inputStyle}
          />
        </div>

        <div style={{ fontSize: 11, color: workspacePath ? 'var(--text-muted)' : 'var(--status-error)' }}>
          {workspacePath ? `workdir: ${workspacePath}` : 'Workspace has no root path — cannot launch.'}
        </div>

        {error && <div style={{ fontSize: 11, color: 'var(--status-error)' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ ...chipStyle(false), padding: '6px 14px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!workspacePath || busy}
            style={{ ...chipStyle(true), padding: '6px 14px', opacity: !workspacePath || busy ? 0.5 : 1 }}
          >
            {busy ? 'Launching…' : 'Launch'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
