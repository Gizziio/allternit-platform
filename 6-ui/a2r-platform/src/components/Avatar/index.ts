/**
 * Avatar Component Library
 * 
 * Modular SVG avatar system for AI agents.
 * 
 * @example
 * ```tsx
 * import { AgentAvatar, useAvatarCreatorStore } from '@/components/avatar';
 * 
 * // Display an avatar
 * <AgentAvatar 
 *   config={avatarConfig}
 *   emotion="pleased"
 *   size={80}
 * />
 * 
 * // Use the creator store
 * const { currentConfig, setEyePreset } = useAvatarCreatorStore();
 * ```
 */

// Main component
export { AgentAvatar, StaticAgentAvatar, AgentAvatarSizes } from './AgentAvatar';
export type { AgentAvatarProps } from './AgentAvatar.types';

// Chat component
export { AgentMessageAvatar } from './AgentMessageAvatar';

// Component types
export type {
  BodyPartProps,
  EyesPartProps,
  AntennasPartProps,
  GlowPartProps,
  AccessoryPartProps,
  AvatarSizePreset,
  EmotionAnimationResult,
  ReactiveAnimationResult,
  AvatarAnimationResult,
} from './AgentAvatar.types';

// Size utilities
export { 
  getAvatarSizePreset, 
  calculateAvatarDimensions,
  AVATAR_SIZE_PRESETS 
} from './AgentAvatar.types';

// Animation hooks
export { useEmotionAnimation, getEmotionAnimationClass } from './hooks/useEmotionAnimation';
export { 
  useReactiveAnimation, 
  useMouseTracking, 
  useClickAnimation 
} from './hooks/useReactiveAnimation';
export { 
  useAvatarAnimation, 
  useLocomotionAnimation, 
  useBlinkAnimation,
  useAnimationFrame 
} from './hooks/useAvatarAnimation';

// Avatar parts (for advanced customization)
export { Body, getBodyPositions, BODY_SHAPE_METADATA } from './parts/Body';
export { Eyes, EYE_PRESET_METADATA, PUPIL_STYLE_METADATA } from './parts/Eyes';
export { Antennas, ANTENNA_STYLE_METADATA, ANTENNA_ANIMATION_METADATA, TIP_DECORATION_METADATA } from './parts/Antennas';
export { Glow, GLOW_INTENSITY_PRESETS, calculateGlowColor } from './parts/Glow';
export { Accessories, AVAILABLE_ACCESSORIES, ACCESSORIES_BY_CATEGORY } from './parts/Accessories';

// Styles
import './AgentAvatar.styles.css';

// Re-export types from character types for convenience
export type {
  AvatarConfig,
  AvatarBodyShape,
  AvatarEmotion,
  EyePreset,
  PupilStyle,
  BlinkRate,
  AntennaStyle,
  AntennaAnimation,
  AvatarEyeConfig,
  AvatarAntennaConfig,
  AvatarColorScheme,
  AvatarPersonalityConfig,
} from '../../lib/agents/character.types';

export {
  DEFAULT_AVATAR_CONFIG,
  createDefaultAvatarConfig,
} from '../../lib/agents/character.types';
