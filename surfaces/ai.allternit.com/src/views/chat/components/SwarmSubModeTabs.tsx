import React from 'react';
import { UsersThree, ChartLineUp } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { SwarmSubModeId } from '@/stores/agent-surface-mode.store';

interface SwarmSubModeTabsProps {
  selectedSubMode: SwarmSubModeId;
  onSelectSubMode: (subModeId: SwarmSubModeId) => void;
}

const SWARM_SUB_MODE_TABS = [
  { id: 'specialist-team' as const, label: 'Specialist Team', color: '#14b8a6', icon: UsersThree },
  { id: 'population-simulation' as const, label: 'Population Simulation', color: '#06b6d4', icon: ChartLineUp },
];

/**
 * Nested sub-mode selector rendered only under the 'swarms' top-level mode
 * — a secondary, always-visible strip (not a popover) since it's choosing
 * between two flavors of an already-selected mode, not picking a mode.
 * Styled after ModeDock.tsx's own tab treatment (icon chip with a
 * color-tinted background, inset ring at reduced opacity for the selected
 * tab).
 */
export function SwarmSubModeTabs({ selectedSubMode, onSelectSubMode }: SwarmSubModeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Agent Swarm sub-mode"
      className="inline-flex items-center gap-1 rounded-xl border border-[var(--chat-composer-glass-border)] bg-[var(--chat-composer-glass-bg)] backdrop-blur-md p-1"
    >
      {SWARM_SUB_MODE_TABS.map((tab) => {
        const isSelected = selectedSubMode === tab.id;
        const TabIcon = tab.icon;
        return (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectSubMode(tab.id)}
            className={cn(
              'group relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all',
              isSelected
                ? 'bg-[var(--chat-composer-glass-bg)] border border-[var(--chat-composer-glass-border)] backdrop-blur-md'
                : 'hover:bg-hover'
            )}
            style={isSelected ? { boxShadow: `inset 0 0 0 1.5px ${tab.color}40` } : undefined}
          >
            <span
              className="flex items-center justify-center size-5 rounded-md transition-transform group-hover:scale-105 border border-white/[0.06]"
              style={{ background: `${tab.color}14`, color: tab.color }}
            >
              <TabIcon size={12} weight={isSelected ? 'fill' : 'bold'} />
            </span>
            <span
              className={cn('font-medium', isSelected && 'font-bold')}
              style={isSelected ? { color: tab.color } : undefined}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
