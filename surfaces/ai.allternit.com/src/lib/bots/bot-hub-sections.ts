/**
 * Bot Hub Sections (spec Phase 5)
 *
 * User-managed roster sections in the Bot Hub. Membership lives ON the bot
 * (`botProfile.sectionId`, Hermes' `BotMeta.sectionId` pattern), so deleting
 * or hiding a section never orphans a bot — unresolvable memberships fall
 * back to the always-present "All bots" bucket. Unset sectionIds default to
 * `category:<botCategory>` so pre-existing bots land in sensible buckets.
 *
 * Section chrome (order, collapsed, hidden, custom labels) is per-user and
 * persisted at localStorage `allternit:bot-hub-sections`; an in-memory
 * fallback keeps tests and locked-down environments working.
 *
 * @module bot-hub-sections
 */

import type { Agent, BotCategory } from '../agents/agent.types';
import { BOT_CATEGORIES } from './bot-profile';

export const BOT_HUB_SECTIONS_STORAGE_KEY = 'allternit:bot-hub-sections';

/** The uncategorized bucket always exists and cannot be deleted. */
export const ALL_BOTS_SECTION_ID = 'all';

export interface BotHubSection {
  /** 'category:<botCategory>' for promoted categories, 'custom:<slug>' for user-created. */
  id: string;
  label: string;
  collapsed: boolean;
  /** Hidden sections keep their bots out of the roster; search still finds them. */
  hidden: boolean;
}

export function categorySectionId(category: BotCategory): string {
  return `category:${category}`;
}

/** Default section list: every bot category promoted, in canonical order. */
export function defaultBotHubSections(): BotHubSection[] {
  return (Object.keys(BOT_CATEGORIES) as BotCategory[]).map((category) => ({
    id: categorySectionId(category),
    label: BOT_CATEGORIES[category].label,
    collapsed: false,
    hidden: false,
  }));
}

// ---------------------------------------------------------------------------
// Persistence (localStorage with in-memory fallback)
// ---------------------------------------------------------------------------

let memoryFallback: BotHubSection[] | null = null;

function readRaw(): unknown {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(BOT_HUB_SECTIONS_STORAGE_KEY);
  } catch {
    // Locked-down storage: serve the in-memory fallback instead.
    return memoryFallback ? JSON.parse(JSON.stringify(memoryFallback)) : null;
  }
  if (raw == null) {
    return memoryFallback ? JSON.parse(JSON.stringify(memoryFallback)) : null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Corrupt entry: ignore it and re-seed from defaults.
    return null;
  }
}

/** Load sections, normalizing against the current category set. */
export function loadBotHubSections(): BotHubSection[] {
  const raw = readRaw();
  const stored = Array.isArray(raw) ? (raw as Array<Partial<BotHubSection>>) : null;
  return normalizeBotHubSections(stored);
}

/** Persist sections (order + collapsed/hidden + custom sections). */
export function saveBotHubSections(sections: BotHubSection[]): void {
  memoryFallback = JSON.parse(JSON.stringify(sections)) as BotHubSection[];
  try {
    window.localStorage.setItem(BOT_HUB_SECTIONS_STORAGE_KEY, JSON.stringify(sections));
  } catch {
    // Locked-down storage: the in-memory fallback already holds the state.
  }
}

const KNOWN_CATEGORIES = new Set(Object.keys(BOT_CATEGORIES));

/**
 * Merge stored sections with the current category defaults:
 * - valid stored entries keep their position and collapsed/hidden state
 * - stored entries for categories that no longer exist are dropped
 * - category sections missing from storage are seeded in canonical order
 *   (appended after the stored ones so user ordering wins)
 */
export function normalizeBotHubSections(
  stored: Array<Partial<BotHubSection>> | null,
): BotHubSection[] {
  const defaults = defaultBotHubSections();
  if (!stored) return defaults;

  const seen = new Set<string>();
  const result: BotHubSection[] = [];

  for (const entry of stored) {
    if (!entry || typeof entry.id !== 'string' || !entry.id) continue;
    const isCategory = entry.id.startsWith('category:');
    if (isCategory && !KNOWN_CATEGORIES.has(entry.id.slice('category:'.length))) continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    const fallback = defaults.find((d) => d.id === entry.id);
    result.push({
      id: entry.id,
      label:
        typeof entry.label === 'string' && entry.label.trim()
          ? entry.label
          : (fallback?.label ?? entry.id),
      collapsed: entry.collapsed === true,
      hidden: entry.hidden === true,
    });
  }

  for (const d of defaults) {
    if (!seen.has(d.id)) result.push(d);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

/**
 * Resolve the section a bot belongs to.
 * Returns ALL_BOTS_SECTION_ID when the membership cannot be resolved against
 * the live section list (deleted section + no category bucket).
 */
export function resolveBotSectionId(bot: Agent, sections: BotHubSection[]): string {
  const wanted = bot.botProfile?.sectionId;
  if (wanted && sections.some((s) => s.id === wanted)) return wanted;

  const category = bot.botProfile?.botCategory ?? 'custom';
  const categoryId = categorySectionId(category);
  if (sections.some((s) => s.id === categoryId)) return categoryId;

  return ALL_BOTS_SECTION_ID;
}

export interface SectionGroup {
  section: BotHubSection;
  bots: Agent[];
}

export interface BotHubSectionLayout {
  /** All user-managed sections in display order (hidden ones flagged). */
  sections: SectionGroup[];
  /** Uncategorized bucket — always present, never deletable. */
  allBots: Agent[];
}

/**
 * Group bots into ordered sections plus the "All bots" bucket. Hidden
 * sections keep their members here; rendering decides when to show them.
 */
export function groupBotsBySection(bots: Agent[], sections: BotHubSection[]): BotHubSectionLayout {
  const buckets = new Map<string, Agent[]>();
  const allBots: Agent[] = [];

  for (const bot of bots) {
    const sectionId = resolveBotSectionId(bot, sections);
    if (sectionId === ALL_BOTS_SECTION_ID) {
      allBots.push(bot);
      continue;
    }
    const list = buckets.get(sectionId) ?? [];
    list.push(bot);
    buckets.set(sectionId, list);
  }

  return {
    sections: sections.map((section) => ({
      section,
      bots: buckets.get(section.id) ?? [],
    })),
    allBots,
  };
}

function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/** Create a custom section (appended to the end of the current order). */
export function createCustomSection(sections: BotHubSection[], label: string): BotHubSection[] {
  const trimmed = label.trim();
  const base = `custom:${slugify(trimmed)}`;
  let id = base;
  let suffix = 2;
  while (sections.some((s) => s.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return [
    ...sections,
    { id, label: trimmed || 'New section', collapsed: false, hidden: false },
  ];
}

/**
 * Delete a section. Bots are NOT touched — membership stays on the bot and
 * unresolved memberships render in the "All bots" bucket. The "All bots"
 * bucket itself and default category sections can be re-seeded by
 * normalizeBotHubSections on next load, so deletion is only refused for it.
 */
export function deleteBotHubSection(sections: BotHubSection[], sectionId: string): BotHubSection[] {
  if (sectionId === ALL_BOTS_SECTION_ID) return sections;
  return sections.filter((s) => s.id !== sectionId);
}

/** Patch chrome fields (collapsed/hidden/label) of one section. */
export function updateBotHubSection(
  sections: BotHubSection[],
  sectionId: string,
  patch: Partial<Pick<BotHubSection, 'collapsed' | 'hidden' | 'label'>>,
): BotHubSection[] {
  return sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s));
}
