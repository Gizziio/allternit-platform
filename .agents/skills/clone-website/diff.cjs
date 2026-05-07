#!/usr/bin/env node
/**
 * Clone QA Diff Tool
 *
 * Takes a screenshot of a running local URL and generates an HTML side-by-side
 * comparison report against the original captured screenshot.
 *
 * Usage: node diff.cjs <original-png> <local-url> <output-dir>
 *
 * Produces:
 *   <output-dir>/screenshots/clone-desktop.png   — screenshot of local build
 *   <output-dir>/diff-report.html                — side-by-side comparison
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function diff(originalPng, localUrl, outputDir) {
  fs.mkdirSync(path.join(outputDir, 'screenshots'), { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  process.stdout.write(`Screenshotting clone at ${localUrl}...\n`);
  await page.goto(localUrl, { waitUntil: 'networkidle', timeout: 20000 });
  const clonePath = path.join(outputDir, 'screenshots', 'clone-desktop.png');
  await page.screenshot({ path: clonePath, fullPage: true });
  await browser.close();

  process.stdout.write(`Clone screenshot saved → ${clonePath}\n`);

  // Resolve absolute paths for the HTML report
  const origAbs = path.resolve(originalPng);
  const cloneAbs = path.resolve(clonePath);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Clone Diff Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #111; color: #eee; font-family: system-ui, sans-serif; padding: 24px; }
  h1 { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #D4B08C; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .panel h2 { font-size: 13px; font-weight: 500; margin-bottom: 8px; color: #9B9B9B; letter-spacing: 0.04em; text-transform: uppercase; }
  .panel img { width: 100%; border: 1px solid rgba(212,176,140,0.15); border-radius: 8px; }
  .meta { margin-top: 16px; font-size: 12px; color: #666; }
</style>
</head>
<body>
<h1>Clone Diff Report — ${new Date().toLocaleString()}</h1>
<div class="grid">
  <div class="panel">
    <h2>Original</h2>
    <img src="${origAbs}" alt="original">
  </div>
  <div class="panel">
    <h2>Clone</h2>
    <img src="${cloneAbs}" alt="clone">
  </div>
</div>
<p class="meta">Review both screenshots above. Identify layout, color, typography, and spacing differences. Patch the components accordingly.</p>
</body>
</html>`;

  const reportPath = path.join(outputDir, 'diff-report.html');
  fs.writeFileSync(reportPath, html);
  process.stdout.write(`Diff report → ${reportPath}\n`);
  process.stdout.write('Open the report, compare both screenshots, and note discrepancies.\n');
}

const [,, originalPng, localUrl, outputDir] = process.argv;
if (!originalPng || !localUrl || !outputDir) {
  process.stderr.write('Usage: node diff.cjs <original-png> <local-url> <output-dir>\n');
  process.exit(1);
}

diff(originalPng, localUrl, outputDir).catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
