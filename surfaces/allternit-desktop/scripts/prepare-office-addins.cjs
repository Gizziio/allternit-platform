#!/usr/bin/env node
// Cross-platform replacement for the previous inline
//   ALLTERNIT_OFFICE_APP_BASE_URL=... pnpm --dir ../allternit-extensions/... manifest:generate
// which is Unix-only syntax and fails on Windows cmd
// ('ALLTERNIT_OFFICE_APP_BASE_URL' is not recognized — run 8 Windows packaging failure).
//
// Runs the office-addin manifest generator directly with the production URLs
// applied via the child env. Env vars already set in the environment win.

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const addinDir = path.resolve(__dirname, '../../allternit-extensions/allternit-office-addin');
const generator = path.join(addinDir, 'scripts', 'build-manifest.mjs');

const result = spawnSync(process.execPath, [generator], {
  stdio: 'inherit',
  cwd: addinDir,
  env: {
    ...process.env,
    ALLTERNIT_OFFICE_APP_BASE_URL:
      process.env.ALLTERNIT_OFFICE_APP_BASE_URL ||
      'https://platform.allternit.com/office-addins',
    ALLTERNIT_PLATFORM_URL:
      process.env.ALLTERNIT_PLATFORM_URL || 'https://platform.allternit.com',
  },
});

if (result.error) {
  console.error('[prepare-office-addins] failed to start generator:', result.error);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
