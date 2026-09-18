import { describe, expect, it } from 'vitest';
import {
  buildAvatarConfigFromEditor,
  defaultAvatarEditorValues,
  hydrateAvatarEditorFromConfig,
  matchPackSelection,
} from '../avatar-config';

describe('avatar-config', () => {
  it('builds a pack sheet avatar for Alloy Classic Atlas', () => {
    const state = defaultAvatarEditorValues();
    state.avatarMode = 'packs';
    state.packSelection = { packId: 'alloy-classic', spriteId: 'atlas' };
    const config = buildAvatarConfigFromEditor(state, '#B08D6E');
    expect(config.mascotTemplate).toBe('pet');
    expect(config.pet?.spriteUrl).toBe('/avatar-packs/alloy-classic/atlas-sheet.webp');
    expect(matchPackSelection(config)).toEqual({ packId: 'alloy-classic', spriteId: 'atlas' });
  });

  it('builds a portrait image avatar for Alloy Pro (no sheets)', () => {
    const state = defaultAvatarEditorValues();
    state.avatarMode = 'packs';
    state.packSelection = { packId: 'alloy-pro', spriteId: 'vantage' };
    const config = buildAvatarConfigFromEditor(state, '#2563eb');
    expect(config.type).toBe('image');
    expect(config.uri).toBe('/avatar-packs/alloy-pro/vantage.webp');
    expect(matchPackSelection(config)).toEqual({ packId: 'alloy-pro', spriteId: 'vantage' });
  });

  it('hydrates sprite-pack mode from a saved sheet URL', () => {
    const hydrated = hydrateAvatarEditorFromConfig({
      type: 'mascot',
      mascotTemplate: 'pet',
      pet: {
        spriteUrl: '/avatar-packs/gizzi-brawl/gizzi-sheet.webp',
        frameWidth: 192,
        frameHeight: 208,
        columns: 8,
        rows: 9,
      },
    });
    expect(hydrated.avatarMode).toBe('packs');
    expect(hydrated.packSelection).toEqual({ packId: 'gizzi-brawl', spriteId: 'gizzi' });
  });

  it('round-trips gizzi mode', () => {
    const state = defaultAvatarEditorValues('#6366f1');
    state.avatarMode = 'gizzi';
    state.gizziColor = '#6366f1';
    state.gizziEmotion = 'curious';
    const config = buildAvatarConfigFromEditor(state, '#6366f1');
    const hydrated = hydrateAvatarEditorFromConfig(config, '#6366f1');
    expect(hydrated.avatarMode).toBe('gizzi');
    expect(hydrated.gizziColor).toBe('#6366f1');
    expect(hydrated.gizziEmotion).toBe('curious');
  });
});
