// Renders public/icon-source.svg into the PNG icons the Office manifests
// reference (icon-16.png / icon-32.png / icon-80.png at the app base URL).
// Runs as part of prebuild; vite copies public/ into dist/ and the platform
// postbuild embeds them at /office-addins/.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const svgPath = join(root, 'public', 'icon-source.svg');
const svg = readFileSync(svgPath, 'utf8');

for (const size of [16, 32, 80]) {
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0, 0, 0, 0)',
  })
    .render()
    .asPng();
  const out = join(root, 'public', `icon-${size}.png`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png);
  console.log(`built ${out} (${png.byteLength} bytes)`);
}
