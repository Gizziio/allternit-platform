/**
 * Clawd Avatar Adapter
 * 
 * Official A2R mascot avatar with full mood support.
 */

import type { AvatarAdapter } from '../types';
import { Mood, AvatarSize, VisualState, getMoodColor } from '@a2r/visual-state/types';
import React from 'react';

/**
 * Clawd SVG paths for each mood
 */
const clawdPaths: Record<Mood, string> = {
  [Mood.Idle]: `
    <circle cx="50" cy="50" r="40" fill="currentColor"/>
    <circle cx="35" cy="40" r="5" fill="white"/>
    <circle cx="65" cy="40" r="5" fill="white"/>
    <path d="M 35 60 Q 50 65 65 60" stroke="white" stroke-width="3" fill="none"/>
  `,
  [Mood.Focused]: `
    <circle cx="50" cy="50" r="40" fill="currentColor"/>
    <ellipse cx="35" cy="40" rx="8" ry="5" fill="white"/>
    <ellipse cx="65" cy="40" rx="8" ry="5" fill="white"/>
    <circle cx="35" cy="40" r="2" fill="currentColor"/>
    <circle cx="65" cy="40" r="2" fill="currentColor"/>
    <path d="M 40 65 L 50 60 L 60 65" stroke="white" stroke-width="3" fill="none"/>
  `,
  [Mood.Thinking]: `
    <circle cx="50" cy="50" r="40" fill="currentColor"/>
    <circle cx="30" cy="40" r="6" fill="white"/>
    <circle cx="70" cy="40" r="6" fill="white"/>
    <text x="70" y="25" font-size="15" fill="white">💭</text>
    <path d="M 35 65 Q 50 55 65 65" stroke="white" stroke-width="3" fill="none"/>
  `,
  [Mood.Uncertain]: `
    <circle cx="50" cy="50" r="40" fill="currentColor"/>
    <text x="30" y="50" font-size="20" fill="white">🤨</text>
    <path d="M 35 70 Q 50 60 65 70" stroke="white" stroke-width="3" fill="none"/>
  `,
  [Mood.Celebrating]: `
    <circle cx="50" cy="50" r="40" fill="currentColor"/>
    <text x="15" y="30" font-size="12" fill="white">✨</text>
    <text x="75" y="30" font-size="12" fill="white">✨</text>
    <circle cx="35" cy="45" r="5" fill="white"/>
    <circle cx="65" cy="45" r="5" fill="white"/>
    <path d="M 30 60 Q 50 75 70 60" stroke="white" stroke-width="4" fill="none"/>
  `,
  [Mood.Warning]: `
    <polygon points="50,15 85,85 15,85" fill="currentColor"/>
    <text x="42" y="70" font-size="25" fill="white">!</text>
  `,
  [Mood.Error]: `
    <circle cx="50" cy="50" r="40" fill="currentColor"/>
    <path d="M 30 30 L 70 70 M 70 30 L 30 70" stroke="white" stroke-width="6" stroke-linecap="round"/>
  `,
  [Mood.Listening]: `
    <circle cx="50" cy="50" r="40" fill="currentColor"/>
    <text x="40" y="60" font-size="25" fill="white">👂</text>
    <path d="M 20 50 Q 10 50 15 40" stroke="white" stroke-width="2" fill="none" opacity="0.5"/>
    <path d="M 20 50 Q 10 50 15 60" stroke="white" stroke-width="2" fill="none" opacity="0.5"/>
  `,
  [Mood.Speaking]: `
    <circle cx="50" cy="50" r="40" fill="currentColor"/>
    <ellipse cx="50" cy="45" rx="15" ry="10" fill="white"/>
    <circle cx="30" cy="35" r="4" fill="white" opacity="0.6"/>
    <circle cx="70" cy="35" r="4" fill="white" opacity="0.6"/>
  `,
  [Mood.Sleeping]: `
    <circle cx="50" cy="50" r="40" fill="currentColor" opacity="0.7"/>
    <text x="30" y="45" font-size="15" fill="white">💤</text>
    <path d="M 35 55 Q 40 55 40 60 Q 40 65 35 65" stroke="white" stroke-width="2" fill="none"/>
    <path d="M 60 55 Q 65 55 65 60 Q 65 65 60 65" stroke="white" stroke-width="2" fill="none"/>
  `,
  [Mood.Confused]: `
    <circle cx="50" cy="50" r="40" fill="currentColor"/>
    <text x="25" y="40" font-size="12" fill="white" transform="rotate(-20 25 40)">?</text>
    <text x="65" y="40" font-size="12" fill="white" transform="rotate(20 65 40)">?</text>
    <path d="M 40 65 Q 50 60 60 65" stroke="white" stroke-width="3" fill="none"/>
  `,
};

const sizePixels: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

/**
 * Create Clawd avatar adapter
 */
export function createClawdAdapter(): AvatarAdapter {
  return {
    name: 'clawd',
    displayName: 'Clawd (Official)',
    description: 'Official A2R mascot avatar with full mood support',
    
    render: (state: VisualState, size: AvatarSize) => {
      const color = getMoodColor(state.mood);
      const sizePx = sizePixels[size];
      const intensity = state.intensity / 10;
      
      // Calculate animations based on intensity
      const pulseDuration = 2 - intensity;
      const scale = 0.9 + (intensity * 0.1);
      
      const svgContent = clawdPaths[state.mood] || clawdPaths[Mood.Idle];
      
      return React.createElement('div', {
        style: {
          width: sizePx,
          height: sizePx,
          color,
          animation: `clawd-pulse ${pulseDuration}s ease-in-out infinite`,
          transform: `scale(${scale})`,
          transition: 'all 0.3s ease',
          opacity: 0.5 + (state.confidence * 0.5),
          filter: state.reliability < 0.5 ? 'grayscale(50%)' : 'none',
        },
        dangerouslySetInnerHTML: {
          __html: `
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              ${svgContent}
            </svg>
            <style>
              @keyframes clawd-pulse {
                0%, 100% { transform: scale(${scale}); }
                50% { transform: scale(${scale * 1.05}); }
              }
            </style>
          `,
        },
      });
    },
    
    supportedMoods: Object.values(Mood),
    supportsIntensity: true,
    supportsConfidence: true,
    supportsReliability: true,
  };
}

/**
 * Default Clawd adapter instance
 */
export const clawdAdapter = createClawdAdapter();
