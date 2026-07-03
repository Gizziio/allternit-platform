/**
 * Craft reference loader — ported from nexu-io/open-design.
 *
 * Craft files live at `/craft/*.md` and contain universal design rules
 * (typography, color, anti-ai-slop) that apply regardless of brand.
 * A skill opts in by listing slugs in `od.craft.requires`. Missing craft
 * files are ignored silently so skills can forward-reference future craft
 * sections.
 */

import typography from '../../../craft/typography.md?raw';
import color from '../../../craft/color.md?raw';
import antiAiSlop from '../../../craft/anti-ai-slop.md?raw';

export type CraftSlug = 'typography' | 'color' | 'anti-ai-slop';

const CRAFT_LIBRARY: Record<CraftSlug, string> = {
  typography,
  color,
  'anti-ai-slop': antiAiSlop,
};

const VALID_CRAFT_SLUGS = new Set<string>(Object.keys(CRAFT_LIBRARY));

export function isCraftSlug(value: string): value is CraftSlug {
  return VALID_CRAFT_SLUGS.has(value);
}

export function getCraftBody(slug: CraftSlug): string {
  return CRAFT_LIBRARY[slug] ?? '';
}

export function loadCraftRequirements(slugs: string[]): string {
  return slugs
    .filter((slug): slug is CraftSlug => isCraftSlug(slug))
    .map((slug) => `---\n${CRAFT_LIBRARY[slug]}`.trim())
    .join('\n\n');
}
