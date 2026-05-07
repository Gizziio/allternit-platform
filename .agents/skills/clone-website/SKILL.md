---
name: clone-website
description: "Reverse-engineers any public website and rebuilds it as a pixel-accurate React page using the Allternit design system. Extracts computed styles, design tokens, assets, and component boundaries via Playwright, then generates GlassCard/GlassSurface components mapped to allternit.tokens.ts."
tags: ["design", "ui-ux", "browser", "cloning", "allternit-design-system", "playwright"]
tools: ["llm", "filesystem", "browser", "bash"]
entrypoint: "SKILL.md"
---

# Clone Website Skill

Triggered by: `/clone-website <url>`

Reverse-engineers any public website and rebuilds it as a pixel-accurate React page
using the Allternit design system (GlassSurface, GlassCard, allternit.tokens.ts).

---

## Requirements

- Playwright installed: `node_modules/playwright` must exist at monorepo root
- Chromium browser: `npx playwright install chromium` if screenshots fail
- Output goes to `output/cloned/<slug>/` at monorepo root

---

## Step 0 — Parse URL and set up directories

1. Extract a slug from the URL. Rule: lowercase domain + first path segment, hyphens for dots/slashes.
   Examples:
   - `https://stripe.com/` → `stripe-com`
   - `https://linear.app/features` → `linear-app-features`
   - `https://vercel.com/home` → `vercel-com-home`

2. Set `OUTPUT` = `output/cloned/<slug>` (relative to monorepo root).

3. Create directory structure:
   ```
   mkdir -p output/cloned/<slug>/screenshots
   mkdir -p output/cloned/<slug>/specs
   mkdir -p output/cloned/<slug>/components
   mkdir -p output/cloned/<slug>/assets
   ```

---

## Phase 1 — Extract

Run the extraction script from the monorepo root:

```bash
node .agents/skills/clone-website/extract-styles.cjs <url> output/cloned/<slug>
```

This writes `output/cloned/<slug>/extracted.json` and three screenshots.

Read the extracted.json and print a summary:
- Page title and URL
- Number of components found
- Number of root CSS variables
- Top 5 colors by frequency
- Fonts detected (from fontFaces)

If the script fails (network error, timeout), tell the user and stop.

---

## Phase 2 — Token Map

Read `extracted.json`. Build a token mapping from the target site's design values to the
Allternit design system defined in `surfaces/allternit-platform/src/design/allternit.tokens.ts`.

### Color mapping rules

For each color in `colorFrequency` (top 20):

1. Parse the RGB value.
2. Find the closest match in the Allternit palette using perceptual distance:
   - Compare against SAND (50–950), NUDE (100–600), BACKGROUND (primary/secondary/tertiary/elevated),
     TEXT (primary/secondary/tertiary), BORDER (subtle/default/strong), STATUS (success/warning/error/info).
3. If distance < 30 (on 0–255 scale per channel): map to that token.
4. If no close match: keep the raw hex/rgb value as a one-off.

### Typography mapping rules

For each unique font-size value found in component computed styles:
- Match to nearest TYPOGRAPHY.size value: xs=11px, sm=13px, base=14px, md=15px, lg=16px, xl=18px, 2xl=20px, 3xl=24px.

For font-weight:
- 400 → TYPOGRAPHY.weight.normal
- 500 → TYPOGRAPHY.weight.medium
- 600 → TYPOGRAPHY.weight.semibold
- 700 → TYPOGRAPHY.weight.bold

### Spacing mapping rules

For padding/margin/gap values (px):
- 4px → SPACE[1]
- 8px → SPACE[2]
- 12px → SPACE[3]
- 16px → SPACE[4]
- 20px → SPACE[5]
- 24px → SPACE[6]
- 32px → SPACE[8]
- 40px → SPACE[10]
- 48px → SPACE[12]
- 64px → SPACE[16]
- Round to nearest step.

### Border-radius mapping

- ≤4px → RADIUS.xs
- ≤8px → RADIUS.sm
- ≤12px → RADIUS.md
- ≤16px → RADIUS.lg
- ≤20px → RADIUS.xl
- ≤24px → RADIUS['2xl']
- ≤28px → RADIUS['3xl']
- ≥9000px → RADIUS.full

Write the mapping to `output/cloned/<slug>/token-map.json`:
```json
{
  "colors": { "rgb(X,Y,Z)": "SAND[500]", ... },
  "fontSizes": { "18px": "TYPOGRAPHY.size.xl", ... },
  "spacing": { "16px": "SPACE[4]", ... },
  "radii": { "12px": "RADIUS.md", ... },
  "dominantBackground": "<hex>",
  "dominantText": "<hex>",
  "primaryAccent": "<hex>",
  "bodyFont": "<font-family string>"
}
```

---

## Phase 3 — Component Specs

For each entry in `extracted.json → components`:

1. Assign a PascalCase component name based on tagName + className/role:
   - `header` / `role=banner` → `SiteHeader`
   - `nav` / `role=navigation` → `SiteNav`
   - `[class*=hero]` → `HeroSection`
   - `main` / `role=main` → `PageMain`
   - `[class*=feature]` → `FeaturesSection`
   - `[class*=pricing]` → `PricingSection`
   - `[class*=testimonial]` → `TestimonialsSection`
   - `[class*=cta]` → `CtaSection`
   - `[class*=faq]` → `FaqSection`
   - `[class*=card]` → `ContentCard`
   - `footer` / `role=contentinfo` → `SiteFooter`
   - Fallback: `Section<index>`

2. Write `output/cloned/<slug>/specs/<ComponentName>.md`:

```markdown
# <ComponentName>

**Selector**: `<selector from extracted.json>`
**Tag**: `<tagName>`
**Viewport rect**: <x> <y> <width>×<height>

## Structure
<innerTextPreview — describes what content it holds>

## HTML Preview
```html
<htmlPreview>
```

## Key Styles (mapped to Allternit tokens)
| Property | Original | Allternit Token |
|---|---|---|
| background-color | <value> | <mapped token or hex> |
| color | <value> | <mapped token> |
| font-size | <value> | <mapped token> |
| padding | <value> | <mapped token> |
| border-radius | <value> | <mapped token> |
| box-shadow | <value> | keep as-is or SHADOW.md |

## Layout
- Display: <display value>
- Flex/Grid details if applicable

## Assets
List any image or font URLs referenced in this component's area.

## Interaction Notes
Based on the HTML structure, note any interactive elements (buttons, links, inputs, accordions).
```

After writing all spec files, list them:
```
Specs written:
- SiteHeader.md
- HeroSection.md
- ...
```

---

## Phase 4 — Build Components

For each spec file, generate a `.tsx` component at `output/cloned/<slug>/components/<ComponentName>.tsx`.

### Allternit design system rules — MUST follow:

**Imports always from:**
```tsx
import { SAND, BACKGROUND, TEXT, BORDER, SHADOW, GLASS, SPACE, RADIUS, TYPOGRAPHY, ANIMATION } from '@/design/allternit.tokens'
// or via relative path: '../../../surfaces/allternit-platform/src/design/allternit.tokens'
```

For standalone output use inline token values (no imports needed) since these components
will live in `output/cloned/<slug>/components/` outside the platform.

**Component template:**
```tsx
'use client';

import React from 'react';

// Token values inlined for portability
const tokens = {
  // paste relevant token values here from allternit.tokens.ts
};

interface <ComponentName>Props {
  className?: string;
}

export function <ComponentName>({ className }: <ComponentName>Props) {
  return (
    <section
      style={{
        background: tokens.background,
        color: tokens.text,
        padding: `${tokens.paddingV} ${tokens.paddingH}`,
        // ... mapped styles
      }}
      className={className}
    >
      {/* content */}
    </section>
  );
}
```

### Fidelity rules:

1. **Background**: match the dominant background color mapped in token-map.json.
2. **Typography**: use font-size, font-weight, line-height from computed styles, mapped to token values.
3. **Spacing**: use padding/gap values mapped to SPACE tokens.
4. **Borders**: match border-radius, border-color from computed styles.
5. **Glass surfaces**: if the original uses backdrop-filter/blur, use GLASS tokens.
6. **Shadows**: match box-shadow. Use SHADOW.md/lg/xl when close.
7. **Colors**: use mapped token for colors within 30-unit distance. Use exact hex for one-offs.
8. **Layout**: preserve display, flex-direction, align-items, justify-content, gap, grid-template-columns exactly.
9. **Content**: reconstruct text content from innerTextPreview. Use placeholder for long body text.
10. **Images**: reference assets from `../assets/`. Use an `<img>` with alt text if asset not downloaded.
11. **Responsive**: add a `@media (max-width: 768px)` block for key layout changes observed in tablet screenshot.

### After all components, generate the page assembly:

`output/cloned/<slug>/page.tsx`:
```tsx
'use client';

import React from 'react';
import { SiteHeader } from './components/SiteHeader';
import { HeroSection } from './components/HeroSection';
// ... all components

export default function ClonedPage() {
  return (
    <div style={{ background: '<dominantBackground from token-map.json>' }}>
      <SiteHeader />
      <HeroSection />
      {/* ... */}
    </div>
  );
}
```

Also generate `output/cloned/<slug>/preview.html` — a self-contained HTML file that approximates
the full page visually for quick screenshot comparison. Use inline CSS only. Reconstruct the
layout from the computed styles in extracted.json. This is what the QA phase will screenshot.

---

## Phase 5 — QA Diff

1. Report a list of all files generated:
   ```
   Generated:
     output/cloned/<slug>/components/SiteHeader.tsx
     output/cloned/<slug>/components/HeroSection.tsx
     ...
     output/cloned/<slug>/page.tsx
     output/cloned/<slug>/preview.html
   ```

2. Take a screenshot of the preview.html using the diff tool:
   ```bash
   node .agents/skills/clone-website/diff.cjs \
     output/cloned/<slug>/screenshots/original-desktop.png \
     "file://$(pwd)/output/cloned/<slug>/preview.html" \
     output/cloned/<slug>
   ```

3. Read both screenshot files (original-desktop.png and clone-desktop.png) visually.

4. Report a **Fidelity Assessment** in this format:
   ```
   ## Fidelity Assessment — <slug>

   | Section | Match | Issues |
   |---|---|---|
   | SiteHeader | 85% | Font size slightly larger, padding off |
   | HeroSection | 90% | Background gradient missing |
   | ... | ... | ... |

   **Overall: XX%**

   ### Top 3 patches needed:
   1. <component>: <specific fix>
   2. <component>: <specific fix>
   3. <component>: <specific fix>
   ```

5. Apply the top 3 patches inline — edit the component files directly.

6. Re-write the preview.html incorporating the patches.

7. Final output summary:
   ```
   Clone complete: output/cloned/<slug>/
   ├── extracted.json         — raw extraction data
   ├── token-map.json         — design token mapping
   ├── specs/                 — per-component spec files
   ├── components/            — React components (.tsx)
   ├── page.tsx               — assembled page
   ├── preview.html           — standalone preview
   └── screenshots/
       ├── original-desktop.png
       ├── original-tablet.png
       ├── original-mobile.png
       └── clone-desktop.png
   ```

---

## Error handling

- If extraction fails with a timeout: retry once with `{ waitUntil: 'domcontentloaded' }` by passing `--no-wait` flag manually.
- If a component selector matches 0 elements: skip it, don't create an empty spec.
- If an asset URL is relative: resolve against the page URL before recording it.
- If the page has infinite scroll or heavy JS rendering: note it in the assessment and clone the above-the-fold content only.

---

## Notes

- Do not copy or reproduce verbatim copyrighted text content (blog posts, marketing copy). Use placeholder text.
- Logos and brand marks: use `[Logo]` placeholder text. Do not reproduce trademarked imagery.
- This skill is for design reference, prototyping, and UI pattern extraction — not production deployment of cloned sites.
