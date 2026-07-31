#!/usr/bin/env node
/**
 * Offline test for scout.cjs — verifies the three Gherkin scenarios from
 * .steering/spec.md that are testable without network:
 *   (a) 8 stubbed items above threshold -> exactly 5 briefs, 5 slugs in
 *       seen.json, 5 announcements captured.
 *   (b) re-run with same sources -> the remaining 3 backlog items are
 *       briefed (drain, no duplicates); a third run is a true no-op.
 *   (c) rails-ensure failure -> non-zero exit before any brief is written,
 *       and the error names the blocker.
 * No network: fetchAllSources is stubbed via SCOUT_PIPELINE_MODULE, the rails
 * announce via SCOUT_ANNOUNCER, and rails-ensure via SCOUT_RAILS_ENSURE.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const SCOUT = path.join(__dirname, 'scout.cjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-test-'));
const CAPTURE_FILE = path.join(TMP, 'announcements.jsonl');

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

const ITEMS = [
  { title: 'Item Alpha Mechanism', score: 0.95 },
  { title: 'Item Bravo Mechanism', score: 0.9 },
  { title: 'Item Charlie Mechanism', score: 0.85 },
  { title: 'Item Delta Mechanism', score: 0.8 },
  { title: 'Item Echo Mechanism', score: 0.75 },
  { title: 'Item Foxtrot Mechanism', score: 0.6 },
  { title: 'Item Golf Mechanism', score: 0.5 },
  { title: 'Item Hotel Mechanism', score: 0.4 },
];

const fixtureModule = path.join(TMP, 'fixture-pipeline.cjs');
fs.writeFileSync(
  fixtureModule,
  `'use strict';
const items = ${JSON.stringify(
    ITEMS.map((it, i) => ({
      title: it.title,
      url: `https://example.com/item-${i}`,
      text: `excerpt for ${it.title}`,
      source: 'hackernews',
      score: 100 - i,
      relevance: { score: it.score, matched: [], focusAreas: [] },
    })),
  )};
module.exports = {
  fetchAllSources: async () => ({ filtered: items }),
  // no callKimi export: scout must fall back to the TODO(agent) template
};
`,
);

const ensureOk = path.join(TMP, 'ensure-ok.sh');
fs.writeFileSync(ensureOk, '#!/usr/bin/env bash\necho "rails: OK"\nexit 0\n');

const ensureFail = path.join(TMP, 'ensure-fail.sh');
fs.writeFileSync(
  ensureFail,
  '#!/usr/bin/env bash\necho "rails: port 8013 held by an instance that rejects pipeline writes — run `make stop && make api` or stop the packaged app" >&2\nexit 1\n',
);

const announcer = path.join(TMP, 'announcer.cjs');
fs.writeFileSync(
  announcer,
  `'use strict';
const fs = require('fs');
module.exports = async (payload) => {
  fs.appendFileSync(process.env.SCOUT_ANNOUNCE_CAPTURE, JSON.stringify(payload) + '\\n');
};
`,
);

function runScout(env) {
  try {
    const stdout = execFileSync('node', [SCOUT], {
      env: { ...process.env, SCOUT_ANNOUNCE_CAPTURE: CAPTURE_FILE, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// ─── Scenario (a): fresh run produces capped, announced briefs ───────────────

const dirA = path.join(TMP, 'run-a');
const resA = runScout({
  SCOUT_DIR: dirA,
  SCOUT_PIPELINE_MODULE: fixtureModule,
  SCOUT_RAILS_ENSURE: ensureOk,
  SCOUT_ANNOUNCER: announcer,
});

const briefsA = fs.existsSync(path.join(dirA, 'briefs'))
  ? fs.readdirSync(path.join(dirA, 'briefs')).filter((f) => f.endsWith('.md'))
  : [];
const seenA = JSON.parse(fs.readFileSync(path.join(dirA, 'seen.json'), 'utf8'));
const announcedA = readJsonl(CAPTURE_FILE);

check('(a) scout exits 0 on fresh run', resA.status === 0, resA.stderr);
check('(a) exactly 5 briefs written', briefsA.length === 5, `got ${briefsA.length}`);
check('(a) seen.json lists 5 slugs', seenA.length === 5, `got ${seenA.length}`);
check('(a) 5 announcements captured', announcedA.length === 5, `got ${announcedA.length}`);
const expectedTop5 = ['item-alpha-mechanism', 'item-bravo-mechanism', 'item-charlie-mechanism', 'item-delta-mechanism', 'item-echo-mechanism'];
check(
  '(a) top 5 by score selected (dedup filter first, then cap)',
  expectedTop5.every((s) => seenA.includes(s)),
  `seen=${seenA.join(',')}`,
);
check(
  '(a) announcements target wih:pipeline-discovery with brief asset_ref',
  announcedA.every(
    (a) =>
      a.thread === 'wih:pipeline-discovery' &&
      typeof a.asset_ref === 'string' &&
      a.asset_ref.startsWith(path.join(dirA, 'briefs')),
  ),
);
const briefBody = fs.readFileSync(path.join(dirA, 'briefs', `${expectedTop5[0]}.md`), 'utf8');
check(
  '(a) brief has 4 structured sections + TODO(agent) fallback',
  ['What it is', 'Mechanism', 'Integration surface', 'Requirements seed'].every((s) =>
    briefBody.includes(`## ${s}`),
  ) && briefBody.includes('TODO(agent)'),
);

// ─── Scenario (b): re-run drains the backlog without duplicating ────────────

const resB = runScout({
  SCOUT_DIR: dirA,
  SCOUT_PIPELINE_MODULE: fixtureModule,
  SCOUT_RAILS_ENSURE: ensureOk,
  SCOUT_ANNOUNCER: announcer,
});

const briefsB = fs.readdirSync(path.join(dirA, 'briefs')).filter((f) => f.endsWith('.md'));
const seenB = JSON.parse(fs.readFileSync(path.join(dirA, 'seen.json'), 'utf8'));
const announcedB = readJsonl(CAPTURE_FILE);

check('(b) re-run exits 0', resB.status === 0, resB.stderr);
check('(b) remaining 3 backlog items briefed (8 total)', briefsB.length === 8, `got ${briefsB.length}`);
check('(b) seen.json lists all 8 slugs', seenB.length === 8, `got ${seenB.length}`);
check('(b) 3 new announcements (8 total)', announcedB.length === 8, `got ${announcedB.length}`);
check('(b) no item briefed twice', new Set(seenB).size === seenB.length);
check(
  '(b) backlog items are the previously-unseen 3',
  ['item-foxtrot-mechanism', 'item-golf-mechanism', 'item-hotel-mechanism'].every((s) => seenB.includes(s)),
);

// Third run: everything above threshold is seen -> a true no-op.
const resB3 = runScout({
  SCOUT_DIR: dirA,
  SCOUT_PIPELINE_MODULE: fixtureModule,
  SCOUT_RAILS_ENSURE: ensureOk,
  SCOUT_ANNOUNCER: announcer,
});
const briefsB3 = fs.readdirSync(path.join(dirA, 'briefs')).filter((f) => f.endsWith('.md'));
const announcedB3 = readJsonl(CAPTURE_FILE);
check('(b) third run exits 0', resB3.status === 0, resB3.stderr);
check('(b) third run writes nothing', briefsB3.length === 8, `got ${briefsB3.length}`);
check('(b) third run makes no announcements', announcedB3.length === 8, `got ${announcedB3.length}`);

// ─── Scenario (c): rails outage aborts the run loudly ───────────────────────

const dirC = path.join(TMP, 'run-c');
const resC = runScout({
  SCOUT_DIR: dirC,
  SCOUT_PIPELINE_MODULE: fixtureModule,
  SCOUT_RAILS_ENSURE: ensureFail,
  SCOUT_ANNOUNCER: announcer,
});

const briefsC = fs.existsSync(path.join(dirC, 'briefs'))
  ? fs.readdirSync(path.join(dirC, 'briefs')).filter((f) => f.endsWith('.md'))
  : [];

check('(c) scout exits non-zero when rails-ensure fails', resC.status !== 0);
check('(c) no brief written before abort', briefsC.length === 0, `got ${briefsC.length}`);
check(
  '(c) error names the blocker',
  resC.stderr.includes('port 8013') && resC.stderr.includes('rejects pipeline writes'),
  resC.stderr.trim(),
);
check('(c) seen.json never created', !fs.existsSync(path.join(dirC, 'seen.json')));

// ─── Result ─────────────────────────────────────────────────────────────────

fs.rmSync(TMP, { recursive: true, force: true });
if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed.');
