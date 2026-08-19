/**
 * Tests for bot-avatar.service.
 */

import { describe, it, expect } from 'vitest';
import {
  hashSeed,
  generateGeometricAvatar,
  generatePetAvatar,
  generateBotAvatar,
  createImageBotAvatar,
  isBotAvatar,
  resolveBotAvatar,
} from '../bot-avatar.service';

describe('hashSeed', () => {
  it('returns a deterministic 32-bit hash', () => {
    const a = hashSeed('same-seed');
    const b = hashSeed('same-seed');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
  });

  it('returns different hashes for different seeds', () => {
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('generateGeometricAvatar', () => {
  it('produces deterministic output for a seed', () => {
    const a = generateGeometricAvatar('geo-1');
    const b = generateGeometricAvatar('geo-1');
    expect(a).toEqual(b);
    expect(a.seed).toBe('geo-1');
    expect(a.shape).toBeDefined();
    expect(a.primaryColor).toMatch(/^#/);
    expect(a.secondaryColor).toMatch(/^#/);
    expect(a.eyePreset).toBeDefined();
  });

  it('produces different avatars for different seeds', () => {
    const a = generateGeometricAvatar('geo-a');
    const b = generateGeometricAvatar('geo-b');
    expect(a.primaryColor !== b.primaryColor || a.shape !== b.shape || a.eyePreset !== b.eyePreset).toBe(true);
  });
});

describe('generatePetAvatar', () => {
  it('produces deterministic output for a seed', () => {
    const a = generatePetAvatar('pet-1');
    const b = generatePetAvatar('pet-1');
    expect(a).toEqual(b);
    expect(a.species).toBeDefined();
    expect(a.accessory).toBeDefined();
  });
});

describe('generateBotAvatar', () => {
  it('generates a geometric avatar when requested', () => {
    const avatar = generateBotAvatar('seed', 'geometric');
    expect(avatar.type).toBe('geometric');
    expect(isBotAvatar(avatar)).toBe(true);
  });

  it('generates a pet avatar when requested', () => {
    const avatar = generateBotAvatar('seed', 'pet');
    expect(avatar.type).toBe('pet');
    expect(isBotAvatar(avatar)).toBe(true);
  });

  it('falls back to geometric for image type without a URL', () => {
    const avatar = generateBotAvatar('seed', 'image');
    expect(avatar.type).toBe('geometric');
  });

  it('is deterministic when the type is fixed', () => {
    const a = generateBotAvatar('fixed', 'pet');
    const b = generateBotAvatar('fixed', 'pet');
    expect(a).toEqual(b);
  });
});

describe('createImageBotAvatar', () => {
  it('creates an image avatar', () => {
    const avatar = createImageBotAvatar('https://example.com/bot.png', 'Bot');
    expect(avatar.type).toBe('image');
    expect(avatar.data).toEqual({ url: 'https://example.com/bot.png', alt: 'Bot' });
  });
});

describe('isBotAvatar', () => {
  it('accepts valid avatars', () => {
    expect(isBotAvatar(generateBotAvatar('x'))).toBe(true);
    expect(isBotAvatar(createImageBotAvatar('https://example.com/x.png'))).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isBotAvatar(null)).toBe(false);
    expect(isBotAvatar({ type: 'unknown', data: {} })).toBe(false);
    expect(isBotAvatar({ type: 'geometric' })).toBe(false);
  });
});

describe('resolveBotAvatar', () => {
  it('returns the stored avatar when valid', () => {
    const stored = generateBotAvatar('stored', 'pet');
    expect(resolveBotAvatar('seed', stored)).toEqual(stored);
  });

  it('generates a deterministic fallback when stored avatar is invalid', () => {
    const fallback = resolveBotAvatar('seed', { type: 'bad' });
    expect(isBotAvatar(fallback)).toBe(true);
    const again = resolveBotAvatar('seed', null);
    expect(again).toEqual(fallback);
  });
});
