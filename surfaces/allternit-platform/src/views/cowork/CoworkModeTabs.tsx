/**
 * CoworkModeTabs.tsx
 * 
 * Mode-specific tabs for Cowork surface.
 * Provides contextual tabs based on the collaborative workflow.
 * 
 * Top Pills: Plan, Execute, Review, Automate, Web, Agents
 * Bottom Dock: Plan, Execute, Review, Report, Automate, Web, Agents, Sync
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardText,
  Play,
  CheckCircle,
  FileText,
  Lightning,
  Globe,
  Robot,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useAgentSurfaceModeStore, type AgentModeId } from '@/stores/agent-surface-mode.store';

interface ModeTab {
  id: AgentModeId;
  label: string;
  icon: PhosphorIcon;
  description?: string;
}

// Top pills configuration (6 tabs)
const TOP_PILLS: ModeTab[] = [
  { id: 'plan', label: 'Plan', icon: ClipboardText, description: 'Define tasks and milestones' },
  { id: 'execute', label: 'Execute', icon: Play, description: 'Run tasks and workflows' },
  { id: 'review', label: 'Review', icon: CheckCircle, description: 'Review and approve work' },
  { id: 'automate', label: 'Automate', icon: Lightning, description: 'Automation and scheduling' },
  { id: 'web', label: 'Web', icon: Globe, description: 'Web search and browsing' },
  { id: 'agents', label: 'Agents', icon: Robot, description: 'Agent selection and config' },
];

// Bottom dock configuration (8 tabs)
const BOTTOM_TABS: ModeTab[] = [
  { id: 'plan', label: 'Plan', icon: ClipboardText },
  { id: 'execute', label: 'Execute', icon: Play },
  { id: 'review', label: 'Review', icon: CheckCircle },
  { id: 'report', label: 'Report', icon: FileText },
  { id: 'automate', label: 'Automate', icon: Lightning },
  { id: 'web', label: 'Web', icon: Globe },
  { id: 'agents', label: 'Agents', icon: Robot },
  { id: 'sync', label: 'Sync', icon: ArrowsClockwise },
];

interface CoworkModeTabsProps {
  variant: 'top-pills' | 'bottom-dock';
  surfaceTheme?: {
    accent: string;
    soft: string;
    glow: string;
  };
  className?: string;
}

/**
 * Cowork Mode Tabs
 * 
 * Provides surface-specific mode selection for the Cowork view.
 * - Top pills: Main workflow modes (6)
 * - Bottom dock: Extended workflow modes (8)
 */
export function CoworkModeTabs({ 
  variant, 
  surfaceTheme,
  className 
}: CoworkModeTabsProps) {
  const { selectedModeBySurface, setSelectedMode } = useAgentSurfaceModeStore();
  const currentMode = selectedModeBySurface['cowork'];
  
  const tabs = variant === 'top-pills' ? TOP_PILLS : BOTTOM_TABS;
  
  const handleSelect = (modeId: AgentModeId) => {
    setSelectedMode('cowork', modeId);
  };
  
  if (variant === 'top-pills') {
    return (
      <div className={cn(
        "flex items-center gap-2 flex-wrap justify-center",
        className
      )}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentMode === tab.id;
          
          return (
            <motion.button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                isActive 
                  ? "text-white" 
                  : "text-[#9B9B9B] hover:text-[#ECECEC] hover:bg-white/5"
              )}
              style={{
                background: isActive 
                  ? `linear-gradient(135deg, ${surfaceTheme?.soft || 'rgba(167,139,250,0.2)'} 0%, ${surfaceTheme?.glow || 'rgba(167,139,250,0.1)'} 100%)`
                  : 'transparent',
                border: isActive 
                  ? `1px solid ${surfaceTheme?.accent || '#A78BFA'}` 
                  : '1px solid rgba(255,255,255,0.06)',
                boxShadow: isActive 
                  ? `0 0 20px ${surfaceTheme?.glow || 'rgba(167,139,250,0.2)'}` 
                  : 'none',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="cowork-mode-indicator"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${surfaceTheme?.soft || 'rgba(167,139,250,0.2)'} 0%, transparent 100%)`,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    );
  }
  
  // Bottom dock variant
  return (
    <div className={cn(
      "flex items-center gap-1 p-1.5 rounded-xl bg-[#1e1e1e] border border-[#333]",
      className
    )}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentMode === tab.id;
        
        return (
          <motion.button
            key={tab.id}
            onClick={() => handleSelect(tab.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              isActive 
                ? "text-white" 
                : "text-[#666] hover:text-[#b8b8b8] hover:bg-white/5"
            )}
            style={{
              background: isActive 
                ? surfaceTheme?.soft || 'rgba(167,139,250,0.15)' 
                : 'transparent',
            }}
            whileTap={{ scale: 0.95 }}
          >
            <Icon className={cn(
              "w-3.5 h-3.5",
              isActive && "text-[#A78BFA]"
            )} />
            <span>{tab.label}</span>
            {isActive && (
              <motion.div
                layoutId="cowork-dock-indicator"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ background: surfaceTheme?.accent || '#A78BFA' }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
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
  
  const modeConfig = BOTTOM_TABS.find(t => t.id === currentMode) || BOTTOM_TABS[1];
  
  return {
    currentMode,
    modeConfig,
    setMode: (modeId: AgentModeId) => setSelectedMode('cowork', modeId),
    isPlan: currentMode === 'plan',
    isExecute: currentMode === 'execute',
    isReview: currentMode === 'review',
    isReport: currentMode === 'report',
    isAutomate: currentMode === 'automate',
    isWeb: currentMode === 'web',
    isAgents: currentMode === 'agents',
    isSync: currentMode === 'sync',
  };
}

export default CoworkModeTabs;
