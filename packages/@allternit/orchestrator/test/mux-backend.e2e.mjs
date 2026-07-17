// packages/@allternit/orchestrator/test/mux-backend.e2e.mjs
// End-to-end verification of MuxBackend against a live allternit-mux daemon.
// Spawns a fake agent (shell script), exercises the full ExecutorBackend
// surface: spawn → status → send (verified) → tail → watch (sentinel) →
// footprint → kill. Exits non-zero on any failure.
//
// Run: npx tsx packages/@allternit/orchestrator/test/mux-backend.e2e.mjs

import { spawn as spawnProc, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MuxBackend, probeMux } from '../src/backends/mux.backend.ts';

const here = dirname(fileURLToPath(import.meta.url));
const muxBinary = join(here, '..', '..', '..', '..', 'target', 'debug', 'allternit-mux');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const stateDir = mkdtempSync(join(tmpdir(), 'mux-e2e-state-'));
const socketPath = join(stateDir, 'mux.sock');
const workdir = mkdtempSync(join(tmpdir(), 'mux-e2e-work-'));

// Fake agent: waits for a line containing "finish", then writes the ADR-0044
// sentinel notes file.
const agentScript = join(workdir, 'agent.sh');
writeFileSync(
  agentScript,
  `#!/bin/sh
while IFS= read -r line; do
  case "$line" in
    *finish*)
      printf '%s\\n' '---' 'status: done' 'files_changed: [a.ts]' 'deviations: []' 'remaining: []' '---' '' 'all done' > NOTES.md
      ;;
  esac
done
`,
);
chmodSync(agentScript, 0o755);

// Workdir is a git repo so footprint() works.
execFileSync('git', ['-C', workdir, 'init', '-q']);
execFileSync('git', ['-C', workdir, 'add', 'agent.sh']);
execFileSync('git', ['-C', workdir, '-c', 'user.email=e2e@mux', '-c', 'user.name=e2e', 'commit', '-qm', 'init']);

const daemon = spawnProc(muxBinary, ['serve'], {
  env: { ...process.env, ALLTERNIT_MUX_STATE_DIR: stateDir, ALLTERNIT_MUX_SOCKET: socketPath },
  stdio: 'ignore',
});
const cleanup = () => {
  try { daemon.kill('SIGTERM'); } catch { /* gone */ }
};
process.on('exit', cleanup);

try {
  // Wait for the daemon socket.
  let up = false;
  for (let i = 0; i < 100; i++) {
    if (existsSync(socketPath)) { up = true; break; }
    await sleep(100);
  }
  check('daemon socket appears', up);
  check('probeMux sees the daemon', (await probeMux(socketPath)).installed === true);

  const backend = new MuxBackend({ socketPath, stateDir });

  const spec = {
    slug: 'e2e',
    workdir,
    vendor: 'kimi',
    mode: 'interactive',
    launchCommand: `/bin/sh ${agentScript}`,
    isolation: 'none',
    notesFile: 'NOTES.md',
    timeoutMs: 30_000,
    watchIntervalMs: 200,
  };

  const session = await backend.spawn(spec);
  check('spawn returns running', session.state === 'running', `state=${session.state}`);
  check('transcript path recorded', typeof session.transcriptPath === 'string' && session.transcriptPath.endsWith('.scrollback'));

  check('status running', (await backend.status(session)) === 'running');

  const sent = await backend.send(session, 'please finish');
  check('verified send submitted', sent.submitted === true, sent.reason ?? '');

  const outcome = await backend.watch(session, spec);
  check('watch returns done', outcome.kind === 'done');
  if (outcome.kind === 'done') {
    check('report status done', outcome.report.status === 'done');
    check('report filesChanged parsed', JSON.stringify(outcome.report.filesChanged) === '["a.ts"]');
  }

  const tail = await backend.tail(session, 50);
  check('tail returns transcript text', typeof tail === 'string' && tail.length > 0);

  const fp = await backend.footprint(session);
  check('footprint is array', Array.isArray(fp.changedFiles));
  check('footprint sees NOTES.md as changed', fp.changedFiles.includes('NOTES.md'), fp.changedFiles.join(','));

  await backend.kill(session);
  check('status dead after kill', (await backend.status(session)) === 'dead');

  // Transcript (mux scrollback file) captured the session from byte zero.
  check('transcript file exists', existsSync(session.transcriptPath));
} catch (error) {
  failures += 1;
  console.error('FAIL exception:', error);
} finally {
  cleanup();
}

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
