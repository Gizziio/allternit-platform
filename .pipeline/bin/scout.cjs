#!/usr/bin/env node
/**
 * Discovery scout (Phase 1): fetch sources via the repo's pipeline lib, pick
 * the top-5 unseen items by relevance score, write a mechanism brief per item
 * to .pipeline/briefs/, track slugs in .pipeline/seen.json, and announce each
 * brief to rails thread wih:pipeline-discovery.
 *
 * Hard requirements (see .steering/spec.md R0–R4):
 *  - rails-ensure.sh runs first; any failure aborts non-zero before any brief.
 *  - A failed announcement after a successful ensure is a hard error:
 *    recorded in .pipeline/errors.log, non-zero exit. No skip-and-continue.
 *
 * Dependency injection (used by scout-test.cjs; defaults hit production):
 *  - SCOUT_DIR             state dir (default: .pipeline)
 *  - SCOUT_PIPELINE_MODULE module exporting fetchAllSources (default: repo lib)
 *  - SCOUT_RAILS_ENSURE    rails-ensure script path
 *  - SCOUT_ANNOUNCER       module exporting async (payload) => void
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SCOUT_DIR = process.env.SCOUT_DIR || path.resolve(__dirname, '..');
const BRIEFS_DIR = path.join(SCOUT_DIR, 'briefs');
const SEEN_FILE = path.join(SCOUT_DIR, 'seen.json');
const ERRORS_LOG = path.join(SCOUT_DIR, 'errors.log');
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PIPELINE_MODULE =
  process.env.SCOUT_PIPELINE_MODULE ||
  path.join(REPO_ROOT, '.github', 'scripts', 'lib', 'pipeline.cjs');
const RAILS_ENSURE =
  process.env.SCOUT_RAILS_ENSURE || path.join(__dirname, 'rails-ensure.sh');
const RAILS_SHARE_URL = 'http://localhost:8013/api/rails/mail/share';
const DISCOVERY_THREAD = 'wih:pipeline-discovery';
const MAX_BRIEFS = 5;
// Social sources degrade to [] without credentials and add noise; disabled.
const SOCIAL_SOURCES = new Set(['twitter', 'x', 'bluesky', 'mastodon']);

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function logError(entry) {
  fs.mkdirSync(SCOUT_DIR, { recursive: true });
  fs.appendFileSync(ERRORS_LOG, `[${new Date().toISOString()}] ${entry}\n`);
}

// ─── Rails ensure (R0/R1) ───────────────────────────────────────────────────

function ensureRails() {
  try {
    execFileSync('bash', [RAILS_ENSURE], { stdio: ['ignore', 'inherit', 'inherit'] });
  } catch (err) {
    fail(`scout: rails-ensure failed (exit ${err.status ?? '?'}) — aborting before any brief is written`);
  }
}

// ─── Rails announce (R3/R4) ─────────────────────────────────────────────────

function httpAnnounce(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      RAILS_SHARE_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 5000,
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve();
          else reject(new Error(`rails announce returned HTTP ${res.statusCode}`));
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('rails announce timed out')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const announce = process.env.SCOUT_ANNOUNCER
  ? require(path.resolve(process.env.SCOUT_ANNOUNCER))
  : httpAnnounce;

// ─── Seen state (R2) ────────────────────────────────────────────────────────

function loadSeen() {
  try {
    const data = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return []; // tolerate missing/corrupt file
  }
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2) + '\n');
}

// ─── Slugs ──────────────────────────────────────────────────────────────────

function baseSlug(title) {
  const slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || crypto.createHash('sha1').update(String(title)).digest('hex').slice(0, 12);
}

function uniqueSlug(title, url, taken) {
  let slug = baseSlug(title);
  if (!taken.has(slug)) return slug;
  const hash = crypto.createHash('sha1').update(String(url || title)).digest('hex').slice(0, 8);
  slug = `${baseSlug(title).slice(0, 51).replace(/-+$/g, '')}-${hash}`;
  let n = 2;
  while (taken.has(slug)) slug = `${baseSlug(title).slice(0, 50)}-${hash}${n++}`;
  return slug;
}

// ─── Mechanism brief ────────────────────────────────────────────────────────
//
// Structured brief format (Phase 2): both the LLM path and the TODO(agent)
// fallback emit exactly these sections so .pipeline/bin/generate-spec.cjs can
// parse them mechanically:
//   ## What it is            — one paragraph
//   ## Mechanism             — bulleted facts about how it works internally
//   ## Integration surface   — bullets `- <repo path or subsystem>: <change>`
//   ## Requirements seed     — 2-6 bullets, each `WHEN <trigger>, THE SYSTEM
//                              SHALL <observable behavior>`

function templateBrief(item, reason) {
  const body = `## What it is

TODO(agent): one paragraph describing what this is. (LLM brief generation unavailable: ${reason})

## Mechanism

- TODO(agent): one fact about how it works internally

## Integration surface

- TODO(agent): <repo path or subsystem>: <what would change>

## Requirements seed

- TODO(agent): WHEN <trigger>, THE SYSTEM SHALL <observable behavior>
- TODO(agent): WHEN <trigger>, THE SYSTEM SHALL <observable behavior>`;
  return briefDocument(item, body);
}

function briefDocument(item, body) {
  return `# ${item.title}\n\n- Source: ${item.source}\n- URL: ${item.url}\n- Relevance score: ${item.relevance?.score ?? 'n/a'}\n- Discovered: ${new Date().toISOString()}\n\n${body}\n`;
}

function loadCharter() {
  const p = path.join(SCOUT_DIR, 'charter.md');
  try {
    return fs.readFileSync(p, 'utf8').slice(0, 3000);
  } catch {
    return '';
  }
}

async function generateBrief(pipeline, item) {
  if (typeof pipeline.callKimi === 'function' && pipeline.KIMI_API_KEY) {
    const charter = loadCharter();
    try {
      const text = await pipeline.callKimi(
        [
          {
            role: 'user',
            content:
              'Write a concise mechanism brief (markdown) about the following discovery item, ' +
              'with EXACTLY these four sections and formats (no other sections):\n' +
              '"## What it is" — one paragraph.\n' +
              '"## Mechanism" — bulleted facts about how it works internally.\n' +
              '"## Integration surface" — bulleted candidate touchpoints in the Allternit repo ' +
              '(an agent runtime/orchestration platform with rails, infra/, domains/, mcp/), each ' +
              'formatted "- <repo path or subsystem>: <what would change>".\n' +
              '"## Requirements seed" — 2-6 bullets, each a single checkable behavior in the form ' +
              '"WHEN <trigger>, THE SYSTEM SHALL <observable behavior>".\n' +
              (charter
                ? `\nFrame the brief through this product charter — the integration surface and requirements seed must serve it, and if the item clearly conflicts with it, say so in one line at the top:\n${charter}\n`
                : '') +
              `\nTitle: ${item.title}\nURL: ${item.url}\nExcerpt: ${(item.text || '').slice(0, 600)}`,
          },
        ],
        1200,
      );
      if (text) {
        return briefDocument(item, text);
      }
    } catch (err) {
      console.error(`scout: callKimi failed for "${item.title}" (${err.message}); writing TODO template`);
      return templateBrief(item, `callKimi error: ${err.message}`);
    }
    return templateBrief(item, 'callKimi returned empty');
  }
  return templateBrief(item, 'no LLM helper available (callKimi not exported or KIMI_API_KEY unset)');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  ensureRails(); // R1: abort non-zero before anything else if rails is unusable

  const pipeline = require(PIPELINE_MODULE);
  if (typeof pipeline.fetchAllSources !== 'function') {
    fail(`scout: ${PIPELINE_MODULE} does not export fetchAllSources`);
  }

  // Social sources disabled via flags where they exist (xcurated/bluesky/
  // mastodon); twitter has no flag, so post-filter by source label too.
  const result = await pipeline.fetchAllSources({
    includeXCurated: false,
    includeBluesky: false,
    includeMastodon: false,
  });
  const items = (result.filtered || []).filter((i) => !SOCIAL_SOURCES.has(i.source));

  const seen = loadSeen();
  const taken = new Set(seen);
  if (fs.existsSync(BRIEFS_DIR)) {
    for (const f of fs.readdirSync(BRIEFS_DIR)) {
      if (f.endsWith('.md')) taken.add(f.slice(0, -3));
    }
  }

  // Dedup filter first, then cap: top MAX_BRIEFS by relevance score among
  // items not already in seen.json (R1). This drains the backlog across runs
  // — items ranked 6+ today surface on later runs — while never re-briefing
  // a seen item. An item is "seen" if its deterministic slug (base or
  // hash-suffixed collision variant) is already listed, checked BEFORE
  // uniqueSlug assigns new collision suffixes.
  const alreadySeen = (item) => {
    const base = baseSlug(item.title);
    if (seen.includes(base)) return true;
    const hash = crypto.createHash('sha1').update(String(item.url || item.title)).digest('hex').slice(0, 8);
    return seen.includes(`${base.slice(0, 51).replace(/-+$/g, '')}-${hash}`);
  };
  const unseen = items
    .filter((item) => !alreadySeen(item))
    .sort((a, b) => (b.relevance?.score ?? 0) - (a.relevance?.score ?? 0))
    .slice(0, MAX_BRIEFS);
  const candidates = [];
  for (const item of unseen) {
    const slug = uniqueSlug(item.title, item.url, taken);
    taken.add(slug); // sequential so within-run collisions get a hash suffix
    candidates.push({ item, slug });
  }

  if (candidates.length === 0) {
    console.log('scout: no new items above threshold; nothing to do');
    return;
  }

  fs.mkdirSync(BRIEFS_DIR, { recursive: true });

  for (const { item, slug } of candidates) {
    const briefPath = path.join(BRIEFS_DIR, `${slug}.md`);
    fs.writeFileSync(briefPath, await generateBrief(pipeline, item));
    console.log(`scout: brief written ${briefPath}`);

    // R3/R4: announce; failure after a successful ensure is a hard error.
    // Announce BEFORE recording seen: on failure the brief is rolled back and
    // the slug stays unseen, so the next run retries the item instead of
    // silently losing its announcement (ordering fix per steering review).
    try {
      await announce({
        thread: DISCOVERY_THREAD,
        asset_ref: briefPath,
        note: item.title,
      });
      console.log(`scout: announced "${item.title}" to ${DISCOVERY_THREAD}`);
    } catch (err) {
      fs.rmSync(briefPath, { force: true });
      logError(`announce failed for ${briefPath} ("${item.title}"): ${err.message}`);
      fail(`scout: rails announcement failed for "${slug}" — brief rolled back, recorded in ${ERRORS_LOG}; aborting`);
    }

    seen.push(slug);
    saveSeen(seen); // R2: persist per brief for cross-run idempotency
    taken.add(slug);
  }

  console.log(`scout: done — ${candidates.length} brief(s), seen.json now holds ${seen.length} slug(s)`);
}

main().catch((err) => {
  logError(`scout fatal: ${err.stack || err.message}`);
  fail(`scout: fatal — ${err.message}`);
});
