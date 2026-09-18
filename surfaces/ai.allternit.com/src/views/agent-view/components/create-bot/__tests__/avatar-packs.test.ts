import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_PACKS,
  SHIPPED_AVATAR_PACK_IDS,
  isShippedAvatarPack,
} from '../avatar-packs';

const publicPacksDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../public/avatar-packs',
);

describe('shipped avatar packs', () => {
  it('lists the four finished packs and leaves the rest as placeholders', () => {
    expect([...SHIPPED_AVATAR_PACK_IDS]).toEqual([
      'alloy-classic',
      'alloy-pro',
      'gizzi-brawl',
      'grok-carry',
    ]);
    for (const id of SHIPPED_AVATAR_PACK_IDS) {
      expect(isShippedAvatarPack(id)).toBe(true);
      expect(AVATAR_PACKS.some((pack) => pack.id === id)).toBe(true);
    }
    expect(isShippedAvatarPack('codex-carry')).toBe(false);
    expect(isShippedAvatarPack('gizzi-family')).toBe(false);
  });

  it('does not declare sheets for Alloy Pro (portraits only)', () => {
    const pack = AVATAR_PACKS.find((p) => p.id === 'alloy-pro');
    expect(pack).toBeDefined();
    expect(pack!.sprites).toHaveLength(8);
    for (const sprite of pack!.sprites) {
      expect(sprite.sheetUrl).toBeUndefined();
      expect(sprite.portraitUrl).toBe(`/avatar-packs/alloy-pro/${sprite.id}.webp`);
    }
  });

  it('declares sheets for the other shipped packs', () => {
    for (const packId of ['alloy-classic', 'gizzi-brawl', 'grok-carry'] as const) {
      const pack = AVATAR_PACKS.find((p) => p.id === packId);
      expect(pack, packId).toBeDefined();
      expect(pack!.sprites.length).toBeGreaterThan(0);
      for (const sprite of pack!.sprites) {
        expect(sprite.sheetUrl, `${packId}/${sprite.id}`).toBe(
          `/avatar-packs/${packId}/${sprite.id}-sheet.webp`,
        );
      }
    }
  });

  it('has every declared shipped file on disk', () => {
    for (const packId of SHIPPED_AVATAR_PACK_IDS) {
      const pack = AVATAR_PACKS.find((p) => p.id === packId)!;
      for (const sprite of pack.sprites) {
        const portrait = path.join(publicPacksDir, packId, `${sprite.id}.webp`);
        expect(existsSync(portrait), portrait).toBe(true);
        if (sprite.sheetUrl) {
          const sheet = path.join(publicPacksDir, packId, `${sprite.id}-sheet.webp`);
          expect(existsSync(sheet), sheet).toBe(true);
        } else {
          const sheet = path.join(publicPacksDir, packId, `${sprite.id}-sheet.webp`);
          expect(existsSync(sheet), sheet).toBe(false);
        }
      }
    }
  });
});
