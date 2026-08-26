import React from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  CaretDown,
  CaretUp,
  Command,
  DotsSixVertical,
  GitDiff,
  Package,
  RocketLaunch,
  Terminal,
} from '@phosphor-icons/react';

export type DrawerTabId =
  | 'mission-control'
  | 'terminal'
  | 'changes'
  | 'artifacts';

interface DrawerTabsProps {
  activeTab: DrawerTabId;
  isOpen: boolean;
  onTabChange: (id: DrawerTabId) => void;
  onToggle: () => void;
  onMouseDown?: (event: React.MouseEvent) => void;
  onTouchStart?: (event: React.TouchEvent) => void;
}

interface TabDef {
  id: DrawerTabId;
  label: string;
  icon: PhosphorIcon;
}

export const DRAWER_TABS: TabDef[] = [
  { id: 'mission-control', label: 'Mission Control', icon: RocketLaunch },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'changes', label: 'Changes', icon: GitDiff },
  { id: 'artifacts', label: 'Artifacts', icon: Package },
];

export function DrawerTabs({
  activeTab,
  isOpen,
  onTabChange,
  onToggle,
  onMouseDown,
  onTouchStart,
}: DrawerTabsProps) {
  return (
    <div
      data-testid="console-drawer-tabs"
      onMouseDown={isOpen ? onMouseDown : undefined}
      onTouchStart={isOpen ? onTouchStart : undefined}
      style={{
        minHeight: 40,
        display: 'flex',
        alignItems: 'stretch',
        padding: '0 max(10px, env(safe-area-inset-left, 0px))',
        borderTop: '1px solid color-mix(in srgb, var(--accent-code) 28%, var(--border-strong))',
        borderBottom: isOpen ? '1px solid var(--border-subtle)' : 'none',
        background: isOpen
          ? 'linear-gradient(90deg, color-mix(in srgb, var(--accent-code) 10%, var(--surface-floating)) 0%, var(--surface-floating) 220px)'
          : 'var(--surface-floating)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: isOpen
          ? 'inset 0 1px 0 color-mix(in srgb, var(--accent-code) 25%, transparent), var(--shadow-sm)'
          : '0 -4px 24px color-mix(in srgb, var(--accent-code) 8%, transparent)',
        overflow: 'hidden',
        flexShrink: 0,
        cursor: isOpen ? 'row-resize' : 'default',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '0 12px 0 6px',
          color: 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      >
        <DotsSixVertical size={13} weight="bold" />
        <span
          style={{
            width: 22,
            height: 22,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 6,
            border: '1px solid color-mix(in srgb, var(--accent-code) 30%, var(--border-subtle))',
            background: 'color-mix(in srgb, var(--accent-code) 12%, var(--surface-panel))',
            boxShadow: '0 0 10px color-mix(in srgb, var(--accent-code) 18%, transparent)',
          }}
        >
          <Command size={12} color="var(--accent-code)" weight="bold" />
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: 'var(--text-secondary)',
          }}
        >
          CONSOLE
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Console panels"
        style={{
          minWidth: 0,
          display: 'flex',
          alignItems: 'stretch',
          gap: 2,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {DRAWER_TABS.map((tab) => (
          <Tab
            key={tab.id}
            id={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.id}
            isOpen={isOpen}
            onClick={onTabChange}
          />
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 12 }} />

      <button
        type="button"
        aria-label={isOpen ? 'Collapse console' : 'Expand console'}
        title={isOpen ? 'Collapse console' : 'Expand console'}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={onToggle}
        style={{
          width: 34,
          height: 30,
          alignSelf: 'center',
          display: 'grid',
          placeItems: 'center',
          border: '1px solid transparent',
          borderRadius: 7,
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {isOpen ? <CaretDown size={13} weight="bold" /> : <CaretUp size={13} weight="bold" />}
      </button>
    </div>
  );
}

function Tab({
  id,
  label,
  icon: Icon,
  active,
  isOpen,
  onClick,
}: {
  id: DrawerTabId;
  label: string;
  icon: PhosphorIcon;
  active: boolean;
  isOpen: boolean;
  onClick: (id: DrawerTabId) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={() => onClick(id)}
      style={{
        height: 40,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 12px',
        margin: '0 1px',
        borderRadius: 8,
        background: active && isOpen
          ? 'color-mix(in srgb, var(--accent-code) 14%, var(--surface-panel))'
          : 'transparent',
        border: '1px solid transparent',
        borderBottom: active && isOpen ? '1px solid color-mix(in srgb, var(--accent-code) 30%, transparent)' : '1px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        fontSize: 11,
        fontWeight: active ? 700 : 550,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'color 160ms ease, background 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
        boxShadow: active && isOpen
          ? 'inset 0 1px 0 color-mix(in srgb, var(--accent-code) 20%, transparent), 0 0 14px color-mix(in srgb, var(--accent-code) 12%, transparent)'
          : 'none',
      }}
    >
      <Icon
        size={13}
        weight={active ? 'fill' : 'regular'}
        color={active ? 'var(--accent-code, #60a5fa)' : undefined}
      />
      {label}
      {active && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 3,
            height: 2,
            borderRadius: '2px 2px 0 0',
            background: 'var(--accent-code, #60a5fa)',
            boxShadow: '0 0 10px color-mix(in srgb, var(--accent-code, #60a5fa) 55%, transparent)',
          }}
        />
      )}
    </button>
  );
}
