#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — PDF Edition Generator
 *
 * Renders Anthropic-style PDF editions for publications in the discovery
 * pipeline and records `pdfUrl` on each pipeline entry. PDFs land next to
 * the HTML editions and deploy with the site:
 *   surfaces/ai.allternit.com/public/editions/{slug}.pdf
 *   https://ai.allternit.com/editions/{slug}.pdf
 *
 * Usage:
 *   node .github/scripts/generate-pdf-editions.cjs --new              # CI: items missing pdfUrl
 *   node .github/scripts/generate-pdf-editions.cjs --all              # backfill everything missing
 *   node .github/scripts/generate-pdf-editions.cjs --slug <slug>      # one publication
 *   node .github/scripts/generate-pdf-editions.cjs --all --force      # regenerate existing PDFs
 *
 * Requires Playwright + Chromium (root devDependency of this repo):
 *   npm ci && npx playwright install chromium
 */

const fs = require('fs');
const path = require('path');
const { buildPdfEditionHtml } = require('./lib/pdf-edition.cjs');

const DATA_FILE = path.resolve(
  __dirname,
  '../../surfaces/ai.allternit.com/src/data/discovery-pipeline.json',
);
const EDITIONS_DIR = path.resolve(
  __dirname,
  '../../surfaces/ai.allternit.com/public/editions',
);
const EDITIONS_URL_BASE = 'https://ai.allternit.com/editions';

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { new: false, all: false, force: false, slug: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--new') opts.new = true;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--slug') {
      opts.slug = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.new && !opts.all && !opts.slug) {
    throw new Error(
      'Nothing to do. Pass --new, --all, or --slug <slug> (see header comment).',
    );
  }
  return opts;
}

function selectItems(items, opts) {
  if (opts.slug) {
    const found = items.filter((it) => it && it.slug === opts.slug);
    if (!found.length) {
      throw new Error(`No publication with slug "${opts.slug}" in ${DATA_FILE}`);
    }
    return found;
  }
  // --new and --all both mean "everything missing a pdfUrl" unless --force.
  return items.filter(
    (it) =>
      it &&
      it.slug &&
      it.content &&
      it.content.markdown &&
      (opts.force || !it.pdfUrl),
  );
}

// ─── Rendering ──────────────────────────────────────────────────────────────

async function renderPdf(browser, publication, outPath) {
  const html = buildPdfEditionHtml(publication);
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    // Make sure webfonts are in before pagination is computed.
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.pdf({
      path: outPath,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await page.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error(
      'Playwright is not installed. Run:\n' +
        '  npm ci && npx playwright install chromium',
    );
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(items)) {
    throw new Error(`${DATA_FILE} is not a JSON array`);
  }
  const selected = selectItems(items, opts);
  if (!selected.length) {
    console.log('No publications need PDF editions. Nothing to do.');
    return;
  }

  fs.mkdirSync(EDITIONS_DIR, { recursive: true });

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error(
      'Chromium is not installed for Playwright. Run:\n' +
        '  npx playwright install chromium\n\n' +
        String(err && err.message ? err.message : err),
    );
    process.exit(1);
  }

  let rendered = 0;
  const failures = [];
  try {
    for (const publication of selected) {
      const outPath = path.join(EDITIONS_DIR, `${publication.slug}.pdf`);
      try {
        await renderPdf(browser, publication, outPath);
        publication.pdfUrl = `${EDITIONS_URL_BASE}/${publication.slug}.pdf`;
        rendered += 1;
        console.log(`rendered ${publication.slug}.pdf`);
      } catch (err) {
        failures.push(publication.slug);
        console.error(
          `failed ${publication.slug}: ${err && err.message ? err.message : err}`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  if (rendered > 0) {
    fs.writeFileSync(DATA_FILE, `${JSON.stringify(items, null, 2)}\n`);
    console.log(`updated pdfUrl on ${rendered} entr${rendered === 1 ? 'y' : 'ies'} in ${path.relative(process.cwd(), DATA_FILE)}`);
  }
  if (failures.length) {
    console.error(`failures: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
