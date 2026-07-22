# Publications V2 implementation map

## Objective

Upgrade Allternit News, A://SUDO Reality, and the Builders Blog from primarily
text publications with one SVG cover into editorial products with deeper
articles, structured visual media, video-aware rendering, pull quotes,
explainers, and graceful website/email/PDF fallbacks.

## Product decisions (fixed)

1. Use a mixed-media model: original/code-native Allternit art, explicit media
   supplied by cited sources, diagrams/charts, and allowlisted video embeds.
2. Never scrape or republish arbitrary images. Source media is eligible only
   when input provenance already supplies an explicit media URL and source URL.
3. Every visual requires alt text, caption, credit, and source URL except
   original Allternit-generated diagrams, whose credit is `Allternit`.
4. Video embeds are limited to YouTube and Vimeo. Email/PDF use a linked poster
   or text card, never an iframe.
5. Existing publication JSON remains backward compatible. `media` and
   `editorial` are optional.
6. Existing CLI department headings and publication routes remain stable.
7. Never invent a quote, statistic, image credit, or source.
8. Establish a polished reference edition before fully automating original
   raster-image generation.

## Target editorial depth

| Publication | Target length | Typical visuals |
| --- | --- | --- |
| Allternit News | 1,800–2,600 words | 4–6 mixed visuals |
| A://SUDO Reality | 3,200–4,800 words | 6–10 mixed visuals |
| Builders Blog | 1,200–2,000 words | 3–6 screenshots/diagrams |

## Shared data model

Optional publication fields:

```ts
type PublicationMedia = {
  id: string;
  type: 'image' | 'video' | 'chart' | 'diagram';
  url: string;
  embedUrl?: string;
  posterUrl?: string;
  alt: string;
  caption: string;
  credit: string;
  sourceUrl?: string;
  placement: 'hero' | 'wide' | 'inline' | 'sidebar';
  section?: string;
};

type PublicationEditorial = {
  dek?: string;
  keyPoints?: string[];
  pullQuotes?: Array<{ text: string; attribution?: string; sourceUrl?: string }>;
  visualBriefs?: Array<{
    id: string;
    kind: 'illustration' | 'chart' | 'diagram' | 'timeline';
    title: string;
    purpose: string;
    prompt: string;
    dataSourceUrls?: string[];
  }>;
};
```

## Phases

### Phase 1 — platform foundation

- Add media normalization and source-media selection utilities.
- Increase generator depth and editorial requirements.
- Add optional `media` and `editorial` output.
- Teach standalone artifacts to render rich media safely.
- Teach email output to use image/video fallbacks safely.
- Preserve existing publication output when optional fields are absent.

### Phase 2 — allternit.com rendering

- Extend website publication types and discovery-feed mapping.
- Add reusable editorial media, gallery, video, pull-quote, key-point, and
  explainer components.
- Integrate them into article and edition pages.
- Ensure responsive, accessible, print-safe behavior.

### Phase 3 — reference edition

- Upgrade `weekly-news-2026-w29` into the gold-standard reference edition.
- Create original code-native diagrams/charts where the article supports them.
- Add only rights-safe/source-explicit external media.
- Add captions, credits, and email/PDF fallbacks.

### Phase 4 — automation and polish

- Encode reference-edition rules into weekly generation.
- Add media completeness and attribution validation.
- Add per-publication editorial checks and documentation.
- Update Publications Operations docs and changelog.

## Repositories

Platform/pipeline:

```text
/Users/macbook/Desktop/allternit-workspace/allternit
```

Website:

```text
/Users/macbook/Desktop/allternit-websites/projects/www.allternit.com/source
```

## Global constraints

- No builds, typechecks, dev servers, commits, pushes, deployments, or sends.
- Do not touch unrelated dirty-worktree files.
- Match existing CommonJS/TypeScript/React idioms.
- Do not add dependencies in the foundation phases.
- Do not place secrets or subscriber data in source or notes.

