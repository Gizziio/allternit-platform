# Allternit Marketing System

How Allternit announces and markets products — modeled on the observed playbooks of
Anthropic, OpenAI, Qwen, Kimi (Moonshot), and Hermes (Nous Research), distilled to a
stack a small team can actually run.

## Brand marks

| Mark | File | Use |
|------|------|-----|
| Matrix (construct "A") | `surfaces/ai.allternit.com/public/brand/matrix/matrix-logo.svg` | The Allternit trademark glyph — our "asterisk". X avatar, blog hero, product UI. |
| Matrix mono | `.../brand/matrix/matrix-logo-mono.svg` | Single-color contexts (inherits `currentColor` when inlined). |
| A:// (protocol) | `.../brand/a-protocol/a-protocol.svg` | The protocol mark — our "A\". Pixel-construct A + block colon + staircase slashes, coral core. Docs, API references, protocol specs. |
| A:// mono | `.../brand/a-protocol/a-protocol-mono.svg` | Single-color contexts. |
| A://TERNIT (wordmark) | `.../brand/a-protocol/a-ternit-wordmark.svg` | Full naming lockup — the :// stands in for the "ll" of Allternit. The A:// mark and pixel TERNIT share one big-block grid, coral core in the A. Headers, splash screens, marketing hero. |
| A://TERNIT light / mono | `.../brand/a-protocol/a-ternit-wordmark-light.svg`, `...-mono.svg` | Dark surfaces / single-color contexts. |
| A://SUDO (wordmark) | `.../brand/a-protocol/a-sudo-wordmark.svg` | Sudo sub-brand lockup — same grid as A://TERNIT. |
| A://LABS (wordmark) | `.../brand/a-protocol/a-labs-wordmark.svg` | Labs sub-brand lockup — same grid as A://TERNIT. |
| Sub-brand light / mono | `.../brand/a-protocol/a-{sudo,labs}-wordmark-light.svg`, `...-mono.svg` | Dark surfaces / single-color contexts. |

Live marks: `surfaces/ai.allternit.com/src/components/AProtocolWordmark.tsx` is the
React expanding wordmark (Anthropic-style scroll collapse, `useScrollCollapse`
hook); `marketing/templates/scroll-logo.html` is the dependency-free version for
static sites. Office header (`office.allternit.com/src/HomePage.tsx`) and the app
loader (`ai.allternit.com/src/pages/HomePage.tsx`) already use it.

**One glyph rule** (from the labs): every surface uses the same mark identically.
Matrix = the company/product. A:// = the protocol/spec layer. Never invent a third mark.

### Tokens

| Token | Value | Use |
|-------|-------|-----|
| Cream | `#F0EEE6` | Light marketing surfaces (cards, posts) |
| Dark | `#0B0B0C` | Product/dark surfaces |
| Tan | `#D4B08C` | Primary mark color |
| Coral | `#D97757` | Accent — core block, `://`, key stats |
| Ink | `#141413` | Text on cream |

Type: serif display headline (Georgia fallback) + system sans body + JetBrains Mono
for code/specs. Restraint is the aesthetic — one mark, one accent color, generous
whitespace.

## The announcement anatomy

Every launch artifact (blog post, README, X post) follows the same skeleton, observed
across all five labs:

1. **Lede** — "Today we're introducing X" + one-line superlative. No exclamation marks.
2. **Hero stat or card** above the fold (render with `render-card.sh`).
3. **What it does** — 2–4 capability sections, concrete examples over adjectives.
4. **Benchmarks / proof** — table with footnoted methodology. Bold our wins; never
   claim a number we didn't measure.
5. **Proof by others** — user quotes, partner notes, community results.
6. **Values paragraph** — our positioning (local-first, open rails) stated inside the
   launch post, not in a separate manifesto.
7. **Availability** — where to get it, pricing/access in plain lines, links to docs.

Templates: `templates/announcement-post.md` (blog/README), `templates/x-launch.md`
(X-first post + optional thread), `templates/scroll-logo.html` (Anthropic-style
scroll header: full A://TERNIT wordmark at the top of the page, collapses to the
A:// mark on scroll — dependency-free SVG + CSS; React equivalent lives at
`surfaces/ai.allternit.com/src/components/AProtocolWordmark.tsx`).

## Channel hierarchy

1. **X post is the cannon-shot** — one post, one card or short clip, link out.
2. **Blog/README is the durable artifact** — the template above.
3. **Docs/repo links convert** — link to docs or code within the first paragraph.

## Cadence strategy

Two gears, run both:

- **Point releases every few weeks** (Qwen/Kimi style) — dated changelog entries,
  X-first, one stat each. Velocity is the marketing.
- **2–4 flagship moments per year** (OpenAI/Anthropic style) — full announcement post,
  social card set, short launch video.

## Short video recipe

Frontier labs use <2 min product-in-use clips. Ours:

1. **Screen recording** of the product doing one impressive thing (15–60s). One task,
   no cuts if possible — authenticity beats polish.
2. **End card** — render `templates/video-endcard.html` at 1920×1080, hold 2–3s.
3. Optional AI-generated b-roll via the local Seedance/Higgsfield pipeline for
   flagship launches only.
4. Publish on X with the announcement post; mirror to YouTube.

## Tools

- `render-card.sh <html> <out.png> [WxH]` — renders any template to PNG via headless
  Chrome. Templates are plain HTML with inline CSS; edit tokens at the top of each file.
