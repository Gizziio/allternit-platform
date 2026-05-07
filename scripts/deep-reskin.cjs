#!/usr/bin/env node
/**
 * Allternit Deep Reskin Engine
 * Comprehensive brand replacement across all 4 forks.
 */

const fs = require('fs');
const path = require('path');

const TARGETS = [
  {
    dir: './lobe-chat',
    name: 'Lobe Chat',
    slug: 'lobe-chat',
    newName: 'Allternit Canvas',
    newSlug: 'allternit-canvas',
    extra: [
      [/LobeHub/g, 'Allternit'],
      [/lobehub/g, 'allternit'],
      [/@lobehub\//g, '@allternit/'],
      [/lobe\.chat/g, 'canvas.allternit.local'],
      [/"name":\s*"@lobehub\/chat"/g, '"name": "@allternit/canvas"'],
    ],
  },
  {
    dir: './docmost',
    name: 'Docmost',
    slug: 'docmost',
    newName: 'Allternit Wiki',
    newSlug: 'allternit-wiki',
    extra: [
      [/"name":\s*"docmost"/g, '"name": "allternit-wiki"'],
      [/docmost\.com/g, 'wiki.allternit.local'],
    ],
  },
  {
    dir: './open-webui',
    name: 'Open WebUI',
    slug: 'open-webui',
    newName: 'Allternit AI',
    newSlug: 'allternit-ai',
    extra: [
      [/"name":\s*"open-webui"/g, '"name": "allternit-ai"'],
      [/openwebui\.com/g, 'ai.allternit.local'],
      [/webui\.com/g, 'ai.allternit.local'],
    ],
  },
  {
    dir: './affine',
    name: 'AFFiNE',
    slug: 'affine',
    newName: 'Allternit Board',
    newSlug: 'allternit-board',
    extra: [
      [/AFFiNE\.pro/g, 'board.allternit.local'],
      [/affine\.pro/g, 'board.allternit.local'],
      [/"name":\s*"affine"/g, '"name": "allternit-board"'],
      [/@affine\//g, '@allternit/'],
    ],
  },
];

const EXTENSIONS = new Set([
  '.ts','.tsx','.js','.jsx','.json','.css','.less','.scss',
  '.html','.md','.yml','.yaml','.toml','.py','.rs','.vue','.svelte'
]);

const SKIP = new Set(['node_modules','.git','.next','dist','build','target','coverage']);

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, cb);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      cb(full);
    }
  }
}

function reskin(target) {
  const base = path.resolve(target.dir);
  if (!fs.existsSync(base)) {
    console.log(`SKIP: ${target.dir} not found`);
    return;
  }

  let files = 0;
  let changed = 0;

  walk(base, (file) => {
    files++;
    const raw = fs.readFileSync(file, 'utf8');
    let next = raw;

    // Primary replacements
    const escName = target.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escSlug = target.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(escName, 'g'), target.newName);
    next = next.replace(new RegExp(escSlug, 'g'), target.newSlug);

    // Case variants
    next = next.replace(new RegExp(escName.toUpperCase(), 'g'), target.newName.toUpperCase());
    next = next.replace(new RegExp(escName.toLowerCase(), 'g'), target.newName.toLowerCase());

    // Extra patterns
    for (const [re, rep] of target.extra) {
      next = next.replace(re, rep);
    }

    if (next !== raw) {
      fs.writeFileSync(file, next, 'utf8');
      changed++;
    }
  });

  console.log(`${target.dir}: scanned ${files} files, changed ${changed}`);

  // Drop brand assets
  const assets = ['logo','brand','favicon','icon','apple-touch-icon','mstile','safari-pinned-tab'];
  for (const a of assets) {
    try {
      for (const ext of ['.png','.svg','.ico','.jpg','.jpeg','.webp']) {
        const p = path.join(base, 'public', a + ext);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    } catch {}
  }

  // Write ORIGIN.md
  const origin = `# Origin Attribution

This repository is a hard fork of **${target.name}**.

- License: see upstream
- Fork date: ${new Date().toISOString().split('T')[0]}
- Fork purpose: Reskin and integration into the Allternit platform.

All original licenses and copyrights remain with the upstream authors.
Modifications are Copyright © Allternit.
`;
  fs.writeFileSync(path.join(base, 'ORIGIN.md'), origin);
}

for (const t of TARGETS) reskin(t);
console.log('\n✅ Deep reskin complete.');
