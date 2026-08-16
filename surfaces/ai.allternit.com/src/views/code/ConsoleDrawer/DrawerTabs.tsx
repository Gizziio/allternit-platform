import React from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  CaretDown,
  CaretUp,
  GitDiff,
  Package,
  RocketLaunch,
  Terminal,
  Command,
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
        minHeight: 38,
        display: 'flex',
        alignItems: 'stretch',
        padding: '0 max(10px, env(safe-area-inset-left, 0px))',
        borderTop: '1px solid var(--border-strong)',
        borderBottom: isOpen ? '1px solid var(--border-subtle)' : 'none',
        background: 'var(--surface-floating)',
        backdropFilter: 'blur(20px) saturate(170%)',
        WebkitBackdropFilter: 'blur(20px) saturate(170%)',
        boxShadow: isOpen ? 'var(--shadow-sm)' : 'var(--shadow-lg)',
        overflow: 'hidden',
        flexShrink: 0,
        cursor: isOpen ? 'row-resize' : 'default',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          height: 38,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px 0 10px',
          color: 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 6,
            background: 'linear-gradient(135deg, var(--accent-code), color-mix(in srgb, var(--accent-code) 55%, #000))',
            boxShadow: '0 0 12px color-mix(in srgb, var(--accent-code) 45%, transparent)',
          }}
        >
          <Command size={13} weight="fill" color="#fff" />
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: 'var(--text-primary)',
          }}
        >
          Console
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
        height: 38,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 11px',
        background: active && isOpen ? 'var(--shell-mode-code-soft)' : 'transparent',
        border: 'none',
        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        fontSize: 11,
        fontWeight: active ? 650 : 550,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'color 140ms ease, background 140ms ease',
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
            left: 9,
            right: 9,
            bottom: 0,
            height: 2,
            borderRadius: '2px 2px 0 0',
            background: 'var(--accent-code, #60a5fa)',
            boxShadow: '0 0 10px color-mix(in srgb, var(--accent-code, #60a5fa) 45%, transparent)',
          }}
        />
      )}
    </button>
  );
}
