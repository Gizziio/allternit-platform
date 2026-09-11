/**
 * Bundled Allternit Design skills that ship inside Allternit.
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
import posterSkill from '../../../skills/poster-skill/SKILL.md?raw';
import infographicSkill from '../../../skills/infographic-skill/SKILL.md?raw';
import socialCreativeSkill from '../../../skills/social-creative-skill/SKILL.md?raw';
import productLaunchSkill from '../../../skills/product-launch-skill/SKILL.md?raw';
import eduVisualSkill from '../../../skills/edu-visual-skill/SKILL.md?raw';
import scientificFigureSkill from '../../../skills/scientific-figure-skill/SKILL.md?raw';
import generativeArtSkill from '../../../skills/generative-art-skill/SKILL.md?raw';
import pitchDeckSkill from '../../../skills/pitch-deck-skill/SKILL.md?raw';
import emailNewsletterSkill from '../../../skills/email-newsletter-skill/SKILL.md?raw';
import personalSiteSkill from '../../../skills/personal-site-skill/SKILL.md?raw';
// open-design example plugins, vendored in-process as runnable skills (mirror the plugin cards in bundled-plugins.ts)
import docsPageSkill from '../../../plugins/examples/docs-page/SKILL.md?raw';
import blogPostSkill from '../../../plugins/examples/blog-post/SKILL.md?raw';
import dataReportSkill from '../../../plugins/examples/data-report/SKILL.md?raw';
import cartesianDeckSkill from '../../../plugins/examples/html-ppt-zhangzara-cartesian/SKILL.md?raw';

const RAW_SKILLS: { id: string; source: string; assets: string[] }[] = [
  { id: 'saas-landing', source: saasLandingSkill, assets: ['assets/base.html'] },
  { id: 'dashboard', source: dashboardSkill, assets: ['assets/base.html'] },
  { id: 'magazine-deck', source: magazineDeckSkill, assets: ['assets/template.html'] },
  { id: 'design-system-from-brief', source: designSystemSkill, assets: [] },
  { id: 'mobile-app', source: mobileAppSkill, assets: [] },
  { id: 'poster', source: posterSkill, assets: [] },
  { id: 'infographic', source: infographicSkill, assets: [] },
  { id: 'social-creative', source: socialCreativeSkill, assets: [] },
  { id: 'product-launch', source: productLaunchSkill, assets: [] },
  { id: 'edu-visual', source: eduVisualSkill, assets: [] },
  { id: 'scientific-figure', source: scientificFigureSkill, assets: [] },
  { id: 'generative-art', source: generativeArtSkill, assets: [] },
  { id: 'pitch-deck', source: pitchDeckSkill, assets: [] },
  { id: 'email-newsletter', source: emailNewsletterSkill, assets: [] },
  { id: 'personal-site', source: personalSiteSkill, assets: [] },
  { id: 'docs-page', source: docsPageSkill, assets: [] },
  { id: 'blog-post', source: blogPostSkill, assets: [] },
  { id: 'data-report', source: dataReportSkill, assets: [] },
  { id: 'html-ppt-zhangzara-cartesian', source: cartesianDeckSkill, assets: [] },
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
