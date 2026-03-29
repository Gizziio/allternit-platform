import React from 'react';
import {
  Sparkle,
  Robot,
  Lightning,
} from '@phosphor-icons/react';

interface A2RLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'horizontal' | 'stacked' | 'icon-only';
  showText?: boolean;
}

/**
 * A2R Brand Logo Component
 * 
 * Represents the A2R (Autonomous Agent Runtime) brand identity
 * using the sand/nude color palette from the design system.
 * Optimized for dark theme backgrounds.
 */
export function A2RLogo({ size = 'md', variant = 'horizontal', showText = true }: A2RLogoProps) {
  const sizeConfig = {
    sm: { icon: 20, text: 'text-sm', gap: 'gap-1.5' },
    md: { icon: 28, text: 'text-base', gap: 'gap-2' },
    lg: { icon: 40, text: 'text-2xl', gap: 'gap-3' },
  };

  const config = sizeConfig[size];

  // A2R Brand Colors from design system (dark theme optimized)
  const brandColors = {
    primary: '#D4B08C',    // nude-400 (brighter for dark theme)
    secondary: '#B08D6E',  // sand-500
    accent: '#D97757',     // Warm accent
    light: '#ECECEC',      // Primary text for dark theme
  };

  const LogoIcon = () => (
    <div 
      className="relative flex items-center justify-center"
      style={{
        width: config.icon,
        height: config.icon,
      }}
    >
      {/* Outer ring - gradient */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.accent} 100%)`,
          opacity: 0.15,
        }}
      />
      
      {/* Middle ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: config.icon * 0.7,
          height: config.icon * 0.7,
          border: `2px solid ${brandColors.primary}`,
          opacity: 0.4,
        }}
      />
      
      {/* Inner core - Sparkles icon */}
      <Sparkle 
        size={config.icon * 0.5} 
        style={{ color: brandColors.primary }}
        fill="currentColor"
      />
    </div>
  );

  const Text = () => (
    <div className="flex flex-col">
      <span 
        className={`${config.text} font-bold tracking-tight`}
        style={{ color: brandColors.light }}
      >
        A2R
      </span>
      {size !== 'sm' && (
        <span 
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: brandColors.primary }}
        >
          Agent Studio
        </span>
      )}
    </div>
  );

  if (variant === 'icon-only') {
    return <LogoIcon />;
  }

  if (variant === 'stacked') {
    return (
      <div className="flex flex-col items-center gap-2">
        <LogoIcon />
        {showText && <Text />}
      </div>
    );
  }

  // Horizontal (default)
  return (
    <div className={`flex items-center ${config.gap}`}>
      <LogoIcon />
      {showText && <Text />}
    </div>
  );
}

/**
 * Animated Orb Component for Agent Studio branding
 */
export function A2ROrb({ className = '' }: { className?: string }) {
  const brandColors = {
    primary: '#B08D6E',
    secondary: '#D4B08C',
    accent: '#D97757',
  };

  return (
    <div className={`relative ${className}`}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-xl"
        style={{
          background: `radial-gradient(circle, ${brandColors.primary} 0%, transparent 70%)`,
          opacity: 0.3,
        }}
      />
      
      {/* Outer orbit */}
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          border: `1px solid ${brandColors.primary}`,
          opacity: 0.2,
          animationDuration: '8s',
        }}
      />
      
      {/* Inner orbit */}
      <div
        className="absolute inset-2 rounded-full animate-spin"
        style={{
          border: `1px solid ${brandColors.secondary}`,
          opacity: 0.3,
          animationDirection: 'reverse',
          animationDuration: '6s',
        }}
      />
      
      {/* Core */}
      <div
        className="absolute inset-4 rounded-full"
        style={{
          background: `linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.accent} 100%)`,
          boxShadow: `0 0 20px ${brandColors.primary}40`,
        }}
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

export function BrandBadge({ 
  children, 
  variant = 'default', 
  size = 'sm',
  icon,
  className = ''
}: BrandBadgeProps) {
  const brandColors = {
    primary: '#D4B08C',
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
    sm: { padding: 'px-1.5 py-0.5', text: 'text-[10px]', height: 'h-4' },
    md: { padding: 'px-2 py-1', text: 'text-xs', height: 'h-5' },
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border ${config.bg} ${config.border} ${sizeConfig[size].padding} ${sizeConfig[size].text} ${sizeConfig[size].height} ${className}`}
      style={{ color: config.text }}
    >
      {icon}
      {children}
    </span>
  );
}
