#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — PDF Edition Template
 *
 * Builds a print-paginated HTML document per publication, designed to be
 * rendered to PDF by generate-pdf-editions.cjs (Playwright page.pdf()).
 *
 * The layout follows the Anthropic editorial-piece language (cream paper,
 * oversized serif display type, one idea per page, generous margins, pull
 * quotes) rather than the multi-column newspaper layout of the HTML edition
 * artifact in edition-artifact.cjs. Markdown rendering is reused from that
 * module so both artifacts stay in sync.
 *
 * Page furniture (nameplate strip at the foot of every page) uses a fixed
 * element, which Chromium repeats on every printed page. All margins are
 * managed in CSS (@page margin: 0) so the cream background runs to the
 * paper edge; the renderer must pass printBackground: true.
 */

const { renderMarkdown } = require('./edition-artifact.cjs');

// ─── Configuration (keep in sync with edition-artifact.cjs) ────────────────

const INK = '#1A1A1A';
const CREAM = '#F5F3EF';
const MUTED = '#6B6B6B';

// One accent per publication type (mirrors cover.cjs / edition-artifact.cjs).
const ACCENT = {
  signal: '#E07A5F', // Allternit News — coral
  feature: '#4F46E5', // A://SUDO Reality — indigo
  blog: '#059669', // Allternit Blog — emerald
};

const NAMEPLATE = {
  signal: 'Allternit News',
  feature: 'A://SUDO Reality',
  blog: 'Allternit Blog',
};

const KICKER = {
  signal: 'Intelligence Dispatch',
  feature: 'Cover Story',
  blog: "Builder's Notebook",
};

const CANONICAL = {
  signal: 'https://allternit.com/news',
  feature: 'https://allternit.com/features',
  blog: 'https://allternit.com/blog',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Text Helpers ───────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  const d = new Date(iso || '');
  if (isNaN(d)) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function byline(publication) {
  const authors = Array.isArray(publication.authors) ? publication.authors : [];
  const teams = Array.isArray(publication.teams) ? publication.teams : [];
  let line = authors.length ? `By ${authors.join(', ')}` : '';
  if (teams.length) line += `${line ? ' · ' : ''}${teams.join(', ')} desk`;
  return line;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────
// Letter pages with zero @page margin; each page pads itself. A fixed footer
// strip repeats on every page. Type scale is tuned for paper, not screens.

const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  /* Top margin clears continuation pages from the paper edge; the bottom
     margin reserves the strip where the fixed page foot sits. The root
     background propagates to the whole page box, so the cream stays
     full-bleed even with margins. */
  @page { size: Letter; margin: 56px 0 60px; }
  html, body { margin: 0; padding: 0; }
  body {
    background: ${CREAM};
    color: ${INK};
    font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
    font-size: 15.5px;
    line-height: 1.75;
  }

  /* Repeating page foot — fixed elements print on every page, positioned
     within the page content area just above the bottom margin. */
  .pagefoot {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 0 68px 22px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 9.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${MUTED};
  }
  .pagefoot .tick {
    width: 8px;
    height: 8px;
    background: var(--accent);
    transform: translateY(0.5px);
  }
  .pagefoot .right { margin-left: auto; }

  .page { break-after: page; }

  /* ── Cover ── */
  .cover {
    min-height: 920px; /* ~Letter content height minus @page margins */
    padding: 0 68px 8px;
    display: flex;
    flex-direction: column;
  }
  .masthead-row {
    display: flex;
    align-items: baseline;
    gap: 14px;
  }
  .masthead-tick {
    width: 12px;
    height: 12px;
    background: var(--accent);
    transform: translateY(1px);
  }
  .nameplate {
    font-weight: 700;
    font-size: 21px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .edition-line {
    margin-left: auto;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${MUTED};
  }
  .hairline {
    position: relative;
    border-top: 1px solid ${INK};
    margin: 12px 0 0;
  }
  .hairline .lead {
    position: absolute;
    left: 0;
    top: -2px;
    width: 140px;
    border-top: 3px solid var(--accent);
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

  /* ── Body sections — one ## section per page ── */
  .content { padding: 0 68px; }
  .content > h2 { break-before: page; }
  .content h2 {
    margin: 0 0 0.9em;
    font-size: 34px;
    font-weight: 700;
    line-height: 1.15;
    break-after: avoid;
  }
  .content h2::before {
    content: '';
    display: inline-block;
    width: 11px;
    height: 11px;
    margin-right: 12px;
    background: var(--accent);
  }
  .content h2.department::before { content: none; }
  .content h2 .chip {
    display: inline-block;
    padding: 8px 16px 9px;
    border: 1px solid ${INK};
    font-family: 'Courier New', Courier, monospace;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.08em;
    background: transparent;
  }
  .content h3 {
    margin: 1.4em 0 0.5em;
    font-size: 19px;
    font-weight: 700;
    break-after: avoid;
  }
  .content h4 {
    margin: 1.2em 0 0.4em;
    font-size: 16px;
    font-weight: 700;
    break-after: avoid;
  }
  .content p {
    margin: 0 0 1.05em;
    max-width: 62ch;
  }
  .content ul, .content ol {
    margin: 0 0 1.2em;
    padding-left: 1.3em;
    max-width: 62ch;
  }
  .content li { margin-bottom: 0.85em; }
  .content li::marker { color: var(--accent); }
  .content a {
    color: ${INK};
    text-decoration-color: var(--accent);
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }
  .content code {
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.86em;
    background: rgba(26, 26, 26, 0.06);
    padding: 0.08em 0.3em;
  }

  /* Pull quotes — the Anthropic quote-page feel, kept in flow */
  .content blockquote {
    margin: 1.8em 0;
    padding: 26px 6px;
    border-top: 1px solid ${INK};
    border-bottom: 1px solid ${INK};
    break-inside: avoid;
  }
  .content blockquote p {
    margin: 0;
    max-width: none;
    font-size: 26px;
    line-height: 1.4;
  }
  .content blockquote p::before {
    content: '\\201C';
    color: var(--accent);
    margin-right: 2px;
  }
  .content blockquote p::after { content: '\\201D'; color: var(--accent); }

  hr.rule {
    border: none;
    border-top: 1px solid rgba(26, 26, 26, 0.35);
    margin: 2em 0;
    max-width: 62ch;
  }

  /* ── Back page ── */
  .backpage { padding: 0 68px; break-before: page; }
  .backpage h2 {
    margin: 34px 0 0.7em;
    font-size: 15px;
    font-variant-caps: small-caps;
    letter-spacing: 0.1em;
  }
  .backpage p, .backpage li {
    font-size: 13px;
    line-height: 1.7;
    color: ${INK};
  }
  .backpage p { margin: 0 0 0.7em; max-width: 62ch; }
  .backpage .muted { color: ${MUTED}; }
  .backpage a { color: ${INK}; text-decoration-color: var(--accent); }
  .backpage ul.sources {
    margin: 0;
    padding-left: 1.3em;
    max-width: 66ch;
  }
  .backpage ul.sources li { margin-bottom: 0.4em; }
  .backpage ul.sources .host {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    color: ${MUTED};
  }
  .backpage .colophon-lines {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid ${INK};
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${MUTED};
  }
  .backpage .colophon-lines p { margin: 0 0 4px; font-size: inherit; color: inherit; }
`;

// ─── HTML Assembly ──────────────────────────────────────────────────────────

function buildPdfEditionHtml(publication) {
  if (!publication || !publication.slug) {
    throw new Error('buildPdfEditionHtml: publication.slug is required');
  }
  const kind = publication.contentType || publication.type || 'blog';
  const accent = ACCENT[kind] || INK;
  const series = publication.series || NAMEPLATE[kind] || NAMEPLATE.blog;
  const canonical = CANONICAL[kind] || CANONICAL.blog;

  const edition = publication.issueNumber
    ? `Edition ${publication.issueNumber}`
    : formatDate(publication.publishedAt || publication.createdAt);
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

  const sources =
    publication.content && Array.isArray(publication.content.sources)
      ? publication.content.sources.filter((s) => s && (s.title || s.url))
      : [];
  const MAX_SOURCES = 10;
  const sourceItems = sources
    .slice(0, MAX_SOURCES)
    .map((s) => {
      // Source titles can be raw social posts — strip embedded URLs and
      // hashtags so the list reads as titles, not log lines.
      const cleaned = String(s.title || s.url)
        .replace(/https?:\/\/\S+/g, '')
        .replace(/#\w+/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const capped =
        cleaned.length > 110 ? `${cleaned.slice(0, 107).trimEnd()}…` : cleaned;
      const title = escapeHtml(capped || s.url || 'Source');
      const host = escapeHtml(hostOf(s.url));
      const linked = s.url
        ? `<a href="${escapeHtml(s.url)}">${title}</a>`
        : title;
      return `<li>${linked}${host ? ` <span class="host">${host}</span>` : ''}</li>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(`${publication.title || 'Untitled'} — ${series}`)}</title>
<meta name="generator" content="Allternit publications pipeline (PDF edition)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,700;1,6..72,400;1,6..72,700&amp;display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body style="--accent: ${accent};">

<div class="pagefoot" style="--accent: ${accent};" aria-hidden="true">
  <span class="tick"></span>
  <span>${escapeHtml(series)}</span>
  <span class="right">ai.allternit.com</span>
</div>

<section class="cover page" style="--accent: ${accent};">
  <div class="masthead-row">
    <span class="masthead-tick" aria-hidden="true"></span>
    <span class="nameplate">${escapeHtml(series)}</span>
    <span class="edition-line">${escapeHtml(edition)}</span>
  </div>
  <div class="hairline" aria-hidden="true"><span class="lead"></span></div>

  <div class="cover-body">
    <p class="kicker"><span class="dot" aria-hidden="true">&#10035;</span>${escapeHtml(KICKER[kind] || KICKER.blog)}</p>
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

<section class="backpage page" style="--accent: ${accent};">
  <div class="masthead-row">
    <span class="masthead-tick" aria-hidden="true"></span>
    <span class="nameplate" style="font-size: 15px;">${escapeHtml(series)}</span>
    <span class="edition-line">${escapeHtml(edition)}</span>
  </div>
  <div class="hairline" aria-hidden="true"><span class="lead"></span></div>

  <h2>About this edition</h2>
  ${publication.abstract ? `<p>${escapeHtml(publication.abstract)}</p>` : ''}
  <p class="muted">Read it on the web: <a href="${escapeHtml(canonical)}">${escapeHtml(canonical.replace(/^https?:\/\//, ''))}</a></p>

  ${sourceItems ? `<h2>Sources</h2>\n  <ul class="sources">${sourceItems}</ul>` : ''}

  <div class="colophon-lines">
    <p>${escapeHtml(series)} · ${escapeHtml(edition)}</p>
    <p>License: ${escapeHtml(publication.license || 'CC BY 4.0')}</p>
    <p>Generated by the Allternit publications pipeline</p>
  </div>
</section>

</body>
</html>
`;
}

module.exports = { buildPdfEditionHtml };
