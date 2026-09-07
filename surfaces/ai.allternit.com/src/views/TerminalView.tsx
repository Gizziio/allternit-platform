import React, { useState } from 'react';
import { Square, SquaresFour } from '@phosphor-icons/react';
import { TerminalTabs } from './nodes/terminal';
import { GlassCard } from '@/design/glass/GlassCard';
import { tokens } from '@/design/tokens';
import { TerminalWorkspace } from '@/components/terminal-workspace/TerminalWorkspace';

type TerminalViewMode = 'workspace' | 'classic';

/**
 * Shell "Terminal" app. Defaults to the global multi-terminal workspace
 * (responsive tile grid + focus zoom); the classic single tab-strip terminal
 * stays one toggle away.
 */
export function TerminalView({ noPadding = false }: { noPadding?: boolean }): React.ReactNode {
  const [mode, setMode] = useState<TerminalViewMode>('workspace');

  return (
    <div
      style={{
        height: '100%',
        padding: noPadding ? 0 : tokens.space.lg,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* View-mode toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          alignSelf: 'flex-end',
          marginBottom: noPadding ? 6 : 8,
          padding: 2,
          borderRadius: 999,
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-panel)',
        }}
      >
        <ModeToggleButton
          active={mode === 'workspace'}
          onClick={() => setMode('workspace')}
          ariaLabel="Terminal workspace"
          title="Workspace — terminal grid"
        >
          <SquaresFour size={12} weight={mode === 'workspace' ? 'fill' : 'regular'} />
        </ModeToggleButton>
        <ModeToggleButton
          active={mode === 'classic'}
          onClick={() => setMode('classic')}
          ariaLabel="Classic terminal"
          title="Classic — tab strip"
        >
          <Square size={12} weight={mode === 'classic' ? 'fill' : 'regular'} />
        </ModeToggleButton>
      </div>

      <GlassCard
        style={{
          flex: 1,
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: noPadding ? 0 : 12,
          border: noPadding ? 'none' : '1px solid var(--border-strong)',
        }}
      >
        {mode === 'workspace' ? <TerminalWorkspace /> : <TerminalTabs className="h-full" />}
      </GlassCard>
    </div>
  );
}

function ModeToggleButton({
  children,
  active,
  onClick,
  ariaLabel,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  title: string;
}): React.ReactNode {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid transparent',
        borderRadius: 999,
        background: active ? 'var(--surface-active)' : hovered ? 'var(--surface-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}

export default TerminalView;
