#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — PDF Edition Template (typographic)
 *
 * Builds a print-paginated HTML document per publication, designed to be
 * rendered to PDF by generate-pdf-editions.cjs (Playwright page.pdf()).
 *
 * The layout follows the Anthropic editorial-piece language (cream paper,
 * oversized serif display type, one idea per page, generous margins, pull
 * quotes) rather than the multi-column newspaper layout of the HTML edition
 * artifact in edition-artifact.cjs. Markdown rendering is reused from that
 * module so both artifacts stay in sync; page furniture and the back page are
 * shared with the photo edition through pdf-shared.cjs.
 *
 * Page furniture (nameplate strip at the foot of every page) uses a fixed
 * element, which Chromium repeats on every printed page. Margins are managed
 * in CSS; the renderer must pass printBackground: true.
 */

const { renderMarkdown } = require('./edition-artifact.cjs');
const {
  INK,
  MUTED,
  escapeHtml,
  formatDate,
  editionLine,
  byline,
  kindInfo,
  BASE_STYLES,
  CONTENT_STYLES,
  BACKPAGE_STYLES,
  FONTS_HEAD,
  pagefootHtml,
  mastheadHtml,
  buildBackPage,
} = require('./pdf-shared.cjs');

// ─── Template-specific styles (cover page) ─────────────────────────────────

const STYLES = `
  /* ── Cover ── */
  .cover {
    min-height: 920px; /* ~Letter content height minus @page margins */
    padding: 0 68px 8px;
    display: flex;
    flex-direction: column;
  }

  .cover-body { margin-top: 132px; }
  .kicker {
    display: inline-block;
    margin: 0 0 26px;
    padding: 7px 14px 8px;
    border: 1px solid ${INK};
    font-family: 'Courier New', Courier, monospace;
    font-size: 11.5px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${INK};
  }
  .kicker .dot { color: var(--accent); margin-right: 8px; }
  h1.display {
    margin: 0;
    max-width: 11em;
    font-size: 62px;
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.015em;
  }
  .deck {
    margin: 30px 0 0;
    max-width: 30em;
    font-style: italic;
    font-size: 20px;
    line-height: 1.5;
  }
  .cover-meta { margin-top: 44px; }
  .byline, .dateline {
    margin: 0;
    font-variant-caps: small-caps;
    letter-spacing: 0.08em;
    font-size: 15px;
  }
  .dateline { margin-top: 5px; color: ${MUTED}; }
`;

// ─── HTML Assembly ──────────────────────────────────────────────────────────

function buildPdfEditionHtml(publication) {
  if (!publication || !publication.slug) {
    throw new Error('buildPdfEditionHtml: publication.slug is required');
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
    ? renderMarkdown(markdown)
    : `<p>${escapeHtml(publication.abstract || '')}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(`${publication.title || 'Untitled'} — ${series}`)}</title>
<meta name="generator" content="Allternit publications pipeline (PDF edition)">
${FONTS_HEAD}
<style>${BASE_STYLES}${STYLES}${CONTENT_STYLES}${BACKPAGE_STYLES}</style>
</head>
<body style="--accent: ${accent};">

${pagefootHtml(series, accent)}

<section class="cover page" style="--accent: ${accent};">
  ${mastheadHtml(series, edition)}

  <div class="cover-body">
    <p class="kicker"><span class="dot" aria-hidden="true">&#10035;</span>${escapeHtml(kicker)}</p>
    <h1 class="display">${escapeHtml(publication.title || 'Untitled')}</h1>
    ${publication.subtitle ? `<p class="deck">${escapeHtml(publication.subtitle)}</p>` : ''}
    <div class="cover-meta">
      ${meta ? `<p class="byline">${escapeHtml(meta)}</p>` : ''}
      ${datelineParts ? `<p class="dateline">${escapeHtml(datelineParts)}</p>` : ''}
    </div>
  </div>
</section>

<main class="content" style="--accent: ${accent};">
${body}
</main>

${buildBackPage(publication)}

</body>
</html>
`;
}

module.exports = { buildPdfEditionHtml };
