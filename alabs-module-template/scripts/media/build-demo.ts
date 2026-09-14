#!/usr/bin/env npx tsx
/**
 * Build a runnable demo for inclusion in an A://Labs module.
 *
 * Copies a source demo folder to `alabs-generated-courses/demos/{id}/` and returns
 * an iframe embed. Demos can be plain HTML/JS/TS files; if a Vite build is needed
 * later, this script can be extended to run `vite build`.
 *
 * Source folder structure:
 *   alabs-generated-courses/media/src/{id}/
 *   ├── index.html
 *   ├── main.js
 *   └── style.css
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface DemoAsset {
  id: string;
  src: string;
}

export async function buildDemo(asset: DemoAsset, worktreeRoot: string): Promise<string> {
  const sourceDir = path.isAbsolute(asset.src)
    ? asset.src
    : path.join(worktreeRoot, asset.src);

  const outputDir = path.join(worktreeRoot, 'alabs-generated-courses/demos', asset.id);

  // Validate source
  const indexPath = path.join(sourceDir, 'index.html');
  try {
    await fs.access(indexPath);
  } catch {
    throw new Error(`Demo source must contain index.html: ${sourceDir}`);
  }

  // Ensure output directory exists and is empty
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  // Copy all files recursively
  async function copyRecursive(src: string, dest: string) {
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await copyRecursive(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  await copyRecursive(sourceDir, outputDir);

  return `
<div class="demo-embed alabs-media" data-media-id="${asset.id}">
  <div class="demo-header">
    <span class="demo-label">Runnable demo</span>
    <a href="demos/${asset.id}/index.html" target="_blank" rel="noopener">Open in new tab ↗</a>
  </div>
  <iframe src="demos/${asset.id}/index.html" loading="lazy" title="${asset.id} demo"></iframe>
</div>
  `.trim();
}

// CLI usage for testing
async function main() {
  const srcIdx = process.argv.indexOf('--src');
  const idIdx = process.argv.indexOf('--id');
  const rootIdx = process.argv.indexOf('--root');
  if (srcIdx === -1 || idIdx === -1) {
    console.error('Usage: build-demo.ts --src <folder> --id <asset-id> --root <worktree-root>');
    process.exit(1);
  }
  const worktreeRoot = rootIdx === -1 ? process.cwd() : process.argv[rootIdx + 1];
  const html = await buildDemo({ src: process.argv[srcIdx + 1], id: process.argv[idIdx + 1] }, worktreeRoot);
  console.log(html);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
