import { describe, it, expect } from 'vitest';
import { composeStudioSystemPrompt } from './studio-system-prompt';

describe('composeStudioSystemPrompt — design taste steering', () => {
  const prompt = composeStudioSystemPrompt();

  it('carries the adapted Design taste block with upstream attribution', () => {
    expect(prompt).toContain('## Design taste (steering — binding)');
    expect(prompt).toContain('frontend-design');
    expect(prompt).toContain('anthropics/skills');
    expect(prompt).toContain('skills/references/frontend-design.md');
  });

  it('plans tokens before code', () => {
    expect(prompt).toContain('Plan tokens before code');
    expect(prompt).toContain(':root custom properties');
  });

  it('states the contrast floor (WCAG AA)', () => {
    expect(prompt).toContain('4.5:1');
    expect(prompt).toMatch(/contrast/i);
  });

  it('bans emoji icons in favour of inline SVG', () => {
    expect(prompt).toContain('inline SVG with currentColor only');
    expect(prompt).toMatch(/never emoji as icons/i);
  });

  it('restates the deny-list against the html-linter P0s (coral + purple families)', () => {
    expect(prompt).toContain('#D97757');
    expect(prompt).toContain('#E27C59');
    expect(prompt).toContain('purple/indigo/violet');
    expect(prompt).toContain('html-linter.ts');
    // Amber family is brand law, not an AI tell
    expect(prompt).toContain('#B08D6E');
    expect(prompt).toContain('#C4A684');
    expect(prompt).toContain('#9A7658');
  });

  it('keeps Inter as local fallback intent rather than an outright ban', () => {
    // The A:// craft rules carry the Inter-fallback alias; the existing anti-slop
    // list only bans Inter as a *display* face (body text is fine) — upstream's
    // blanket Inter ban is intentionally not ported (mapping doc §4).
    expect(prompt).toContain('Inter acceptable ONLY as the local fallback');
    expect(prompt).toContain('as a *display* face (body text is fine)');
  });

  it('bans invented content and template-chrome defaults', () => {
    expect(prompt).toContain('[METRIC]');
    expect(prompt).toContain('Spend your boldness in one place');
    expect(prompt).toContain('one decisive gradient per design');
  });

  it('still emits the base identity, craft rules, and discovery directives', () => {
    expect(prompt).toContain('## A:// craft rules (binding)');
    expect(prompt).toContain('expert designer working with the user as your manager');
    expect(prompt).toContain('RULE 1 — turn 1 must emit');
  });
});

describe('composeStudioSystemPrompt — self-verification (render and compare, P1.5)', () => {
  const prompt = composeStudioSystemPrompt();

  it('instructs render-and-compare before finalizing the artifact', () => {
    expect(prompt).toContain('## Self-verification — render and compare (binding, max 2 passes)');
    expect(prompt).toContain('BEFORE emitting `<artifact>`');
    // Defect categories to check against the brief
    expect(prompt).toMatch(/overflow\/clipping/i);
    expect(prompt).toMatch(/contrast/i);
    expect(prompt).toMatch(/hierarchy/i);
    expect(prompt).toMatch(/alignment/i);
  });

  it('gives the exact render script command line', () => {
    expect(prompt).toContain('node scripts/render-artifact-screenshot.mjs --html-file /tmp/studio-verify.html');
    expect(prompt).toContain('--width 1280 --height 800');
  });

  it('caps the render passes at 2', () => {
    expect(prompt).toContain('max 2 render passes total');
  });

  it('persists the final screenshot as a project file under /.renders/', () => {
    expect(prompt).toContain('/.renders/<timestamp>.png');
  });

  it('requires honesty when the renderer is unavailable', () => {
    expect(prompt).toContain('never claim you rendered when you did not');
  });
});
