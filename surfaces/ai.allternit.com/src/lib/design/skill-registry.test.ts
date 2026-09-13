import { describe, expect, it } from 'vitest';

import { parseSkillMarkdown, parseYamlFrontmatter } from './skill-registry';

/** Verbatim frontmatter of the bundled saas-landing skill (the issue #368 fixture). */
const SAAS_LANDING = `---
name: saas-landing
description: |
  Produce a single-page SaaS landing page with hero, features, social proof, pricing, and CTA.
triggers:
  - "saas landing"
  - "marketing page"
  - "product landing"
od:
  mode: prototype
  scenario: marketing
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout, components]
  craft:
    requires: [typography, color, anti-ai-slop]
  inputs:
    - name: product_name
      type: string
      required: true
      label: Product name
    - name: tagline
      type: string
      required: true
      label: Tagline
    - name: has_pricing
      type: boolean
      default: true
      label: Include pricing section
  example_prompt: "Create a SaaS landing page for my product."
---

# Workflow

1. Read the active DESIGN.md.
`;

/** Synthetic fixture covering shapes the bundled skills don't all exercise. */
const SYNTHETIC = `---
name: synthetic
description: >
  Folded description
  stays one line.
triggers:
  - "go"
od:
  mode: prototype
  scenario: engineering
  inputs:
    - name: tone
      type: enum
      values:
        - formal
        - playful
        - technical
      default: playful
      label: Tone of voice
    - name: iterations
      type: integer
      min: 1
      max: 10
      default: 3
    - name: notes
      type: text
      required: false
      placeholder: "Anything else: constraints, references, deadline"
  example_prompt_i18n:
    en: "Build it."
    zh: "开始构建。"
---

Body here.
`;

describe('parseYamlFrontmatter', () => {
  it('parses flat keys, block scalar descriptions, and quoted triggers', () => {
    const { frontmatter, body } = parseYamlFrontmatter(SAAS_LANDING);
    expect(frontmatter.name).toBe('saas-landing');
    expect(frontmatter.description).toBe(
      'Produce a single-page SaaS landing page with hero, features, social proof, pricing, and CTA.',
    );
    expect(frontmatter.triggers).toEqual(['saas landing', 'marketing page', 'product landing']);
    expect(body.startsWith('# Workflow')).toBe(true);
  });

  it('parses nested od.inputs as a list of typed maps (issue #368)', () => {
    const { frontmatter } = parseYamlFrontmatter(SAAS_LANDING);
    const od = frontmatter.od as Record<string, unknown>;
    expect(Array.isArray(od.inputs)).toBe(true);
    const inputs = od.inputs as Record<string, unknown>[];
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toMatchObject({
      name: 'product_name',
      type: 'string',
      required: true,
      label: 'Product name',
    });
    expect(inputs[2]).toMatchObject({ name: 'has_pricing', type: 'boolean', default: true });
  });

  it('parses nested preview/design_system maps and inline + list values', () => {
    const { frontmatter } = parseYamlFrontmatter(SAAS_LANDING);
    const od = frontmatter.od as Record<string, unknown>;
    expect(od.preview).toEqual({ type: 'html', entry: 'index.html' });
    expect(od.design_system).toEqual({
      requires: true,
      sections: ['color', 'typography', 'layout', 'components'],
    });
    expect(od.craft).toEqual({ requires: ['typography', 'color', 'anti-ai-slop'] });
    expect(od.example_prompt).toBe('Create a SaaS landing page for my product.');
  });

  it('parses enum values lists, numeric bounds, and i18n maps', () => {
    const { frontmatter } = parseYamlFrontmatter(SYNTHETIC);
    const od = frontmatter.od as Record<string, unknown>;
    const inputs = od.inputs as Record<string, unknown>[];
    expect(inputs[0]).toMatchObject({
      name: 'tone',
      type: 'enum',
      values: ['formal', 'playful', 'technical'],
      default: 'playful',
    });
    expect(inputs[1]).toMatchObject({ name: 'iterations', type: 'integer', min: 1, max: 10, default: 3 });
    expect(typeof inputs[1]!.min).toBe('number');
    expect(inputs[2]).toMatchObject({ name: 'notes', type: 'text', required: false });
    expect(od.example_prompt_i18n).toEqual({ en: 'Build it.', zh: '开始构建。' });
    expect(frontmatter.description).toBe('Folded description stays one line.');
  });

  it('only treats a standalone --- line as the closing fence', () => {
    const raw = `---
name: fence-test
example_prompt: "a --- b stays inside the value"
---

Body --- not frontmatter.
`;
    const { frontmatter, body } = parseYamlFrontmatter(raw);
    expect(frontmatter.example_prompt).toBe('a --- b stays inside the value');
    expect(body).toContain('---');
  });

  it('returns empty frontmatter for documents without a fence', () => {
    const { frontmatter, body } = parseYamlFrontmatter('Just a body.');
    expect(frontmatter).toEqual({});
    expect(body).toBe('Just a body.');
  });
});

describe('parseSkillMarkdown', () => {
  it('normalizes parsed inputs into typed SkillInput records', () => {
    const record = parseSkillMarkdown('saas-landing', SAAS_LANDING);
    expect(record.inputs).toHaveLength(3);
    expect(record.inputs[0]).toMatchObject({
      name: 'product_name',
      type: 'string',
      required: true,
      label: 'Product name',
    });
    expect(record.inputs[1]!.required).toBe(true);
    expect(record.inputs[2]).toMatchObject({
      name: 'has_pricing',
      type: 'boolean',
      default: true,
      label: 'Include pricing section',
    });
    expect(record.mode).toBe('prototype');
    expect(record.scenario).toBe('marketing');
    expect(record.preview).toMatchObject({ type: 'html', entry: 'index.html' });
    expect(record.designSystem).toEqual({
      requires: true,
      sections: ['color', 'typography', 'layout', 'components'],
    });
    expect(record.craft.requires).toEqual(['typography', 'color', 'anti-ai-slop']);
    expect(record.examplePrompt).toBe('Create a SaaS landing page for my product.');
  });

  it('normalizes enum/integer inputs with numeric bounds', () => {
    const record = parseSkillMarkdown('synthetic', SYNTHETIC);
    expect(record.inputs[0]).toMatchObject({
      name: 'tone',
      type: 'enum',
      values: ['formal', 'playful', 'technical'],
      default: 'playful',
    });
    expect(record.inputs[1]).toMatchObject({ name: 'iterations', type: 'integer', min: 1, max: 10, default: 3 });
    expect(record.examplePromptI18n).toEqual({ en: 'Build it.', zh: '开始构建。' });
  });
});
