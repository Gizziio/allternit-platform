#!/usr/bin/env node
// Vendor noVNC (core/ + vendor/) from node_modules into assets/novnc/ so the
// allternit-api embed viewer can serve it locally — NO CDN. Run after install:
//
//   pnpm install            # from the repo root (workspace picks up cmd/*)
//   node scripts/vendor-novnc.mjs
//
// Only `core/` (ES modules incl. rfb.js) and `vendor/` (promise, pako) are
// required for the RFB protocol; `app/`, `locale/`, and the full vnc.html UI
// are deliberately NOT copied.

import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const crateRoot = path.resolve(here, "..");
const outDir = path.join(crateRoot, "assets", "novnc");

// Resolve @novnc/novnc through Node's resolver so this works whether the
// package was installed by pnpm (symlinked) or npm. The exports map does not
// expose ./package.json, so resolve the main entry and walk up to the
// package root (the first ancestor containing core/ + vendor/).
const require = createRequire(path.join(crateRoot, "package.json"));
const entry = require.resolve("@novnc/novnc");
let novncDir = path.dirname(entry);
while (
  !existsSync(path.join(novncDir, "core")) ||
  !existsSync(path.join(novncDir, "vendor"))
) {
  const parent = path.dirname(novncDir);
  if (parent === novncDir) {
    throw new Error(`could not locate @novnc/novnc package root from ${entry}`);
  }
  novncDir = parent;
}

for (const sub of ["core", "vendor"]) {
  const src = path.join(novncDir, sub);
  if (!existsSync(src) || !statSync(src).isDirectory()) {
    throw new Error(`@novnc/novnc is missing ${sub}/ — run pnpm install first`);
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const sub of ["core", "vendor"]) {
  cpSync(path.join(novncDir, sub), path.join(outDir, sub), { recursive: true });
}

// Package license/readme ride along for attribution.
for (const extra of ["LICENSE.txt", "README.md", "package.json"]) {
  const src = path.join(novncDir, extra);
  if (existsSync(src)) cpSync(src, path.join(outDir, extra));
}

console.log(`vendored @novnc/novnc ${novncDir} -> ${outDir}`);
