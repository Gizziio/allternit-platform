/**
 * Run the marketplace vitest suites under plain Node with the local shim.
 * Usage: node --import <register-hooks> run-all.mjs [test files...]
 * Defaults to every *.test.ts under the two marketplace surfaces.
 * Exit code is non-zero when any suite fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { drainQueue, resetShim, shimResults } from './vitest-shim.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const DEFAULT_SUITES = [
  'surfaces/allternit-desktop/src/main/mini-app-oauth-broker.test.ts',
  'surfaces/allternit-desktop/src/main/mini-app-policy-proxy.test.ts',
  'surfaces/allternit-desktop/src/main/mini-app-release-installer.test.ts',
  'surfaces/allternit-desktop/src/main/mini-app-sandbox-windows.test.ts',
  'surfaces/allternit-desktop/src/main/mini-app-sandbox.test.ts',
  'surfaces/allternit-desktop/src/main/mini-apps-manager.test.ts',
  'surfaces/allternit-desktop/src/main/mini-app-secrets.test.ts',
  'surfaces/allternit-desktop/src/main/mini-app-approvals.test.ts',
  'surfaces/ai.allternit.com/src/views/aci/mini-app-signing.test.ts',
  'surfaces/ai.allternit.com/src/views/aci/mini-app-review-diff.test.ts',
  'surfaces/ai.allternit.com/src/views/aci/mini-app-lint.test.ts',
  'surfaces/ai.allternit.com/src/views/aci/mini-app-permissions-explain.test.ts',
];

const suites = process.argv.slice(2).length
  ? process.argv.slice(2)
  : DEFAULT_SUITES;

let totalPass = 0;
let totalFail = 0;
const failedSuites = [];

for (const suite of suites) {
  const absolute = path.isAbsolute(suite) ? suite : path.join(repoRoot, suite);
  if (!fs.existsSync(absolute)) {
    console.log(`SKIP ${suite} (missing)`);
    continue;
  }
  resetShim();
  try {
    await import(`${pathToFileURL(absolute).href}?t=${Date.now()}`);
    await drainQueue();
  } catch (error) {
    console.log(`ERROR ${suite}: ${error.message}`);
    totalFail += 1;
    failedSuites.push(suite);
    continue;
  }
  const { pass, fail } = shimResults();
  totalPass += pass;
  totalFail += fail;
  if (fail) failedSuites.push(suite);
  console.log(`${fail ? 'FAIL' : 'PASS'} ${suite} — ${pass} passed, ${fail} failed`);
}

console.log(`\n${totalPass} passed, ${totalFail} failed across ${suites.length} suites`);
if (failedSuites.length) {
  console.log('failing suites:\n  ' + failedSuites.join('\n  '));
}
process.exit(totalFail ? 1 : 0);
