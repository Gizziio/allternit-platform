#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — Photo Edition Generator (local, Codex-driven)
 *
 * Creates the Anthropic-style photo edition of a publication:
 *   1. Builds six editorial-photography briefs from the publication.
 *   2. Generates each photo with the local Codex app's built-in image tool
 *      (uses the operator's ChatGPT account quota — no API key, no CI).
 *   3. Renders editions/{slug}.photo.pdf via Playwright Chromium and records
 *      `photoUrl` on the pipeline entry.
 *
 * Usage:
 *   node .github/scripts/generate-photo-edition.cjs --slug <slug>   # one publication
 *   node .github/scripts/generate-photo-edition.cjs --new           # published items missing photoUrl
 *   node .github/scripts/generate-photo-edition.cjs --all           # everything published
 *   node .github/scripts/generate-photo-edition.cjs --slug <slug> --force       # regenerate images too
 *   node .github/scripts/generate-photo-edition.cjs --slug <slug> --skip-images # re-layout only
 *   node .github/scripts/generate-photo-edition.cjs --slug <slug> --photos-dir <dir>  # use these images
 *
 * Notes:
 * - Requires `codex` on PATH, signed in (ChatGPT), for image generation, and
 *   Playwright + Chromium for the PDF render (npm/pnpm install +
 *   `npx playwright install chromium`).
 * - ~6 image generations per edition. This never runs in CI: Codex auth is
 *   local. Commit the generated PNGs, PDF, and pipeline JSON to publish.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildPhotoEditionHtml } = require('./lib/photo-edition.cjs');
const { harvestSourceImages } = require('./lib/source-images.cjs');
const { buildPhotoBriefs } = require('./lib/photo-briefs.cjs');

const DATA_FILE = path.resolve(
  __dirname,
  '../../surfaces/ai.allternit.com/src/data/discovery-pipeline.json',
);
const EDITIONS_DIR = path.resolve(
  __dirname,
  '../../surfaces/ai.allternit.com/public/editions',
);
const IMAGES_BASE = path.resolve(
  __dirname,
  '../../surfaces/ai.allternit.com/public/images/editions',
);
const EDITIONS_URL_BASE = 'https://ai.allternit.com/editions';

const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const GENERATED_IMAGES_DIR = path.join(CODEX_HOME, 'generated_images');
const IMAGE_TIMEOUT_MS = 5 * 60 * 1000;

// Photo slots in layout order (see lib/photo-edition.cjs).
const SLOTS = [
  'cover-hero',
  'cover-inset-a',
  'cover-inset-b',
  'bleed-quote',
  'pair-a',
  'pair-b',
];

// Slots that harvested source images may fill: small cover-collage spots,
// where an og-card reads fine at thumbnail size. The big photographic pages
// (full-bleed quote page, two-up page) always come from Codex generation —
// blown up to a full page, a 1200x630 text card looks wrong.
const COVER_SLOTS = SLOTS.slice(0, 3);

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    new: false,
    all: false,
    force: false,
    skipImages: false,
    noHarvest: false,
    photosDir: null,
    slug: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--new') opts.new = true;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--skip-images') opts.skipImages = true;
    else if (arg === '--no-harvest') opts.noHarvest = true;
    else if (arg === '--slug') opts.slug = argv[++i];
    else if (arg === '--photos-dir') opts.photosDir = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!opts.new && !opts.all && !opts.slug) {
    throw new Error('Nothing to do. Pass --new, --all, or --slug <slug>.');
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
  return items.filter(
    (it) =>
      it &&
      it.slug &&
      it.content &&
      it.content.markdown &&
      (opts.force || !it.photoUrl),
  );
}

// ─── Codex image generation ─────────────────────────────────────────────────

function snapshotGeneratedImages() {
  const seen = new Set();
  let sessions = [];
  try {
    sessions = fs.readdirSync(GENERATED_IMAGES_DIR);
  } catch {
    return seen;
  }
  for (const session of sessions) {
    const dir = path.join(GENERATED_IMAGES_DIR, session);
    let files = [];
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (f.toLowerCase().endsWith('.png')) seen.add(path.join(dir, f));
    }
  }
  return seen;
}

function newImagesSince(snapshot) {
  const now = snapshotGeneratedImages();
  return [...now]
    .filter((p) => !snapshot.has(p))
    .map((p) => ({ p, mtime: fs.statSync(p).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime)
    .map((x) => x.p);
}

// Runs one codex exec generation and returns the newest produced PNG (or null).
function generateImage(brief) {
  const snapshot = snapshotGeneratedImages();
  const prompt =
    'Use your image generation tool to create exactly one image and save ' +
    'it with the tool defaults. Do not ask questions. Image brief: ' +
    brief;
  const result = spawnSync(
    'codex',
    ['exec', '--skip-git-repo-check', prompt],
    { timeout: IMAGE_TIMEOUT_MS, encoding: 'utf8' },
  );
  if (result.error) {
    console.error(`  codex exec failed: ${result.error.message}`);
    return null;
  }
  // The tool writes asynchronously on rare occasions — give it a moment.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const fresh = newImagesSince(snapshot);
    if (fresh.length) return fresh[fresh.length - 1];
    spawnSync('sleep', ['5']);
  }
  return null;
}

// ─── Rendering ──────────────────────────────────────────────────────────────

async function renderPdf(browser, publication, photos, storyImages, outPath) {
  const html = buildPhotoEditionHtml(publication, photos, storyImages);
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
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

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const items = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(items)) throw new Error(`${DATA_FILE} is not a JSON array`);
  const selected = selectItems(items, opts);
  if (!selected.length) {
    console.log('No publications need photo editions. Nothing to do.');
    return;
  }

  const needGeneration = !opts.skipImages && !opts.photosDir;
  if (needGeneration) {
    const which = spawnSync('which', ['codex'], { encoding: 'utf8' });
    if (which.status !== 0) {
      console.error(
        '`codex` is not on PATH. Install/sign in to the Codex app, or use ' +
          '--skip-images / --photos-dir.',
      );
      process.exit(1);
    }
  }

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error(
      'Playwright is not installed. Run:\n' +
        '  pnpm install --frozen-lockfile && npx playwright install chromium',
    );
    process.exit(1);
  }
  const browser = await chromium.launch();

  let rendered = 0;
  const failures = [];
  try {
    for (const publication of selected) {
      const slug = publication.slug;
      console.log(`\n▸ ${slug}`);
      const imageDir = path.join(IMAGES_BASE, slug);
      fs.mkdirSync(imageDir, { recursive: true });

      if (opts.photosDir) {
        // Map the supplied directory's images onto the slots in sorted order.
        const supplied = fs
          .readdirSync(opts.photosDir)
          .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
          .sort();
        SLOTS.forEach((slot, i) => {
          const src = supplied[i] && path.join(opts.photosDir, supplied[i]);
          const dest = path.join(imageDir, `${slot}.png`);
          if (src && (opts.force || !fs.existsSync(dest))) {
            fs.copyFileSync(src, dest);
            console.log(`  ${slot} ← ${supplied[i]}`);
          }
        });
      } else if (!opts.skipImages) {
        // Step 0: harvest the real photos behind each linked source. These
        // fill both the per-story figures and as many layout slots as they
        // cover; Codex generation handles only what's left. The manifest
        // records the source-URL → file mapping so --skip-images re-runs and
        // the template can match photos back to their stories.
        const manifestPath = path.join(imageDir, 'harvest-manifest.json');
        let harvestedAll = [];
        if (fs.existsSync(manifestPath) && !opts.force) {
          try {
            harvestedAll = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            console.log(`  reusing ${harvestedAll.length} harvested image(s)`);
          } catch {
            harvestedAll = [];
          }
        } else if (!opts.noHarvest) {
          console.log('  harvesting source images…');
          harvestedAll = await harvestSourceImages(publication, imageDir, {
            log: console.log,
          });
          fs.writeFileSync(manifestPath, JSON.stringify(harvestedAll, null, 2));
        }
        const slotPool = [...harvestedAll];

        const briefs = await buildPhotoBriefs(publication, {
          log: console.log,
        });
        for (const slot of SLOTS) {
          const dest = path.join(imageDir, `${slot}.png`);
          if (fs.existsSync(dest) && !opts.force) {
            console.log(`  ${slot} exists, keeping`);
            continue;
          }
          // Cover-collage slots may be filled from the harvest; the big
          // photographic pages are always Codex-generated.
          const fromHarvest =
            COVER_SLOTS.includes(slot) && slotPool.length
              ? slotPool.shift()
              : null;
          if (fromHarvest) {
            fs.copyFileSync(fromHarvest.file, dest);
            console.log(`  ${slot} ← harvested (${fromHarvest.host})`);
            continue;
          }
          console.log(`  generating ${slot}…`);
          const produced = generateImage(briefs[slot]);
          if (produced) {
            fs.copyFileSync(produced, dest);
            console.log(`  ${slot} ✓`);
          } else {
            console.error(`  ${slot} ✗ (no image produced — layout will adapt)`);
          }
        }
      }

      // Per-story photos: any harvested story-*.png|jpg in the image dir,
      // matched back to their source URLs by the harvest manifest.
      const manifestPath = path.join(imageDir, 'harvest-manifest.json');
      let storyImages = [];
      if (fs.existsSync(manifestPath)) {
        try {
          storyImages = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch {
          storyImages = [];
        }
      }

      const photos = {
        coverHero: existing(path.join(imageDir, 'cover-hero.png')),
        coverInsetA: existing(path.join(imageDir, 'cover-inset-a.png')),
        coverInsetB: existing(path.join(imageDir, 'cover-inset-b.png')),
        bleedQuote: existing(path.join(imageDir, 'bleed-quote.png')),
        pairA: existing(path.join(imageDir, 'pair-a.png')),
        pairB: existing(path.join(imageDir, 'pair-b.png')),
      };

      try {
        fs.mkdirSync(EDITIONS_DIR, { recursive: true });
        const outPath = path.join(EDITIONS_DIR, `${slug}.photo.pdf`);
        await renderPdf(browser, publication, photos, storyImages, outPath);
        publication.photoUrl = `${EDITIONS_URL_BASE}/${slug}.photo.pdf`;
        rendered += 1;
        console.log(`  rendered ${slug}.photo.pdf`);
      } catch (err) {
        failures.push(slug);
        console.error(`  render failed: ${err && err.message ? err.message : err}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (rendered > 0) {
    fs.writeFileSync(DATA_FILE, `${JSON.stringify(items, null, 2)}\n`);
    console.log(
      `\nupdated photoUrl on ${rendered} entr${rendered === 1 ? 'y' : 'ies'} in ` +
        path.relative(process.cwd(), DATA_FILE),
    );
  }
  if (failures.length) {
    console.error(`failures: ${failures.join(', ')}`);
    process.exit(1);
  }
}

function existing(p) {
  return fs.existsSync(p) ? p : null;
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
