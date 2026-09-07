"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Code,
  DotsThree,
  FileText,
  FolderOpen,
  GitDiff,
  GitFork,
  Globe,
  PencilSimple,
  SquaresFour,
  TerminalWindow,
  Trash,
  Scroll,
} from '@phosphor-icons/react';

export type CodePaneTarget = 'artifacts' | 'files' | 'diff' | 'terminal' | 'aci' | 'transcript';

interface CodeSessionLauncherProps {
  onOpenPane: (pane: CodePaneTarget) => void;
  /** Renders the canvas-mode toggle inline with the other pane widgets. */
  onCanvasMode?: () => void;
  /** Pressed state for the canvas-mode toggle (thread view is never canvas,
      but the prop keeps the pill honest when embedded elsewhere). */
  canvasModeActive?: boolean;
  onRename: () => void;
  onFork: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onOpenIn: (target: 'window' | 'vscode' | 'terminal') => void;
}

const iconButton: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
};

// Icon + short label pill used by the pane shortcuts; kept compact so the
// floating launcher stays a pill.
const labeledButton: React.CSSProperties = {
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '0 9px',
  border: 'none',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

// Pressed state for the canvas-mode toggle, from the chat mode-pill tokens.
const labeledButtonActive: React.CSSProperties = {
  background: 'var(--chat-mode-pill-active-bg)',
  color: 'var(--chat-mode-pill-active-fg)',
};

const menuButtonBase: React.CSSProperties = {
  height: 30,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 9px',
  border: 'none',
  borderRadius: 7,
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 12,
  textAlign: 'left',
  cursor: 'pointer',
};

export function CodeSessionLauncher(props: CodeSessionLauncherProps): React.ReactNode {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openInOpen, setOpenInOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const run = (action: () => void) => {
    action();
    setMenuOpen(false);
    setOpenInOpen(false);
  };

  const item = (label: string, Icon: typeof FolderOpen, action: () => void, danger = false) => (
    <button
      type="button"
      onClick={() => run(action)}
      style={{
        ...menuButtonBase,
        width: '100%',
        color: danger ? 'var(--status-error)' : 'var(--text-primary)',
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div
      ref={rootRef}
      data-testid="code-session-launcher"
      style={{
        position: 'absolute',
        top: 8,
        right: 18,
        zIndex: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 34,
        padding: 3,
        border: '1px solid var(--border-subtle)',
        borderRadius: 999,
        background: 'var(--glass-bg-thick)',
        boxShadow: 'var(--shadow-sm)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {props.onCanvasMode ? (
        <button
          type="button"
          data-testid="code-canvas-mode-toggle"
          aria-label="Switch to canvas mode"
          aria-pressed={props.canvasModeActive ?? false}
          title="Switch to canvas mode"
          onClick={props.onCanvasMode}
          style={props.canvasModeActive ? { ...labeledButton, ...labeledButtonActive } : labeledButton}
        >
          <SquaresFour size={15} weight="bold" />
          Canvas
        </button>
      ) : null}
      <button type="button" aria-label="Open terminal" title="Open terminal" onClick={() => props.onOpenPane('terminal')} style={labeledButton}><TerminalWindow size={15} weight="bold" />Terminal</button>
      <button type="button" aria-label="Open diff" title="Open diff" onClick={() => props.onOpenPane('diff')} style={labeledButton}><GitDiff size={15} weight="bold" />Diff</button>
      <button type="button" aria-label="Open ACI" title="Open computer" onClick={() => props.onOpenPane('aci')} style={labeledButton}><Globe size={15} weight="bold" />Computer</button>
      <button type="button" aria-label="Session actions" title="Session actions" onClick={() => setMenuOpen((value) => !value)} style={{ ...iconButton, width: 'auto', padding: '0 9px', gap: 5, color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}><DotsThree size={17} weight="bold" />Actions</button>

      {menuOpen ? (
        <div style={{ position: 'absolute', top: 42, right: 0, width: 208, padding: 5, border: '1px solid var(--border-subtle)', borderRadius: 11, background: 'var(--surface-floating)', boxShadow: '0 14px 34px rgba(0,0,0,0.22)' }}>
          {item('Artifacts library', FileText, () => props.onOpenPane('artifacts'))}
          {item('Files', FolderOpen, () => props.onOpenPane('files'))}
          <button type="button" onClick={() => setOpenInOpen((value) => !value)} style={{ ...menuButtonBase, width: '100%' }}><Code size={14} />Open in…</button>
          {openInOpen ? <div style={{ marginLeft: 22, borderLeft: '1px solid var(--border-subtle)', paddingLeft: 5 }}>{item('New window', Code, () => props.onOpenIn('window'))}{item('VS Code', Code, () => props.onOpenIn('vscode'))}{item('Terminal', TerminalWindow, () => props.onOpenIn('terminal'))}</div> : null}
          {item('Rename', PencilSimple, props.onRename)}
          {item('Transcript view', Scroll, () => props.onOpenPane('transcript'))}
          {item('Fork', GitFork, props.onFork)}
          {item('Archive', Archive, props.onArchive)}
          <div style={{ height: 1, margin: '4px 6px', background: 'var(--border-subtle)' }} />
          {item('Delete', Trash, props.onDelete, true)}
        </div>
      ) : null}
    </div>
  );
}
