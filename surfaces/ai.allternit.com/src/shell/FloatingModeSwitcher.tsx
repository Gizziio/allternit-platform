import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassSurface } from '../design/GlassSurface';
import { tokens } from '../design/tokens';
import type { Icon } from '@phosphor-icons/react';
import { ChatText, UsersThree, TerminalWindow, Palette, Globe, CaretLeft, CaretRight, SidebarSimple, Sun, Moon } from '@phosphor-icons/react';
import type { AppMode } from './ShellHeader';

interface FloatingModeSwitcherProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onRailToggle: () => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export function FloatingModeSwitcher({ activeMode, onModeChange, onRailToggle, theme, onThemeToggle }: FloatingModeSwitcherProps): JSX.Element {
  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <GlassSurface
        intensity="elevated"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px',
          borderRadius: 999,
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          background: 'var(--glass-bg-thick)',
          gap: 4
        }}
      >
        <button onClick={onRailToggle} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '8px 12px' }}>
          <SidebarSimple size={18} weight="bold" />
        </button>
        
        <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />

        <ModePill active={activeMode === 'chat'} onClick={() => onModeChange('chat')} icon={ChatText} label="Chat" color={tokens.colors.chat.primary} />
        <ModePill active={activeMode === 'cowork'} onClick={() => onModeChange('cowork')} icon={UsersThree} label="Cowork" color="var(--accent-cowork)" />
        <ModePill active={activeMode === 'code'} onClick={() => onModeChange('code')} icon={TerminalWindow} label="Code" color="var(--accent-code)" />
        <ModePill active={activeMode === 'design'} onClick={() => onModeChange('design')} icon={Palette} label="Design" color="rgba(212,176,140,0.9)" />
        <ModePill active={activeMode === 'browser'} onClick={() => onModeChange('browser')} icon={Globe} label="Browser" color="var(--accent-browser)" />

        <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />

        <button onClick={onThemeToggle} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '8px 12px' }}>
          {theme === 'light' ? <Moon size={18} weight="bold" /> : <Sun size={18} weight="bold" />}
        </button>
      </GlassSurface>
    </div>
  );
}

interface ModePillProps {
  active: boolean;
  onClick: () => void;
  icon: Icon;
  label: string;
  color: string;
}

function ModePill({ active, onClick, icon: Icon, label, color }: ModePillProps): JSX.Element {
  return (
    <motion.button
      onClick={onClick}
      layout
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: active ? 8 : 0,
        padding: active ? '8px 16px' : '8px 10px',
        borderRadius: 999,
        border: 'none',
        background: active ? color : 'transparent',
        color: active ? 'var(--shell-control-active-fg)' : 'var(--text-tertiary)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 700,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Icon size={18} weight={active ? 'fill' : 'bold'} />
      <AnimatePresence initial={false}>
        {active && (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            style={{ overflow: 'hidden', display: 'inline-block' }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
