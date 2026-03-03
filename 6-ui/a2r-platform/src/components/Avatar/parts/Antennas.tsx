/**
 * Antennas Component
 * 
 * Renders avatar antennas with support for:
 * - Multiple styles (straight, curved, coiled, zigzag, leaf, bolt)
 * - 0-3 count
 * - Various animations
 * - Tip decorations
 */

import React from 'react';
import type { 
  AvatarConfig, 
  AvatarEmotion, 
  AntennaStyle 
} from '../../../lib/agents/character.types';

interface AntennasProps {
  config: AvatarConfig['antennas'];
  colors: AvatarConfig['colors'];
  size: number;
  emotion?: AvatarEmotion;
  isAnimating?: boolean;
}

// Antenna path definitions
const ANTENNA_PATHS: Record<AntennaStyle, {
  name: string;
  path: string;
  width: number;
  height: number;
  tipX: number;
  tipY: number;
}> = {
  straight: {
    name: 'Straight',
    path: 'M 0 0 L 0 -25',
    width: 2,
    height: 25,
    tipX: 0,
    tipY: -25,
  },
  curved: {
    name: 'Curved',
    path: 'M 0 0 Q -5 -12 0 -25',
    width: 4,
    height: 25,
    tipX: 0,
    tipY: -25,
  },
  coiled: {
    name: 'Coiled',
    path: 'M 0 0 L 0 -5 Q -3 -7 -3 -10 Q -3 -13 0 -15 Q 3 -17 3 -20 Q 3 -23 0 -25',
    width: 6,
    height: 25,
    tipX: 0,
    tipY: -25,
  },
  zigzag: {
    name: 'Zigzag',
    path: 'M 0 0 L -3 -8 L 3 -16 L 0 -25',
    width: 6,
    height: 25,
    tipX: 0,
    tipY: -25,
  },
  leaf: {
    name: 'Leaf',
    path: 'M 0 0 Q -6 -12 0 -25 Q 6 -12 0 0',
    width: 12,
    height: 25,
    tipX: 0,
    tipY: -25,
  },
  bolt: {
    name: 'Bolt',
    path: 'M -2 0 L 2 -10 L -2 -18 L 2 -25',
    width: 4,
    height: 25,
    tipX: 2,
    tipY: -25,
  },
};

// Tip decoration paths
const TIP_DECORATIONS: Record<string, {
  render: (x: number, y: number, color: string) => React.ReactNode;
}> = {
  none: { render: () => null },
  ball: {
    render: (x, y, color) => (
      <circle cx={x} cy={y} r="3" fill={color} />
    ),
  },
  glow: {
    render: (x, y, color) => (
      <>
        <circle cx={x} cy={y} r="4" fill={color} opacity="0.5" filter="url(#glow)" />
        <circle cx={x} cy={y} r="2" fill={color} />
      </>
    ),
  },
  star: {
    render: (x, y, color) => (
      <polygon
        points={`${x},${y - 4} ${x + 1},${y - 1} ${x + 4},${y} ${x + 1},${y + 1} ${x},${y + 4} ${x - 1},${y + 1} ${x - 4},${y} ${x - 1},${y - 1}`}
        fill={color}
      />
    ),
  },
  diamond: {
    render: (x, y, color) => (
      <polygon
        points={`${x},${y - 4} ${x + 3},${y} ${x},${y + 4} ${x - 3},${y}`}
        fill={color}
      />
    ),
  },
};

// Get animation class based on config
function getAnimationClass(animation: string): string {
  return `antenna-animation--${animation}`;
}

// Calculate antenna positions based on count
function getAntennaPositions(count: number): { x: number; angle: number }[] {
  switch (count) {
    case 1:
      return [{ x: 50, angle: 0 }];
    case 2:
      return [
        { x: 40, angle: -10 },
        { x: 60, angle: 10 },
      ];
    case 3:
      return [
        { x: 35, angle: -15 },
        { x: 50, angle: 0 },
        { x: 65, angle: 15 },
      ];
    default:
      return [];
  }
}

export const Antennas: React.FC<AntennasProps> = ({
  config,
  colors,
  size,
  emotion,
  isAnimating,
}) => {
  if (config.count === 0) return null;
  
  const style = ANTENNA_PATHS[config.style];
  const positions = getAntennaPositions(config.count);
  const tipDecoration = TIP_DECORATIONS[config.tipDecoration || 'none'];
  const scale = size / 100;
  
  // Emotion-based antenna adjustments
  const getEmotionTransform = (baseAngle: number): string => {
    switch (emotion) {
      case 'alert':
        return `rotate(${baseAngle * 0.5})`;
      case 'curious':
        return `rotate(${baseAngle + (baseAngle < 0 ? -5 : 5)})`;
      case 'focused':
        return `rotate(${baseAngle * 0.3})`;
      case 'skeptical':
        return `rotate(${baseAngle + (baseAngle < 0 ? 3 : -3)})`;
      default:
        return `rotate(${baseAngle})`;
    }
  };
  
  return (
    <g 
      className="avatar-antennas"
      data-count={config.count}
      data-style={config.style}
      data-animation={isAnimating ? config.animation : 'static'}
    >
      {positions.map((pos, index) => {
        const emotionTransform = getEmotionTransform(pos.angle);
        const animationClass = isAnimating ? getAnimationClass(config.animation) : '';
        
        return (
          <g
            key={index}
            className={`avatar-antenna ${animationClass}`}
            transform={`translate(${pos.x}, 20) ${emotionTransform}`}
            style={{
              transformOrigin: '0 0',
            }}
          >
            {/* Antenna stem */}
            <path
              d={style.path}
              stroke={colors.secondary}
              strokeWidth={2 * scale}
              strokeLinecap="round"
              fill="none"
            />
            
            {/* Tip decoration */}
            {tipDecoration.render(
              style.tipX,
              style.tipY,
              colors.glow
            )}
          </g>
        );
      })}
    </g>
  );
};

// Export antenna metadata
export const ANTENNA_STYLE_METADATA: Record<AntennaStyle, {
  name: string;
  description: string;
  energy: 'low' | 'medium' | 'high';
}> = {
  straight: {
    name: 'Straight',
    description: 'Classic stick antenna',
    energy: 'low',
  },
  curved: {
    name: 'Curved',
    description: 'Elegant arc design',
    energy: 'low',
  },
  coiled: {
    name: 'Coiled',
    description: 'Spring-like flexible',
    energy: 'high',
  },
  zigzag: {
    name: 'Zigzag',
    description: 'Electric energetic',
    energy: 'high',
  },
  leaf: {
    name: 'Leaf',
    description: 'Natural organic',
    energy: 'medium',
  },
  bolt: {
    name: 'Bolt',
    description: 'Lightning powerful',
    energy: 'high',
  },
};

export const ANTENNA_ANIMATION_METADATA: Record<string, {
  name: string;
  description: string;
}> = {
  static: { name: 'Static', description: 'No movement' },
  wiggle: { name: 'Wiggle', description: 'Random twitching' },
  pulse: { name: 'Pulse', description: 'Glow intensity change' },
  sway: { name: 'Sway', description: 'Gentle rotation' },
  bounce: { name: 'Bounce', description: 'Vertical bobbing' },
};

export const TIP_DECORATION_METADATA: Record<string, {
  name: string;
  description: string;
}> = {
  none: { name: 'None', description: 'Plain tip' },
  ball: { name: 'Ball', description: 'Round ball tip' },
  glow: { name: 'Glow', description: 'Glowing orb' },
  star: { name: 'Star', description: 'Star-shaped tip' },
  diamond: { name: 'Diamond', description: 'Diamond gem tip' },
};

Antennas.displayName = 'Antennas';
