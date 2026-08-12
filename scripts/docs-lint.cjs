#!/usr/bin/env node
/**
 * Lightweight docs linter.
 *
 * - Verifies the expected Phase 4 docs/public files exist.
 * - Checks local Markdown links inside docs/public.
 * - Type-checks the SDK examples if TypeScript is available.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DOCS_PUBLIC = path.join(ROOT, 'docs', 'public');

const REQUIRED_FILES = [
  'gizzi/index.md',
  'gizzi/configuration.md',
  'sdk/typescript-quickstart.md',
  'sdk/examples/chat-with-tools.ts',
  'sdk/examples/stream-events.ts',
  'sdk/examples/run-batch.ts',
  'sdk/examples/tsconfig.json',
  'cli/admin.md',
];

let failed = false;

function fail(message) {
  failed = true;
  process.stderr.write(`FAIL: ${message}\n`);
}

function pass(message) {
  process.stdout.write(`PASS: ${message}\n`);
}

// 1. Required files exist.
for (const file of REQUIRED_FILES) {
  const full = path.join(DOCS_PUBLIC, file);
  if (!fs.existsSync(full)) {
    fail(`missing required file: docs/public/${file}`);
  } else {
    pass(`docs/public/${file} exists`);
  }
}

// 2. Simple local markdown link check inside docs/public.
const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
const mdFiles = [];

function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(full);
    } else if (entry.name.endsWith('.md')) {
      mdFiles.push(full);
    }
  }
}

collect(DOCS_PUBLIC);

for (const file of mdFiles) {
  const text = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = linkPattern.exec(text)) !== null) {
    const raw = match[2];
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('mailto:')) {
      continue;
    }
    const target = raw.split('#')[0];
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) {
      fail(`broken link in ${path.relative(ROOT, file)}: ${raw}`);
    }
  }
}
pass('all local markdown links resolve');

// 3. Type-check SDK examples.
try {
  execSync('npx tsc --noEmit -p docs/public/sdk/examples/tsconfig.json', {
    cwd: ROOT,
    stdio: 'inherit',
  });
  pass('SDK examples type-check');
} catch (error) {
  fail('SDK examples failed type-check');
}

if (failed) {
  process.exit(1);
}
process.stdout.write('\nDocs lint passed.\n');
