/**
 * Craft reference loader — ported from nexu-io/open-design.
 *
 * Craft reference loader — vendored in-process from nexu-io/open-design `craft/`.
 *
 * Craft files live at `/craft/*.md` and contain universal design rules
 * (typography, color, motion, accessibility, anti-ai-slop, …) that apply
 * regardless of brand. A skill opts in by listing slugs in `od.craft.requires`.
 * Missing craft files are ignored silently so skills can forward-reference
 * future craft sections. Served inside the Allternit frontend bundle — no
 * daemon, no sidecar.
 */

import typography from '../../../craft/typography.md?raw';
import color from '../../../craft/color.md?raw';
import antiAiSlop from '../../../craft/anti-ai-slop.md?raw';
import typographyHierarchy from '../../../craft/typography-hierarchy.md?raw';
import typographyHierarchyEditorial from '../../../craft/typography-hierarchy-editorial.md?raw';
import accessibilityBaseline from '../../../craft/accessibility-baseline.md?raw';
import animationDiscipline from '../../../craft/animation-discipline.md?raw';
import formValidation from '../../../craft/form-validation.md?raw';
import lawsOfUx from '../../../craft/laws-of-ux.md?raw';
import rtlAndBidi from '../../../craft/rtl-and-bidi.md?raw';
import stateCoverage from '../../../craft/state-coverage.md?raw';

export type CraftSlug =
  | 'typography'
  | 'color'
  | 'anti-ai-slop'
  | 'typography-hierarchy'
  | 'typography-hierarchy-editorial'
  | 'accessibility-baseline'
  | 'animation-discipline'
  | 'form-validation'
  | 'laws-of-ux'
  | 'rtl-and-bidi'
  | 'state-coverage';

const CRAFT_LIBRARY: Record<CraftSlug, string> = {
  typography,
  color,
  'anti-ai-slop': antiAiSlop,
  'typography-hierarchy': typographyHierarchy,
  'typography-hierarchy-editorial': typographyHierarchyEditorial,
  'accessibility-baseline': accessibilityBaseline,
  'animation-discipline': animationDiscipline,
  'form-validation': formValidation,
  'laws-of-ux': lawsOfUx,
  'rtl-and-bidi': rtlAndBidi,
  'state-coverage': stateCoverage,
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
