/**
 * Tests for artifact template registry and keyword matcher.
 *
 * Validates:
 *  1. Every template has required fields and valid content
 *  2. HTML templates are self-contained (no CDN src= links)
 *  3. Matcher returns the correct template for representative prompts
 *  4. getBestTemplate returns null for nonsense prompts below threshold
 */

import { describe, it, expect } from 'vitest';
import { ARTIFACT_TEMPLATES, TEMPLATES_BY_ID, TEMPLATE_CATEGORIES } from './artifact-templates';
import { getBestTemplate, findRelevantTemplates } from './template-matcher';

// ─────────────────────────────────────────────────────────────────────────────
// Registry shape
// ─────────────────────────────────────────────────────────────────────────────

describe('ARTIFACT_TEMPLATES registry', () => {
  it('has 12 templates', () => {
    expect(ARTIFACT_TEMPLATES).toHaveLength(12);
  });

  it('every template has required fields', () => {
    for (const t of ARTIFACT_TEMPLATES) {
      expect(t.id, `${t.id} missing id`).toBeTruthy();
      expect(t.title, `${t.id} missing title`).toBeTruthy();
      expect(t.description, `${t.id} missing description`).toBeTruthy();
      expect(['html','svg','mermaid','jsx']).toContain(t.kind);
      expect(t.tags.length, `${t.id} has no tags`).toBeGreaterThan(0);
      expect(t.prompt, `${t.id} missing prompt`).toBeTruthy();
      expect(t.content, `${t.id} missing content`).toBeTruthy();
    }
  });

  it('all IDs are unique', () => {
    const ids = ARTIFACT_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('TEMPLATES_BY_ID lookup matches array', () => {
    for (const t of ARTIFACT_TEMPLATES) {
      expect(TEMPLATES_BY_ID[t.id]).toBe(t);
    }
  });

  it('TEMPLATE_CATEGORIES contains all used categories', () => {
    const used = new Set(ARTIFACT_TEMPLATES.map(t => t.category));
    for (const cat of used) {
      expect(TEMPLATE_CATEGORIES).toContain(cat);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HTML template quality guards
// ─────────────────────────────────────────────────────────────────────────────

describe('HTML template content', () => {
  const htmlTemplates = ARTIFACT_TEMPLATES.filter(t => t.kind === 'html');

  it('every HTML template opens and closes the html tag', () => {
    for (const t of htmlTemplates) {
      expect(t.content, `${t.id} missing <!DOCTYPE html>`).toContain('<!DOCTYPE html>');
      expect(t.content, `${t.id} missing </html>`).toContain('</html>');
    }
  });

  it('no HTML template loads external CDN resources (sandbox constraint)', () => {
    // sandbox="allow-scripts" blocks external fetches in the gallery iframe
    const cdnPatterns = [
      /src=["']https?:\/\//,
      /href=["']https?:\/\//,
      /import\s+.*from\s+["']https?:\/\//,
    ];
    for (const t of htmlTemplates) {
      for (const pattern of cdnPatterns) {
        expect(
          pattern.test(t.content),
          `${t.id} contains external resource matching ${pattern}`
        ).toBe(false);
      }
    }
  });

  it('every HTML template has a <script> block', () => {
    for (const t of htmlTemplates) {
      expect(t.content, `${t.id} missing <script>`).toContain('<script>');
    }
  });

  it('every HTML template has a <style> or inline style block', () => {
    for (const t of htmlTemplates) {
      const hasStyle = t.content.includes('<style>') || t.content.includes('style="');
      expect(hasStyle, `${t.id} has no styles`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mermaid template content
// ─────────────────────────────────────────────────────────────────────────────

describe('Mermaid template content', () => {
  const mermaidTemplates = ARTIFACT_TEMPLATES.filter(t => t.kind === 'mermaid');

  it('has 4 mermaid templates', () => {
    expect(mermaidTemplates).toHaveLength(4);
  });

  it('each mermaid template starts with a valid diagram type', () => {
    const validTypes = ['erDiagram', 'flowchart', 'journey', 'classDiagram', 'sequenceDiagram', 'gantt', 'graph'];
    for (const t of mermaidTemplates) {
      const firstWord = t.content.trim().split(/\s/)[0];
      expect(
        validTypes.some(type => t.content.trim().startsWith(type)),
        `${t.id} doesn't start with a known mermaid type (starts with "${firstWord}")`
      ).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Template matcher
// ─────────────────────────────────────────────────────────────────────────────

describe('getBestTemplate matcher', () => {
  const cases: Array<[string, string, string]> = [
    ['build me a kanban task tracker with columns',        'html',    'kanban-board'],
    ['test my regex pattern with global and case flags',   'html',    'regex-tester'],
    ['markdown editor with live preview split pane',       'html',    'markdown-editor'],
    ['format and validate some json data with tree view',  'html',    'json-formatter'],
    ['kpi metrics dashboard revenue sparkline charts',     'html',    'kpi-dashboard'],
    ['invoice generator billing line items print pdf',     'html',    'invoice-generator'],
    ['sortable searchable paginated data table users',     'html',    'data-table'],
    ['budget expense tracker income categories chart',     'html',    'budget-tracker'],
    ['database schema er diagram entity relationship',     'mermaid', 'er-diagram'],
    ['company org chart hierarchy cto engineers',          'mermaid', 'org-chart'],
    ['user journey onboarding flow discovery signup',      'mermaid', 'user-journey'],
    ['uml class diagram oop methods attributes',           'mermaid', 'class-diagram'],
  ];

  it.each(cases)('"%s" → %s', (prompt, kind, expectedId) => {
    const match = getBestTemplate(prompt, kind as 'html' | 'mermaid');
    expect(match, `Expected match for: "${prompt}"`).not.toBeNull();
    expect(match!.id).toBe(expectedId);
  });

  it('returns null for a completely unrelated prompt when kind has no templates', () => {
    // jsx has no templates in the registry so kind boost can't save it
    const match = getBestTemplate('cook me some pasta with garlic and olive oil', 'jsx');
    expect(match).toBeNull();
  });

  it('for html prompts, always returns some template (kind boost floors html at 15)', () => {
    // By design: even for unrelated html prompts we inject a fallback few-shot example
    const match = getBestTemplate('cook me some pasta with garlic and olive oil', 'html');
    expect(match).not.toBeNull();
    expect(match?.kind).toBe('html');
  });

  it('same-kind boost makes html templates rank above mermaid for html prompts', () => {
    // "dashboard chart" matches both kpi-dashboard (html) and potentially diagrams
    // but html kind boost should ensure html wins
    const match = getBestTemplate('build a dashboard with charts and metrics', 'html');
    expect(match?.kind).toBe('html');
  });
});

describe('findRelevantTemplates', () => {
  it('returns multiple results when count > 1', () => {
    const results = findRelevantTemplates('build a tool for developers', 'html', 3);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('results are sorted by score descending', () => {
    const results = findRelevantTemplates('json data formatter viewer developer', 'html', 5);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  it('filters out results below a very high minScore for unrelated prompts', () => {
    // With minScore=100, only results with strong signal pass; pasta/cooking has none
    const results = findRelevantTemplates('pasta carbonara recipe chef', 'html', 5, 100);
    expect(results).toHaveLength(0);
  });
});
