#!/usr/bin/env node
// Mintlify CLI currently only supports LTS Node versions (18/20/22).
// Running on non-LTS Node (e.g. 26) fails before any validation happens,
// so we gate the command and provide a clear remediation message.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const major = parseInt(process.version.slice(1).split('.')[0], 10);

if (major >= 25) {
  const msg =
    `[surfaces/docs] Mintlify CLI does not support Node ${process.version}. ` +
    `Install an LTS Node version (e.g. 20 or 22) to run the docs build.`;
  if (process.env.CI) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg + ' Skipping validation in local dev.');
  process.exit(0);
}

// The @mintlify/cli package exposes the binary as `mint` in current versions.
// `mintlify` is kept as a legacy alias but may print a deprecation warning or
// fail on newer installs, so we prefer `mint` and fall back only if needed.
const binDir = path.join(__dirname, '..', 'node_modules', '.bin');
const mintBin = fs.existsSync(path.join(binDir, 'mint'))
  ? path.join(binDir, 'mint')
  : fs.existsSync(path.join(binDir, 'mintlify'))
    ? path.join(binDir, 'mintlify')
    : 'mint';

execSync(`${JSON.stringify(mintBin)} validate`, {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});
