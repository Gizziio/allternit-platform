import { describe, expect, it } from 'vitest';

import { BUNDLED_SKILLS, RAW_SKILLS } from './bundled-skills';
import { GALLERY_CATEGORIES, getGalleryCategory } from './gallery-categories';

const ALLOWED_MODES = [
  'prototype',
  'deck',
  'template',
  'design-system',
  'image',
  'video',
  'audio',
  'utility',
];

const ALLOWED_SCENARIOS = [
  'design',
  'marketing',
  'operation',
  'engineering',
  'product',
  'finance',
  'hr',
  'sale',
  'personal',
];

describe('BUNDLED_SKILLS', () => {
  it('has entries', () => {
    expect(BUNDLED_SKILLS.length).toBeGreaterThanOrEqual(15);
  });

  it('every entry parses with a unique id and non-empty core fields', () => {
    const ids = new Set<string>();
    for (const skill of BUNDLED_SKILLS) {
      expect(skill.id).toBeTruthy();
      expect(ids.has(skill.id)).toBe(false);
      ids.add(skill.id);

      expect(skill.name.trim().length).toBeGreaterThan(0);
      expect(skill.description.trim().length).toBeGreaterThan(0);
      expect(skill.triggers.length).toBeGreaterThanOrEqual(3);
      for (const trigger of skill.triggers) {
        expect(trigger.trim().length).toBeGreaterThan(0);
      }
      expect(skill.examplePrompt?.trim().length).toBeGreaterThan(0);
      expect(skill.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid od.mode and od.scenario from the allowed unions', () => {
    for (const skill of BUNDLED_SKILLS) {
      expect(ALLOWED_MODES).toContain(skill.mode);
      expect(skill.scenario).toBeDefined();
      expect(ALLOWED_SCENARIOS).toContain(skill.scenario);
    }
  });

  it('every skill whose frontmatter declares od.inputs parses them (issue #368)', () => {
    const declared = RAW_SKILLS.filter((raw) => /^\s+inputs:\s*$/m.test(raw.source));
    expect(declared.length).toBeGreaterThan(0);
    for (const raw of declared) {
      const parsed = BUNDLED_SKILLS.find((skill) => skill.id === raw.id);
      expect(parsed).toBeDefined();
      expect(parsed!.inputs.length).toBeGreaterThan(0);
    }
    for (const skill of BUNDLED_SKILLS) {
      for (const input of skill.inputs) {
        expect(input.name.trim().length).toBeGreaterThan(0);
        expect(['string', 'integer', 'boolean', 'enum', 'text']).toContain(input.type);
      }
    }
  });
});

describe('GALLERY_CATEGORIES', () => {
  it('covers exactly the set of bundled skill ids — no missing, no extra', () => {
    const bundledIds = BUNDLED_SKILLS.map((s) => s.id).sort();
    const galleryIds = Object.keys(GALLERY_CATEGORIES).sort();
    expect(galleryIds).toEqual(bundledIds);
  });

  it('every bundled skill resolves through getGalleryCategory', () => {
    for (const skill of BUNDLED_SKILLS) {
      const entry = getGalleryCategory(skill.id);
      expect(entry).toBeDefined();
      expect(entry!.category.trim().length).toBeGreaterThan(0);
      expect(entry!.label.trim().length).toBeGreaterThan(0);
      expect(entry!.kimiCategory.trim().length).toBeGreaterThan(0);
    }
  });
});
