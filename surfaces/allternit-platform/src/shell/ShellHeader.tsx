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
  title,
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
}: ShellHeaderProps): JSX.Element {
  const modeColors: Record<string, string> = {
    chat: 'var(--accent-chat)',
    cowork: 'var(--accent-cowork)',
    code: 'var(--accent-code)'
  };
  const currentModeColor = modeColors[activeMode] || modeColors.chat;

  return (
    <GlassSurface 
      intensity="elevated"
      style={{ 
        height: 40, 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 16px 0 90px', 
        borderRadius: 0, 
        borderBottom: 'none',
        justifyContent: 'space-between',
        background: 'transparent',
        position: 'relative',
        WebkitAppRegion: 'drag'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, WebkitAppRegion: 'no-drag' }}>
        <button 
          onClick={onRailToggle}
          style={{
            background: isRailCollapsed ? 'var(--shell-control-active-bg)' : 'var(--shell-control-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 6,
            color: isRailCollapsed ? 'var(--shell-control-active-fg)' : 'var(--shell-control-muted-fg)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            WebkitAppRegion: 'no-drag',
          }}
          title={isRailCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <SidebarSimple size={20} weight={isRailCollapsed ? "fill" : "regular"} />
        </button>

        <div style={{ 
          color: currentModeColor, 
          fontWeight: 900, 
          fontSize: 18, 
          letterSpacing: '-0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginLeft: 8
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: currentModeColor, boxShadow: '0 0 10px ' + currentModeColor }} />
          Allternit
        </div>
      </div>

      {/* Left-aligned Mode Switcher */}
      <div style={{
        position: 'absolute',
        left: '90px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        WebkitAppRegion: 'no-drag'
      }}>
        <ModeSwitcher 
          activeMode={activeMode} 
          onModeChange={onModeChange}
          size="small"
          variant="segmented"
          showLabels={true}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, WebkitAppRegion: 'no-drag' }}>
        {/* Environment Selector */}
        <EnvironmentSelector
          currentEnvironment={currentEnvironment}
          onEnvironmentChange={onEnvironmentChange}
          onOpenControlCenter={onOpenControlCenter}
        />

        {/* Allternit Operator Service Status */}
        <AllternitOperatorStatus />

        {/* Artifact Sidecar Toggle */}
        <button
          onClick={onSidecarToggle}
          style={{
            background: sidecarOpen ? 'var(--shell-control-active-bg)' : 'var(--shell-control-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            color: sidecarOpen ? 'var(--shell-control-active-fg)' : 'var(--shell-control-fg)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            WebkitAppRegion: 'no-drag',
          }}
          title="Toggle Artifact Sidecar (Cmd+Shift+A)"
        >
          <FileCode size={18} weight={sidecarOpen ? "fill" : "regular"} />
        </button>

        <div style={{ display: 'flex', gap: 4, WebkitAppRegion: 'no-drag' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, WebkitAppRegion: 'no-drag' }}>
            <CaretLeft size={18} />
          </button>
          <button onClick={onForward} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, WebkitAppRegion: 'no-drag' }}>
            <CaretRight size={18} />
          </button>
        </div>

        <button 
          onClick={onThemeToggle}
          style={{ 
            background: 'var(--shell-control-bg)', 
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            color: 'var(--shell-control-fg)',
            cursor: 'pointer',
            WebkitAppRegion: 'no-drag'
          }}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </GlassSurface>
  );
}
