'use client';

import React from 'react';
import { CaretDown, Terminal } from '@phosphor-icons/react';
import { CODE_SESSION_MODE_LABELS } from './CodeWorkspaceBar';
import type { CodeSessionMode } from './CodeModeStore';
import { useDrawerStore } from '@/drawers/drawer.store';

interface CodeBottomStatusBarProps {
  sessionMode: CodeSessionMode;
  onSessionModeChange: (mode: CodeSessionMode) => void;
}

const BORDER = 'rgba(255, 255, 255, 0.08)';
const TEXT_PRIMARY = 'var(--text-primary)';
const TEXT_SECONDARY = 'var(--text-secondary)';

const MODE_ITEMS: { id: CodeSessionMode; index: number }[] = [
  { id: 'SAFE', index: 1 },
  { id: 'DEFAULT', index: 2 },
  { id: 'PLAN', index: 3 },
  { id: 'AUTO', index: 4 },
];

export function CodeBottomStatusBar({
  sessionMode,
  onSessionModeChange,
}: CodeBottomStatusBarProps): React.ReactNode {
  return (
    <div
      data-testid="code-bottom-status-bar"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <ModeSelector sessionMode={sessionMode} onChange={onSessionModeChange} />
      <ConsoleTab />
    </div>
  );
}

function ConsoleTab() {
  const isOpen = useDrawerStore((state) => state.drawers.console.open);
  const openDrawer = useDrawerStore((state) => state.openDrawer);
  const closeDrawer = useDrawerStore((state) => state.closeDrawer);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isOpen}
      aria-controls="allternit-console-drawer"
      data-testid="code-bottom-status-console"
      onClick={() => (isOpen ? closeDrawer('console') : openDrawer('console'))}
      style={{
        height: 28,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 9px',
        border: `1px solid ${isOpen ? 'color-mix(in srgb, var(--accent-code) 45%, transparent)' : BORDER}`,
        borderRadius: 999,
        background: isOpen
          ? 'color-mix(in srgb, var(--accent-code) 12%, transparent)'
          : 'rgba(255, 255, 255, 0.025)',
        color: isOpen ? TEXT_PRIMARY : TEXT_SECONDARY,
        fontSize: 12,
        fontWeight: isOpen ? 700 : 600,
        cursor: 'pointer',
        transition: 'color 140ms ease, background 140ms ease',
      }}
    >
      <Terminal size={14} />
      <span>Console</span>
    </button>
  );
}

function ModeSelector({
  sessionMode,
  onChange,
}: {
  sessionMode: CodeSessionMode;
  onChange: (mode: CodeSessionMode) => void;
}) {
  return (
    <label
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <select
        aria-label="Code permission mode"
        data-testid="code-bottom-status-mode"
        value={sessionMode}
        onChange={(event) => onChange(event.target.value as CodeSessionMode)}
        style={{
          height: 28,
          appearance: 'none',
          padding: '0 28px 0 11px',
          borderRadius: 999,
          border: `1px solid ${BORDER}`,
          background: 'rgba(255, 255, 255, 0.025)',
          color: TEXT_SECONDARY,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {MODE_ITEMS.map((item) => (
          <option key={item.id} value={item.id}>
            {CODE_SESSION_MODE_LABELS[item.id]}
          </option>
        ))}
      </select>
      <CaretDown
        aria-hidden="true"
        size={12}
        style={{
          position: 'absolute',
          right: 9,
          pointerEvents: 'none',
          color: TEXT_SECONDARY,
          opacity: 0.75,
        }}
      />
    </label>
  );
}
