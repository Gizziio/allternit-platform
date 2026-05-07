/**
 * Skills Catalog
 *
 * Registry of design skills ported from open-design's skills library.
 * Each skill maps to a SKILL.md file in public/skills/ and defines
 * which studio modes it applies to.
 */

export type SkillMode =
  | 'all'
  | 'page'
  | 'component'
  | 'deck'
  | 'email'
  | 'document'
  | 'app';

export interface Skill {
  id: string;
  label: string;
  description: string;
  modes: SkillMode[];
  skillMdPath?: string;
  tags?: string[];
}

export const SKILLS_CATALOG: Skill[] = [
  {
    id: 'saas-landing',
    label: 'SaaS Landing Page',
    description: 'Hero, features, social proof, pricing, CTA — the complete conversion page arc.',
    modes: ['page'],
    skillMdPath: '/skills/saas-landing.md',
    tags: ['marketing', 'conversion'],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Data-rich admin or analytics view with cards, charts, and sidebar navigation.',
    modes: ['page', 'app'],
    skillMdPath: '/skills/dashboard.md',
    tags: ['data', 'admin'],
  },
  {
    id: 'mobile-app',
    label: 'Mobile App Screen',
    description: 'Native-feeling mobile screen with bottom nav, status bar, and gesture affordances.',
    modes: ['page', 'component', 'app'],
    skillMdPath: '/skills/mobile-app.md',
    tags: ['mobile', 'ios', 'android'],
  },
  {
    id: 'mobile-onboarding',
    label: 'Mobile Onboarding',
    description: 'Multi-step welcome flow with progress indicators, permissions, and value props.',
    modes: ['page', 'app'],
    skillMdPath: '/skills/mobile-onboarding.md',
    tags: ['mobile', 'onboarding'],
  },
  {
    id: 'pricing-page',
    label: 'Pricing Page',
    description: 'Tiered pricing grid with feature comparison, toggles, and CTA hierarchy.',
    modes: ['page'],
    skillMdPath: '/skills/pricing-page.md',
    tags: ['marketing', 'conversion'],
  },
  {
    id: 'docs-page',
    label: 'Documentation Page',
    description: 'Technical docs layout with sidebar TOC, code blocks, and breadcrumb nav.',
    modes: ['page'],
    skillMdPath: '/skills/docs-page.md',
    tags: ['documentation', 'technical'],
  },
  {
    id: 'wireframe-sketch',
    label: 'Wireframe Sketch',
    description: 'Lo-fi structural sketch using boxes, labels, and grayscale layout tokens.',
    modes: ['page', 'component', 'app'],
    skillMdPath: '/skills/wireframe-sketch.md',
    tags: ['wireframe', 'planning'],
  },
  {
    id: 'web-prototype',
    label: 'Web Prototype',
    description: 'Interactive prototype with hover states, transitions, and simulated navigation.',
    modes: ['page', 'component', 'app'],
    skillMdPath: '/skills/web-prototype.md',
    tags: ['prototype', 'interaction'],
  },
  {
    id: 'simple-deck',
    label: 'Presentation Deck',
    description: 'Slide-based 1920×1080 deck with keyboard navigation and scale-to-fit.',
    modes: ['deck'],
    skillMdPath: '/skills/simple-deck.md',
    tags: ['slides', 'presentation'],
  },
  {
    id: 'social-carousel',
    label: 'Social Carousel',
    description: 'Square or portrait carousel slides optimised for Instagram/LinkedIn sharing.',
    modes: ['deck', 'page'],
    skillMdPath: '/skills/social-carousel.md',
    tags: ['social', 'marketing'],
  },
  {
    id: 'magazine-poster',
    label: 'Magazine Poster',
    description: 'Editorial poster with strong typography hierarchy and striking imagery placeholders.',
    modes: ['page', 'deck'],
    skillMdPath: '/skills/magazine-poster.md',
    tags: ['editorial', 'print'],
  },
  {
    id: 'email-marketing',
    label: 'Marketing Email',
    description: 'HTML email with inline styles, responsive tables, and text fallback.',
    modes: ['email'],
    skillMdPath: '/skills/email-marketing.md',
    tags: ['email', 'marketing'],
  },
  {
    id: 'blog-post',
    label: 'Blog Post',
    description: 'Long-form article layout with pull quotes, images, and reading progress.',
    modes: ['page', 'document'],
    skillMdPath: '/skills/blog-post.md',
    tags: ['content', 'editorial'],
  },
  {
    id: 'kanban-board',
    label: 'Kanban Board',
    description: 'Multi-column task board with card drag handles, status labels, and filters.',
    modes: ['app', 'page'],
    skillMdPath: '/skills/kanban-board.md',
    tags: ['productivity', 'app'],
  },
  {
    id: 'team-okrs',
    label: 'Team OKRs',
    description: 'Quarterly objectives and key results tracker with progress rings and ownership.',
    modes: ['page', 'document'],
    skillMdPath: '/skills/team-okrs.md',
    tags: ['business', 'planning'],
  },
  {
    id: 'weekly-update',
    label: 'Weekly Update',
    description: 'Internal team update with metrics, blockers, shoutouts, and next steps.',
    modes: ['document'],
    skillMdPath: '/skills/weekly-update.md',
    tags: ['business', 'communication'],
  },
  {
    id: 'pm-spec',
    label: 'Product Spec',
    description: 'PRD-style spec doc with problem statement, success metrics, and requirements.',
    modes: ['document'],
    skillMdPath: '/skills/pm-spec.md',
    tags: ['product', 'documentation'],
  },
  {
    id: 'eng-runbook',
    label: 'Engineering Runbook',
    description: 'Operational runbook with incident steps, escalation paths, and checklists.',
    modes: ['document'],
    skillMdPath: '/skills/eng-runbook.md',
    tags: ['engineering', 'ops'],
  },
  {
    id: 'finance-report',
    label: 'Finance Report',
    description: 'Executive finance summary with budget tables, variance charts, and commentary.',
    modes: ['document', 'page'],
    skillMdPath: '/skills/finance-report.md',
    tags: ['finance', 'business'],
  },
  {
    id: 'gamified-app',
    label: 'Gamified App',
    description: 'Achievement-based UI with XP bars, badges, streaks, and leaderboard elements.',
    modes: ['app', 'page'],
    skillMdPath: '/skills/gamified-app.md',
    tags: ['gaming', 'engagement'],
  },
];

export function getSkillById(id: string): Skill | undefined {
  return SKILLS_CATALOG.find((s) => s.id === id);
}

export function getSkillsByMode(mode: SkillMode): Skill[] {
  return SKILLS_CATALOG.filter((s) => s.modes.includes(mode) || s.modes.includes('all'));
}

export async function fetchSkillMd(skill: Skill): Promise<string> {
  if (!skill.skillMdPath) return '';
  try {
    const res = await fetch(skill.skillMdPath);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}
