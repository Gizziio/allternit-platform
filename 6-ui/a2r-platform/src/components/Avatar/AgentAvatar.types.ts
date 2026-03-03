/**
 * Agent Avatar Component Types
 * 
 * Type definitions for the modular SVG avatar system
 */

import type { 
  AvatarConfig, 
  AvatarEmotion, 
  AvatarBodyShape,
  EyePreset,
  AntennaStyle
} from '../../lib/agents/character.types';

// ============================================================================
// Component Props
// ============================================================================

export interface AgentAvatarProps {
  /** Avatar configuration - defines appearance */
  config: AvatarConfig;
  
  /** Current emotional state - affects animation */
  emotion?: AvatarEmotion;
  
  /** Size in pixels */
  size?: number;
  
  /** Whether animations are enabled */
  isAnimating?: boolean;
  
  /** Current interaction state for reactive animations */
  interactionState?: 'idle' | 'hover' | 'active';
  
  /** Optional className for styling */
  className?: string;
  
  /** Callback when avatar is clicked */
  onClick?: () => void;
  
  /** Callback when emotion changes */
  onEmotionChange?: (emotion: AvatarEmotion) => void;
  
  /** Whether to show the glow effect */
  showGlow?: boolean;
  
  /** Optional target for eye tracking (mouse position) */
  lookAt?: { x: number; y: number } | null;
}

export interface BodyPartProps {
  shape: AvatarBodyShape;
  colors: AvatarConfig['colors'];
  size: number;
  emotion?: AvatarEmotion;
  isAnimating?: boolean;
}

export interface EyesPartProps {
  config: AvatarConfig['eyes'];
  size: number;
  emotion?: AvatarEmotion;
  isAnimating?: boolean;
  lookAt?: { x: number; y: number } | null;
}

export interface AntennasPartProps {
  config: AvatarConfig['antennas'];
  colors: AvatarConfig['colors'];
  size: number;
  emotion?: AvatarEmotion;
  isAnimating?: boolean;
}

export interface GlowPartProps {
  color: string;
  size: number;
  intensity?: number;
  pulse?: boolean;
}

export interface AccessoryPartProps {
  accessoryId: string;
  size: number;
  colors: AvatarConfig['colors'];
}

// ============================================================================
// Animation Types
// ============================================================================

export interface AnimationFrame {
  transform?: string;
  opacity?: number;
  scale?: number;
}

export interface EmotionAnimation {
  name: string;
  duration: number;
  easing: string;
  keyframes: AnimationFrame[];
}

export interface IdleAnimationConfig {
  type: 'precision' | 'exploratory' | 'systemic' | 'balanced';
  duration: number;
  easing: string;
}

export interface ReactiveAnimationConfig {
  hover: { scale: number; duration: number };
  active: { scale: number; duration: number };
}

// ============================================================================
// Preset Types
// ============================================================================

export interface BodyShapeDefinition {
  id: AvatarBodyShape;
  name: string;
  description: string;
  path: string; // SVG path data
  viewBox: string;
  center: { x: number; y: number };
  eyePosition: { x: number; y: number };
  antennaPosition: { x: number; y: number };
}

export interface EyePresetDefinition {
  id: EyePreset;
  name: string;
  description: string;
  // Left and right eye paths (can be mirrored)
  leftPath: string;
  rightPath?: string; // If different from left
  // Pupil position offsets
  pupilOffset: { x: number; y: number };
  // Blink animation path (closed state)
  blinkPath?: string;
}

export interface AntennaStyleDefinition {
  id: AntennaStyle;
  name: string;
  description: string;
  // Base path for single antenna
  path: string;
  // Animation transforms for each animation type
  animations: Record<string, string>;
}

export interface ColorPalette {
  name: string;
  colors: {
    primary: string[];
    secondary: string[];
    glow: string[];
    outline: string[];
  };
}

// ============================================================================
// Render Context
// ============================================================================

export interface AvatarRenderContext {
  config: AvatarConfig;
  size: number;
  emotion: AvatarEmotion;
  isAnimating: boolean;
  interactionState: 'idle' | 'hover' | 'active';
}

// ============================================================================
// Event Types
// ============================================================================

export interface AvatarEventMap {
  'emotion:change': { from: AvatarEmotion; to: AvatarEmotion };
  'animation:start': { type: string };
  'animation:end': { type: string };
  'interaction:hover': void;
  'interaction:leave': void;
  'interaction:click': void;
}

export type AvatarEventType = keyof AvatarEventMap;

// ============================================================================
// Size Presets
// ============================================================================

export const AVATAR_SIZE_PRESETS = {
  xs: { size: 24, strokeWidth: 1, eyeScale: 0.6, name: 'Extra Small' },
  sm: { size: 32, strokeWidth: 1.5, eyeScale: 0.7, name: 'Small' },
  md: { size: 44, strokeWidth: 2, eyeScale: 0.8, name: 'Medium' },
  lg: { size: 64, strokeWidth: 2.5, eyeScale: 0.9, name: 'Large' },
  xl: { size: 80, strokeWidth: 3, eyeScale: 1.0, name: 'Extra Large' },
  '2xl': { size: 120, strokeWidth: 4, eyeScale: 1.2, name: '2X Large' },
  '3xl': { size: 200, strokeWidth: 6, eyeScale: 1.5, name: '3X Large' },
} as const;

export type AvatarSizePreset = keyof typeof AVATAR_SIZE_PRESETS;

export function getAvatarSizePreset(preset: AvatarSizePreset) {
  return AVATAR_SIZE_PRESETS[preset];
}

export function calculateAvatarDimensions(size: number) {
  return {
    viewBox: '0 0 100 100',
    centerX: 50,
    centerY: 50,
    scale: size / 100,
    strokeWidth: Math.max(1, size / 40),
    eyeScale: Math.min(1.5, 0.6 + (size / 200))
  };
}
