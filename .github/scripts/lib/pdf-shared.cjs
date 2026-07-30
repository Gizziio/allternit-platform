#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — Shared PDF Edition Primitives
 *
 * Constants, helpers, base print styles, and the back-page (About / Sources /
 * colophon) shared by the two PDF templates:
 *   - pdf-edition.cjs   — typographic edition (automatic, CI)
 *   - photo-edition.cjs — Anthropic-style photo edition (local, Codex images)
 *
 * Accent/nameplate/kicker values mirror cover.cjs and edition-artifact.cjs —
 * keep them in sync when the editorial language changes.
 */

const { pathToFileURL } = require('url');

// ─── Configuration ──────────────────────────────────────────────────────────

const INK = '#1A1A1A';
const CREAM = '#F5F3EF';
const MUTED = '#6B6B6B';

// One accent per publication type.
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

// "Edition 2026-W31" when an issue number exists, else the publish date.
function editionLine(publication) {
  if (publication.issueNumber) return `Edition ${publication.issueNumber}`;
  return formatDate(publication.publishedAt || publication.createdAt);
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

// Local image path → file:// URL (kept for any future file-document renders).
function fileUrl(p) {
  return pathToFileURL(p).href;
}

// Resolved per-type values in one place so both templates agree.
function kindInfo(publication) {
  const kind = publication.contentType || publication.type || 'blog';
  return {
    kind,
    accent: ACCENT[kind] || INK,
    series: publication.series || NAMEPLATE[kind] || NAMEPLATE.blog,
    canonical: CANONICAL[kind] || CANONICAL.blog,
    kicker: KICKER[kind] || KICKER.blog,
  };
}

// ─── Shared Styles ──────────────────────────────────────────────────────────
// Page setup, repeating page foot, masthead furniture, and the flowing-body
// (.content) rules used by both templates. Template-specific styles live in
// the template modules.

const BASE_STYLES = `
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
`;

/* Full-article body — one ## section per page, department chips, pull
   quotes. Used by both templates. */
const CONTENT_STYLES = `
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

  /* Pull quotes — oversized serif between hairlines */
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
`;

const BACKPAGE_STYLES = `
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

// ─── Shared HTML Fragments ──────────────────────────────────────────────────

const FONTS_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,700;1,6..72,400;1,6..72,700&amp;display=swap" rel="stylesheet">`;

function pagefootHtml(series, accent) {
  return `<div class="pagefoot" style="--accent: ${accent};" aria-hidden="true">
  <span class="tick"></span>
  <span>${escapeHtml(series)}</span>
  <span class="right">ai.allternit.com</span>
</div>`;
}

function mastheadHtml(series, edition, { nameplateSize } = {}) {
  const size = nameplateSize ? ` style="font-size: ${nameplateSize};"` : '';
  return `<div class="masthead-row">
    <span class="masthead-tick" aria-hidden="true"></span>
    <span class="nameplate"${size}>${escapeHtml(series)}</span>
    <span class="edition-line">${escapeHtml(edition)}</span>
  </div>
  <div class="hairline" aria-hidden="true"><span class="lead"></span></div>`;
}

// Cleaned, capped source list — raw social titles get URLs/hashtags stripped.
function sourceItemsHtml(publication) {
  const sources =
    publication.content && Array.isArray(publication.content.sources)
      ? publication.content.sources.filter((s) => s && (s.title || s.url))
      : [];
  const MAX_SOURCES = 10;
  return sources
    .slice(0, MAX_SOURCES)
    .map((s) => {
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
}

function buildBackPage(publication) {
  const { accent, series, canonical } = kindInfo(publication);
  const edition = editionLine(publication);
  const sourceItems = sourceItemsHtml(publication);

  return `<section class="backpage page" style="--accent: ${accent};">
  ${mastheadHtml(series, edition, { nameplateSize: '15px' })}

  <h2>About this edition</h2>
  ${publication.abstract ? `<p>${escapeHtml(publication.abstract)}</p>` : ''}
  <p class="muted">Read it on the web: <a href="${escapeHtml(canonical)}">${escapeHtml(canonical.replace(/^https?:\/\//, ''))}</a></p>

  ${sourceItems ? `<h2>Sources</h2>\n  <ul class="sources">${sourceItems}</ul>` : ''}

  <div class="colophon-lines">
    <p>${escapeHtml(series)} · ${escapeHtml(edition)}</p>
    <p>License: ${escapeHtml(publication.license || 'CC BY 4.0')}</p>
    <p>Generated by the Allternit publications pipeline</p>
  </div>
</section>`;
}

module.exports = {
  INK,
  CREAM,
  MUTED,
  ACCENT,
  NAMEPLATE,
  KICKER,
  CANONICAL,
  escapeHtml,
  formatDate,
  editionLine,
  byline,
  hostOf,
  fileUrl,
  kindInfo,
  BASE_STYLES,
  CONTENT_STYLES,
  BACKPAGE_STYLES,
  FONTS_HEAD,
  pagefootHtml,
  mastheadHtml,
  sourceItemsHtml,
  buildBackPage,
};
