#!/usr/bin/env npx tsx
/**
 * Build a Mermaid diagram asset for inclusion in an A://Labs module.
 *
 * Reads a .mmd source file and returns inline HTML that Mermaid's client-side
 * renderer will convert to an SVG inside the module.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface MermaidAsset {
  id: string;
  src: string;
}

export async function buildMermaid(asset: MermaidAsset): Promise<string> {
  const source = await fs.readFile(asset.src, 'utf-8');
  const diagram = source.trim();

  if (!diagram) {
    throw new Error(`Mermaid source is empty: ${asset.src}`);
  }

  // Escape HTML special characters so the diagram source renders literally
  const escaped = diagram
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<pre class="mermaid alabs-media" data-media-id="${asset.id}">${escaped}</pre>`;
}

// CLI usage for testing
async function main() {
  const srcIdx = process.argv.indexOf('--src');
  const idIdx = process.argv.indexOf('--id');
  if (srcIdx === -1 || idIdx === -1) {
    console.error('Usage: build-mermaid.ts --src <file.mmd> --id <asset-id>');
    process.exit(1);
  }
  const html = await buildMermaid({ src: process.argv[srcIdx + 1], id: process.argv[idIdx + 1] });
  console.log(html);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
