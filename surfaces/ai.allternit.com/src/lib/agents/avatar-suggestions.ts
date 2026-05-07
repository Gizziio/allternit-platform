/**
 * Avatar Suggestions
 * 
 * Smart defaults and suggestions for avatar configuration based on:
 * - Agent setup type (coding, creative, research, operations, generalist)
 * - Temperament (precision, exploratory, systemic, balanced)
 * - Agent name/vibe
 * - Selected capabilities
 */

import type { 
  AgentSetup, 
  AvatarConfig, 
  AvatarBodyShape, 
  EyePreset, 
  AntennaStyle,
  AntennaAnimation,
  AvatarEmotion 
} from './character.types';
import { createDefaultAvatarConfig } from './character.types';
import { SETUP_COLOR_PALETTES } from '../../components/Avatar/presets/colorPalettes';

// ============================================================================
// Setup-to-Visual Mappings
// ============================================================================

interface VisualSuggestion {
  bodyShape: AvatarBodyShape;
  eyePreset: EyePreset;
  antennaStyle: AntennaStyle;
  antennaAnimation: AntennaAnimation;
  colors: {
    primary: string;
    secondary: string;
    glow: string;
  };
  personality: {
    bounce: number;
    sway: number;
    breathing: boolean;
  };
}

const SETUP_VISUAL_SUGGESTIONS: Record<AgentSetup, VisualSuggestion> = {
  coding: {
    bodyShape: 'hex',
    eyePreset: 'narrow',
    antennaStyle: 'straight',
    antennaAnimation: 'pulse',
    colors: {
      primary: '#1E293B',
      secondary: '#22D3EE',
      glow: '#06B6D4',
    },
    personality: {
      bounce: 0.1,
      sway: 0.05,
      breathing: true,
    },
  },
  creative: {
    bodyShape: 'cloud',
    eyePreset: 'wide',
    antennaStyle: 'leaf',
    antennaAnimation: 'sway',
    colors: {
      primary: '#8B5CF6',
      secondary: '#EC4899',
      glow: '#E879F9',
    },
    personality: {
      bounce: 0.4,
      sway: 0.3,
      breathing: true,
    },
  },
  research: {
    bodyShape: 'diamond',
    eyePreset: 'curious',
    antennaStyle: 'coiled',
    antennaAnimation: 'bounce',
    colors: {
      primary: '#F59E0B',
      secondary: '#1E40AF',
      glow: '#EAB308',
    },
    personality: {
      bounce: 0.15,
      sway: 0.1,
      breathing: true,
    },
  },
  operations: {
    bodyShape: 'square',
    eyePreset: 'focused',
    antennaStyle: 'zigzag',
    antennaAnimation: 'wiggle',
    colors: {
      primary: '#DC2626',
      secondary: '#F59E0B',
      glow: '#EF4444',
    },
    personality: {
      bounce: 0.05,
      sway: 0.02,
      breathing: false,
    },
  },
  generalist: {
    bodyShape: 'round',
    eyePreset: 'round',
    antennaStyle: 'curved',
    antennaAnimation: 'sway',
    colors: {
      primary: '#14B8A6',
      secondary: '#34D399',
      glow: '#2DD4BF',
    },
    personality: {
      bounce: 0.3,
      sway: 0.15,
      breathing: true,
    },
  },
};

// ============================================================================
// Temperament Adjustments
// ============================================================================

interface TemperamentAdjustment {
  bounceModifier: number;
  swayModifier: number;
  blinkRate: 'slow' | 'normal' | 'fast' | 'never';
  eyePresetOverride?: EyePreset;
}

const TEMPERAMENT_ADJUSTMENTS: Record<string, TemperamentAdjustment> = {
  precision: {
    bounceModifier: 0.3,
    swayModifier: 0.3,
    blinkRate: 'slow',
    eyePresetOverride: 'focused',
  },
  exploratory: {
    bounceModifier: 1.3,
    swayModifier: 1.5,
    blinkRate: 'normal',
    eyePresetOverride: 'curious',
  },
  systemic: {
    bounceModifier: 0.8,
    swayModifier: 0.6,
    blinkRate: 'normal',
  },
  balanced: {
    bounceModifier: 1,
    swayModifier: 1,
    blinkRate: 'normal',
  },
};

// ============================================================================
// Name-based Suggestions
// ============================================================================

const NAME_KEYWORDS: Record<string, Partial<VisualSuggestion>> = {
  // Tech/Code related
  'code': { eyePreset: 'pixel', antennaStyle: 'straight' },
  'dev': { eyePreset: 'narrow', antennaStyle: 'straight' },
  'hack': { eyePreset: 'narrow', antennaStyle: 'bolt' },
  'bot': { eyePreset: 'pixel', antennaAnimation: 'static' },
  'ai': { eyePreset: 'starry', antennaStyle: 'coiled' },
  
  // Creative
  'art': { eyePreset: 'starry', antennaStyle: 'leaf' },
  'design': { eyePreset: 'wide', antennaStyle: 'curved' },
  'creative': { eyePreset: 'mischief', antennaStyle: 'leaf' },
  'muse': { eyePreset: 'starry', antennaAnimation: 'sway' },
  
  // Research
  'research': { eyePreset: 'curious', antennaStyle: 'coiled' },
  'analyst': { eyePreset: 'focused', antennaStyle: 'straight' },
  'scholar': { eyePreset: 'curious', antennaAnimation: 'bounce' },
  'scout': { eyePreset: 'wide', antennaStyle: 'curved' },
  
  // Operations
  'guard': { eyePreset: 'focused', antennaStyle: 'zigzag' },
  'ops': { eyePreset: 'narrow', antennaAnimation: 'wiggle' },
  'command': { eyePreset: 'proud', antennaStyle: 'bolt' },
  'secure': { eyePreset: 'narrow', antennaStyle: 'straight' },
  
  // General/Helper
  'help': { eyePreset: 'round', antennaStyle: 'curved' },
  'assist': { eyePreset: 'pleased', antennaAnimation: 'sway' },
  'buddy': { eyePreset: 'pleased', antennaStyle: 'curved' },
  'pal': { eyePreset: 'mischief', antennaAnimation: 'bounce' },
};

// ============================================================================
// Suggestion Functions
// ============================================================================

/**
 * Generate avatar config suggestions based on agent setup
 */
export function suggestAvatarForSetup(
  setup: AgentSetup,
  temperament?: string
): Partial<AvatarConfig> {
  const base = SETUP_VISUAL_SUGGESTIONS[setup];
  const palette = SETUP_COLOR_PALETTES[setup];
  
  let config: Partial<AvatarConfig> = {
    baseShape: base.bodyShape,
    eyes: {
      preset: base.eyePreset,
      size: 1,
      color: base.colors.secondary,
      pupilStyle: 'dot',
      blinkRate: 'normal',
    },
    antennas: {
      count: 2,
      style: base.antennaStyle,
      animation: base.antennaAnimation,
      tipDecoration: 'none',
    },
    colors: {
      primary: base.colors.primary,
      secondary: base.colors.secondary,
      glow: base.colors.glow,
      outline: palette.outline[0],
    },
    personality: base.personality,
    accessories: [],
  };
  
  // Apply temperament adjustments
  if (temperament && TEMPERAMENT_ADJUSTMENTS[temperament]) {
    const adj = TEMPERAMENT_ADJUSTMENTS[temperament];
    
    if (config.personality) {
      config.personality.bounce = (config.personality.bounce ?? 0.3) * adj.bounceModifier;
      config.personality.sway = (config.personality.sway ?? 0.15) * adj.swayModifier;
    }
    
    if (config.eyes) {
      config.eyes.blinkRate = adj.blinkRate;
      if (adj.eyePresetOverride) {
        config.eyes.preset = adj.eyePresetOverride;
      }
    }
  }
  
  return config;
}

/**
 * Analyze agent name and suggest visual elements
 */
export function suggestFromName(name: string): Partial<VisualSuggestion> {
  const lowerName = name.toLowerCase();
  const suggestions: Partial<VisualSuggestion>[] = [];
  
  for (const [keyword, suggestion] of Object.entries(NAME_KEYWORDS)) {
    if (lowerName.includes(keyword)) {
      suggestions.push(suggestion);
    }
  }
  
  // Merge all matching suggestions
  return suggestions.reduce((acc, curr) => ({ ...acc, ...curr }), {});
}

/**
 * Generate complete avatar config based on all context
 */
export function generateSmartAvatar(
  setup: AgentSetup,
  options: {
    name?: string;
    temperament?: string;
    capabilities?: string[];
  } = {}
): AvatarConfig {
  const base = createDefaultAvatarConfig(setup);
  const setupSuggestion = suggestAvatarForSetup(setup, options.temperament);
  const nameSuggestion = options.name ? suggestFromName(options.name) : {};
  
  // Merge suggestions into base config
  const merged: AvatarConfig = {
    ...base,
    baseShape: nameSuggestion.bodyShape || setupSuggestion.baseShape || base.baseShape,
    eyes: {
      ...base.eyes,
      preset: nameSuggestion.eyePreset || setupSuggestion.eyes?.preset || base.eyes?.preset || 'round',
      color: setupSuggestion.eyes?.color || base.eyes?.color || '#ECECEC',
      blinkRate: setupSuggestion.eyes?.blinkRate || base.eyes?.blinkRate || 'normal',
      size: base.eyes?.size ?? 1,
      pupilStyle: base.eyes?.pupilStyle ?? 'dot',
    },
    antennas: {
      ...base.antennas,
      style: nameSuggestion.antennaStyle || setupSuggestion.antennas?.style || base.antennas?.style || 'straight',
      animation: nameSuggestion.antennaAnimation || setupSuggestion.antennas?.animation || base.antennas?.animation || 'sway',
      count: base.antennas?.count ?? 2,
      tipDecoration: base.antennas?.tipDecoration ?? 'none',
    },
    colors: {
      ...base.colors,
      primary: setupSuggestion.colors?.primary || base.colors?.primary || '#6366f1',
      secondary: setupSuggestion.colors?.secondary || base.colors?.secondary || '#8b5cf6',
      glow: setupSuggestion.colors?.glow || base.colors?.glow || '#6366f1',
      outline: base.colors?.outline || '#1e1b4b',
    },
    personality: {
      ...base.personality,
      bounce: setupSuggestion.personality?.bounce ?? base.personality?.bounce ?? 0.3,
      sway: setupSuggestion.personality?.sway ?? base.personality?.sway ?? 0.15,
      breathing: setupSuggestion.personality?.breathing ?? base.personality?.breathing ?? true,
    },
  };
  
  return merged;
}

// ============================================================================
// Emotion Suggestions
// ============================================================================

/**
 * Suggest emotion based on agent state or context
 */
export function suggestEmotion(context: {
  isProcessing?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  isListening?: boolean;
  isTyping?: boolean;
}): AvatarEmotion {
  if (context.isError) return 'skeptical';
  if (context.isSuccess) return 'pleased';
  if (context.isProcessing) return 'focused';
  if (context.isListening) return 'curious';
  if (context.isTyping) return 'focused';
  return 'steady';
}

// ============================================================================
// Color Suggestions
// ============================================================================

/**
 * Suggest a harmonious color scheme
 */
export function suggestColorScheme(
  setup: AgentSetup,
  mood: 'calm' | 'energetic' | 'professional' | 'playful' = 'professional'
): { primary: string; secondary: string; glow: string; outline: string } {
  const palette = SETUP_COLOR_PALETTES[setup];
  
  const schemes: Record<typeof mood, { primary: number; secondary: number; glow: number }> = {
    calm: { primary: 0, secondary: 3, glow: 4 },
    energetic: { primary: 2, secondary: 1, glow: 0 },
    professional: { primary: 1, secondary: 2, glow: 2 },
    playful: { primary: 2, secondary: 4, glow: 3 },
  };
  
  const scheme = schemes[mood];
  
  return {
    primary: palette.primary[scheme.primary % palette.primary.length],
    secondary: palette.secondary[scheme.secondary % palette.secondary.length],
    glow: palette.glow[scheme.glow % palette.glow.length],
    outline: palette.outline[0],
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if an avatar config matches its suggested setup
 */
export function validateAvatarMatchesSetup(
  config: AvatarConfig,
  setup: AgentSetup
): { matches: boolean; differences: string[] } {
  const suggestion = SETUP_VISUAL_SUGGESTIONS[setup];
  const differences: string[] = [];
  
  if (config.baseShape !== suggestion.bodyShape) {
    differences.push(`Body shape is ${config.baseShape}, suggested ${suggestion.bodyShape}`);
  }
  
  if (config.eyes?.preset !== suggestion.eyePreset) {
    differences.push(`Eye preset is ${config.eyes?.preset}, suggested ${suggestion.eyePreset}`);
  }
  
  if (config.antennas?.style !== suggestion.antennaStyle) {
    differences.push(`Antenna style is ${config.antennas?.style}, suggested ${suggestion.antennaStyle}`);
  }
  
  return {
    matches: differences.length === 0,
    differences,
  };
}

// ============================================================================
// Export Summary
// ============================================================================

export const AvatarSuggestionUtils = {
  suggestAvatarForSetup,
  suggestFromName,
  generateSmartAvatar,
  suggestEmotion,
  suggestColorScheme,
  validateAvatarMatchesSetup,
  SETUP_VISUAL_SUGGESTIONS,
  TEMPERAMENT_ADJUSTMENTS,
  NAME_KEYWORDS,
};
