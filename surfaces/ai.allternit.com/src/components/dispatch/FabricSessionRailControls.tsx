'use client';

import React, { useState } from 'react';
import { SidebarSimple } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { FABRIC_DRIVE_KINDS, type FabricDriveKind } from '@/lib/fabric-session-kind';
import { FabricKindIcon } from '@/components/dispatch/FabricSessionDriveViews';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const KIND_ACCENT: Record<Exclude<FabricDriveKind, 'desktop'>, string> = {
  chat: 'var(--accent-chat)',
  bot: 'var(--accent-bot)',
  code: 'var(--accent-code)',
  aci: 'var(--accent-browser)',
};

const SESSION_TABS = FABRIC_DRIVE_KINDS.filter((tab) => tab.id !== 'desktop');

export function FabricSessionRailControls({
  railCollapsed,
  driveKind,
  onToggleRail,
  onDriveKindChange,
}: {
  railCollapsed: boolean;
  driveKind: FabricDriveKind;
  onToggleRail: () => void;
  onDriveKindChange: (kind: FabricDriveKind) => void;
}): React.ReactNode {
  const isCoarse = useMediaQuery('(pointer: coarse)');
  const [hovered, setHovered] = useState(false);
  const showKinds = railCollapsed && (isCoarse || hovered);

  return (
    <div
      data-testid="fabric-rail-controls"
      className="flex items-center pointer-events-auto shrink-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          'flex items-center gap-0.5 rounded-lg transition-all duration-200',
          showKinds
            ? 'bg-[var(--shell-control-bg)] border border-solid border-[var(--border-subtle)] px-1 py-0.5'
            : 'bg-[var(--shell-control-bg)]/60 border border-solid border-transparent',
        )}
      >
        <button
          type="button"
          onClick={onToggleRail}
          title={railCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="bg-transparent border-none rounded-md w-11 h-11 md:w-7 md:h-7 flex items-center justify-center text-[var(--shell-item-muted)] cursor-pointer transition-all duration-150 shrink-0 hover:bg-[var(--shell-item-hover)] hover:text-[var(--shell-item-fg)]"
        >
          <SidebarSimple size={15} weight={railCollapsed ? 'fill' : 'bold'} />
        </button>
        {showKinds ? (
          <>
            <div className="w-px h-4 bg-[var(--shell-divider)]" />
            {SESSION_TABS.map((tab) => {
              const active = driveKind === tab.id;
              const accent = KIND_ACCENT[tab.id as keyof typeof KIND_ACCENT];
              return (
                <button
                  key={tab.id}
                  type="button"
                  title={tab.label}
                  data-testid={`fabric-rail-mode-${tab.id}`}
                  onClick={() => onDriveKindChange(tab.id)}
                  onMouseEnter={() => onDriveKindChange(tab.id)}
                  className="flex items-center justify-center w-11 h-11 md:w-7 md:h-7 rounded-lg border-none cursor-pointer transition-all duration-150 shrink-0"
                  style={{
                    background: active ? accent : 'transparent',
                    color: active ? 'var(--ui-text-inverse)' : 'var(--shell-item-muted)',
                  }}
                >
                  <FabricKindIcon kind={tab.id} size={15} />
                </button>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}
