/**
 * Color Palette Presets
 * 
 * Curated color schemes for each agent setup type.
 * Ensures visual consistency and accessibility.
 */

import type { AgentSetup, AvatarColorScheme } from '../../../lib/agents/character.types';

// ============================================================================
// Setup-Based Color Palettes
// ============================================================================

export interface ColorPaletteSet {
  name: string;
  description: string;
  primary: string[];
  secondary: string[];
  glow: string[];
  outline: string[];
}

export const SETUP_COLOR_PALETTES: Record<AgentSetup, ColorPaletteSet> = {
  coding: {
    name: 'Tech Blue',
    description: 'Cool blues and cyans for a technical feel',
    primary: [
      '#1E293B', // Slate 800
      '#0F172A', // Slate 900
      '#1e3a5f', // Deep blue
      '#0c4a6e', // Sky 900
      '#164e63', // Cyan 900
      '#172554', // Blue 950
      '#1e1b4b', // Indigo 950
      '#312e81', // Indigo 800
    ],
    secondary: [
      '#22D3EE', // Cyan 400
      '#06B6D4', // Cyan 500
      '#0891B2', // Cyan 600
      '#0EA5E9', // Sky 500
      '#38BDF8', // Sky 400
      '#60A5FA', // Blue 400
      '#818CF8', // Indigo 400
      '#A5B4FC', // Indigo 300
    ],
    glow: [
      '#06B6D4', // Cyan 500
      '#22D3EE', // Cyan 400
      '#67E8F9', // Cyan 300
      '#A5F3FC', // Cyan 200
      '#CFFAFE', // Cyan 100
      '#7DD3FC', // Sky 300
      '#BAE6FD', // Sky 200
    ],
    outline: [
      '#0E7490', // Cyan 700
      '#155E75', // Cyan 800
      '#164E63', // Cyan 900
      '#0C4A6E', // Sky 900
      '#075985', // Sky 800
      '#1E3A8A', // Blue 900
      '#1E40AF', // Blue 800
    ],
  },
  
  creative: {
    name: 'Artistic Purple',
    description: 'Warm purples, pinks, and gradients for creativity',
    primary: [
      '#8B5CF6', // Violet 500
      '#7C3AED', // Violet 600
      '#6D28D9', // Violet 700
      '#EC4899', // Pink 500
      '#DB2777', // Pink 600
      '#BE185D', // Pink 700
      '#9333EA', // Purple 600
      '#7E22CE', // Purple 700
    ],
    secondary: [
      '#F472B6', // Pink 400
      '#F9A8D4', // Pink 300
      '#E879F9', // Fuchsia 400
      '#F0ABFC', // Fuchsia 300
      '#F5D0FE', // Fuchsia 200
      '#D8B4FE', // Purple 300
      '#C4B5FD', // Violet 300
      '#A78BFA', // Violet 400
    ],
    glow: [
      '#E879F9', // Fuchsia 400
      '#F0ABFC', // Fuchsia 300
      '#F5D0FE', // Fuchsia 200
      '#FAE8FF', // Fuchsia 100
      '#FDF4FF', // Fuchsia 50
      '#F9A8D4', // Pink 300
      '#FBCFE8', // Pink 200
    ],
    outline: [
      '#7C3AED', // Violet 600
      '#6B21A8', // Purple 800
      '#86198F', // Fuchsia 800
      '#9F1239', // Rose 800
      '#BE185D', // Pink 700
      '#A21CAF', // Fuchsia 700
    ],
  },
  
  research: {
    name: 'Scholar Amber',
    description: 'Ambers, golds, and deep blues for scholarly pursuits',
    primary: [
      '#F59E0B', // Amber 500
      '#D97706', // Amber 600
      '#B45309', // Amber 700
      '#1E40AF', // Blue 800
      '#1E3A8A', // Blue 900
      '#92400E', // Amber 800
      '#78350F', // Amber 900
      '#3730A3', // Indigo 800
    ],
    secondary: [
      '#FCD34D', // Amber 300
      '#FDE68A', // Amber 200
      '#FEF3C7', // Amber 100
      '#60A5FA', // Blue 400
      '#93C5FD', // Blue 300
      '#BFDBFE', // Blue 200
      '#FDBA74', // Orange 300
      '#FED7AA', // Orange 200
    ],
    glow: [
      '#EAB308', // Yellow 500
      '#FDE047', // Yellow 300
      '#FEF08A', // Yellow 200
      '#FEF9C3', // Yellow 100
      '#FACC15', // Yellow 400
      '#FCD34D', // Amber 300
      '#FDE68A', // Amber 200
    ],
    outline: [
      '#B45309', // Amber 700
      '#92400E', // Amber 800
      '#78350F', // Amber 900
      '#1E3A8A', // Blue 900
      '#172554', // Blue 950
      '#9A3412', // Orange 800
    ],
  },
  
  operations: {
    name: 'Action Red',
    description: 'Bold reds, oranges, and safety yellows',
    primary: [
      '#DC2626', // Red 600
      '#B91C1C', // Red 700
      '#991B1B', // Red 800
      '#F97316', // Orange 500
      '#EA580C', // Orange 600
      '#C2410C', // Orange 700
      '#EF4444', // Red 500
      '#9F1239', // Rose 800
    ],
    secondary: [
      '#FBBF24', // Amber 400
      '#FCD34D', // Amber 300
      '#FDE68A', // Amber 200
      '#FB923C', // Orange 400
      '#FDBA74', // Orange 300
      '#FED7AA', // Orange 200
      '#FCA5A5', // Red 300
      '#FECACA', // Red 200
    ],
    glow: [
      '#EF4444', // Red 500
      '#F87171', // Red 400
      '#FCA5A5', // Red 300
      '#FECACA', // Red 200
      '#FEF2F2', // Red 50
      '#FDBA74', // Orange 300
      '#FED7AA', // Orange 200
    ],
    outline: [
      '#991B1B', // Red 800
      '#7F1D1D', // Red 900
      '#9A3412', // Orange 800
      '#7C2D12', // Orange 900
      '#881337', // Rose 900
      '#BE123C', // Rose 700
    ],
  },
  
  generalist: {
    name: 'Balanced Teal',
    description: 'Balanced teals, greens, and neutrals',
    primary: [
      '#14B8A6', // Teal 500
      '#0D9488', // Teal 600
      '#0F766E', // Teal 700
      '#22C55E', // Green 500
      '#16A34A', // Green 600
      '#15803D', // Green 700
      '#06B6D4', // Cyan 500
      '#0891B2', // Cyan 600
    ],
    secondary: [
      '#34D399', // Emerald 400
      '#6EE7B7', // Emerald 300
      '#A7F3D0', // Emerald 200
      '#4ADE80', // Green 400
      '#86EFAC', // Green 300
      '#BBF7D0', // Green 200
      '#22D3EE', // Cyan 400
      '#67E8F9', // Cyan 300
    ],
    glow: [
      '#2DD4BF', // Teal 400
      '#5EEAD4', // Teal 300
      '#99F6E4', // Teal 200
      '#CCFBF1', // Teal 100
      '#F0FDFA', // Teal 50
      '#6EE7B7', // Emerald 300
      '#A7F3D0', // Emerald 200
    ],
    outline: [
      '#0F766E', // Teal 700
      '#115E59', // Teal 800
      '#134E4A', // Teal 900
      '#14532D', // Green 900
      '#166534', // Green 800
      '#155E75', // Cyan 800
    ],
  },
};

// ============================================================================
// Universal Accent Colors
// ============================================================================

export const UNIVERSAL_ACCENTS = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  white: '#FFFFFF',
  black: '#000000',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color palette for a setup
 */
export function getColorPalette(setup: AgentSetup): ColorPaletteSet {
  return SETUP_COLOR_PALETTES[setup];
}

/**
 * Get a random color from a palette category
 */
export function getRandomColor(
  setup: AgentSetup,
  category: keyof ColorPaletteSet = 'primary'
): string {
  const palette = SETUP_COLOR_PALETTES[setup];
  const colors = palette[category] as string[];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Generate a random color scheme for a setup
 */
export function generateRandomColorScheme(setup: AgentSetup): AvatarColorScheme {
  return {
    primary: getRandomColor(setup, 'primary'),
    secondary: getRandomColor(setup, 'secondary'),
    glow: getRandomColor(setup, 'glow'),
    outline: getRandomColor(setup, 'outline'),
  };
}

/**
 * Get a color that contrasts well with a background
 */
export function getContrastColor(backgroundColor: string): string {
  // Simple luminance check
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Adjust color brightness
 */
export function adjustBrightness(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert hex to rgba
 */
export function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// Preset Color Schemes
// ============================================================================

export const PRESET_COLOR_SCHEMES: Record<string, AvatarColorScheme> = {
  // Coding presets
  'coding-dark': {
    primary: '#1E293B',
    secondary: '#22D3EE',
    glow: '#06B6D4',
    outline: '#0E7490',
  },
  'coding-midnight': {
    primary: '#0F172A',
    secondary: '#60A5FA',
    glow: '#3B82F6',
    outline: '#1E40AF',
  },
  
  // Creative presets
  'creative-purple': {
    primary: '#8B5CF6',
    secondary: '#EC4899',
    glow: '#E879F9',
    outline: '#7C3AED',
  },
  'creative-sunset': {
    primary: '#DB2777',
    secondary: '#F59E0B',
    glow: '#FCD34D',
    outline: '#BE185D',
  },
  
  // Research presets
  'research-amber': {
    primary: '#F59E0B',
    secondary: '#1E40AF',
    glow: '#EAB308',
    outline: '#B45309',
  },
  'research-scholar': {
    primary: '#92400E',
    secondary: '#60A5FA',
    glow: '#FDE68A',
    outline: '#78350F',
  },
  
  // Operations presets
  'operations-alert': {
    primary: '#DC2626',
    secondary: '#F59E0B',
    glow: '#EF4444',
    outline: '#991B1B',
  },
  'operations-safety': {
    primary: '#F97316',
    secondary: '#FACC15',
    glow: '#FDBA74',
    outline: '#C2410C',
  },
  
  // Generalist presets
  'generalist-teal': {
    primary: '#14B8A6',
    secondary: '#34D399',
    glow: '#2DD4BF',
    outline: '#0F766E',
  },
  'generalist-nature': {
    primary: '#22C55E',
    secondary: '#86EFAC',
    glow: '#4ADE80',
    outline: '#15803D',
  },
};

/**
 * Get a preset color scheme
 */
export function getPresetColorScheme(presetId: string): AvatarColorScheme | undefined {
  return PRESET_COLOR_SCHEMES[presetId];
}

/**
 * Get all preset IDs for a setup
 */
export function getPresetsForSetup(setup: AgentSetup): string[] {
  const prefix = `${setup}-`;
  return Object.keys(PRESET_COLOR_SCHEMES).filter(id => id.startsWith(prefix));
}
