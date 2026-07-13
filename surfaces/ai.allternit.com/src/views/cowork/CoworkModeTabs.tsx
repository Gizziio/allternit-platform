/**
 * CoworkModeTabs.tsx
 *
 * Mode-specific tabs for Cowork surface.
 * Only surfaces with implemented views are exposed: execute, agents, web,
 * routines, loops, sync.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Globe,
  Robot,
  ArrowsClockwise,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Pill } from '@/components/ui/Pill';
import { useAgentSurfaceModeStore, type AgentModeId } from '@/stores/agent-surface-mode.store';

interface ModeTab {
  id: AgentModeId;
  label: string;
  icon: PhosphorIcon;
  description?: string;
}

const TABS: ModeTab[] = [
  { id: 'execute', label: 'Execute', icon: Play, description: 'Run tasks and workflows' },
  { id: 'routines', label: 'Routines', icon: ArrowsClockwise, description: 'Routines configuration' },
  { id: 'loops', label: 'Loops', icon: ArrowCounterClockwise, description: 'Loop monitoring' },
  { id: 'web', label: 'Web', icon: Globe, description: 'Web search and browsing' },
  { id: 'agents', label: 'Agents', icon: Robot, description: 'Agent selection and config' },
  { id: 'sync', label: 'Sync', icon: ArrowsClockwise, description: 'Sync status and settings' },
];

interface CoworkModeTabsProps {
  variant?: 'top-pills' | 'bottom-dock';
  className?: string;
}

export function CoworkModeTabs({
  variant = 'top-pills',
  className,
}: CoworkModeTabsProps): React.ReactNode {
  const { selectedModeBySurface, setSelectedMode } = useAgentSurfaceModeStore();
  const currentMode = selectedModeBySurface['cowork'];

  const handleSelect = (modeId: AgentModeId) => {
    setSelectedMode('cowork', modeId);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 flex-wrap',
        variant === 'bottom-dock' &&
          'p-1.5 rounded-xl bg-[var(--surface-panel)] border border-[var(--ui-border-muted)]',
        className
      )}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentMode === tab.id;

        return (
          <motion.div
            key={tab.id}
            whileHover={variant === 'top-pills' ? { scale: 1.02 } : undefined}
            whileTap={{ scale: 0.98 }}
          >
            <Pill
              active={isActive}
              size={variant === 'bottom-dock' ? 'sm' : 'md'}
              icon={<Icon size={variant === 'bottom-dock' ? 14 : 16} weight={isActive ? 'fill' : 'regular'} />}
              onClick={() => handleSelect(tab.id)}
              className={cn(
                variant === 'top-pills' && 'rounded-full',
                variant === 'bottom-dock' && 'rounded-lg'
              )}
            >
              {tab.label}
            </Pill>
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * Hook to get the current Cowork mode and its configuration
 */
export function useCoworkMode() {
  const { selectedModeBySurface, setSelectedMode } = useAgentSurfaceModeStore();
  const currentMode = selectedModeBySurface['cowork'] || 'execute';

  const modeConfig = TABS.find((t) => t.id === currentMode) || TABS[0];

  return {
    currentMode,
    modeConfig,
    setMode: (modeId: AgentModeId) => setSelectedMode('cowork', modeId),
    isExecute: currentMode === 'execute',
    isRoutines: currentMode === 'routines',
    isLoops: currentMode === 'loops',
    isWeb: currentMode === 'web',
    isAgents: currentMode === 'agents',
    isSync: currentMode === 'sync',
  };
}

export default CoworkModeTabs;
