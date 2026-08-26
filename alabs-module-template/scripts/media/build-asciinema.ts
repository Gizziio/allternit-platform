#!/usr/bin/env npx tsx
/**
 * Build an Asciinema terminal recording asset for inclusion in an A://Labs module.
 *
 * Reads a .cast file and inlines it into an <asciinema-player> tag. The player
 * CSS/JS is loaded by the shared shell when this media type is used.
 */

import * as fs from 'fs/promises';

export interface AsciinemaAsset {
  id: string;
  src: string;
}

export async function buildAsciinema(asset: AsciinemaAsset): Promise<string> {
  const cast = await fs.readFile(asset.src, 'utf-8');
  const trimmed = cast.trim();

  if (!trimmed) {
    throw new Error(`Asciinema cast is empty: ${asset.src}`);
  }

  // Inline the cast data as a data URI to keep modules self-contained.
  const dataUri = `data:application/json;base64,${Buffer.from(trimmed).toString('base64')}`;

  return `
<div class="asciinema-wrapper alabs-media" data-media-id="${asset.id}">
  <asciinema-player src="${dataUri}" theme="monokai" speed="1.2" cols="80" rows="24"></asciinema-player>
</div>
  `.trim();
}

// CLI usage for testing
async function main() {
  const srcIdx = process.argv.indexOf('--src');
  const idIdx = process.argv.indexOf('--id');
  if (srcIdx === -1 || idIdx === -1) {
    console.error('Usage: build-asciinema.ts --src <file.cast> --id <asset-id>');
    process.exit(1);
  }
  const html = await buildAsciinema({ src: process.argv[srcIdx + 1], id: process.argv[idIdx + 1] });
  console.log(html);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
