/**
 * Bot Avatar Service
 *
 * Deterministic, bot-scoped avatar generation. Supports three avatar families:
 *   - geometric: hash-derived SVG shape, color, and eyes
 *   - pet: hash-derived companion face/species
 *   - image: user-supplied image URL
 *
 * Avatars are stored in bot metadata (`botProfile.avatar`) so the same bot always
 * renders the same face across sessions and surfaces.
 *
 * @module bot-avatar.service
 */

import { z } from 'zod';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('BotAvatarService');

export type BotAvatarType = 'geometric' | 'pet' | 'image';

export interface BotAvatar {
  type: BotAvatarType;
  data: BotGeometricAvatar | BotPetAvatar | BotImageAvatar;
}

export interface BotGeometricAvatar {
  seed: string;
  shape: 'circle' | 'rounded' | 'square' | 'hex' | 'diamond';
  primaryColor: string;
  secondaryColor: string;
  eyePreset: 'round' | 'wide' | 'narrow' | 'focused' | 'curious';
}

export interface BotPetAvatar {
  seed: string;
  species: 'cat' | 'dog' | 'rabbit' | 'fox' | 'owl' | 'robot';
  primaryColor: string;
  secondaryColor: string;
  accessory?: 'none' | 'glasses' | 'bow' | 'headset';
}

export interface BotImageAvatar {
  url: string;
  alt?: string;
}

export const BotGeometricAvatarSchema = z.object({
  seed: z.string(),
  shape: z.enum(['circle', 'rounded', 'square', 'hex', 'diamond']),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  eyePreset: z.enum(['round', 'wide', 'narrow', 'focused', 'curious']),
});

export const BotPetAvatarSchema = z.object({
  seed: z.string(),
  species: z.enum(['cat', 'dog', 'rabbit', 'fox', 'owl', 'robot']),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  accessory: z.enum(['none', 'glasses', 'bow', 'headset']).optional(),
});

export const BotImageAvatarSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
});

export const BotAvatarSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('geometric'), data: BotGeometricAvatarSchema }),
  z.object({ type: z.literal('pet'), data: BotPetAvatarSchema }),
  z.object({ type: z.literal('image'), data: BotImageAvatarSchema }),
]);

const PALETTE = [
  { primary: '#6366f1', secondary: '#a5b4fc' },
  { primary: '#8b5cf6', secondary: '#c4b5fd' },
  { primary: '#ec4899', secondary: '#fbcfe8' },
  { primary: '#f43f5e', secondary: '#fecdd3' },
  { primary: '#f97316', secondary: '#fed7aa' },
  { primary: '#eab308', secondary: '#fef08a' },
  { primary: '#10b981', secondary: '#a7f3d0' },
  { primary: '#14b8a6', secondary: '#99f6e4' },
  { primary: '#06b6d4', secondary: '#a5f3fc' },
  { primary: '#3b82f6', secondary: '#bfdbfe' },
  { primary: '#64748b', secondary: '#cbd5e1' },
  { primary: '#d946ef', secondary: '#f0abfc' },
];

const SHAPES: BotGeometricAvatar['shape'][] = ['circle', 'rounded', 'square', 'hex', 'diamond'];
const EYE_PRESETS: BotGeometricAvatar['eyePreset'][] = ['round', 'wide', 'narrow', 'focused', 'curious'];
const PET_SPECIES: BotPetAvatar['species'][] = ['cat', 'dog', 'rabbit', 'fox', 'owl', 'robot'];
const PET_ACCESSORIES: BotPetAvatar['accessory'][] = ['none', 'glasses', 'bow', 'headset'];

/**
 * Deterministic 32-bit hash of a seed string.
 */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFromHash<T>(hash: number, items: readonly T[]): T {
  return items[Math.abs(hash) % items.length];
}

/**
 * Generate a deterministic geometric avatar from a seed.
 */
export function generateGeometricAvatar(seed: string): BotGeometricAvatar {
  const hash = hashSeed(seed);
  const colors = pickFromHash(hash, PALETTE);
  return {
    seed,
    shape: pickFromHash(hash >> 8, SHAPES),
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    eyePreset: pickFromHash(hash >> 16, EYE_PRESETS),
  };
}

/**
 * Generate a deterministic pet avatar from a seed.
 */
export function generatePetAvatar(seed: string): BotPetAvatar {
  const hash = hashSeed(seed);
  const colors = pickFromHash(hash, PALETTE);
  return {
    seed,
    species: pickFromHash(hash >> 8, PET_SPECIES),
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    accessory: pickFromHash(hash >> 16, PET_ACCESSORIES),
  };
}

/**
 * Generate a deterministic bot avatar.
 *
 * If no type is provided, the seed hash decides between geometric and pet.
 */
export function generateBotAvatar(seed: string, type?: BotAvatarType): BotAvatar {
  const resolvedType = type ?? (hashSeed(seed) % 2 === 0 ? 'geometric' : 'pet');

  switch (resolvedType) {
    case 'geometric':
      return { type: 'geometric', data: generateGeometricAvatar(seed) };
    case 'pet':
      return { type: 'pet', data: generatePetAvatar(seed) };
    case 'image':
      logger.warn({ seed }, 'Image avatars require a URL; falling back to geometric');
      return { type: 'geometric', data: generateGeometricAvatar(seed) };
    default:
      return { type: 'geometric', data: generateGeometricAvatar(seed) };
  }
}

/**
 * Build an image avatar.
 */
export function createImageBotAvatar(url: string, alt?: string): BotAvatar {
  return { type: 'image', data: { url, alt } };
}

/**
 * Type guard for BotAvatar values.
 */
export function isBotAvatar(value: unknown): value is BotAvatar {
  if (typeof value !== 'object' || value === null) return false;
  const avatar = value as Partial<BotAvatar>;
  return (
    typeof avatar.type === 'string' &&
    ['geometric', 'pet', 'image'].includes(avatar.type) &&
    typeof avatar.data === 'object' &&
    avatar.data !== null
  );
}

/**
 * Resolve a bot avatar from metadata, generating a deterministic fallback when
 * none is stored.
 */
export function resolveBotAvatar(seed: string, stored?: unknown): BotAvatar {
  if (isBotAvatar(stored)) return stored;
  return generateBotAvatar(seed);
}
