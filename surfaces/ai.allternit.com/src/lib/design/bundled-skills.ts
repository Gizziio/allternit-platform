/**
 * Bundled Open Design skills that ship inside Allternit.
 *
 * These are thin ports of the SKILL.md convention. Each skill folder lives
 * under `/skills/` and contains a SKILL.md plus optional assets/. At build
 * time the markdown is imported as a raw string and parsed into a SkillRecord.
 */

import { parseSkillMarkdown, type SkillRecord } from './skill-registry';

import saasLandingSkill from '../../../skills/saas-landing-skill/SKILL.md?raw';
import dashboardSkill from '../../../skills/dashboard-skill/SKILL.md?raw';
import magazineDeckSkill from '../../../skills/magazine-deck-skill/SKILL.md?raw';
import designSystemSkill from '../../../skills/design-system-skill/SKILL.md?raw';
import mobileAppSkill from '../../../skills/mobile-app-skill/SKILL.md?raw';

const RAW_SKILLS: { id: string; source: string; assets: string[] }[] = [
  { id: 'saas-landing', source: saasLandingSkill, assets: ['assets/base.html'] },
  { id: 'dashboard', source: dashboardSkill, assets: ['assets/base.html'] },
  { id: 'magazine-deck', source: magazineDeckSkill, assets: ['assets/template.html'] },
  { id: 'design-system-from-brief', source: designSystemSkill, assets: [] },
  { id: 'mobile-app', source: mobileAppSkill, assets: [] },
];

export const BUNDLED_SKILLS: SkillRecord[] = RAW_SKILLS.map((s) =>
  parseSkillMarkdown(s.id, s.source, s.assets),
);

export function getBundledSkillById(id: string): SkillRecord | undefined {
  return BUNDLED_SKILLS.find((s) => s.id === id);
}

export function getBundledSkillsByMode(mode: string): SkillRecord[] {
  return BUNDLED_SKILLS.filter((s) => s.mode === mode);
}
