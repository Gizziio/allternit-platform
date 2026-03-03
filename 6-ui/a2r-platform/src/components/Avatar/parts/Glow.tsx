/**
 * Glow Component
 * 
 * Renders the ambient glow/beacon effect behind the avatar.
 * Supports pulsing animation and intensity adjustments.
 */

import React from 'react';

interface GlowProps {
  color: string;
  size: number;
  intensity?: number;
  pulse?: boolean;
}

export const Glow: React.FC<GlowProps> = ({
  color,
  size,
  intensity = 0.5,
  pulse = true,
}) => {
  const scale = size / 100;
  
  // Calculate glow size based on avatar size
  const glowRadius = 45 * scale;
  const glowOpacity = Math.min(1, Math.max(0, intensity));
  
  return (
    <g 
      className={`avatar-glow ${pulse ? 'avatar-glow--pulsing' : ''}`}
      style={{
        opacity: glowOpacity,
      }}
    >
      {/* Outer soft glow */}
      <circle
        cx={50}
        cy={50}
        r={glowRadius}
        fill={color}
        opacity={0.15}
        filter="url(#glow-outer)"
      />
      
      {/* Middle glow layer */}
      <circle
        cx={50}
        cy={50}
        r={glowRadius * 0.7}
        fill={color}
        opacity={0.25}
        filter="url(#glow-middle)"
      />
      
      {/* Inner bright glow */}
      <circle
        cx={50}
        cy={50}
        r={glowRadius * 0.4}
        fill={color}
        opacity={0.4}
      />
      
      {/* Define glow filters */}
      <defs>
        <filter id="glow-outer" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        
        <filter id="glow-middle" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </g>
  );
};

// Predefined glow intensity presets
export const GLOW_INTENSITY_PRESETS = {
  dim: 0.3,
  soft: 0.5,
  bright: 0.7,
  intense: 0.9,
} as const;

// Helper to calculate glow color from base color
export function calculateGlowColor(baseColor: string, intensity: number = 1): string {
  // If it's a hex color, we can use it directly with adjusted opacity
  if (baseColor.startsWith('#')) {
    return baseColor;
  }
  return baseColor;
}

// Helper to create gradient glow effect
export function createGlowGradient(
  color: string,
  id: string
): React.ReactNode {
  return (
    <radialGradient id={id} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor={color} stopOpacity="0.6" />
      <stop offset="50%" stopColor={color} stopOpacity="0.2" />
      <stop offset="100%" stopColor={color} stopOpacity="0" />
    </radialGradient>
  );
}

Glow.displayName = 'Glow';
