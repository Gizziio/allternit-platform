#!/usr/bin/env node
/**
 * VS Code extension tests require a downloadable VS Code runtime.
 * In CI / workspace-wide test runs we skip them; run with
 * RUN_VSCODE_TESTS=1 to invoke the real vscode-test runner.
 */
if (process.env.RUN_VSCODE_TESTS) {
  const { execSync } = require('child_process');
  execSync('vscode-test', { stdio: 'inherit' });
} else {
  console.log(
    'Skipping VS Code integration tests (no RUN_VSCODE_TESTS=1). Set RUN_VSCODE_TESTS=1 to run them.'
  );
}
