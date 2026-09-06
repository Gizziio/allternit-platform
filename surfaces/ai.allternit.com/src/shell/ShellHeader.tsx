import React, { useEffect, useState } from 'react';
import { GlassSurface } from '../design/GlassSurface';
import { AllternitOperatorStatus } from '../components/AllternitOperatorStatus';
import { EnvironmentSelector, EnvironmentType } from './EnvironmentSelector';
import { listGoals, listRoutines, listLoops } from '@/lib/automation-api';
import {
  CaretLeft,
  CaretRight,
  Sun,
  Moon,
  SidebarSimple,
  FileCode,
  Target,
  Sparkle,
} from '@phosphor-icons/react';

import { ModeSwitcher } from './ModeSwitcher';
import { AProtocolWordmark } from '@/components/AProtocolWordmark';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [automationCount, setAutomationCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [goals, routines, loops] = await Promise.all([
          listGoals(),
          listRoutines(),
          listLoops(),
        ]);
        if (cancelled) return;
        const activeGoals = goals.filter((g) => g.status === 'active').length;
        const activeRoutines = routines.filter((r) => r.status === 'active').length;
        const activeLoops = loops.filter((l) => l.status === 'active').length;
        setAutomationCount(activeGoals + activeRoutines + activeLoops);
      } catch {
        if (!cancelled) setAutomationCount(null);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'products' } }))}
          className="flex items-center ml-2 bg-transparent border-none p-0 cursor-pointer [WebkitAppRegion:no-drag] hover:opacity-80 transition-opacity"
          title="Open Products"
        >
          <AProtocolWordmark theme="adaptive" height={18} />
        </button>
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
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'products' } }))}
          className="flex items-center gap-1.5 border border-solid border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 bg-[var(--shell-control-bg)] text-[var(--shell-control-fg)] cursor-pointer [WebkitAppRegion:no-drag] transition-colors hover:bg-[var(--shell-control-active-bg)] hover:text-[var(--shell-control-active-fg)]"
          title="Open Products"
        >
          <Sparkle size={16} weight="fill" />
          <span className="text-[12px] font-semibold hidden sm:inline">Products</span>
        </button>

        {/* Automation Hub — visible from every mode */}
        <button
          type="button"
          onClick={() => navigate('/automation/goals')}
          className="flex items-center gap-1.5 border border-solid border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 bg-[var(--shell-control-bg)] text-[var(--shell-control-fg)] cursor-pointer [WebkitAppRegion:no-drag] transition-colors hover:bg-[var(--shell-control-active-bg)] hover:text-[var(--shell-control-active-fg)]"
          title="Open Automation Hub (Goals, Routines, Loops)"
        >
          <Target size={16} />
          <span className="text-[12px] font-semibold hidden sm:inline">Automation</span>
          {automationCount !== null && automationCount > 0 && (
            <span
              className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
              style={{ background: 'var(--accent-primary)', color: '#fff' }}
            >
              {automationCount}
            </span>
          )}
        </button>

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
