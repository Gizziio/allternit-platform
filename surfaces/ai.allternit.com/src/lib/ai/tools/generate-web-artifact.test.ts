/**
 * Tests for generate-web-artifact utility functions.
 *
 * Validates:
 *  1. inferTitle — kind label mapping and 5-word prompt truncation
 *  2. buildSystemWithExample — structure, kind-label mapping, content inclusion
 *  3. FENCE_STRIP_RE — strips well-formed code fences; leaves non-fenced content alone
 */

import { describe, it, expect } from 'vitest';
import { inferTitle, buildSystemWithExample, FENCE_STRIP_RE } from './generate-web-artifact';

// ─────────────────────────────────────────────────────────────────────────────
// inferTitle
// ─────────────────────────────────────────────────────────────────────────────

describe('inferTitle', () => {
  it('labels html kind as "App"', () => {
    expect(inferTitle('build a kanban board', 'html')).toBe('build a kanban board (App)');
  });

  it('labels mermaid kind as "Diagram"', () => {
    expect(inferTitle('er diagram for database', 'mermaid')).toBe('er diagram for database (Diagram)');
  });

  it('uppercases svg kind', () => {
    expect(inferTitle('animated logo', 'svg')).toBe('animated logo (SVG)');
  });

  it('uppercases jsx kind', () => {
    expect(inferTitle('user profile card', 'jsx')).toBe('user profile card (JSX)');
  });

  it('uppercases an unrecognised kind', () => {
    expect(inferTitle('something', 'webgl')).toBe('something (WEBGL)');
  });

  it('truncates prompt to 5 words', () => {
    const long = 'kpi metrics dashboard revenue sparkline charts extras';
    expect(inferTitle(long, 'html')).toBe('kpi metrics dashboard revenue sparkline (App)');
  });

  it('handles a single-word prompt', () => {
    expect(inferTitle('calculator', 'html')).toBe('calculator (App)');
  });

  it('trims leading and trailing whitespace before splitting', () => {
    expect(inferTitle('  build a form  ', 'html')).toBe('build a form (App)');
  });

  it('handles exactly 5 words with no truncation', () => {
    expect(inferTitle('one two three four five', 'mermaid')).toBe('one two three four five (Diagram)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSystemWithExample
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSystemWithExample', () => {
  const base = 'You generate a self-contained HTML file.';
  const exPrompt = 'build a kanban board with drag-and-drop';
  const exContent = '<!DOCTYPE html><html><body><!-- kanban --></body></html>';

  it('starts with the base system prompt', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'html');
    expect(result.startsWith(base)).toBe(true);
  });

  it('contains the ## Reference Example header', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'html');
    expect(result).toContain('## Reference Example');
  });

  it('embeds the example prompt in quotes', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'html');
    expect(result).toContain(`"${exPrompt}"`);
  });

  it('embeds the example content verbatim', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'html');
    expect(result).toContain(exContent);
  });

  it('labels html kind as "HTML"', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'html');
    expect(result).toContain('HTML artifact');
    expect(result).toContain('HTML output:');
  });

  it('labels svg kind as "SVG"', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'svg');
    expect(result).toContain('SVG artifact');
    expect(result).toContain('SVG output:');
  });

  it('labels mermaid kind as "Mermaid"', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'mermaid');
    expect(result).toContain('Mermaid artifact');
    expect(result).toContain('Mermaid output:');
  });

  it('labels jsx kind as "JSX"', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'jsx');
    expect(result).toContain('JSX artifact');
    expect(result).toContain('JSX output:');
  });

  it('falls through to "JSX" for an unrecognised kind', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'webgl');
    expect(result).toContain('JSX');
  });

  it('ends with the "Now generate" instruction', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'html');
    expect(result).toContain('Now generate for the user');
  });

  it('base system appears before the example section', () => {
    const result = buildSystemWithExample(base, exPrompt, exContent, 'html');
    expect(result.indexOf(base)).toBeLessThan(result.indexOf('## Reference Example'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FENCE_STRIP_RE
// ─────────────────────────────────────────────────────────────────────────────

describe('FENCE_STRIP_RE', () => {
  function strip(raw: string): string | null {
    const trimmed = raw.trim();
    const m = trimmed.match(FENCE_STRIP_RE);
    return m ? m[1].trim() : null;
  }

  it('strips a fence with a language tag', () => {
    const input = '```html\n<!DOCTYPE html><html></html>\n```';
    expect(strip(input)).toBe('<!DOCTYPE html><html></html>');
  });

  it('strips a fence without a language tag', () => {
    const input = '```\nerDiagram\n  CUSTOMER ||--o{ ORDER : places\n```';
    expect(strip(input)).toBe('erDiagram\n  CUSTOMER ||--o{ ORDER : places');
  });

  it('strips a multi-line HTML fence', () => {
    const html = '<!DOCTYPE html>\n<html>\n<body><p>hello</p></body>\n</html>';
    const input = `\`\`\`html\n${html}\n\`\`\``;
    expect(strip(input)).toBe(html);
  });

  it('returns null for content without code fences', () => {
    expect(strip('<!DOCTYPE html><html></html>')).toBeNull();
  });

  it('returns null when only an opening fence is present', () => {
    expect(strip('```html\n<!DOCTYPE html>')).toBeNull();
  });

  it('returns null when only a closing fence is present', () => {
    expect(strip('<!DOCTYPE html>\n```')).toBeNull();
  });

  it('returns null when fences are not at the start and end', () => {
    // Leading explanation text prevents ^``` from matching
    const input = 'Here you go:\n```html\n<html></html>\n```';
    expect(strip(input)).toBeNull();
  });

  it('handles trailing whitespace/newline on the raw string (simulates LLM output)', () => {
    // .trim() in execute() removes trailing newline before regex is applied
    const rawWithTrailingNewline = '```html\n<html></html>\n```\n';
    expect(strip(rawWithTrailingNewline)).toBe('<html></html>');
  });
});
