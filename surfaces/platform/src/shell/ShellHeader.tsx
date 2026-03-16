import React from 'react';
import { GlassSurface } from '../design/GlassSurface';
import { tokens } from '../design/tokens';
import { A2ROperatorStatus } from '../components/A2ROperatorStatus';
import { EnvironmentSelector, EnvironmentType } from './EnvironmentSelector';
import {
  ChatText,
  UsersThree,
  TerminalWindow,
  CaretLeft,
  CaretRight,
  Command,
  Sun,
  Moon,
  SidebarSimple,
  Gear,
  FileCode,
} from '@phosphor-icons/react';

import { ModeSwitcher } from './ModeSwitcher';

export type AppMode = 'chat' | 'cowork' | 'code';

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
  currentEnvironment = 'cloud',
  onEnvironmentChange,
}: any) {
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
        height: 64, 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 ' + tokens.space.lg + 'px', 
        borderRadius: 0, 
        borderBottom: '1px solid var(--border-subtle)',
        justifyContent: 'space-between',
        background: 'var(--glass-bg-elevated)',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button 
          onClick={onRailToggle}
          style={{
            background: isRailCollapsed ? 'var(--accent-chat)' : 'rgba(128,128,128,0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 8,
            color: isRailCollapsed ? 'white' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
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
          A2R
        </div>
      </div>

      {/* Centered Mode Switcher */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10
      }}>
        <ModeSwitcher 
          activeMode={activeMode} 
          onModeChange={onModeChange}
          size="small"
          variant="segmented"
          showLabels={true}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Environment Selector */}
        <EnvironmentSelector
          currentEnvironment={currentEnvironment}
          onEnvironmentChange={onEnvironmentChange}
          onOpenControlCenter={onOpenControlCenter}
        />

        {/* A2R Operator Service Status */}
        <A2ROperatorStatus />

        {/* Artifact Sidecar Toggle */}
        <button
          onClick={onSidecarToggle}
          style={{
            background: sidecarOpen ? 'var(--accent-chat)' : 'rgba(128,128,128,0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            color: sidecarOpen ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="Toggle Artifact Sidecar (Cmd+Shift+A)"
        >
          <FileCode size={18} weight={sidecarOpen ? "fill" : "regular"} />
        </button>

        {/* Control Center (Gear Icon) */}
        <button
          onClick={onOpenControlCenter}
          style={{
            background: 'rgba(128,128,128,0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
          title="Control Center"
        >
          <Gear size={18} />
        </button>

        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}>
            <CaretLeft size={18} />
          </button>
          <button onClick={onForward} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}>
            <CaretRight size={18} />
          </button>
        </div>

        <button 
          onClick={onThemeToggle}
          style={{ 
            background: 'rgba(128,128,128,0.05)', 
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </GlassSurface>
  );
}

function ModeButton({ active, onClick, icon: Icon, label, color }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px',
        borderRadius: 11,
        border: 'none',
        background: active ? 'var(--bg-secondary)' : 'transparent',
        color: active ? color : 'var(--text-tertiary)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
      }}
    >
      <Icon size={18} weight={active ? 'duotone' : 'regular'} />
      {label}
    </button>
  );
}
