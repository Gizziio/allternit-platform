#!/usr/bin/env node
/**
 * Website Style Extractor
 *
 * Visits a URL with Playwright, extracts computed styles, design tokens,
 * assets, and screenshots at three breakpoints.
 *
 * Usage: node extract-styles.cjs <url> <output-dir>
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VISUAL_PROPS = [
  'color', 'background-color', 'background-image', 'background-size',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'text-align', 'text-transform', 'text-decoration',
  'display', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content',
  'gap', 'grid-template-columns', 'grid-template-rows',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'width', 'height', 'max-width', 'min-height',
  'border', 'border-radius', 'border-color', 'border-width', 'border-style',
  'box-shadow', 'text-shadow', 'opacity',
  'backdrop-filter', '-webkit-backdrop-filter', 'filter',
  'transform', 'transition', 'animation',
  'position', 'top', 'right', 'bottom', 'left', 'z-index',
  'overflow', 'cursor',
];

const COMPONENT_SELECTORS = [
  'header', 'nav', 'main', 'footer', 'aside',
  'section', 'article', 'form',
  '[class*="hero"]', '[class*="banner"]', '[class*="navbar"]',
  '[class*="header"]', '[class*="footer"]', '[class*="sidebar"]',
  '[class*="card"]', '[class*="feature"]', '[class*="pricing"]',
  '[class*="testimonial"]', '[class*="cta"]', '[class*="faq"]',
  '[class*="navigation"]', '[class*="nav-"]',
  '[id*="hero"]', '[id*="features"]', '[id*="pricing"]', '[id*="about"]',
  '[role="banner"]', '[role="navigation"]', '[role="main"]', '[role="contentinfo"]',
  '[role="complementary"]',
];

async function extract(url, outputDir) {
  fs.mkdirSync(path.join(outputDir, 'screenshots'), { recursive: true });

  const browser = await chromium.launch();

  try {
    // ── Desktop (1440px) ──────────────────────────────────────────────────────
    const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desktopCtx.newPage();

    process.stdout.write(`Navigating to ${url}...\n`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Screenshot — desktop
    await page.screenshot({
      path: path.join(outputDir, 'screenshots', 'original-desktop.png'),
      fullPage: true,
    });
    process.stdout.write('Desktop screenshot captured.\n');

    // ── Root CSS variables (design tokens) ───────────────────────────────────
    const rootVars = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const vars = {};
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText === ':root') {
              const text = rule.cssText;
              const matches = text.match(/--[\w-]+:\s*[^;]+/g) || [];
              for (const m of matches) {
                const [k, v] = m.split(':').map(s => s.trim());
                vars[k] = v;
              }
            }
          }
        } catch (_) { /* cross-origin sheet — skip */ }
      }
      // Also resolve computed values of the vars we found
      const resolved = {};
      for (const key of Object.keys(vars)) {
        resolved[key] = styles.getPropertyValue(key).trim();
      }
      return resolved;
    });

    // ── Font faces ───────────────────────────────────────────────────────────
    const fontFaces = await page.evaluate(() => {
      const faces = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSFontFaceRule) {
              faces.push(rule.cssText);
            }
          }
        } catch (_) { /* cross-origin */ }
      }
      return faces;
    });

    // ── Component boundaries with computed styles ─────────────────────────────
    const selectorList = [
      'header', 'nav', 'main', 'footer', 'aside', 'section', 'article', 'form',
      '[class*="hero"]', '[class*="banner"]', '[class*="navbar"]',
      '[class*="header"]', '[class*="footer"]', '[class*="sidebar"]',
      '[class*="card"]:not([class*="card"] [class*="card"])',
      '[class*="feature"]', '[class*="pricing"]', '[class*="testimonial"]',
      '[class*="cta"]', '[class*="faq"]', '[class*="navigation"]',
      '[role="banner"]', '[role="navigation"]', '[role="main"]', '[role="contentinfo"]',
    ];

    const components = await page.evaluate((selectors, props) => {
      const seen = new Set();
      const results = [];

      for (const sel of selectors) {
        let elements;
        try { elements = Array.from(document.querySelectorAll(sel)); } catch (_) { continue; }

        for (const el of elements.slice(0, 3)) {
          const key = el.tagName + (el.id || el.className?.slice(0, 40) || '');
          if (seen.has(key)) continue;
          seen.add(key);

          const computed = window.getComputedStyle(el);
          const styles = {};
          for (const prop of props) {
            const val = computed.getPropertyValue(prop).trim();
            if (val && val !== 'none' && val !== 'normal' && val !== 'auto') {
              styles[prop] = val;
            }
          }

          const rect = el.getBoundingClientRect();
          results.push({
            selector: sel,
            tagName: el.tagName.toLowerCase(),
            id: el.id || null,
            className: el.className?.slice(0, 80) || null,
            role: el.getAttribute('role') || null,
            innerTextPreview: (el.innerText || '').slice(0, 200),
            htmlPreview: el.outerHTML.slice(0, 600),
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
            styles,
          });
        }
      }
      return results;
    }, selectorList, VISUAL_PROPS);

    // ── Asset inventory ───────────────────────────────────────────────────────
    const assets = await page.evaluate(() => {
      const imgs = Array.from(document.images).map(i => i.src).filter(Boolean);

      const bgImages = [];
      for (const el of document.querySelectorAll('*')) {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none') {
          const match = bg.match(/url\(["']?([^"')]+)["']?\)/g);
          if (match) bgImages.push(...match.map(m => m.slice(4, -1).replace(/['"]/g, '')));
        }
      }

      const fonts = Array.from(document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="font"]'))
        .map(l => l.href).filter(Boolean);

      const svgs = Array.from(document.querySelectorAll('img[src$=".svg"], use[href], symbol[id]'))
        .map(el => el.src || el.getAttribute('href') || el.id).filter(Boolean);

      return {
        images: [...new Set(imgs)],
        backgroundImages: [...new Set(bgImages)],
        fonts,
        svgs: [...new Set(svgs)],
      };
    });

    // ── Color frequency analysis ──────────────────────────────────────────────
    const colorFreq = await page.evaluate(() => {
      const freq = {};
      for (const el of document.querySelectorAll('*')) {
        const s = window.getComputedStyle(el);
        for (const prop of ['color', 'background-color', 'border-color']) {
          const val = s.getPropertyValue(prop).trim();
          if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
            freq[val] = (freq[val] || 0) + 1;
          }
        }
      }
      return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([color, count]) => ({ color, count }));
    });

    // ── Page metadata ─────────────────────────────────────────────────────────
    const meta = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
    }));

    await desktopCtx.close();

    // ── Tablet (768px) ────────────────────────────────────────────────────────
    const tabletCtx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const tabletPage = await tabletCtx.newPage();
    await tabletPage.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await tabletPage.screenshot({
      path: path.join(outputDir, 'screenshots', 'original-tablet.png'),
      fullPage: true,
    });
    await tabletCtx.close();

    // ── Mobile (375px) ────────────────────────────────────────────────────────
    const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await mobilePage.screenshot({
      path: path.join(outputDir, 'screenshots', 'original-mobile.png'),
      fullPage: true,
    });
    await mobileCtx.close();

    process.stdout.write('All breakpoint screenshots captured.\n');

    // ── Write extracted.json ──────────────────────────────────────────────────
    const extracted = {
      url,
      extractedAt: new Date().toISOString(),
      meta,
      rootVars,
      fontFaces,
      components,
      assets,
      colorFrequency: colorFreq,
      screenshots: {
        desktop: 'screenshots/original-desktop.png',
        tablet: 'screenshots/original-tablet.png',
        mobile: 'screenshots/original-mobile.png',
      },
    };

    const outPath = path.join(outputDir, 'extracted.json');
    fs.writeFileSync(outPath, JSON.stringify(extracted, null, 2));
    process.stdout.write(`Extraction complete → ${outPath}\n`);
    process.stdout.write(`Components found: ${components.length}\n`);
    process.stdout.write(`Root CSS vars: ${Object.keys(rootVars).length}\n`);
    process.stdout.write(`Assets: ${assets.images.length} images, ${assets.fonts.length} fonts\n`);

  } finally {
    await browser.close();
  }
}

const [,, url, outputDir] = process.argv;
if (!url || !outputDir) {
  process.stderr.write('Usage: node extract-styles.cjs <url> <output-dir>\n');
  process.exit(1);
}

extract(url, outputDir).catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
