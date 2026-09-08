/**
 * Tests for Bot Hub user sections (lib/bots/bot-hub-sections.ts).
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_BOTS_SECTION_ID,
  BOT_HUB_SECTIONS_STORAGE_KEY,
  categorySectionId,
  createCustomSection,
  defaultBotHubSections,
  deleteBotHubSection,
  groupBotsBySection,
  loadBotHubSections,
  normalizeBotHubSections,
  resolveBotSectionId,
  saveBotHubSections,
  updateBotHubSection,
  type BotHubSection,
} from './bot-hub-sections';
import { BOT_CATEGORIES } from './bot-profile';
import type { Agent, BotCategory } from '../agents/agent.types';

function makeBot(id: string, category?: BotCategory, sectionId?: string): Agent {
  return {
    id,
    name: id,
    isBot: true,
    botProfile: {
      displayName: id,
      botCategory: category,
      sectionId,
    },
  } as unknown as Agent;
}

describe('defaultBotHubSections', () => {
  it('promotes every category in canonical order', () => {
    const sections = defaultBotHubSections();
    expect(sections.map((s) => s.id)).toEqual(
      (Object.keys(BOT_CATEGORIES) as BotCategory[]).map(categorySectionId),
    );
    expect(sections.every((s) => !s.collapsed && !s.hidden)).toBe(true);
  });
});

describe('normalizeBotHubSections', () => {
  it('returns defaults when nothing is stored', () => {
    expect(normalizeBotHubSections(null)).toEqual(defaultBotHubSections());
  });

  it('keeps stored order and chrome, seeds missing categories at the end', () => {
    const stored: Array<Partial<BotHubSection>> = [
      { id: 'category:code', collapsed: true, hidden: true },
      { id: 'custom:vip', label: 'VIP' },
    ];
    const sections = normalizeBotHubSections(stored);
    expect(sections[0].id).toBe('category:code');
    expect(sections[0].collapsed).toBe(true);
    expect(sections[0].hidden).toBe(true);
    expect(sections[1]).toMatchObject({ id: 'custom:vip', label: 'VIP' });
    // Missing categories are appended in canonical order.
    const ids = sections.map((s) => s.id);
    expect(ids).toContain('category:research');
    expect(ids.indexOf('category:research')).toBeGreaterThan(1);
    expect(ids.length).toBe(Object.keys(BOT_CATEGORIES).length + 1);
  });

  it('drops stored sections for categories that no longer exist', () => {
    const sections = normalizeBotHubSections([
      { id: 'category:retired-category' },
      { id: 'category:code' },
    ]);
    expect(sections.some((s) => s.id === 'category:retired-category')).toBe(false);
    expect(sections.filter((s) => s.id.startsWith('custom:') === false).length).toBe(
      Object.keys(BOT_CATEGORIES).length,
    );
  });

  it('dedupes repeated ids and skips malformed entries', () => {
    const sections = normalizeBotHubSections([
      { id: 'category:code' },
      { id: 'category:code', collapsed: true },
      {},
      { id: '' },
      null as unknown as Partial<BotHubSection>,
    ]);
    expect(sections.filter((s) => s.id === 'category:code').length).toBe(1);
    expect(sections[0].collapsed).toBe(false);
  });
});

describe('resolveBotSectionId', () => {
  const sections = defaultBotHubSections();

  it('defaults to the category bucket when sectionId is unset', () => {
    expect(resolveBotSectionId(makeBot('a', 'research'), sections)).toBe('category:research');
  });

  it('defaults to category:custom when the bot has no category either', () => {
    expect(resolveBotSectionId(makeBot('a'), sections)).toBe('category:custom');
  });

  it('honors an explicit sectionId when the section exists', () => {
    const withCustom = createCustomSection(sections, 'VIP');
    expect(resolveBotSectionId(makeBot('a', 'research', 'custom:vip'), withCustom)).toBe(
      'custom:vip',
    );
  });

  it('falls back to the category bucket when the sectionId no longer resolves', () => {
    expect(resolveBotSectionId(makeBot('a', 'code', 'custom:deleted'), sections)).toBe(
      'category:code',
    );
  });

  it('lands in All bots when neither the sectionId nor the category bucket exists', () => {
    const noCustom = sections.filter((s) => s.id !== 'category:custom');
    expect(resolveBotSectionId(makeBot('a', undefined, 'custom:deleted'), noCustom)).toBe(
      ALL_BOTS_SECTION_ID,
    );
  });
});

describe('groupBotsBySection', () => {
  it('groups membership on the bot and always provides the All bots bucket', () => {
    const sections = createCustomSection(defaultBotHubSections(), 'VIP');
    const bots = [
      makeBot('researcher', 'research'),
      makeBot('coder', 'code'),
      makeBot('vip-1', 'sales', 'custom:vip'),
      // Membership points at a deleted section and the bot has no category:
      // the category:custom bucket still catches it (custom is a category).
      makeBot('orphan', undefined, 'custom:gone'),
    ];
    const layout = groupBotsBySection(bots, sections);

    const byId = new Map(layout.sections.map((g) => [g.section.id, g.bots]));
    expect(byId.get('category:research')?.map((b) => b.id)).toEqual(['researcher']);
    expect(byId.get('category:code')?.map((b) => b.id)).toEqual(['coder']);
    expect(byId.get('custom:vip')?.map((b) => b.id)).toEqual(['vip-1']);
    expect(byId.get('category:custom')?.map((b) => b.id)).toEqual(['orphan']);
  });

  it('lands bots in All bots only when no section can resolve', () => {
    const sections = defaultBotHubSections().filter((s) => s.id !== 'category:custom');
    const layout = groupBotsBySection(
      [makeBot('orphan', undefined, 'custom:gone')],
      sections,
    );
    expect(layout.allBots.map((b) => b.id)).toEqual(['orphan']);
  });

  it('preserves section display order and bot order within a section', () => {
    const sections = defaultBotHubSections();
    const bots = [makeBot('b', 'research'), makeBot('a', 'research')];
    const layout = groupBotsBySection(bots, sections);
    expect(layout.sections.map((g) => g.section.id)).toEqual(sections.map((s) => s.id));
    expect(layout.sections[0].bots.map((b) => b.id)).toEqual(['b', 'a']);
  });
});

describe('section management', () => {
  it('createCustomSection slugs labels and dedupes ids', () => {
    let sections = createCustomSection(defaultBotHubSections(), 'My VIP Bots!');
    expect(sections[sections.length - 1]).toMatchObject({
      id: 'custom:my-vip-bots',
      label: 'My VIP Bots!',
    });
    sections = createCustomSection(sections, 'my vip bots');
    expect(sections[sections.length - 1].id).toBe('custom:my-vip-bots-2');
  });

  it('deleteBotHubSection removes only the section — bots are untouched', () => {
    const sections = createCustomSection(defaultBotHubSections(), 'VIP');
    const after = deleteBotHubSection(sections, 'custom:vip');
    expect(after.some((s) => s.id === 'custom:vip')).toBe(false);
    expect(after.length).toBe(sections.length - 1);
    // The All bots bucket cannot be deleted.
    expect(deleteBotHubSection(after, ALL_BOTS_SECTION_ID)).toBe(after);
  });

  it('updateBotHubSection patches chrome fields', () => {
    const sections = defaultBotHubSections();
    const after = updateBotHubSection(sections, 'category:code', { collapsed: true, hidden: true });
    const code = after.find((s) => s.id === 'category:code')!;
    expect(code.collapsed).toBe(true);
    expect(code.hidden).toBe(true);
    expect(after.find((s) => s.id === 'category:research')!.collapsed).toBe(false);
  });
});

describe('persistence', () => {
  it('roundtrips sections through storage (or the in-memory fallback)', () => {
    const sections = updateBotHubSection(
      createCustomSection(defaultBotHubSections(), 'Pinned'),
      'category:research',
      { collapsed: true },
    );
    saveBotHubSections(sections);
    expect(loadBotHubSections()).toEqual(normalizeBotHubSections(sections));
  });

  it('survives corrupt JSON in storage', () => {
    try {
      window.localStorage.setItem(BOT_HUB_SECTIONS_STORAGE_KEY, '{not json');
    } catch {
      // Locked-down storage: readRaw falls back to memory.
    }
    // Either way the loader must not throw and must yield a normalized list
    // that still contains every default category bucket.
    let loaded: ReturnType<typeof loadBotHubSections> = [];
    expect(() => {
      loaded = loadBotHubSections();
    }).not.toThrow();
    for (const d of defaultBotHubSections()) {
      expect(loaded.some((s) => s.id === d.id)).toBe(true);
    }
  });
});
