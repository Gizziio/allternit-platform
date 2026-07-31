#!/usr/bin/env node
/**
 * Offline test for generate-spec.cjs. Fixture briefs (valid + two malformed)
 * in a temp GENERATOR_DIR; asserts:
 *   - valid brief -> spec with all seed requirements present, EARS form
 *     preserved, one Gherkin scenario per requirement, Excluded merged into
 *     Out of scope;
 *   - malformed briefs rejected with errors naming the brief and the
 *     offending line; non-zero exit;
 *   - byte-identical regeneration (run twice, diff);
 *   - .generated.json manifest maps slug -> brief sha256, and unchanged
 *     briefs are skipped in all-briefs mode.
 * No network, no LLM. PASS/FAIL lines, non-zero exit on any FAIL.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const GENERATOR = path.join(__dirname, 'generate-spec.cjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-spec-test-'));
const BRIEFS = path.join(TMP, 'briefs');
const SPECS = path.join(TMP, 'specs');
fs.mkdirSync(BRIEFS, { recursive: true });

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    failures++;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const VALID_SEED = [
  'WHEN a scheduler tick fires, THE SYSTEM SHALL dispatch every due job exactly once',
  'WHEN a job handler throws, THE SYSTEM SHALL retry the job with exponential backoff',
  'WHEN retries are exhausted, THE SYSTEM SHALL move the job to the dead-letter queue',
];

const validBrief = `# Deterministic Job Scheduler

- Source: hackernews
- URL: https://example.com/scheduler
- Relevance score: 0.9
- Discovered: 2026-07-31T00:00:00.000Z

## What it is

A deterministic job scheduler that dispatches due jobs on a tick and isolates
handler failures behind retry and dead-letter semantics.

## Mechanism

- Jobs are stored in a priority queue ordered by due time
- A single tick loop pops due jobs and invokes handlers

## Integration surface

- infra/scheduler: add a tick driver and due-job index
- domains/agent: handlers become agent tool calls

## Requirements seed

- ${VALID_SEED[0]}
- ${VALID_SEED[1]}
- ${VALID_SEED[2]}

## Excluded

- Distributed multi-node scheduling (single node only)
`;

const missingSeedBrief = `# Missing Seed

- Source: hackernews
- URL: https://example.com/missing

## What it is

A brief with no requirements seed section.

## Mechanism

- nothing here
`;

const badBulletBrief = `# Bad Bullet

- Source: hackernews
- URL: https://example.com/bad

## What it is

A brief whose requirements seed contains a non-EARS bullet.

## Requirements seed

- WHEN a tick fires, THE SYSTEM SHALL dispatch jobs
- the system should probably also log stuff
`;

fs.writeFileSync(path.join(BRIEFS, 'valid-brief.md'), validBrief);
fs.writeFileSync(path.join(BRIEFS, 'missing-seed.md'), missingSeedBrief);
fs.writeFileSync(path.join(BRIEFS, 'bad-bullet.md'), badBulletBrief);

function runGenerator(args) {
  try {
    const stdout = execFileSync('node', [GENERATOR, ...args], {
      env: { ...process.env, GENERATOR_DIR: TMP },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ─── Valid brief -> spec ────────────────────────────────────────────────────

const validPath = path.join(BRIEFS, 'valid-brief.md');
const resValid = runGenerator([validPath]);
check('valid brief exits 0', resValid.status === 0, resValid.stderr);

const specPath = path.join(SPECS, 'valid-brief.md');
const spec = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : '';
check('spec file written', spec.length > 0);

VALID_SEED.forEach((seed, i) => {
  check(`R${i + 1} present verbatim (EARS preserved)`, spec.includes(`- [ ] R${i + 1}: ${seed}`));
});
check('one Gherkin scenario per requirement', (spec.match(/- Scenario: R\d+ — /g) || []).length === 3);
check(
  'Gherkin expansion is mechanical (When=trigger, Then=behavior)',
  spec.includes('  When a scheduler tick fires') &&
    spec.includes('  Then the system SHALL dispatch every due job exactly once'),
);
check('Context from What it is + source URL', spec.includes('## Context') && spec.includes('Source: https://example.com/scheduler'));
check('Excluded merged into Out of scope', spec.includes('## Out of scope') && spec.includes('Distributed multi-node scheduling'));

// ─── Determinism: byte-identical regeneration ───────────────────────────────

const firstBytes = fs.readFileSync(specPath);
const resRegen = runGenerator([validPath]);
const secondBytes = fs.readFileSync(specPath);
check('regeneration exits 0', resRegen.status === 0, resRegen.stderr);
check('regeneration is byte-identical', Buffer.compare(firstBytes, secondBytes) === 0);

// ─── Manifest ───────────────────────────────────────────────────────────────

const manifest = JSON.parse(fs.readFileSync(path.join(SPECS, '.generated.json'), 'utf8'));
check(
  'manifest maps slug -> brief sha256',
  manifest['valid-brief'] === sha256(validBrief),
  JSON.stringify(manifest),
);

// All-briefs mode: unchanged valid brief skipped, malformed ones rejected.
const resAll = runGenerator([]);
check('all-briefs mode exits non-zero (malformed present)', resAll.status !== 0);
check(
  'all-briefs mode skips up-to-date brief',
  resAll.stdout.includes('0 spec(s) written, 1 up to date, 2 rejected'),
  resAll.stdout.trim(),
);

// ─── Malformed briefs ───────────────────────────────────────────────────────

const resMissing = runGenerator([path.join(BRIEFS, 'missing-seed.md')]);
check('missing-seed brief exits non-zero', resMissing.status !== 0);
check(
  'missing-seed error names the brief and the section',
  resMissing.stderr.includes('missing-seed.md') && resMissing.stderr.includes("missing required section '## Requirements seed'"),
  resMissing.stderr.trim(),
);

const resBad = runGenerator([path.join(BRIEFS, 'bad-bullet.md')]);
check('bad-bullet brief exits non-zero', resBad.status !== 0);
check(
  'bad-bullet error names the brief, line number and offending line',
  resBad.stderr.includes('bad-bullet.md') &&
    /line \d+/.test(resBad.stderr) &&
    resBad.stderr.includes('the system should probably also log stuff'),
  resBad.stderr.trim(),
);
check(
  'bad-bullet error states the expected WHEN/SHALL shape',
  resBad.stderr.includes('WHEN <trigger>, THE SYSTEM SHALL'),
  resBad.stderr.trim(),
);
check('no spec written for rejected briefs', !fs.existsSync(path.join(SPECS, 'bad-bullet.md')) && !fs.existsSync(path.join(SPECS, 'missing-seed.md')));

// ─── Result ─────────────────────────────────────────────────────────────────

fs.rmSync(TMP, { recursive: true, force: true });
if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed.');
