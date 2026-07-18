#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — Interactive Edition Artifact
 *
 * Builds a single self-contained HTML "edition" page per publication in the
 * IBD editorial language of the cover generator: cream paper, black serif
 * masthead, one accent color per publication type, justified multi-column
 * body. All CSS is inlined; the only script is a fixed action bar (Save as
 * PDF / Download HTML) that is hidden when printing. Newsreader loads from
 * the Google Fonts CDN with Georgia/serif fallbacks, so the page stays fully
 * readable offline.
 *
 * Editions are written to surfaces/ai.allternit.com/public/editions/ and
 * deploy with the site, so each file is served at:
 *   https://ai.allternit.com/editions/{slug}.html
 */

const fs = require('fs');
const path = require('path');
const { buildCoverSvg } = require('./cover.cjs');

// ─── Configuration ──────────────────────────────────────────────────────────

const EDITIONS_DIR = path.resolve(
  __dirname,
  '../../../surfaces/ai.allternit.com/public/editions',
);
const EDITIONS_URL_BASE = 'https://ai.allternit.com/editions';

const INK = '#1A1A1A';
const CREAM = '#F5F3EF';
const MUTED = '#6B6B6B';

// One accent per publication type (mirrors cover.cjs).
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

// Canonical publication home per content type, linked from the footer.
const CANONICAL = {
  signal: 'https://allternit.com/news',
  feature: 'https://allternit.com/features',
  blog: 'https://allternit.com/blog',
};

// The five CLI departments of the Allternit News desk — `## ` headings that
// match one of these render as font-mono accent chips.
const DEPARTMENTS = ['ls -la', 'rm -rf', 'git push', 'pwned', 'Ctrl + Z'];

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

// Only web-safe link targets survive; anything else renders as plain text.
function renderLink(label, url) {
  const href = String(url || '').trim();
  if (!/^(https?:|mailto:|\/|#)/i.test(href)) return escapeHtml(label);
  return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

// Inline markdown: links, `code`, **bold**, *italic*. Links and code spans
// are stashed before escaping so their contents are escaped exactly once and
// the emphasis regexes never see markup.
function inline(raw) {
  const stash = [];
  const keep = (html) => {
    stash.push(html);
    return `\u0000${stash.length - 1}\u0000`;
  };

  let t = String(raw);
  t = t.replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, label, url) =>
    keep(renderLink(label, url)),
  );
  t = t.replace(/`([^`]+)`/g, (m, code) => keep(`<code>${escapeHtml(code)}</code>`));

  t = escapeHtml(t);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*\s][^*]*?)\*/g, '<em>$1</em>');
  t = t.replace(/(?<![\w_])_([^_]+)_(?![\w_])/g, '<em>$1</em>');

  return t.replace(/\u0000(\d+)\u0000/g, (m, n) => stash[Number(n)]);
}

// `## ` headings that name one of the five CLI departments render as mono
// chips; anything else is a plain bold serif subhead.
function renderH2(text) {
  const plain = text.replace(/\*\*/g, '').trim();
  const isDepartment = DEPARTMENTS.some(
    (d) => d.toLowerCase() === plain.toLowerCase(),
  );
  if (isDepartment) {
    return `<h2 class="department"><code class="chip">${escapeHtml(plain)}</code></h2>`;
  }
  return `<h2>${inline(text)}</h2>`;
}

const HR_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;

// Minimal server-side markdown → HTML: ##/### subheads, **bold**, *italic*,
// links, lists, > pull quotes, --- hairlines, paragraphs. A leading `# ` H1
// is dropped — the masthead already displays the publication title.
function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length && !lines[i].trim()) i += 1;
  if (i < lines.length && /^#\s+/.test(lines[i].trim())) i += 1;

  let para = [];
  const flushPara = () => {
    if (!para.length) return;
    const html = inline(para.join('\n'))
      .replace(/ {2,}\n/g, '<br>')
      .replace(/\n/g, ' ');
    para = [];
    if (html.trim()) out.push(`<p>${html}</p>`);
  };

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      flushPara();
      i += 1;
      continue;
    }

    if (HR_RE.test(trimmed)) {
      flushPara();
      out.push('<hr class="rule">');
      i += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level <= 2) out.push(renderH2(text));
      else if (level === 3) out.push(`<h3>${inline(text)}</h3>`);
      else out.push(`<h4>${inline(text)}</h4>`);
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushPara();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      const q = inline(quote.join('\n'))
        .replace(/ {2,}\n/g, '<br>')
        .replace(/\n/g, ' ');
      out.push(`<blockquote><p>${q}</p></blockquote>`);
      continue;
    }

    const ordered = /^\d+[.)]\s+/.test(trimmed);
    if (ordered || /^[-*+]\s+/.test(trimmed)) {
      flushPara();
      const itemRe = ordered ? /^\d+[.)]\s+(.*)$/ : /^[-*+]\s+(.*)$/;
      const items = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(itemRe);
        if (!m) break;
        items.push(`<li>${inline(m[1].trim())}</li>`);
        i += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    para.push(lines[i]);
    i += 1;
  }
  flushPara();

  return out.join('\n');
}

// ─── Page Furniture ─────────────────────────────────────────────────────────

function editionLine(publication) {
  if (publication.issueNumber) return `Edition ${publication.issueNumber}`;
  const date = publication.publishedAt || publication.createdAt;
  if (date) {
    const d = new Date(date);
    if (!isNaN(d)) {
      return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    }
  }
  return '';
}

function dateline(publication) {
  const date = publication.publishedAt || publication.createdAt;
  if (!date) return '';
  const d = new Date(date);
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

// ─── Styles & Script ────────────────────────────────────────────────────────

const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: ${CREAM};
    color: ${INK};
    font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
    font-size: 19px;
    line-height: 1.62;
    padding-bottom: 96px; /* clear the fixed action bar */
  }
  article.edition {
    max-width: 1120px;
    margin: 0 auto;
    padding: 48px 40px 64px;
  }

  /* Masthead — publication name in black serif, edition line, hairline */
  .masthead-row {
    display: flex;
    align-items: baseline;
    gap: 18px;
  }
  .masthead-tick {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    background: var(--accent);
    transform: translateY(1px);
  }
  .nameplate {
    font-weight: 700;
    font-size: 30px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${INK};
  }
  .edition-line {
    margin-left: auto;
    font-family: 'Courier New', Courier, monospace;
    font-size: 14px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${MUTED};
  }
  .hairline {
    position: relative;
    border-top: 1px solid ${INK};
    margin: 14px 0 0;
  }
  .hairline .lead {
    position: absolute;
    left: 0;
    top: -2px;
    width: 168px;
    border-top: 3px solid var(--accent);
  }

  /* Cover banner */
  figure.cover {
    margin: 36px 0 0;
    break-inside: avoid;
  }
  figure.cover svg {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid rgba(26, 26, 26, 0.22);
  }

  /* Title block */
  .titleblock { margin: 44px 0 0; }
  .kicker {
    margin: 0 0 14px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 14px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent);
  }
  h1.display {
    margin: 0;
    font-size: clamp(42px, 6.4vw, 76px);
    font-weight: 700;
    line-height: 1.04;
    letter-spacing: -0.015em;
  }
  .deck {
    margin: 22px 0 0;
    max-width: 46em;
    font-style: italic;
    font-size: 23px;
    line-height: 1.45;
    color: ${INK};
  }
  .byline, .dateline {
    margin: 26px 0 0;
    font-variant-caps: small-caps;
    letter-spacing: 0.08em;
    font-size: 17px;
  }
  .byline { color: ${INK}; }
  .dateline { margin-top: 6px; color: ${MUTED}; }

  /* Body — justified multi-column with hairline rules */
  .columns {
    margin-top: 40px;
    column-width: 320px;
    column-gap: 44px;
    column-rule: 1px solid rgba(26, 26, 26, 0.18);
    text-align: justify;
    hyphens: auto;
  }
  .columns p { margin: 0 0 1em; break-inside: avoid; }
  .columns h2, .columns h3, .columns h4 {
    break-after: avoid;
    line-height: 1.2;
  }
  .columns h2 {
    margin: 1.1em 0 0.55em;
    font-size: 27px;
    font-weight: 700;
  }
  .columns h2::before {
    content: '';
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 10px;
    background: var(--accent);
  }
  .columns h2.department { margin-top: 1.3em; }
  .columns h2.department::before { content: none; }
  .columns h2 .chip {
    display: inline-block;
    padding: 6px 14px 7px;
    border: 1px solid ${INK};
    font-family: 'Courier New', Courier, monospace;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${INK};
    background: transparent;
  }
  .columns h3 { margin: 1.1em 0 0.4em; font-size: 21px; font-weight: 700; }
  .columns h4 { margin: 1em 0 0.4em; font-size: 18px; font-weight: 700; }
  .columns ul, .columns ol { margin: 0 0 1em; padding-left: 1.25em; }
  .columns li { margin-bottom: 0.45em; }
  .columns a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
  .columns code {
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.86em;
    background: rgba(26, 26, 26, 0.06);
    padding: 0.08em 0.3em;
  }

  /* Blockquotes → oversized serif pull quotes with hairline rules */
  .columns blockquote {
    margin: 1.6em 0;
    padding: 20px 4px;
    border-top: 1px solid ${INK};
    border-bottom: 1px solid ${INK};
    break-inside: avoid;
  }
  .columns blockquote p {
    margin: 0;
    font-size: 27px;
    line-height: 1.35;
    text-align: left;
  }
  .columns blockquote p::before {
    content: '\\201C';
    color: var(--accent);
    margin-right: 2px;
  }

  hr.rule {
    border: none;
    border-top: 1px solid rgba(26, 26, 26, 0.35);
    margin: 1.8em 0;
  }

  /* Footer / colophon */
  footer.colophon { margin-top: 56px; }
  footer.colophon .hairline { margin-bottom: 22px; }
  footer.colophon p {
    margin: 0 0 6px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${MUTED};
  }
  footer.colophon a { color: var(--accent); }

  /* Fixed action bar — the only JS on the page */
  .action-bar {
    position: fixed;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: ${INK};
    color: ${CREAM};
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    letter-spacing: 0.06em;
    box-shadow: 0 6px 24px rgba(26, 26, 26, 0.28);
    z-index: 10;
  }
  .action-bar .bar-title {
    padding-right: 6px;
    border-right: 1px solid rgba(245, 243, 239, 0.35);
    text-transform: uppercase;
  }
  .action-bar button {
    appearance: none;
    border: 1px solid ${CREAM};
    background: transparent;
    color: ${CREAM};
    font: inherit;
    padding: 7px 14px;
    cursor: pointer;
    text-transform: uppercase;
  }
  .action-bar button:hover, .action-bar button:focus-visible {
    background: var(--accent);
    border-color: var(--accent);
    color: ${INK};
    outline: none;
  }

  @media (max-width: 640px) {
    article.edition { padding: 32px 20px 56px; }
    .nameplate { font-size: 22px; }
    .masthead-row { flex-wrap: wrap; }
    .edition-line { margin-left: 0; width: 100%; }
  }

  @media print {
    @page { margin: 18mm 16mm; }
    body { padding-bottom: 0; }
    .action-bar { display: none !important; }
    figure.cover, .columns blockquote { break-inside: avoid; }
    /* Each ## department heading starts a fresh page — except the first
       block of the body, which would leave the title page blank. */
    .columns > h2 { break-before: page; }
    .columns > h2:first-child { break-before: auto; }
    a { color: ${INK}; }
  }
`;

const ACTION_BAR_SCRIPT = `(function () {
  var slug = %SLUG%;
  document.getElementById('save-pdf').addEventListener('click', function () {
    window.print();
  });
  document.getElementById('download-html').addEventListener('click', function () {
    var html = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
    var a = document.createElement('a');
    a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    a.download = slug + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
})();`;

// ─── HTML Assembly ──────────────────────────────────────────────────────────

function buildEditionArtifact(publication) {
  if (!publication || !publication.slug) {
    throw new Error('buildEditionArtifact: publication.slug is required');
  }
  const kind = publication.contentType || publication.type || 'blog';
  const accent = ACCENT[kind] || INK;
  const series = publication.series || NAMEPLATE[kind] || NAMEPLATE.blog;
  const canonical = CANONICAL[kind] || CANONICAL.blog;
  const artifactUrl = `${EDITIONS_URL_BASE}/${publication.slug}.html`;

  const edition = editionLine(publication);
  const date = dateline(publication);
  const meta = byline(publication);
  const readingTime = publication.readingTime
    ? `${publication.readingTime} min read`
    : '';

  const markdown = publication.content && publication.content.markdown;
  const body = markdown
    ? renderMarkdown(markdown)
    : `<p>${escapeHtml(publication.abstract || '')}</p>`;

  // Same SVG string writeCover() hosts — artifact and hosted cover identical.
  const coverSvg = buildCoverSvg(publication).trimEnd();

  const datelineParts = [date, readingTime].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${publication.title || 'Untitled'} — ${series}`)}</title>
<meta name="description" content="${escapeHtml(publication.abstract || publication.subtitle || '')}">
<meta name="generator" content="Allternit publications pipeline">
<link rel="canonical" href="${escapeHtml(artifactUrl)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,700;1,6..72,400;1,6..72,700&amp;display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>
<article class="edition" style="--accent: ${accent};">
  <header class="masthead">
    <div class="masthead-row">
      <span class="masthead-tick" aria-hidden="true"></span>
      <span class="nameplate">${escapeHtml(series)}</span>
      <span class="edition-line">${escapeHtml(edition)}</span>
    </div>
    <div class="hairline" aria-hidden="true"><span class="lead"></span></div>
  </header>

  <figure class="cover">
${coverSvg}
  </figure>

  <header class="titleblock">
    <p class="kicker">${escapeHtml(KICKER[kind] || KICKER.blog)}</p>
    <h1 class="display">${escapeHtml(publication.title || 'Untitled')}</h1>
    ${publication.subtitle ? `<p class="deck">${escapeHtml(publication.subtitle)}</p>` : ''}
    ${meta ? `<p class="byline">${escapeHtml(meta)}</p>` : ''}
    ${datelineParts ? `<p class="dateline">${escapeHtml(datelineParts)}</p>` : ''}
    <div class="hairline" aria-hidden="true"></div>
  </header>

  <div class="columns">
${body}
  </div>

  <footer class="colophon">
    <div class="hairline" aria-hidden="true"><span class="lead"></span></div>
    <p>Canonical: <a href="${escapeHtml(canonical)}">${escapeHtml(canonical.replace(/^https?:\/\//, ''))}</a></p>
    <p>Generated by the Allternit publications pipeline</p>
  </footer>
</article>

<div class="action-bar" role="toolbar" aria-label="Edition actions" style="--accent: ${accent};">
  <span class="bar-title">${escapeHtml(series)}</span>
  <button type="button" id="save-pdf">Save as PDF</button>
  <button type="button" id="download-html">Download HTML</button>
</div>
<script>${ACTION_BAR_SCRIPT.replace('%SLUG%', JSON.stringify(publication.slug))}</script>
</body>
</html>
`;
}

// ─── IO ─────────────────────────────────────────────────────────────────────

// Writes the edition HTML for a publication and returns its public URL.
function writeEditionArtifact(publication) {
  if (!publication || !publication.slug) {
    throw new Error('writeEditionArtifact: publication.slug is required');
  }
  const html = buildEditionArtifact(publication);
  fs.mkdirSync(EDITIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(EDITIONS_DIR, `${publication.slug}.html`), html);
  return `${EDITIONS_URL_BASE}/${publication.slug}.html`;
}

module.exports = {
  buildEditionArtifact,
  writeEditionArtifact,
  renderMarkdown,
  EDITIONS_DIR,
  EDITIONS_URL_BASE,
};
