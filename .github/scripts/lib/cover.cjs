#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — Cover Image Generator
 *
 * Pure-SVG cover art for publications (no dependencies — the SVG is built
 * as a string). Editorial/typographic design: an IBD-style newspaper +
 * magazine look on a cream background, one accent color per publication
 * type.
 *
 * Covers are written to surfaces/ai.allternit.com/public/images/discovery/
 * and deploy with the site, so each file is served at:
 *   https://ai.allternit.com/images/discovery/{slug}.svg
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────────────────

const WIDTH = 1200;
const HEIGHT = 630;

const COVER_DIR = path.resolve(
  __dirname,
  '../../../surfaces/ai.allternit.com/public/images/discovery',
);
const COVER_URL_BASE = 'https://ai.allternit.com/images/discovery';

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
  signal: 'ALLTERNIT NEWS',
  feature: 'A://SUDO REALITY',
  blog: 'ALLTERNIT BLOG',
};

// The five CLI departments of the Allternit News desk.
const DEPARTMENTS = ['ls -la', 'rm -rf', 'git push', 'pwned', 'Ctrl + Z'];

const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "'Courier New', Courier, monospace";

const TITLE_MAX_CHARS = 90;
const TITLE_FONT_SIZES = [64, 56, 48];
const TITLE_MAX_LINES = 3;
const TITLE_MAX_WIDTH = 920;

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

// ─── Text Helpers ───────────────────────────────────────────────────────────

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Keep titles readable: hard cap at ~90 chars, cut on a word boundary.
function truncateTitle(title, maxChars = TITLE_MAX_CHARS) {
  const clean = String(title || 'Untitled').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > maxChars * 0.6 ? lastSpace : maxChars - 1)}…`;
}

// Approximate Georgia bold advance width (~0.52em) for wrapping.
function charsPerLine(fontSize) {
  return Math.floor(TITLE_MAX_WIDTH / (fontSize * 0.52));
}

function wrapTitle(title, fontSize) {
  const words = title.split(' ');
  const limit = charsPerLine(fontSize);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > limit && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Pick the largest font size that keeps the title within TITLE_MAX_LINES.
function layoutTitle(title) {
  for (const size of TITLE_FONT_SIZES) {
    const lines = wrapTitle(title, size);
    if (lines.length <= TITLE_MAX_LINES) return { fontSize: size, lines };
  }
  const fontSize = TITLE_FONT_SIZES[TITLE_FONT_SIZES.length - 1];
  return { fontSize, lines: wrapTitle(title, fontSize).slice(0, TITLE_MAX_LINES) };
}

// ─── SVG Construction ───────────────────────────────────────────────────────

function editionLine(publication) {
  if (publication.issueNumber) return `EDITION ${publication.issueNumber}`;
  const date = publication.publishedAt || publication.createdAt;
  if (date) {
    const d = new Date(date);
    if (!isNaN(d)) {
      return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    }
  }
  return '';
}

function buildCoverSvg(publication) {
  const kind = publication.contentType || publication.type || 'blog';
  const accent = ACCENT[kind] || INK;
  const nameplate = escapeXml(
    (publication.series || NAMEPLATE[kind] || NAMEPLATE.blog).toUpperCase(),
  );
  const edition = escapeXml(editionLine(publication));
  const title = truncateTitle(publication.title);
  const { fontSize, lines } = layoutTitle(title);
  const lineHeight = Math.round(fontSize * 1.18);

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
  );
  parts.push(`<title>${escapeXml(title)}</title>`);

  // Paper + accent spine
  parts.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${CREAM}"/>`);
  parts.push(`<rect x="0" y="0" width="12" height="${HEIGHT}" fill="${accent}"/>`);

  // Masthead: accent tick, nameplate in small-caps-style mono, edition right
  parts.push(`<rect x="80" y="62" width="16" height="16" fill="${accent}"/>`);
  parts.push(
    `<text x="108" y="77" font-family="${MONO}" font-size="21" letter-spacing="5" fill="${INK}">${nameplate}</text>`,
  );
  if (edition) {
    parts.push(
      `<text x="1120" y="77" text-anchor="end" font-family="${MONO}" font-size="17" letter-spacing="2" fill="${MUTED}">${edition}</text>`,
    );
  }

  // Top hairline with an accent lead segment
  parts.push(`<line x1="80" y1="96" x2="1120" y2="96" stroke="${INK}" stroke-width="1"/>`);
  parts.push(`<line x1="80" y1="96" x2="248" y2="96" stroke="${accent}" stroke-width="3"/>`);

  // Title block, vertically centered in the middle region
  const regionTop = 140;
  const regionHeight = 340;
  const blockHeight = lines.length * lineHeight;
  const firstBaseline =
    regionTop + (regionHeight - blockHeight) / 2 + fontSize * 0.85;
  lines.forEach((line, i) => {
    const y = Math.round(firstBaseline + i * lineHeight);
    parts.push(
      `<text x="80" y="${y}" font-family="${SERIF}" font-size="${fontSize}" font-weight="bold" fill="${INK}">${escapeXml(line)}</text>`,
    );
  });

  // News items carry the five CLI departments as mono chips along the bottom
  if (kind === 'signal') {
    let cx = 80;
    for (const dept of DEPARTMENTS) {
      const label = escapeXml(dept.toUpperCase());
      const chipWidth = dept.length * 10 + 28;
      parts.push(
        `<rect x="${cx}" y="512" width="${chipWidth}" height="40" fill="none" stroke="${INK}" stroke-width="1"/>`,
      );
      parts.push(
        `<text x="${cx + chipWidth / 2}" y="537" text-anchor="middle" font-family="${MONO}" font-size="15" letter-spacing="1" fill="${INK}">${label}</text>`,
      );
      cx += chipWidth + 16;
    }
  }

  // Bottom hairline + colophon
  parts.push(`<line x1="80" y1="580" x2="1120" y2="580" stroke="${INK}" stroke-width="1"/>`);
  parts.push(
    `<text x="80" y="608" font-family="${MONO}" font-size="15" letter-spacing="2" fill="${MUTED}">AI.ALLTERNIT.COM · DISCOVERY</text>`,
  );
  if (publication.readingTime) {
    parts.push(
      `<text x="1120" y="608" text-anchor="end" font-family="${MONO}" font-size="15" letter-spacing="2" fill="${MUTED}">${escapeXml(`${publication.readingTime} MIN READ`)}</text>`,
    );
  }

  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

// ─── IO ─────────────────────────────────────────────────────────────────────

// Writes the cover SVG for a publication and returns its absolute public URL.
function writeCover(publication) {
  if (!publication || !publication.slug) {
    throw new Error('writeCover: publication.slug is required');
  }
  const svg = buildCoverSvg(publication);
  fs.mkdirSync(COVER_DIR, { recursive: true });
  fs.writeFileSync(path.join(COVER_DIR, `${publication.slug}.svg`), svg);
  return `${COVER_URL_BASE}/${publication.slug}.svg`;
}

module.exports = {
  buildCoverSvg,
  writeCover,
  COVER_DIR,
  COVER_URL_BASE,
};
