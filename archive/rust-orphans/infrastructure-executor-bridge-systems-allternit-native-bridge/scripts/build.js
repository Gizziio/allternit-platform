const { spawnSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isDebug = args.includes('--debug');
const napiBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'napi.cmd' : 'napi'
);

if (!existsSync(napiBin)) {
  console.warn('[native-bridge] @napi-rs/cli not installed; skipping native build.');
  process.exit(0);
}

const napiArgs = ['build', '--platform'];
if (!isDebug) {
  napiArgs.push('--release');
}

const result = spawnSync(napiBin, napiArgs, { stdio: 'inherit' });
process.exit(result.status ?? 1);
