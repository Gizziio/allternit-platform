#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — Photo Edition Template
 *
 * Builds the Anthropic-style photo edition: a print-paginated Letter document
 * with Codex-generated photography woven through it — photos interleaved in
 * the cover headline, a large-serif lede page, full-bleed photo pages, a
 * quote-over-photo page, and a two-up photo page — while the COMPLETE article
 * text flows through in order (one ## section per page, same body styles as
 * the typographic edition via pdf-shared.cjs).
 *
 * Rendered to editions/{slug}.photo.pdf by generate-photo-edition.cjs.
 * Photos arrive as local file paths and embed as file:// URLs at render time.
 * Every photo slot degrades gracefully: missing cover photos yield the
 * typographic cover, missing bleed/pair photos simply drop those pages.
 *
 * Unlike the typographic edition there is no fixed page foot — the reference
 * piece runs clean pages, and full-bleed photography would collide with a
 * repeating footer.
 */

const fs = require('fs');
const path = require('path');
const { renderMarkdown } = require('./edition-artifact.cjs');
const {
  escapeHtml,
  formatDate,
  editionLine,
  byline,
  kindInfo,
  BASE_STYLES,
  CONTENT_STYLES,
  BACKPAGE_STYLES,
  FONTS_HEAD,
  mastheadHtml,
  buildBackPage,
} = require('./pdf-shared.cjs');

// Photos embed as data URIs: the render uses page.setContent(), and Chromium
// blocks file:// subresources on a non-file document. Reading happens at
// build time, so a missing file just drops that photo (layout adapts).
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function dataUri(p) {
  try {
    const mime = MIME[path.extname(p).toLowerCase()] || 'image/png';
    return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
  } catch {
    return null;
  }
}

// Lede-page kickers per publication type (the reference's "MEET ELI" idiom).
const LEDE_KICKER = {
  signal: 'The Week',
  feature: 'The Story',
  blog: 'The Note',
};

// ─── Template-specific styles ───────────────────────────────────────────────

const STYLES = `
  /* Full-bleed pages opt out of the default page margins via a named page.
     The cream root background still covers any unpainted strip. */
  @page bleed { margin: 0; }

  /* ── Cover — headline collage with photos woven between segments ── */
  .cover {
    min-height: 920px; /* ~Letter content height minus @page margins */
    padding: 0 68px 8px;
    display: flex;
    flex-direction: column;
  }
  .cover-body { margin-top: 72px; }
  .capsule {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    margin: 0 0 34px;
    padding: 9px 18px 10px;
    background: #FFFFFF;
    border-radius: 999px;
    box-shadow: 0 2px 14px rgba(26, 26, 26, 0.12);
    font-size: 14px;
    letter-spacing: 0.02em;
  }
  .capsule .star { color: var(--accent); font-size: 16px; }
  .collage-row {
    display: flex;
    align-items: center;
    gap: 30px;
    margin: 14px 0;
  }
  h1.seg {
    margin: 0;
    font-size: 58px;
    font-weight: 700;
    line-height: 1.03;
    letter-spacing: -0.015em;
  }
  .ph { object-fit: cover; border-radius: 3px; display: block; }
  .ph-inset { width: 168px; height: 122px; flex: 0 0 auto; }
  .ph-hero { flex: 1 1 auto; min-width: 220px; height: 190px; }

  .cover-meta { margin-top: 48px; }
  .byline, .dateline {
    margin: 0;
    font-variant-caps: small-caps;
    letter-spacing: 0.08em;
    font-size: 15px;
  }
  .dateline { margin-top: 5px; color: #6B6B6B; }

  .cover-foot {
    margin-top: auto;
    text-align: right;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #1A1A1A;
  }

  /* ── Lede page — kicker over one large-serif paragraph ── */
  .lede-page { padding: 0 68px; }
  .lede-kicker {
    margin: 0 0 26px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .lede {
    margin: 0;
    max-width: 24em;
    font-size: 29px;
    line-height: 1.45;
  }
  .lede-meta {
    margin-top: 42px;
    font-variant-caps: small-caps;
    letter-spacing: 0.08em;
    font-size: 15px;
    color: #6B6B6B;
  }

  /* ── Full-bleed photo page with quote overlay ── */
  .bleed {
    page: bleed;
    break-after: page;
    position: relative;
    width: 816px;  /* Letter at 96dpi */
    height: 1056px;
    overflow: hidden;
  }
  .bleed img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .bleed .overlay {
    position: absolute;
    left: 56px;
    right: 56px;
    bottom: 64px;
    color: #FFFFFF;
  }
  .bleed .overlay .q {
    margin: 0;
    font-size: 30px;
    line-height: 1.38;
    text-shadow: 0 2px 26px rgba(0, 0, 0, 0.6);
  }
  .bleed .overlay .attr {
    margin: 16px 0 0;
    font-size: 14px;
    font-variant-caps: small-caps;
    letter-spacing: 0.08em;
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.6);
  }

  /* ── Two-up photo page ── */
  .pair {
    page: bleed;
    break-after: page;
    width: 816px;
    height: 1056px;
    display: flex;
    flex-direction: column;
  }
  .pair img {
    width: 100%;
    height: 50%;
    object-fit: cover;
    display: block;
  }

  /* ── Per-story harvested photos — float beside their item, with credit ── */
  .story-photo {
    float: right;
    width: 38%;
    margin: 2px 0 14px 20px;
  }
  .story-photo img {
    width: 100%;
    aspect-ratio: 4 / 3; /* uniform frame — sources arrive in mixed shapes */
    object-fit: contain; /* never crop: repo cards and diagrams stay legible */
    object-position: center;
    background: rgba(26, 26, 26, 0.05); /* mat fill around letterboxed art */
    display: block;
    border-radius: 3px;
  }
  .story-photo figcaption {
    margin-top: 6px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6B6B6B;
  }
  /* keep each story's floated photo inside its own list item, and never
     split an item across pages — the photo must stay beside its story */
  .content li { break-inside: avoid; }
  .content li::after { content: ''; display: block; clear: both; }
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

// Split a title into up to `n` balanced word segments so photos can be woven
// between headline line-groups, like the reference cover.
function splitTitle(title, n = 3) {
  const words = String(title || '').split(/\s+/).filter(Boolean);
  if (words.length <= 3) return [words.join(' ')];
  const per = Math.ceil(words.length / n);
  const segs = [];
  for (let i = 0; i < words.length; i += per) {
    segs.push(words.slice(i, i + per).join(' '));
  }
  return segs;
}

// First blockquote in the markdown, flattened to plain text for the overlay.
function firstQuote(markdown) {
  const m = String(markdown || '').match(/^(?:>\s?.+(?:\n|$))+/m);
  if (!m) return null;
  const text = m[0]
    .split('\n')
    .map((l) => l.replace(/^>\s?/, ''))
    .join(' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
  if (text.length < 40) return null;
  return text.length > 280 ? `${text.slice(0, 277).trimEnd()}…` : text;
}

// Split the rendered body HTML at each top-level <h2 so photo pages can be
// inserted between whole sections without disturbing the text order.
function splitSections(bodyHtml) {
  const parts = bodyHtml.split(/(?=<h2[ >])/);
  return parts.filter((p) => p.trim());
}

// Per-section, the first list item whose link href matches a harvested
// source image gets that photo as a right-floating figure with a credit
// line — the photo of the thing the story is about, next to the story.
function injectStoryPhotos(bodyHtml, storyImages, dataUriFor) {
  if (!storyImages || !storyImages.length) return bodyHtml;
  const byUrl = new Map(storyImages.map((s) => [s.sourceUrl, s]));

  const sections = bodyHtml.split(/(?=<h2[ >])/).filter((p) => p.trim());
  return sections
    .map((section) => {
      let used = false;
      return section.replace(/<li>[\s\S]*?<\/li>/g, (li) => {
        if (used) return li;
        const hrefs = [...li.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
        for (const href of hrefs) {
          const hit = byUrl.get(href);
          if (!hit) continue;
          const src = dataUriFor(hit.file);
          if (!src) continue;
          used = true;
          return li.replace(
            '<li>',
            `<li><figure class="story-photo"><img src="${src}" alt="">` +
              `<figcaption>photo: ${escapeHtml(hit.host)}</figcaption></figure>`,
          );
        }
        return li;
      });
    })
    .join('\n');
}

// ─── HTML Assembly ──────────────────────────────────────────────────────────
// photos: { coverHero, coverInsetA, coverInsetB, bleedQuote, pairA, pairB } —
// absolute file paths; any may be null/undefined.

function buildPhotoEditionHtml(publication, photos = {}, storyImages = []) {
  if (!publication || !publication.slug) {
    throw new Error('buildPhotoEditionHtml: publication.slug is required');
  }
  const { kind, accent, series, kicker } = kindInfo(publication);

  const edition = editionLine(publication);
  const date = formatDate(publication.publishedAt || publication.createdAt);
  const meta = byline(publication);
  const readingTime = publication.readingTime
    ? `${publication.readingTime} min read`
    : '';
  const datelineParts = [date, readingTime].filter(Boolean).join(' · ');

  const markdown = publication.content && publication.content.markdown;
  const body = markdown
    ? injectStoryPhotos(renderMarkdown(markdown), storyImages, dataUri)
    : `<p>${escapeHtml(publication.abstract || '')}</p>`;

  // ── Cover collage: headline segments interleaved with the cover photos.
  const segs = splitTitle(publication.title || 'Untitled');
  const seg = (i) =>
    segs[i] ? `<h1 class="seg">${escapeHtml(segs[i])}</h1>` : '';
  const img = (p, cls) => {
    const src = p && dataUri(p);
    return src
      ? `<img class="ph ${cls}" src="${src}" alt="">`
      : '';
  };

  const coverRows = [];
  coverRows.push(
    `<div class="collage-row">${seg(0)}${img(photos.coverInsetA, 'ph-inset')}</div>`,
  );
  if (segs.length > 1) {
    coverRows.push(
      `<div class="collage-row">${seg(1)}${img(photos.coverHero, 'ph-hero')}</div>`,
    );
  } else {
    coverRows.push(
      `<div class="collage-row">${img(photos.coverHero, 'ph-hero')}</div>`,
    );
  }
  if (segs.length > 2) {
    coverRows.push(
      `<div class="collage-row">${img(photos.coverInsetB, 'ph-inset')}${seg(2)}</div>`,
    );
    for (let i = 3; i < segs.length; i += 1) {
      coverRows.push(`<div class="collage-row">${seg(i)}</div>`);
    }
  } else {
    coverRows.push(
      `<div class="collage-row">${img(photos.coverInsetB, 'ph-inset')}</div>`,
    );
  }

  // ── Body sections with photo pages interleaved.
  const sections = splitSections(body);
  const quote = firstQuote(markdown);
  const attribution = meta || series;

  const bleedPage = photos.bleedQuote
    ? `<section class="bleed">
  ${img(photos.bleedQuote, '')}
  ${
    quote
      ? `<div class="overlay">
    <p class="q">&#8220;${escapeHtml(quote)}&#8221;</p>
    <p class="attr">${escapeHtml(attribution)}</p>
  </div>`
      : ''
  }
</section>`
    : '';

  const pairPage =
    photos.pairA || photos.pairB
      ? `<section class="pair">
  ${img(photos.pairA, '')}
  ${img(photos.pairB, '')}
</section>`
      : '';

  const bleedAfter = Math.min(1, sections.length);
  const pairAfter = Math.max(bleedAfter, Math.ceil(sections.length / 2));

  const flow = [];
  sections.forEach((html, i) => {
    flow.push(`<main class="content" style="--accent: ${accent};">\n${html}\n</main>`);
    if (i + 1 === bleedAfter && bleedPage) flow.push(bleedPage);
    if (i + 1 === pairAfter && pairPage) flow.push(pairPage);
  });

  const lede = publication.abstract || publication.subtitle || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(`${publication.title || 'Untitled'} — ${series} (photo edition)`)}</title>
<meta name="generator" content="Allternit publications pipeline (photo edition)">
${FONTS_HEAD}
<style>${BASE_STYLES}${STYLES}${CONTENT_STYLES}${BACKPAGE_STYLES}</style>
</head>
<body style="--accent: ${accent};">

<section class="cover page" style="--accent: ${accent};">
  ${mastheadHtml(series, edition)}

  <div class="cover-body">
    <p class="capsule"><span class="star" aria-hidden="true">&#10035;</span>${escapeHtml(kicker)}</p>
    ${coverRows.join('\n    ')}
    <div class="cover-meta">
      ${meta ? `<p class="byline">${escapeHtml(meta)}</p>` : ''}
      ${datelineParts ? `<p class="dateline">${escapeHtml(datelineParts)}</p>` : ''}
    </div>
  </div>

  <div class="cover-foot">ai.allternit.com &middot; ${escapeHtml(edition)}</div>
</section>

${
  lede
    ? `<section class="lede-page page" style="--accent: ${accent};">
  <p class="lede-kicker">${escapeHtml(LEDE_KICKER[kind] || LEDE_KICKER.blog)}</p>
  <p class="lede">${escapeHtml(lede)}</p>
  ${datelineParts ? `<p class="lede-meta">${escapeHtml(datelineParts)}</p>` : ''}
</section>`
    : ''
}

${flow.join('\n\n')}

${buildBackPage(publication)}

</body>
</html>
`;
}

module.exports = { buildPhotoEditionHtml };
