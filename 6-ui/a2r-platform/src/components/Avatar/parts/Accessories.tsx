/**
 * Accessories Component
 * 
 * Renders unlockable accessories for the avatar.
 * Supports glasses, hats, neck items, and other decorations.
 * 
 * Note: This is a placeholder for future accessory system.
 * Currently returns null as accessories are not yet implemented.
 */

import React from 'react';
import type { AvatarConfig } from '../../../lib/agents/character.types';

interface AccessoriesProps {
  accessories: string[];
  layer: 'back' | 'front';
  colors: AvatarConfig['colors'];
  size: number;
}

// Accessory definitions (placeholder for future implementation)
const ACCESSORY_DEFINITIONS: Record<string, {
  name: string;
  layer: 'back' | 'front';
  render: (colors: AvatarConfig['colors'], size: number) => React.ReactNode;
}> = {
  // Glasses
  'glasses-round': {
    name: 'Round Glasses',
    layer: 'front',
    render: (colors, size) => (
      <g transform={`scale(${size / 100})`}>
        <circle cx="38" cy="42" r="8" fill="none" stroke={colors.outline} strokeWidth="2" opacity="0.8" />
        <circle cx="62" cy="42" r="8" fill="none" stroke={colors.outline} strokeWidth="2" opacity="0.8" />
        <line x1="46" y1="42" x2="54" y2="42" stroke={colors.outline} strokeWidth="2" opacity="0.8" />
      </g>
    ),
  },
  'glasses-square': {
    name: 'Square Glasses',
    layer: 'front',
    render: (colors, size) => (
      <g transform={`scale(${size / 100})`}>
        <rect x="30" y="36" width="16" height="12" rx="2" fill="none" stroke={colors.outline} strokeWidth="2" opacity="0.8" />
        <rect x="54" y="36" width="16" height="12" rx="2" fill="none" stroke={colors.outline} strokeWidth="2" opacity="0.8" />
        <line x1="46" y1="42" x2="54" y2="42" stroke={colors.outline} strokeWidth="2" opacity="0.8" />
      </g>
    ),
  },
  // Hats
  'hat-cap': {
    name: 'Cap',
    layer: 'back',
    render: (colors, size) => (
      <g transform={`scale(${size / 100})`}>
        <path d="M 25 25 L 75 25 L 70 15 L 30 15 Z" fill={colors.secondary} />
        <rect x="20" y="25" width="60" height="5" rx="2" fill={colors.primary} />
      </g>
    ),
  },
  'hat-wizard': {
    name: 'Wizard Hat',
    layer: 'back',
    render: (colors, size) => (
      <g transform={`scale(${size / 100})`}>
        <path d="M 50 5 L 75 30 L 25 30 Z" fill={colors.secondary} />
        <ellipse cx="50" cy="30" rx="25" ry="5" fill={colors.primary} />
      </g>
    ),
  },
  // Neck items
  'bow-tie': {
    name: 'Bow Tie',
    layer: 'front',
    render: (colors, size) => (
      <g transform={`scale(${size / 100})`}>
        <path d="M 45 60 L 35 55 L 35 65 Z" fill={colors.secondary} />
        <path d="M 55 60 L 65 55 L 65 65 Z" fill={colors.secondary} />
        <circle cx="50" cy="60" r="3" fill={colors.primary} />
      </g>
    ),
  },
  // Other
  'headset': {
    name: 'Headset',
    layer: 'front',
    render: (colors, size) => (
      <g transform={`scale(${size / 100})`}>
        <path d="M 20 40 Q 15 25 50 20 Q 85 25 80 40" fill="none" stroke={colors.outline} strokeWidth="3" />
        <rect x="15" y="35" width="10" height="15" rx="3" fill={colors.secondary} />
        <rect x="75" y="35" width="10" height="15" rx="3" fill={colors.secondary} />
      </g>
    ),
  },
};

export const Accessories: React.FC<AccessoriesProps> = ({
  accessories,
  layer,
  colors,
  size,
}) => {
  // Filter accessories for this layer
  const layerAccessories = accessories.filter(id => {
    const def = ACCESSORY_DEFINITIONS[id];
    return def && def.layer === layer;
  });
  
  if (layerAccessories.length === 0) {
    return null;
  }
  
  return (
    <g className="avatar-accessories" data-layer={layer}>
      {layerAccessories.map(id => {
        const def = ACCESSORY_DEFINITIONS[id];
        if (!def) return null;
        
        return (
          <g key={id} className={`avatar-accessory avatar-accessory--${id}`}>
            {def.render(colors, size)}
          </g>
        );
      })}
    </g>
  );
};

// Export available accessories
export const AVAILABLE_ACCESSORIES = Object.entries(ACCESSORY_DEFINITIONS).map(
  ([id, def]) => ({
    id,
    name: def.name,
    layer: def.layer,
  })
);

// Export accessory by category
export const ACCESSORIES_BY_CATEGORY = {
  glasses: ['glasses-round', 'glasses-square'],
  hats: ['hat-cap', 'hat-wizard'],
  neck: ['bow-tie'],
  other: ['headset'],
};

Accessories.displayName = 'Accessories';
