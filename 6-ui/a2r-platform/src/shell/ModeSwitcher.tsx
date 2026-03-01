import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatTeardropText,
  UsersThree,
  TerminalWindow,
  type Icon
} from '@phosphor-icons/react';
import type { AppMode } from './ShellHeader';

// Mode configuration with Sand Nude theme colors
interface ModeConfig {
  id: AppMode;
  label: string;
  icon: Icon;
  accentColor: string;
  accentLight: string;
  accentDark: string;
  description: string;
}

const MODES: ModeConfig[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: ChatTeardropText,
    accentColor: 'var(--accent-chat)',
    accentLight: 'rgba(176, 141, 110, 0.15)',
    accentDark: '#7D5F46',
    description: 'Conversational AI interface'
  },
  {
    id: 'cowork',
    label: 'Cowork',
    icon: UsersThree,
    accentColor: 'var(--accent-cowork)',
    accentLight: 'rgba(154, 123, 170, 0.15)',
    accentDark: '#6B5577',
    description: 'Collaborative workspace with artifacts'
  },
  {
    id: 'code',
    label: 'Code',
    icon: TerminalWindow,
    accentColor: 'var(--accent-code)',
    accentLight: 'rgba(107, 154, 123, 0.15)',
    accentDark: '#4A6B55',
    description: 'Development environment with code tools'
  }
];

// Hook for localStorage persistence
const MODE_STORAGE_KEY = 'a2r-platform-mode';

export function useModePersistence() {
  const [mode, setMode] = useState<AppMode>('chat');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load mode from localStorage on mount
    try {
      const savedMode = localStorage.getItem(MODE_STORAGE_KEY) as AppMode | null;
      if (savedMode && ['chat', 'cowork', 'code'].includes(savedMode)) {
        setMode(savedMode);
      }
    } catch {
      // localStorage not available
    }
    setIsLoaded(true);
  }, []);

  const saveMode = (newMode: AppMode) => {
    setMode(newMode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
    } catch {
      // localStorage not available
    }
  };

  return { mode, setMode: saveMode, isLoaded };
}

interface ModeSwitcherProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'pill' | 'tabs' | 'segmented';
  className?: string;
  showLabels?: boolean;
  showTooltips?: boolean;
}

export function ModeSwitcher({
  activeMode,
  onModeChange,
  size = 'medium',
  variant = 'pill',
  className = '',
  showLabels = true,
  showTooltips = false
}: ModeSwitcherProps) {
  const [hoveredMode, setHoveredMode] = useState<AppMode | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleModeChange = (mode: AppMode) => {
    if (mode === activeMode || isTransitioning) return;
    
    setIsTransitioning(true);
    onModeChange(mode);
    
    // Reset transition state after animation
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const activeConfig = MODES.find(m => m.id === activeMode) || MODES[0];

  // Size configurations
  const sizeConfig = {
    small: {
      height: 28,
      padding: '3px 6px',
      iconSize: 14,
      fontSize: 11,
      gap: 2
    },
    medium: {
      height: 34,
      padding: '6px 14px',
      iconSize: 16,
      fontSize: 13,
      gap: 3
    },
    large: {
      height: 44,
      padding: '8px 20px',
      iconSize: 20,
      fontSize: 14,
      gap: 4
    }
  };

  const sizes = sizeConfig[size];

  if (variant === 'tabs') {
    return (
      <div 
        className={`mode-switcher-tabs ${className}`}
        style={{
          display: 'flex',
          gap: 0,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          position: 'relative'
        }}
      >
        {MODES.map((mode, index) => {
          const isActive = activeMode === mode.id;
          const isHovered = hoveredMode === mode.id;
          
          return (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id)}
              onMouseEnter={() => setHoveredMode(mode.id)}
              onMouseLeave={() => setHoveredMode(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: sizes.gap,
                padding: sizes.padding,
                height: sizes.height,
                border: 'none',
                background: isActive ? mode.accentLight : 'transparent',
                color: isActive ? mode.accentColor : 'var(--text-tertiary)',
                cursor: 'pointer',
                fontSize: sizes.fontSize,
                fontWeight: isActive ? 700 : 600,
                position: 'relative',
                transition: 'all 0.2s ease',
                borderRight: index < MODES.length - 1 ? '1px solid var(--border-subtle)' : 'none'
              }}
              title={showTooltips ? mode.description : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 4,
                    right: 4,
                    height: 2,
                    background: mode.accentColor,
                    borderRadius: 2
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <mode.icon 
                size={sizes.iconSize} 
                weight={isActive ? 'duotone' : 'regular'}
                style={{
                  color: isActive ? mode.accentColor : (isHovered ? mode.accentColor : 'var(--text-tertiary)'),
                  transition: 'color 0.2s ease'
                }}
              />
              {showLabels && (
                <span style={{ whiteSpace: 'nowrap' }}>{mode.label}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'segmented') {
    return (
      <div
        className={`mode-switcher-segmented ${className}`}
        style={{
          display: 'flex',
          background: 'rgba(128, 128, 128, 0.05)',
          padding: 3,
          borderRadius: 10,
          gap: 2,
          border: '1px solid var(--border-subtle)',
          position: 'relative'
        }}
      >
        {MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          const isHovered = hoveredMode === mode.id;
          
          return (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id)}
              onMouseEnter={() => setHoveredMode(mode.id)}
              onMouseLeave={() => setHoveredMode(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: sizes.gap,
                padding: sizes.padding,
                height: sizes.height - 6,
                borderRadius: 8,
                border: 'none',
                background: isActive ? 'var(--bg-primary)' : 'transparent',
                color: isActive ? mode.accentColor : 'var(--text-tertiary)',
                cursor: 'pointer',
                fontSize: sizes.fontSize,
                fontWeight: isActive ? 700 : 600,
                position: 'relative',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
              }}
              title={showTooltips ? mode.description : undefined}
            >
              <mode.icon 
                size={sizes.iconSize} 
                weight={isActive ? 'duotone' : 'regular'}
              />
              {showLabels && mode.label}
            </button>
          );
        })}
      </div>
    );
  }

  // Default pill variant (matching FloatingWidgets style)
  return (
    <div
      className={`mode-switcher-pill ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 3,
        borderRadius: 999,
        border: '1px solid var(--border-subtle)',
        background: 'var(--glass-bg-thick)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        gap: 2,
        height: sizes.height,
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)'
      }}
    >
      {MODES.map((mode) => {
        const isActive = activeMode === mode.id;
        const isHovered = hoveredMode === mode.id;
        
        return (
          <motion.button
            key={mode.id}
            onClick={() => handleModeChange(mode.id)}
            onMouseEnter={() => setHoveredMode(mode.id)}
            onMouseLeave={() => setHoveredMode(null)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: sizes.gap,
              padding: showLabels ? sizes.padding : '6px 8px',
              borderRadius: 999,
              border: 'none',
              background: isActive ? mode.accentColor : 'transparent',
              color: isActive ? 'white' : (isHovered ? mode.accentColor : 'var(--text-tertiary)'),
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: sizes.fontSize,
              fontWeight: 700,
              position: 'relative',
              height: sizes.height - 6
            }}
            title={showTooltips ? mode.description : undefined}
          >
            <mode.icon 
              size={sizes.iconSize} 
              weight={isActive ? 'fill' : 'bold'}
            />
            {showLabels && (
              <span>{mode.label}</span>
            )}
            
            {/* Active indicator dot */}
            {isActive && (
              <motion.div
                layoutId="activeIndicator"
                style={{
                  position: 'absolute',
                  bottom: -4,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: mode.accentColor
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// Mode indicator badge - shows current mode with accent color
interface ModeIndicatorProps {
  mode: AppMode;
  size?: 'small' | 'medium';
  pulse?: boolean;
}

export function ModeIndicator({ mode, size = 'small', pulse = false }: ModeIndicatorProps) {
  const config = MODES.find(m => m.id === mode) || MODES[0];
  const dotSize = size === 'small' ? 6 : 8;
  
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="mode-indicator"
      style={{
        width: dotSize,
        height: dotSize,
        borderRadius: '50%',
        background: config.accentColor,
        boxShadow: `0 0 ${pulse ? 8 : 4}px ${config.accentColor}`,
        position: 'relative'
      }}
    >
      {pulse && (
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: '50%',
            background: config.accentColor,
            opacity: 0.3
          }}
        />
      )}
    </motion.div>
  );
}

// Mode-aware accent color hook
export function useModeAccent(mode: AppMode) {
  const config = MODES.find(m => m.id === mode) || MODES[0];
  return {
    color: config.accentColor,
    light: config.accentLight,
    dark: config.accentDark,
    icon: config.icon
  };
}

// Mode transition wrapper with animation
interface ModeTransitionProps {
  mode: AppMode;
  children: React.ReactNode;
  className?: string;
}

export function ModeTransition({ mode, children, className = '' }: ModeTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export { MODES };
export type { ModeConfig };
