---
phase: 1
title: Publications V2 platform foundation
executor: claude
---

# Task

Implement Phase 1 from `docs/PUBLICATIONS_V2_MAP.md`. Do not begin Phase 2 or
edit the `allternit-websites` repository.

## Required files and scope

You may change only these paths:

```text
.github/scripts/generate-briefing.cjs
.github/scripts/generate-feature.cjs
.github/scripts/generate-blog.cjs
.github/scripts/lib/editorial-media.cjs            (new)
.github/scripts/lib/edition-artifact.cjs
.github/scripts/lib/newsletter.cjs
.github/scripts/lib/editorial-media.test.cjs       (new, optional)
docs/PUBLICATIONS_V2_PHASE_1_NOTES.md               (sentinel)
```

Do not edit generated publication JSON, existing artifacts, covers, workflows,
package files, lockfiles, or any other path.

## Required implementation

### 1. Editorial media utility

Create `.github/scripts/lib/editorial-media.cjs` with dependency-free helpers:

- `normalizeMedia(media)` returns validated, deduplicated records.
- `selectSourceMedia(sources, options)` selects only explicit source-provided
  media. Inspect actual source shapes before coding and tolerate missing data.
- `normalizeVideoUrl(url)` accepts only YouTube/youtu.be/Vimeo and returns a
  safe canonical embed URL plus canonical watch/source URL, or null.
- Reject non-HTTP(S), data, javascript, arbitrary iframe, and malformed URLs.
- Require non-empty `alt`, `caption`, and `credit` for retained media.
- Preserve only the fixed field set in `PUBLICATIONS_V2_MAP.md`.
- Deduplicate by canonical URL.
- Never fetch, scrape, download, or infer licensing.

If source records do not include sufficient caption/credit/alt metadata, skip
them. Correct empty media is better than unattributed media.

### 2. Generator editorial depth

Update the three prompt builders while preserving their required existing
headings and factual/sourcing rules.

Targets:

- News: 1,800–2,600 words. Lead package, context, implications, named evidence,
  concise department items, an `At a glance` block, and explicit `Why it
  matters` analysis. No padding.
- Reality: 3,200–4,800 words. Strong thesis, technical mechanism, evidence and
  counterargument, production case study, implications, uncertainties, and
  the existing weekly departments.
- Blog: 1,200–2,000 words. Explain the problem, constraints, decisions,
  implementation, tradeoffs, evidence/screenshots available in inputs, and
  lessons. Do not fabricate implementation details.

Prompts must request useful pull-quote candidates and visual opportunities but
must not invent quotations or media.

### 3. Publication fields

Each generator must add optional, backward-compatible fields:

- `media`: from `selectSourceMedia(...)`, normalized before persistence.
- `editorial`: at minimum `keyPoints`, `pullQuotes`, and `visualBriefs` when the
  metadata response provides valid values.

Extend metadata prompts to request those fields in JSON. Parsing must be
defensive: malformed/missing new fields produce empty arrays, not a failed
publication. Pull quotes must be direct excerpts from the generated article,
not invented external quotations. Visual briefs describe future original art;
they are not rendered as if assets already exist.

For the blog, source media may be empty because git history has no explicit
media metadata. Preserve that honest result.

### 4. Standalone artifact rendering

Update `edition-artifact.cjs` so optional media renders accessibly and safely:

- Hero image before the article body when present.
- Wide/inline image, chart, or diagram sections with `<figure>`, escaped alt,
  caption, credit, and optional source link.
- YouTube/Vimeo videos as responsive iframe embeds with fixed allowlist,
  `loading="lazy"`, descriptive title, and restrictive `allow` attributes.
- Print CSS hides iframes and prints a linked video fallback card.
- No raw media HTML from publication data.
- No visual-brief placeholders pretending to be completed media.
- Existing publications with no `media` render exactly as before apart from
  harmless shared CSS additions.

Use a deterministic placement rule rather than parsing arbitrary insertion
directives: hero first, then grouped non-hero media in an editorial media
section before sources/end matter.

### 5. Newsletter rendering

Update `newsletter.cjs` with email-safe fallbacks:

- Optional hero image with escaped URL/alt/caption/credit.
- Up to three non-hero media cards.
- Images use normal `<img>` elements with constrained inline styles.
- Videos use poster images when available; otherwise a styled linked text card.
- Never use iframe/video tags in email.
- Existing emails with no `media` retain current output.

### 6. Tests/syntax

You may add a dependency-free Node assertion file for the media utility. Do not
run it. Do not run builds, typechecks, tests, linters, formatters, dev servers,
or package installs. The orchestrator will run syntax-only review gates.

## Constraints

- No git operations.
- No network calls.
- No generated artifacts or publication data changes.
- No dependencies.
- No product decisions beyond this spec.
- Preserve current exports and behavior for callers without new fields.
- Escape every untrusted string placed into HTML.
- Keep implementation reviewable; avoid unrelated refactors.

## Completion sentinel

When finished, write `docs/PUBLICATIONS_V2_PHASE_1_NOTES.md`. The file must
start with YAML frontmatter exactly shaped like:

```yaml
---
status: done|blocked
files_changed:
  - path
deviations:
  - description
remaining:
  - description
---
```

Then include concise prose describing implementation and any risks. The notes
file existing is the only completion signal. Do not start Phase 2.

