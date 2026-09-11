# A:// Studio Skill Catalog

Skills are the unit of work in A:// Studio design mode (surfaces/ai.allternit.com). Each skill is a folder under `surfaces/ai.allternit.com/skills/<id>-skill/` containing a `SKILL.md` — YAML frontmatter plus a numbered Workflow body. The studio imports each `SKILL.md` as a raw string (`src/lib/design/bundled-skills.ts`), parses it (`src/lib/design/skill-registry.ts`), and the agent executes the Workflow to produce a single-file HTML artifact.

## First-party catalog

| Skill id | Gallery category | What it produces |
|---|---|---|
| `saas-landing` | landing-pages | Single-page SaaS landing with hero, features, social proof, pricing, CTA |
| `dashboard` | dashboards | Data-dense admin/analytics dashboard with KPI cards, charts, tables |
| `magazine-deck` | decks | Magazine-style horizontal-swipe web deck (the editorial deck option) |
| `design-system-from-brief` | brand-systems | A reusable 9-section DESIGN.md codified from a brand brief |
| `mobile-app` | mobile | Multi-screen mobile app prototype with device frame and tap-through flows |
| `poster` | posters | Bold single-focus poster, print (A3) or social (4:5) |
| `infographic` | infographics | Long-scroll vertical data story, sectioned, charts as inline SVG |
| `social-creative` | social | Brand-safe social post with the hook in the first 20% of the canvas |
| `product-launch` | product | Interactive product reveal one-pager: hero, benefits, spec strip, CTA |
| `edu-visual` | education | Annotated SVG diagram or numbered step sequence teaching one concept |
| `scientific-figure` | science | Paper-ready figure with labeled axes, units, legend, honest scales |
| `generative-art` | art | Seeded generative canvas/SVG piece, amber-legal palette, self-contained |
| `pitch-deck` | decks | 16:9 business pitch deck: problem → stakes → solution → proof → ask |
| `email-newsletter` | email | 600px table-based HTML email, inline styles, dark-mode-tolerant |
| `personal-site` | personal | Portfolio/resume one-pager: name-first hero, work, timeline, contact |

Four vendored open-design example plugins (`docs-page`, `blog-post`, `data-report`, `html-ppt-zhangzara-cartesian`) also ship as bundled skills under `plugins/examples/`. The gallery mapping for all bundled skills lives in `src/lib/design/gallery-categories.ts`.

## The SKILL.md contract

Frontmatter shape, annotated:

```markdown
---
name: poster                    # stable id; matches the folder name minus -skill
description: |                  # block scalar, one or two plain sentences
  Produce a bold single-focus poster as a self-contained HTML canvas.
triggers:                       # ≥3 specific phrases that match a user request
  - "poster"
  - "event poster"
  - "print poster"
od:                             # studio-specific UI hints
  mode: prototype               # prototype | deck | template | design-system | image | video | audio | utility
  scenario: design              # design | marketing | operation | engineering | product | finance | hr | sale | personal
  preview:
    type: html                  # html | jsx | pptx | markdown
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout]
  craft:
    requires: [typography, color, anti-ai-slop]
  inputs:                       # 3–6 typed params rendered as a form
    - name: headline
      type: string              # string | integer | boolean | enum | text
      required: true
      label: Headline
  example_prompt: "Create a poster for my event."
---
```

After the frontmatter comes the Workflow body: 10–15 numbered steps in the house pattern — read the active DESIGN.md, plan from the brief, build a single-file HTML artifact with all CSS inlined, write real specific copy, run the amber-law and anti-slop self-check, pass the html-linter P0 gate, emit a single `<artifact>`.

Note: `od.inputs` list items are currently flattened by the minimal YAML parser in `skill-registry.ts`, so parsed `inputs` come back empty at runtime. The frontmatter contract above is still the source of truth — keep authoring inputs in this shape; a parser fix is tracked separately.

## Quality bar

The filter for gallery featuring is the html-linter P0 gate (`src/lib/design/html-linter.ts`). The studio runs the linter on artifacts, and P0 findings block saving. P0 rules:

- No purple/violet/indigo/fuchsia accents or Tailwind purple defaults (`no-purple-accent`)
- No legacy coral (`no-legacy-coral`)
- No cliché purple→blue "trust gradients"
- No emoji used as icons (`no-emoji-icons`) — inline SVG only
- No lorem ipsum or filler copy (`no-lorem`, `no-filler-features`)
- No invented metrics or social proof (`no-invented-metrics`) — "trusted by 50,000 teams", "10× faster", "99.9% uptime"
- No external placeholder image CDNs

A skill body must instruct the agent to read the active DESIGN.md and to pass this gate before emitting the artifact.

## How to add a new skill

1. Create `skills/<id>-skill/SKILL.md` following the contract above and the house Workflow pattern. Mirror `saas-landing-skill/SKILL.md`.
2. Register it in `src/lib/design/bundled-skills.ts`: add the `?raw` import and a `{ id, source, assets: [] }` entry in `RAW_SKILLS` (use `assets: ['assets/base.html']` only if the skill ships an asset file).
3. Add the gallery mapping in `src/lib/design/gallery-categories.ts` (`category`, `label`, `kimiCategory`).
4. Extend `src/lib/design/bundled-skills.test.ts` if the new skill adds a contract case; the existing tests enforce id uniqueness and exact gallery coverage, so an unwired or unmapped skill fails the suite.
5. Run `pnpm typecheck` and `pnpm vitest run src/lib/design` in `surfaces/ai.allternit.com`.

## Amber law (DESIGN.md v2.1)

- Amber `#B08D6E` is the only accent. Family: `#C4A684` (hover), `#9A7658` (muted).
- No purple, violet, or indigo anywhere. Legacy coral is deprecated (see DESIGN.md v2.1).
- Typography aliases: Allternit Sans (Inter fallback), Serif (Newsreader), Mono (JetBrains Mono).
- SVG icons only — never emoji.
- Contrast ≥ 4.5:1 for text.
- No lorem ipsum, no invented metrics, no fabricated testimonials.

Prefer referencing DESIGN.md tokens over hardcoding hex values — even amber ones — in skill prose and generated artifacts.
