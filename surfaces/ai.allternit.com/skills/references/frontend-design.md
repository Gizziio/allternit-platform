# Frontend design taste (vendored reference)

> **Source:** Anthropic `frontend-design` skill, from https://github.com/anthropics/skills
> (`skills/frontend-design/SKILL.md`, fetched 2026-09-11).
> **License:** Apache-2.0 (see upstream `skills/frontend-design/LICENSE.txt`).
> **Status:** Vendored and ADAPTED for Allternit Studio steering. This is a steering
> reference consumed by `src/lib/design/studio-system-prompt.ts` — it is deliberately NOT
> a bundled creation skill. Adaptation deltas from upstream are marked "ADAPTED".

This document is the base of the studio steering layer's design taste. The composed
system prompt carries a condensed version of these rules; this file is the full reference.

## Ground the design in the subject matter

If the brief does not identify the product or subject, identify it before designing and
confirm with the user. One concrete subject, one audience, one primary job. The subject's
industry, materials, and vernacular are where distinctive visual choices come from. Build
with the brief's real content throughout — never filler.

## Process: plan tokens before code

Work in two passes:

1. **Plan.** Before any code, write a compact token system: 4–6 named palette values, the
   typefaces and their roles, a one-sentence layout concept with alignment guidance, and
   the one principle that makes this design specific to this brief. Bind the tokens to
   `:root` CSS custom properties before writing any layout.
2. **Review against the brief.** If any part of the plan reads like the generic default you
   would produce for any similar page, revise that part and say what changed and why. Only
   then write code, following the revised plan.

## Design principles

- The hero is the first thing viewers see. Open with the most characteristic thing in the
  subject's world, in the form most appropriate to it. A big number with a small label and a
  gradient accent is the default treatment — use it only if it is truly the best option.
- Typography carries the personality. Use one family or two clearly distinct ones. Set a
  deliberate type scale; resist intermediate sizes. Use the type treatment itself as an
  active part of the design, not a neutral delivery vehicle.
- Default to line lengths under 80 characters; serif body gets slightly more line-height.
- Avoid the commonest generated-page tells: a single accented word in a headline, ALL-CAPS
  labels, decorative eyebrow labels above every heading, numbered markers on content that
  is not actually a sequence, middle-dot meta strings, a `→` appended to every link.
- Visual structure is information. Borders, dividers, labels, and numbering encode meaning;
  they are not decoration.
- Use non-user-triggered motion sparingly — one orchestrated moment lands better than
  fade-and-slide-up on every section. Motion that answers a person's action is welcome
  when it shows what changed.
- Copy is design content, not decoration. Write from the end user's perspective, in plain
  language, active voice, sentence case. A CTA says exactly what happens ("Save changes",
  not "Submit"). Errors explain what happened and how to fix it; an empty screen invites
  action. No hype, no filler — Allternit Register 1 (ADAPTED: upstream's "conversational"
  register mapped to our plain/direct voice).
- Spend boldness in one place. Let one element be the memorable thing; cut decoration that
  does not serve the brief. Responsive down to mobile, visible keyboard focus, reduced
  motion respected, accessible contrast — this is the floor, not the flourish.

## Allternit brand law (ADAPTED — replaces upstream's brand-specific bans)

- **Palette:** ivory/graphite surfaces with the amber accent family — `#B08D6E` (primary),
  `#C4A684` (hover/light), `#9A7658` (muted). One accent, used at most twice per screen.
- **Deny-list (P0, enforced by `src/lib/design/html-linter.ts`):** the legacy coral family
  (`#D97757` / `#E27C59` — reserved for Allternit platform UI, not generated artifacts) and
  all purple/indigo/violet families, as raw hex, Tailwind class, or gradient. Cliché
  purple→blue "trust gradients" are banned the same way. Upstream bans purple and flags
  terracotta near `#D97757` as an AI tell — for us the amber family is brand law, but the
  coral hexes above are still P0 (ADAPTED).
- **Typography:** ADAPTED — upstream bans Inter as a default; we port the intent (no
  unconsidered default typography) instead. "Allternit Sans" is our sans voice with Inter
  acceptable ONLY as the local fallback alias; "Allternit Serif" = Newsreader stack;
  "Allternit Mono" = JetBrains Mono stack. Never let body and display be the same family
  without an explicit decision.
- **Icons:** inline SVG with `currentColor` only. Never emoji as icons or feature glyphs.
- **Contrast:** body text ≥ 4.5:1 against its background; large text ≥ 3:1. Verify with
  OKLch lightness difference, not eyeballing.
- **No invented content:** no lorem ipsum, no "Feature One", no unsourced metrics
  ("10× faster", "99.9% uptime"). Leave honest labelled stubs like `[METRIC]`.
- No gradient on every background — at most one decisive gradient per design. No
  template-chrome defaults: three equal columns, identical rounded cards with the same
  soft shadow, tinted near-black standing in for black.

## CSS discipline

Watch selector specificity — generated CSS classes often cancel each other out (a
`.section` type selector vs an element selector on `.cta`), especially padding/margin
between sections. Bind tokens to `:root` custom properties and let components reference
them; do not re-hardcode values per component.

## Self-critique

Critique the work as you build. Before emitting an artifact, score it silently: does the
visual posture match the brief, does the eye land in one obvious place, is every word
specific to this brief, is there exactly one decisive flourish? Any weak dimension is a
regression — fix the weakest and re-check. Before leaving the house, remove one accessory.
