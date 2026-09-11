import { describe, it, expect } from 'vitest';
import {
  lintGeneratedHtml,
  getP0Findings,
  isBrandP0Violation,
  BRAND_P0_RULES,
} from './html-linter';

const AI_SLOP_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Slop</title>
  <style>
    :root { --accent: #8b5cf6; }
    .hero { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
    .cta { background: #B08D6E; }
    .legacy { color: #e27c59; }
    .legacy2 { color: #d97757; }
  </style>
</head>
<body>
  <h1>Lorem ipsum dolor sit amet</h1>
  <p>Trusted by 50,000 teams worldwide — 10x faster with 99.9% uptime.</p>
  <ul>
    <li>✨ Feature One</li>
    <li>🚀 Feature Two</li>
  </ul>
</body>
</html>`;

const CLEAN_AMBER_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Allternit landing</title>
  <style>
    :root {
      --bg: #FAF8F4;
      --surface: #F5F3EE;
      --ink: #1F1B16;
      --muted: #8F7A66;
      --border: #DDD8CD;
      --accent: #B08D6E;
    }
    body { background: var(--bg); color: var(--ink); font-family: "Allternit Sans", Inter, system-ui, sans-serif; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
    .cta { background: var(--accent); color: #fff; }
    .cta:hover { background: #C4A684; }
    .kicker { font-family: "Allternit Mono", "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
  </style>
</head>
<body>
  <main class="card">
    <p class="kicker">Field notes</p>
    <h1>Design systems that survive contact with production</h1>
    <p>Allternit ships ivory-surface interfaces with a single amber accent, so product and marketing never drift apart.</p>
    <button class="cta" type="button">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 8h12M9 3l5 5-5 5"/></svg>
      Start a project
    </button>
  </main>
</body>
</html>`;

describe('html-linter: AI-slop fixture', () => {
  const result = lintGeneratedHtml(AI_SLOP_HTML);

  it('produces P0 (error) findings', () => {
    const errors = result.violations.filter((v) => v.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(result.passed).toBe(false);
  });

  it('flags purple/indigo accents', () => {
    expect(result.violations.some((v) => v.rule === 'no-purple-accent')).toBe(true);
  });

  it('flags legacy coral hexes as brand P0', () => {
    expect(result.violations.some((v) => v.rule === 'no-legacy-coral')).toBe(true);
    const brand = result.violations.filter(isBrandP0Violation);
    expect(brand.some((v) => v.rule === 'no-legacy-coral')).toBe(true);
  });

  it('flags emoji icons, lorem ipsum, filler features, invented metrics, trust gradient', () => {
    const rules = result.violations.map((v) => v.rule);
    expect(rules).toContain('no-emoji-icons');
    expect(rules).toContain('no-lorem');
    expect(rules).toContain('no-filler-features');
    expect(rules).toContain('no-invented-metrics');
    expect(rules).toContain('no-trust-gradient');
  });

  it('exposes P0 findings as a flat list', () => {
    const findings = getP0Findings(result);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.startsWith('['))).toBe(true);
  });
});

describe('html-linter: clean amber/ivory fixture', () => {
  const result = lintGeneratedHtml(CLEAN_AMBER_HTML);

  it('passes with zero P0 findings', () => {
    const errors = result.violations.filter((v) => v.severity === 'error');
    expect(errors).toEqual([]);
    expect(result.passed).toBe(true);
    expect(getP0Findings(result)).toEqual([]);
  });

  it('does not flag brand P0 rules', () => {
    expect(result.violations.filter(isBrandP0Violation)).toEqual([]);
    expect(BRAND_P0_RULES).toEqual(['no-legacy-coral', 'no-purple-accent']);
  });
});
