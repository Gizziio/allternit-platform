#!/usr/bin/env node
/**
 * File Watcher + Manual Reload Helper
 * Watches for file changes and prompts for reload
 */

import { watch } from 'fs';
import { execSync } from 'child_process';

const WATCH_DIRS = [
  '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/6-ui/a2r-platform/src',
  '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/7-apps/shell/web/src',
];

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  👀 File Watcher for A2R Browser Dev                     ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log('Watching for changes... Press Cmd+R in Chrome to reload');
console.log('Or run: node cdp-helper.mjs list');
console.log('');

let lastChange = Date.now();
let changeCount = 0;

function onFileChange(eventType, filename) {
  if (!filename) return;
  if (!filename.endsWith('.ts') && !filename.endsWith('.tsx') && !filename.endsWith('.css')) return;
  
  changeCount++;
  const now = new Date().toLocaleTimeString();
  lastChange = Date.now();
  
  console.log(`[${now}] 📝 Change #${changeCount}: ${filename}`);
  console.log('          ↳ Press Cmd+R in Chrome to reload');
  console.log('          ↳ Or open http://localhost:5177');
  console.log('');
}

// Start watching
for (const dir of WATCH_DIRS) {
  console.log(`   Watching: ${dir.split('/').pop()}`);
  watch(dir, { recursive: true }, onFileChange);
}

console.log('');
console.log('✅ Watcher active');
console.log('   Press Ctrl+C to stop\n');

// Status update every 30 seconds
setInterval(() => {
  const secondsSince = Math.floor((Date.now() - lastChange) / 1000);
  if (secondsSince > 30 && changeCount > 0) {
    console.log(`[${new Date().toLocaleTimeString()}] 💤 Idle (${secondsSince}s since last change)`);
  }
}, 30000);

// Keep process alive
setInterval(() => {}, 1000);
