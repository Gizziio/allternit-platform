#!/usr/bin/env node
/**
 * generate-spec.cjs — deterministic brief -> spec generator (Phase 2).
 *
 * NO LLM calls, NO network, Node built-ins only. Parses the structured brief
 * format emitted by scout.cjs and emits an OpenSpec-profile spec mirroring
 * .steering/spec.md:
 *
 *   Context      — from "## What it is" + the source URL
 *   Requirements — R1..Rn, verbatim from "## Requirements seed" bullets
 *   Out of scope — boilerplate + anything the brief marks under "## Excluded"
 *   Acceptance   — one Gherkin scenario per requirement, mechanically
 *                  expanded from `WHEN <trigger>, THE SYSTEM SHALL <behavior>`
 *
 * Strict parsing: a brief missing "## Requirements seed" (or with a seed
 * bullet not matching the WHEN/SHALL shape) is rejected with an error naming
 * the brief and the offending line. Unparseable briefs are rejected, never
 * improvised.
 *
 * Idempotent + deterministic: same brief in -> byte-identical spec out.
 * `.pipeline/specs/.generated.json` maps slug -> sha256 of the brief content;
 * briefs whose hash is unchanged are skipped in all-briefs mode.
 *
 * Usage:
 *   node .pipeline/bin/generate-spec.cjs [brief-path]
 * Env (testing): GENERATOR_DIR overrides the .pipeline state dir.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PIPELINE_DIR = process.env.GENERATOR_DIR || path.resolve(__dirname, '..');
const BRIEFS_DIR = path.join(PIPELINE_DIR, 'briefs');
const SPECS_DIR = path.join(PIPELINE_DIR, 'specs');
const MANIFEST_FILE = path.join(SPECS_DIR, '.generated.json');

const SECTION_RE = /^##\s+(.+?)\s*$/;
const REQ_RE = /^WHEN\s+(.+?),\s*THE SYSTEM SHALL\s+(.+?)\s*$/i;

class BriefError extends Error {}

function err(briefPath, msg) {
  return new BriefError(`generate-spec: ERROR ${briefPath}: ${msg}`);
}

// ─── Brief parsing ──────────────────────────────────────────────────────────

function parseBrief(briefPath, content) {
  const lines = content.split('\n');
  const titleLine = lines.find((l) => l.startsWith('# '));
  if (!titleLine) throw err(briefPath, 'missing "# <title>" heading');
  const title = titleLine.slice(2).trim();

  const urlLine = lines.find((l) => l.startsWith('- URL:'));
  const url = urlLine ? urlLine.slice('- URL:'.length).trim() : '';

  // Split into sections keyed by heading text. Preamble (title + metadata)
  // is ignored beyond what was extracted above.
  const sections = new Map(); // name -> { start, lines[] }
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SECTION_RE);
    if (m) {
      current = { start: i + 1, lines: [] };
      sections.set(m[1], current);
    } else if (current) {
      current.lines.push({ n: i + 1, text: lines[i] });
    }
  }

  const whatItIs = sections.get('What it is');
  if (!whatItIs) throw err(briefPath, "missing required section '## What it is'");
  const whatItIsText = whatItIs.lines.map((l) => l.text).join('\n').trim();
  if (!whatItIsText) throw err(briefPath, `section '## What it is' (line ${whatItIs.start}) is empty`);

  const seed = sections.get('Requirements seed');
  if (!seed) throw err(briefPath, "missing required section '## Requirements seed'");

  const requirements = [];
  for (const { n, text } of seed.lines) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith('- ')) {
      throw err(briefPath, `line ${n} is not a requirements seed bullet: "${trimmed}"`);
    }
    const bullet = trimmed.slice(2).trim();
    const m = bullet.match(REQ_RE);
    if (!m) {
      throw err(
        briefPath,
        `line ${n} is not a valid requirements seed bullet: "${trimmed}" ` +
          '(expected "- WHEN <trigger>, THE SYSTEM SHALL <observable behavior>")',
      );
    }
    requirements.push({ line: n, trigger: m[1].trim(), behavior: m[2].trim(), verbatim: bullet });
  }
  if (requirements.length === 0) {
    throw err(briefPath, `section '## Requirements seed' (line ${seed.start}) has no bullets`);
  }

  const excluded = [];
  const excludedSection = sections.get('Excluded');
  if (excludedSection) {
    for (const { text } of excludedSection.lines) {
      const trimmed = text.trim();
      if (trimmed.startsWith('- ')) excluded.push(trimmed.slice(2).trim());
    }
  }

  return { title, url, whatItIsText, requirements, excluded };
}

// ─── Spec emission ──────────────────────────────────────────────────────────

function stripPeriod(s) {
  return s.replace(/\.+$/, '');
}

function emitSpec(slug, brief, briefHash) {
  const reqs = brief.requirements
    .map((r, i) => `- [ ] R${i + 1}: ${r.verbatim}`)
    .join('\n');

  const scenarios = brief.requirements
    .map((r, i) => {
      const trigger = stripPeriod(r.trigger);
      const behavior = stripPeriod(r.behavior);
      return [
        `- Scenario: R${i + 1} — ${trigger}`,
        `  Given the integration surface listed in the brief is in place`,
        `  When ${trigger}`,
        `  Then the system SHALL ${behavior}`,
      ].join('\n');
    })
    .join('\n');

  const excluded =
    brief.excluded.length > 0
      ? brief.excluded.map((e) => `- ${e}`).join('\n') + '\n'
      : '';

  return `# Spec: ${brief.title}

<!-- GENERATED by .pipeline/bin/generate-spec.cjs — do not edit by hand.
     Source brief: .pipeline/briefs/${slug}.md
     Brief SHA-256: ${briefHash} -->

## Context

${brief.whatItIsText}

Source: ${brief.url}

## Requirements

${reqs}

## Out of scope

- Review and verification of this spec (Phase 3 spec-checker loop).
- Implementation of the requirements above (executor consumption of the queue).
${excluded}
## Acceptance (Gherkin)

${scenarios}
`;
}

// ─── Manifest ───────────────────────────────────────────────────────────────

function loadManifest() {
  try {
    const data = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveManifest(manifest) {
  const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(sorted, null, 2) + '\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

function processBrief(briefPath, manifest) {
  const slug = path.basename(briefPath).replace(/\.md$/, '');
  const content = fs.readFileSync(briefPath, 'utf8');
  const brief = parseBrief(briefPath, content);
  const briefHash = crypto.createHash('sha256').update(content).digest('hex');

  fs.mkdirSync(SPECS_DIR, { recursive: true });
  const specPath = path.join(SPECS_DIR, `${slug}.md`);
  fs.writeFileSync(specPath, emitSpec(slug, brief, briefHash));
  manifest[slug] = briefHash;
  console.log(
    `generate-spec: wrote ${specPath} (R1..R${brief.requirements.length} from ${briefPath})`,
  );
}

function main() {
  const arg = process.argv[2];
  const manifest = loadManifest();

  if (arg) {
    // Explicit brief: (re)generate unconditionally.
    const briefPath = path.resolve(arg);
    if (!fs.existsSync(briefPath)) {
      console.error(`generate-spec: ERROR ${briefPath}: no such file`);
      process.exit(1);
    }
    try {
      processBrief(briefPath, manifest);
      saveManifest(manifest);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    return;
  }

  // All-briefs mode: process new/changed briefs only.
  if (!fs.existsSync(BRIEFS_DIR)) {
    console.log(`generate-spec: no briefs directory at ${BRIEFS_DIR}; nothing to do`);
    return;
  }
  const briefFiles = fs
    .readdirSync(BRIEFS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  let processed = 0;
  let skipped = 0;
  let failures = 0;
  for (const f of briefFiles) {
    const briefPath = path.join(BRIEFS_DIR, f);
    const slug = f.slice(0, -3);
    const content = fs.readFileSync(briefPath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    if (manifest[slug] === hash) {
      skipped++;
      continue;
    }
    try {
      processBrief(briefPath, manifest);
      processed++;
    } catch (e) {
      failures++;
      console.error(e.message);
    }
  }
  saveManifest(manifest);
  console.log(
    `generate-spec: ${processed} spec(s) written, ${skipped} up to date, ${failures} rejected`,
  );
  if (failures > 0) process.exit(1);
}

main();
