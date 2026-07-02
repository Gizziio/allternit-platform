import React from 'react';
import { GlassSurface } from '../design/GlassSurface';
import { AllternitOperatorStatus } from '../components/AllternitOperatorStatus';
import { EnvironmentSelector, EnvironmentType } from './EnvironmentSelector';
import {
  CaretLeft,
  CaretRight,
  Sun,
  Moon,
  SidebarSimple,
  FileCode,
} from '@phosphor-icons/react';

import { ModeSwitcher } from './ModeSwitcher';
import { cn } from '@/lib/utils';

export type AppMode = 'chat' | 'cowork' | 'code' | 'design' | 'browser';

interface ShellHeaderProps {
  title?: string;
  onBack?: () => void;
  onForward?: () => void;
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  isRailCollapsed: boolean;
  onRailToggle: () => void;
  onOpenControlCenter?: () => void;
  onSidecarToggle?: () => void;
  sidecarOpen?: boolean;
  currentEnvironment?: EnvironmentType;
  onEnvironmentChange?: (env: EnvironmentType) => void;
}

export function ShellHeader({
  onBack,
  onForward,
  activeMode,
  onModeChange,
  theme,
  onThemeToggle,
  isRailCollapsed,
  onRailToggle,
  onOpenControlCenter,
  onSidecarToggle,
  sidecarOpen,
  currentEnvironment = 'local',
  onEnvironmentChange,
}: ShellHeaderProps): React.ReactNode {
  const modeColors: Record<string, string> = {
    chat: 'var(--accent-chat)',
    cowork: 'var(--accent-cowork)',
    code: 'var(--accent-code)',
    design: 'var(--accent-primary)',
    browser: 'var(--accent-browser)',
  };
  const currentModeColor = modeColors[activeMode] || modeColors.chat;

  return (
    <GlassSurface 
      intensity="elevated"
      className="h-10 flex items-center p-[0_16px_0_90px] rounded-none border-b-none justify-between bg-transparent relative [WebkitAppRegion:drag]"
    >
      <div className="flex items-center gap-4 [WebkitAppRegion:no-drag]">
        <button type="button" 
          onClick={onRailToggle}
          className={cn(
            "border border-solid border-[var(--border-subtle)] rounded-lg p-1.5 cursor-pointer flex items-center justify-center transition-all duration-200 [WebkitAppRegion:no-drag]",
            isRailCollapsed ? "bg-[var(--shell-control-active-bg)] text-[var(--shell-control-active-fg)]" : "bg-[var(--shell-control-bg)] text-[var(--shell-control-muted-fg)]"
          )}
          title={isRailCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <SidebarSimple size={20} weight={isRailCollapsed ? "fill" : "regular"} />
        </button>

        <div className="font-black text-[18px] tracking-tight flex items-center gap-2 ml-2" style={{ color: currentModeColor }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: currentModeColor, boxShadow: `0 0 10px ${currentModeColor}` }} />
          Allternit
        </div>
      </div>

      {/* Left-aligned Mode Switcher */}
      <div className="absolute left-[90px] top-1/2 -translate-y-1/2 z-10 [WebkitAppRegion:no-drag]">
        <ModeSwitcher 
          activeMode={activeMode} 
          onModeChange={onModeChange}
          size="small"
          variant="segmented"
          showLabels={true}
        />
      </div>

      <div className="flex items-center gap-3 [WebkitAppRegion:no-drag]">
        {/* Environment Selector */}
        <EnvironmentSelector
          currentEnvironment={currentEnvironment}
          onEnvironmentChange={onEnvironmentChange}
          onOpenControlCenter={onOpenControlCenter}
        />

        {/* Allternit Operator Service Status */}
        <AllternitOperatorStatus />

        {/* Artifact Sidecar Toggle */}
        <button type="button"
          onClick={onSidecarToggle}
          className={cn(
            "border border-solid border-[var(--border-subtle)] rounded-lg p-2 flex cursor-pointer transition-all duration-200 [WebkitAppRegion:no-drag]",
            sidecarOpen ? "bg-[var(--shell-control-active-bg)] text-[var(--shell-control-active-fg)]" : "bg-[var(--shell-control-bg)] text-[var(--shell-control-fg)]"
          )}
          title="Toggle Artifact Sidecar (Cmd+Shift+A)"
        >
          <FileCode size={18} weight={sidecarOpen ? "fill" : "regular"} />
        </button>

        <div className="flex gap-1 [WebkitAppRegion:no-drag]">
          <button type="button" onClick={onBack} className="bg-transparent border-none text-[var(--text-tertiary)] cursor-pointer p-1 [WebkitAppRegion:no-drag] transition-colors hover:text-[var(--text-primary)]">
            <CaretLeft size={18} />
          </button>
          <button type="button" onClick={onForward} className="bg-transparent border-none text-[var(--text-tertiary)] cursor-pointer p-1 [WebkitAppRegion:no-drag] transition-colors hover:text-[var(--text-primary)]">
            <CaretRight size={18} />
          </button>
        </div>

        <button type="button" 
          onClick={onThemeToggle}
          className="bg-[var(--shell-control-bg)] border border-solid border-[var(--border-subtle)] rounded-lg p-2 flex text-[var(--shell-control-fg)] cursor-pointer [WebkitAppRegion:no-drag] transition-colors hover:bg-[var(--shell-control-active-bg)]"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </GlassSurface>
  );
}
