/**
 * Body Component
 * 
 * Renders the avatar body shape based on setup type.
 * Supports 5 base shapes: round, square, hex, diamond, cloud
 */

import React from 'react';
import type { AvatarBodyShape, AvatarConfig, AvatarEmotion } from '../../../lib/agents/character.types';

interface BodyProps {
  shape: AvatarBodyShape;
  colors: AvatarConfig['colors'];
  size: number;
  emotion?: AvatarEmotion;
  isAnimating?: boolean;
  renderForClipPath?: boolean;
}

// SVG path definitions for each body shape
const BODY_PATHS: Record<AvatarBodyShape, {
  path: string;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  eyeY: number;
  antennaY: number;
}> = {
  round: {
    // Classic friendly circle
    path: 'M 50 10 C 72 10 90 28 90 50 C 90 72 72 90 50 90 C 28 90 10 72 10 50 C 10 28 28 10 50 10 Z',
    width: 80,
    height: 80,
    centerX: 50,
    centerY: 50,
    eyeY: 42,
    antennaY: 15,
  },
  square: {
    // Strong square with rounded corners
    path: 'M 20 15 L 80 15 C 87 15 90 18 90 25 L 90 75 C 90 82 87 85 80 85 L 20 85 C 13 85 10 82 10 75 L 10 25 C 10 18 13 15 20 15 Z',
    width: 80,
    height: 70,
    centerX: 50,
    centerY: 50,
    eyeY: 40,
    antennaY: 18,
  },
  hex: {
    // Tech-inspired hexagon
    path: 'M 50 8 L 85 28 L 85 72 L 50 92 L 15 72 L 15 28 Z',
    width: 70,
    height: 84,
    centerX: 50,
    centerY: 50,
    eyeY: 40,
    antennaY: 12,
  },
  diamond: {
    // Precise diamond shape
    path: 'M 50 5 L 90 50 L 50 95 L 10 50 Z',
    width: 80,
    height: 90,
    centerX: 50,
    centerY: 50,
    eyeY: 42,
    antennaY: 18,
  },
  cloud: {
    // Organic flowing cloud
    path: 'M 25 35 Q 15 35 15 45 Q 10 45 10 55 Q 10 70 25 70 Q 30 85 50 85 Q 70 85 75 70 Q 90 70 90 55 Q 90 45 85 45 Q 85 35 75 35 Q 75 20 60 20 Q 50 10 40 20 Q 25 20 25 35 Z',
    width: 80,
    height: 75,
    centerX: 50,
    centerY: 52,
    eyeY: 45,
    antennaY: 20,
  },
};

// Get emotion-specific body adjustments
function getEmotionBodyTransform(emotion: AvatarEmotion | undefined): string {
  if (!emotion) return '';
  
  switch (emotion) {
    case 'alert':
      return 'scale(1.02)';
    case 'focused':
      return 'scale(0.98)';
    case 'proud':
      return 'translateY(-2px) scale(1.01)';
    default:
      return '';
  }
}

export const Body: React.FC<BodyProps> = ({
  shape,
  colors,
  size,
  emotion,
  isAnimating,
  renderForClipPath = false,
}) => {
  const shapeDef = BODY_PATHS[shape] || BODY_PATHS['round'];
  const emotionTransform = getEmotionBodyTransform(emotion);
  
  // Calculate scale based on size
  const scale = size / 100;
  
  // Base style
  const baseStyle: React.CSSProperties = renderForClipPath ? {} : {
    fill: colors?.primary ?? '#6366f1',
    stroke: colors?.outline ?? '#1e1b4b',
    strokeWidth: 2,
    filter: `drop-shadow(0 2px 4px ${colors?.glow ?? '#6366f1'}40)`,
  };
  
  // Transform for emotion
  const transformStyle = emotionTransform || undefined;
  
  // Secondary accent for depth
  const renderAccent = !renderForClipPath && shape !== 'cloud';
  
  return (
    <g 
      className="avatar-body"
      data-shape={shape}
      data-emotion={emotion}
    >
      {/* Main body shape */}
      <path
        d={shapeDef.path}
        style={baseStyle}
        transform={transformStyle}
      />
      
      {/* Secondary accent line/pattern for depth */}
      {renderAccent && (
        <path
          d={shapeDef.path}
          style={{
            fill: 'none',
            stroke: colors?.secondary ?? '#8b5cf6',
            strokeWidth: 1,
            opacity: 0.3,
          }}
          transform={`scale(0.85) translate(${shapeDef.centerX * 0.18}, ${shapeDef.centerY * 0.18})`}
        />
      )}
      
      {/* Shape-specific details */}
      {shape === 'hex' && !renderForClipPath && (
        // Circuit pattern for coding/tech feel
        <>
          <circle cx="50" cy="35" r="3" fill={colors?.secondary ?? '#8b5cf6'} opacity="0.5" />
          <circle cx="35" cy="50" r="2" fill={colors?.secondary ?? '#8b5cf6'} opacity="0.4" />
          <circle cx="65" cy="50" r="2" fill={colors?.secondary ?? '#8b5cf6'} opacity="0.4" />
          <line x1="50" y1="38" x2="50" y2="45" stroke={colors?.secondary ?? '#8b5cf6'} strokeWidth="1" opacity="0.3" />
        </>
      )}
      
      {shape === 'square' && !renderForClipPath && (
        // Armor plates for operations
        <>
          <rect x="30" y="60" width="15" height="15" rx="2" fill={colors?.secondary ?? '#8b5cf6'} opacity="0.2" />
          <rect x="55" y="60" width="15" height="15" rx="2" fill={colors?.secondary ?? '#8b5cf6'} opacity="0.2" />
        </>
      )}
      
      {shape === 'diamond' && !renderForClipPath && (
        // Facet lines for research/scholar
        <>
          <line x1="50" y1="5" x2="50" y2="95" stroke={colors?.outline ?? '#1e1b4b'} strokeWidth="0.5" opacity="0.3" />
          <line x1="10" y1="50" x2="90" y2="50" stroke={colors?.outline ?? '#1e1b4b'} strokeWidth="0.5" opacity="0.3" />
        </>
      )}
      
      {shape === 'cloud' && !renderForClipPath && (
        // Soft gradient hint for creative
        <ellipse
          cx="50"
          cy="60"
          rx="25"
          ry="15"
          fill={colors?.secondary ?? '#8b5cf6'}
          opacity="0.15"
        />
      )}
    </g>
  );
};

// Export position helpers for other parts
export function getBodyPositions(shape: AvatarBodyShape) {
  const def = BODY_PATHS[shape];
  return {
    eyeX: def.centerX,
    eyeY: def.eyeY,
    leftEyeX: def.centerX - 12,
    rightEyeX: def.centerX + 12,
    antennaX: def.centerX,
    antennaY: def.antennaY,
  };
}

// Export shape metadata
export const BODY_SHAPE_METADATA: Record<AvatarBodyShape, {
  name: string;
  description: string;
  idealSetup: string;
}> = {
  round: {
    name: 'Friendly',
    description: 'Classic approachable circle',
    idealSetup: 'generalist',
  },
  square: {
    name: 'Shield',
    description: 'Strong protective form',
    idealSetup: 'operations',
  },
  hex: {
    name: 'Tech',
    description: 'Angular hexagon with circuit details',
    idealSetup: 'coding',
  },
  diamond: {
    name: 'Crystal',
    description: 'Precise geometric diamond',
    idealSetup: 'research',
  },
  cloud: {
    name: 'Organic',
    description: 'Flowing cloud-like form',
    idealSetup: 'creative',
  },
};

Body.displayName = 'Body';
