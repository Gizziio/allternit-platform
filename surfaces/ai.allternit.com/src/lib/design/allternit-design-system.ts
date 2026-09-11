/**
 * A:// Design System — Allternit's canonical brand system.
 *
 * Curated first-party entry for the design marketplace, built from the
 * canonical brand tokens (ivory surfaces, graphite ink, amber accent,
 * Allternit Sans/Serif/Mono type aliases). Registered at the TOP of
 * DESIGN_MARKETPLACE and used as the default direction for new projects.
 */
import type { DesignSystem } from './design-registry';

export const ALLTERNIT_DESIGN_SYSTEM_ID = 'allternit-brand';

export const ALLTERNIT_DESIGN_SYSTEM: DesignSystem = {
  id: ALLTERNIT_DESIGN_SYSTEM_ID,
  name: 'A:// Design System',
  description:
    "Allternit's canonical brand system — ivory paper surfaces, graphite ink, a single amber accent, and Allternit Sans / Serif / Mono typography. The default for all Allternit-generated artifacts.",
  vibe: 'Allternit Brand',
  author: 'Allternit',
  creatorHandle: '@allternit',
  installs: 12400,
  likes: 8900,
  views: 49600,
  forks: 2100,
  tags: ['allternit', 'brand', 'amber', 'ivory', 'editorial', 'canonical'],
  previewColors: ['#FAF8F4', '#0F0F0F', '#B08D6E', '#EBE7DF'],
  designMd: `# Design System: A:// (Allternit Brand)

> The canonical Allternit brand system. Generated artifacts should read as
> Allternit product — ivory paper warmth, graphite ink, one amber accent —
> not generic AI output.

## 1. Color tokens

- **background:** \`#FAF8F4\` (ivory) — page background
- **surface:** \`#F5F3EE\` — cards, panels, raised sheets
- **surface-sunken / border:** \`#EBE7DF\` — dividers, wells, hairlines
- **border-strong:** \`#DDD8CD\`
- **ink (text primary):** \`#1F1B16\`
- **text-secondary:** \`#5C4F42\`
- **text-muted:** \`#8F7A66\`
- **graphite:** \`#0F0F0F\` (canvas), \`#1A1A1A\` (chrome), \`#262626\` (raised dark)
- **accent primary:** \`#B08D6E\` (amber) — CTAs, links, focus rings
- **accent hover:** \`#C4A684\`
- **accent muted:** \`#9A7658\`

Rules:
- One accent — amber \`#B08D6E\` — used at most twice per screen.
- **NEVER purple or indigo** in any form: no violet/fuchsia/indigo Tailwind classes, no \`#8b5cf6\`, \`#B08D6E\`, \`#6366f1\`, no purple→blue "trust" gradients.
- **NEVER coral** (\`#e27c59\`, \`#d97757\`) — coral is reserved for Allternit platform UI chrome only; never in generated artifacts.
- Body text must meet WCAG AA: ≥ 4.5:1 against its background.

## 2. Typography

- **Allternit Sans** — UI, body, labels. Stack: \`"Allternit Sans", Inter, ui-sans-serif, system-ui, sans-serif\`. Inter is acceptable **only** as the local fallback for Allternit Sans.
- **Allternit Serif** — display headlines, editorial moments. Stack: \`"Allternit Serif", Newsreader, Georgia, serif\`.
- **Allternit Mono** — code, data, kickers/eyebrows. Stack: \`"Allternit Mono", "JetBrains Mono", ui-monospace, monospace\`.
- Scale: 12 / 14 / 16 / 20 / 24 / 32 / 48. Tighten display ≥ 32px to −0.02em; ALL-CAPS labels get +0.08em letter-spacing minimum.
- Body line-height 1.5–1.65; line length 45–75 characters.

## 3. Icons & imagery

- Icons are **inline SVG, currentColor, no emoji** — emoji as icons reads as placeholder.
- Use imagery at real aspect ratios; no external placeholder image CDNs (inline SVG stubs instead).

## 4. Do / Don't

- DO bind these tokens to \`:root\` CSS custom properties before laying out.
- DO leave honest stubs (grey block, em dash, \`[METRIC]\`) when a value is unknown.
- DON'T use lorem ipsum or "Feature One / Feature Two" filler.
- DON'T invent metrics or social proof ("10× faster", "99.9% uptime", "trusted by 50,000 teams") unless the brief supplied them.`,
};
