import React from 'react';
import '../styles/design-tokens.css';
import '../styles/animations.css';

/**
 * GlassCard Component
 * 
 * A reusable glass morphism card component with configurable
 * blur intensity, opacity, border, and shadow levels.
 */

export type GlassVariant = 'light' | 'medium' | 'heavy';

export interface GlassCardProps {
  /** Card content */
  children: React.ReactNode;
  
  /** Glass opacity variant - affects background transparency */
  variant?: GlassVariant;
  
  /** Custom blur intensity (overrides variant default) */
  blur?: 'light' | 'medium' | 'heavy' | number;
  
  /** Custom opacity level (overrides variant default) */
  opacity?: number;
  
  /** Border style */
  border?: boolean | 'light' | 'medium' | 'heavy';
  
  /** Shadow elevation */
  shadow?: boolean | 'sm' | 'md' | 'lg' | 'xl' | 'glow-chat' | 'glow-cowork' | 'glow-code';
  
  /** Additional CSS classes */
  className?: string;
  
  /** Click handler */
  onClick?: () => void;
  
  /** Hover effect */
  hoverable?: boolean;
  
  /** Animation on mount */
  animate?: boolean | 'enter' | 'fade' | 'scale';
  
  /** HTML element to render as */
  as?: keyof JSX.IntrinsicElements;
  
  /** Additional HTML attributes */
  [key: string]: any;
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  variant = 'medium',
  blur,
  opacity,
  border = true,
  shadow = 'md',
  className = '',
  onClick,
  hoverable = false,
  animate = false,
  as: Component = 'div',
  ...rest
}) => {
  // Get CSS variable values based on variant
  const getVariantStyles = (): React.CSSProperties => {
    const styles: React.CSSProperties = {};
    
    // Background opacity
    if (opacity !== undefined) {
      styles.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
    } else {
      const opacityMap: Record<GlassVariant, string> = {
        light: 'var(--glass-light)',
        medium: 'var(--glass-medium)',
        heavy: 'var(--glass-heavy)',
      };
      styles.backgroundColor = opacityMap[variant];
    }
    
    // Backdrop blur
    if (typeof blur === 'number') {
      styles.backdropFilter = `blur(${blur}px) saturate(180%)`;
    } else {
      const blurMap: Record<string, string> = {
        light: 'var(--backdrop-blur-light)',
        medium: 'var(--backdrop-blur-medium)',
        heavy: 'var(--backdrop-blur-heavy)',
      };
      styles.backdropFilter = blurMap[blur || variant] || blurMap.medium;
    }
    
    // Border
    if (border === true) {
      styles.border = 'var(--glass-border-medium)';
    } else if (border === 'light') {
      styles.border = 'var(--glass-border-light)';
    } else if (border === 'medium') {
      styles.border = 'var(--glass-border-medium)';
    } else if (border === 'heavy') {
      styles.border = 'var(--glass-border-heavy)';
    }
    
    // Shadow
    if (shadow === true) {
      styles.boxShadow = 'var(--shadow-md)';
    } else if (shadow === 'sm') {
      styles.boxShadow = 'var(--shadow-sm)';
    } else if (shadow === 'md') {
      styles.boxShadow = 'var(--shadow-md)';
    } else if (shadow === 'lg') {
      styles.boxShadow = 'var(--shadow-lg)';
    } else if (shadow === 'xl') {
      styles.boxShadow = 'var(--shadow-xl)';
    } else if (shadow === 'glow-chat') {
      styles.boxShadow = 'var(--shadow-glow-chat)';
    } else if (shadow === 'glow-cowork') {
      styles.boxShadow = 'var(--shadow-glow-cowork)';
    } else if (shadow === 'glow-code') {
      styles.boxShadow = 'var(--shadow-glow-code)';
    }
    
    return styles;
  };
  
  // Build class names
  const getClassNames = (): string => {
    const classes = ['glass-card'];
    
    if (hoverable) {
      classes.push('hover-lift');
    }
    
    if (animate === true || animate === 'enter') {
      classes.push('animate-glass-enter');
    } else if (animate === 'fade') {
      classes.push('animate-fade-in');
    } else if (animate === 'scale') {
      classes.push('animate-scale-in');
    }
    
    if (className) {
      classes.push(className);
    }
    
    return classes.join(' ');
  };
  
  const baseStyles: React.CSSProperties = {
    borderRadius: 'var(--radius-xl)',
    transition: 'all var(--transition-normal)',
  };
  
  return React.createElement(
    Component as string,
    {
      className: getClassNames(),
      style: { ...baseStyles, ...getVariantStyles() },
      onClick,
      ...rest,
    },
    children
  );
};

export default GlassCard;
