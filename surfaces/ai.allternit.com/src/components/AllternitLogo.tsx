import React from 'react';
import {
  Sparkle,
} from '@phosphor-icons/react';

interface AllternitLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'horizontal' | 'stacked' | 'icon-only';
  showText?: boolean;
}

/**
 * Allternit Brand Logo Component
 * 
 * Represents the Allternit (Autonomous Agent Runtime) brand identity
 * using the sand/nude color palette from the design system.
 * Optimized for dark theme backgrounds.
 */
export function AllternitLogo({ size = 'md', variant = 'horizontal', showText = true }: AllternitLogoProps) {
  const sizeConfig = {
    sm: { icon: 20, text: 'text-sm', gap: 'gap-1.5' },
    md: { icon: 28, text: 'text-base', gap: 'gap-2' },
    lg: { icon: 40, text: 'text-2xl', gap: 'gap-3' },
  };

  const config = sizeConfig[size];

  // Allternit Brand Colors from design system (dark theme optimized)
  const brandColors = {
    primary: 'var(--accent-primary)',    // nude-400 (brighter for dark theme)
    secondary: '#B08D6E',  // sand-500
    accent: '#D97757',     // Warm accent
    light: '#ECECEC',      // Primary text for dark theme
  };

  const logoIconEl = (
    <div 
      className="relative flex items-center justify-center size-[var(--logo-size)]"
      style={{
        '--logo-size': `${config.icon}px`,
      } as React.CSSProperties}
    >
      {/* Outer ring - gradient */}
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--logo-primary)] to-[var(--logo-accent)] opacity-15"
        style={{
          '--logo-primary': brandColors.primary,
          '--logo-accent': brandColors.accent,
        } as React.CSSProperties}
      />
      
      {/* Middle ring */}
      <div
        className="absolute rounded-full size-[var(--ring-size)] border-2 border-solid border-[var(--logo-primary)] opacity-40"
        style={{
          '--ring-size': `${config.icon * 0.7}px`,
          '--logo-primary': brandColors.primary,
        } as React.CSSProperties}
      />
      
      {/* Inner core - Sparkles icon */}
      <Sparkle 
        size={config.icon * 0.5} 
        className="text-[var(--logo-primary)] fill-current"
        style={{ '--logo-primary': brandColors.primary } as React.CSSProperties}
      />
    </div>
  );

  const textEl = (
    <div className="flex flex-col">
      <span 
        className={`${config.text} font-bold tracking-tight text-[var(--logo-light)]`}
        style={{ '--logo-light': brandColors.light } as React.CSSProperties}
      >
        Allternit
      </span>
      {size !== 'sm' && (
        <span 
          className="text-xs font-medium uppercase tracking-wider text-[var(--logo-primary)]"
          style={{ '--logo-primary': brandColors.primary } as React.CSSProperties}
        >
          Agent Studio
        </span>
      )}
    </div>
  );

  if (variant === 'icon-only') {
    return logoIconEl;
  }

  if (variant === 'stacked') {
    return (
      <div className="flex flex-col items-center gap-2">
        {logoIconEl}
        {showText && textEl}
      </div>
    );
  }

  // Horizontal (default)
  return (
    <div className={`flex items-center ${config.gap}`}>
      {logoIconEl}
      {showText && textEl}
    </div>
  );
}

/**
 * Animated Orb Component for Agent Studio branding
 */
function AllternitOrb({ className = '' }: { className?: string }) {
  const brandColors = {
    primary: '#B08D6E',
    secondary: 'var(--accent-primary)',
    accent: '#D97757',
  };

  return (
    <div className={`relative ${className}`}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-md bg-[radial-gradient(circle,_var(--orb-primary)_0%,_transparent_70%)] opacity-30"
        style={{ '--orb-primary': brandColors.primary } as React.CSSProperties}
      />
      
      {/* Outer orbit */}
      <div
        className="absolute inset-0 rounded-full animate-spin border border-solid border-[var(--orb-primary)] opacity-20 duration-[8s]"
        style={{ '--orb-primary': brandColors.primary } as React.CSSProperties}
      />
      
      {/* Inner orbit */}
      <div
        className="absolute inset-2 rounded-full animate-spin-reverse border border-solid border-[var(--orb-secondary)] opacity-30 duration-[6s]"
        style={{ '--orb-secondary': brandColors.secondary } as React.CSSProperties}
      />
      
      {/* Core */}
      <div
        className="absolute inset-4 rounded-full bg-gradient-to-br from-[var(--orb-primary)] to-[var(--orb-accent)] shadow-[0_0_20px_var(--orb-primary-40)]"
        style={{ 
          '--orb-primary': brandColors.primary,
          '--orb-accent': brandColors.accent,
          '--orb-primary-40': `${brandColors.primary}40`
        } as React.CSSProperties}
      />
    </div>
  );
}

/**
 * Brand Badge Component for Agent types and statuses
 */
interface BrandBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'accent';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

function BrandBadge({ 
  children, 
  variant = 'default', 
  size = 'sm',
  icon,
  className = ''
}: BrandBadgeProps) {
  const brandColors = {
    primary: 'var(--accent-primary)',
    secondary: '#B08D6E',
    accent: '#D97757',
    light: '#ECECEC',
  };

  const variants = {
    default: {
      bg: 'rgba(212, 176, 140, 0.08)',
      border: 'rgba(212, 176, 140, 0.2)',
      text: brandColors.light,
    },
    primary: {
      bg: `rgba(212, 176, 140, 0.15)`,
      border: brandColors.primary,
      text: brandColors.primary,
    },
    secondary: {
      bg: `rgba(176, 141, 110, 0.15)`,
      border: brandColors.secondary,
      text: '#B08D6E',
    },
    accent: {
      bg: `rgba(217, 119, 87, 0.15)`,
      border: brandColors.accent,
      text: brandColors.accent,
    },
  };

  const config = variants[variant];
  const sizeConfig = {
    sm: { padding: 'px-1.5 py-0.5', text: 'text-xs', height: 'h-4' },
    md: { padding: 'px-2 py-1', text: 'text-xs', height: 'h-5' },
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border border-solid bg-[var(--badge-bg)] border-[var(--badge-border)] text-[var(--badge-text)] ${sizeConfig[size].padding} ${sizeConfig[size].text} ${sizeConfig[size].height} ${className}`}
      style={{ 
        '--badge-bg': config.bg, 
        '--badge-border': config.border, 
        '--badge-text': config.text 
      } as React.CSSProperties}
    >
      {icon}
      {children}
    </span>
  );
}
