/**
 * Avatar Configuration Validation
 * 
 * Zod schema for validating AvatarConfig objects
 * Ensures data integrity when creating or updating avatars
 */

import { z } from 'zod';
import type { AvatarConfig, AvatarBodyShape, EyePreset, PupilStyle, BlinkRate, AntennaStyle, AntennaAnimation, AvatarEmotion } from './character.types';

// Avatar body shape validation
const AvatarBodyShapeSchema = z.enum(['round', 'square', 'hex', 'diamond', 'cloud']) as z.ZodType<AvatarBodyShape>;

// Eye preset validation
const EyePresetSchema = z.enum([
  'round', 'wide', 'narrow', 'curious', 'pleased', 
  'skeptical', 'mischief', 'proud', 'dizzy', 'sleepy', 'starry', 'pixel'
]) as z.ZodType<EyePreset>;

// Pupil style validation
const PupilStyleSchema = z.enum(['dot', 'ring', 'slit', 'star', 'heart', 'plus']) as z.ZodType<PupilStyle>;

// Blink rate validation
const BlinkRateSchema = z.enum(['slow', 'normal', 'fast', 'never']) as z.ZodType<BlinkRate>;

// Antenna style validation
const AntennaStyleSchema = z.enum(['straight', 'curved', 'coiled', 'zigzag', 'leaf', 'bolt']) as z.ZodType<AntennaStyle>;

// Antenna animation validation
const AntennaAnimationSchema = z.enum(['static', 'wiggle', 'pulse', 'sway', 'bounce']) as z.ZodType<AntennaAnimation>;

// Avatar emotion validation
const AvatarEmotionSchema = z.enum([
  'alert', 'curious', 'focused', 'steady', 'pleased', 'skeptical', 'mischief', 'proud'
]) as z.ZodType<AvatarEmotion>;

// Hex color validation (supports #RGB, #RRGGBB, #RGBA, #RRGGBBAA)
const HexColorSchema = z.string().regex(
  /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/,
  'Invalid hex color format'
);

// Eye configuration schema
export const AvatarEyeConfigSchema = z.object({
  preset: EyePresetSchema,
  size: z.number().min(0.5).max(1.5),
  color: HexColorSchema,
  pupilStyle: PupilStyleSchema,
  blinkRate: BlinkRateSchema
});

// Antenna configuration schema
export const AvatarAntennaConfigSchema = z.object({
  count: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  style: AntennaStyleSchema,
  animation: AntennaAnimationSchema,
  tipDecoration: z.enum(['none', 'ball', 'glow', 'star', 'diamond']).optional()
});

// Color scheme schema
export const AvatarColorSchemeSchema = z.object({
  primary: HexColorSchema,
  secondary: HexColorSchema,
  glow: HexColorSchema,
  outline: HexColorSchema
});

// Personality configuration schema
export const AvatarPersonalityConfigSchema = z.object({
  bounce: z.number().min(0).max(1),
  sway: z.number().min(0).max(1),
  breathing: z.boolean()
});

// Full avatar configuration schema
export const AvatarConfigSchema = z.object({
  version: z.literal('1.0'),
  baseShape: AvatarBodyShapeSchema,
  eyes: AvatarEyeConfigSchema,
  antennas: AvatarAntennaConfigSchema,
  colors: AvatarColorSchemeSchema,
  personality: AvatarPersonalityConfigSchema,
  accessories: z.array(z.string()),
  currentEmotion: AvatarEmotionSchema.optional()
});

// Type inference
export type ValidatedAvatarConfig = z.infer<typeof AvatarConfigSchema>;

/**
 * Validate an avatar configuration object
 * @param config The avatar config to validate
 * @returns Validation result with success flag and errors if any
 */
export function validateAvatarConfig(config: unknown): { 
  success: boolean; 
  data?: AvatarConfig; 
  errors?: string[] 
} {
  const result = AvatarConfigSchema.safeParse(config);
  
  if (result.success) {
    return { success: true, data: result.data as AvatarConfig };
  } else {
    const errors = result.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    );
    return { success: false, errors };
  }
}

/**
 * Validate avatar config partially (for incremental updates)
 * @param config The partial avatar config to validate
 * @returns Validation result
 */
export function validatePartialAvatarConfig(config: unknown): {
  success: boolean;
  data?: Partial<AvatarConfig>;
  errors?: string[];
} {
  const result = AvatarConfigSchema.partial().safeParse(config);
  
  if (result.success) {
    return { success: true, data: result.data as Partial<AvatarConfig> };
  } else {
    const errors = result.error.errors.map(err =>
      `${err.path.join('.')}: ${err.message}`
    );
    return { success: false, errors };
  }
}

/**
 * Sanitize avatar config for storage
 * Removes any extra fields and ensures all required fields are present
 * @param config The avatar config to sanitize
 * @returns Sanitized config or null if invalid
 */
export function sanitizeAvatarConfig(config: unknown): AvatarConfig | null {
  const result = validateAvatarConfig(config);
  return result.success ? result.data! : null;
}

/**
 * Check if two avatar configs are equal
 * @param a First avatar config
 * @param b Second avatar config
 * @returns True if configs are equal
 */
export function areAvatarConfigsEqual(a: AvatarConfig, b: AvatarConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Create a deep clone of an avatar config
 * @param config The avatar config to clone
 * @returns Cloned config
 */
export function cloneAvatarConfig(config: AvatarConfig): AvatarConfig {
  return JSON.parse(JSON.stringify(config));
}

/**
 * Migration helper for legacy avatar configs
 * Converts old format to new format if needed
 * @param config The config to migrate
 * @returns Migrated config or null if unmigratable
 */
export function migrateAvatarConfig(config: unknown): AvatarConfig | null {
  // Check if it's already a valid new config
  const validation = validateAvatarConfig(config);
  if (validation.success) {
    return validation.data!;
  }

  // Try to migrate from legacy format
  const legacy = config as { type?: string; fallbackColor?: string; uri?: string } | undefined;
  
  if (legacy?.fallbackColor) {
    // Convert legacy color-only config to new format
    return {
      version: '1.0',
      baseShape: 'round',
      eyes: {
        preset: 'round',
        size: 1.0,
        color: '#ECECEC',
        pupilStyle: 'dot',
        blinkRate: 'normal'
      },
      antennas: {
        count: 2,
        style: 'curved',
        animation: 'sway',
        tipDecoration: 'none'
      },
      colors: {
        primary: legacy.fallbackColor,
        secondary: '#34D399',
        glow: '#2DD4BF',
        outline: '#0F766E'
      },
      personality: {
        bounce: 0.3,
        sway: 0.15,
        breathing: true
      },
      accessories: [],
      currentEmotion: 'steady'
    };
  }

  return null;
}

/**
 * Default validation error messages
 */
export const AVATAR_VALIDATION_MESSAGES = {
  INVALID_HEX_COLOR: 'Color must be a valid hex code (e.g., #FF5733)',
  INVALID_SIZE_RANGE: 'Size must be between 0.5 and 1.5',
  INVALID_BOUNCE_RANGE: 'Bounce must be between 0 and 1',
  INVALID_SWAY_RANGE: 'Sway must be between 0 and 1',
  INVALID_ANTENNA_COUNT: 'Antenna count must be 0, 1, 2, or 3',
  INVALID_VERSION: 'Avatar config version must be "1.0"',
  MISSING_REQUIRED_FIELD: 'Missing required field',
  INVALID_ACCESSORY_ID: 'Invalid accessory ID format'
} as const;
