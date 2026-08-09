import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { loadSkills, parseSkillMarkdown, validateSkillManifest } from '../skills/registry.js';
import { PowerPointSkill } from '../skills/powerpoint.js';
import { ToolRegistry } from '../tools/registry.js';

describe('Skill registry and SKILL.md validation', () => {
  let base: string;

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), 'skills-'));
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  async function writeSkill(name: string, content: string) {
    const dir = join(base, name);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'SKILL.md'), content);
  }

  it('loads and validates a valid skill from the skills directory', async () => {
    await writeSkill(
      'powerpoint',
      `---
name: allternit/powerpoint
version: 0.1.0
description: Generate PowerPoint presentations
tools:
  - create_presentation
  - add_slide
entrypoint: powerpoint.ts
---

## Progressive disclosure

- basic: create_presentation
- full: create_presentation, add_slide
`
    );

    const { skills, errors } = await loadSkills(base);
    expect(errors).toEqual([]);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe('allternit/powerpoint');
    expect(skills[0].manifest.tools).toEqual(['create_presentation', 'add_slide']);
    expect(skills[0].progressiveDisclosure).toContain('Progressive disclosure');
  });

  it('collects errors for malformed skill manifests', async () => {
    await writeSkill(
      'bad',
      `---
name: bad
---
`
    );

    const { skills, errors } = await loadSkills(base);
    expect(skills).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('bad');
  });

  it('rejects manifests with missing or invalid required fields', () => {
    expect(() =>
      validateSkillManifest({
        name: 'allternit/test',
        version: '0.1.0',
        description: 'A test skill',
        tools: ['tool_a'],
        entrypoint: 'index.ts',
      })
    ).not.toThrow();

    expect(() => validateSkillManifest({})).toThrow();
    expect(() =>
      validateSkillManifest({
        name: '',
        version: '0.1.0',
        description: 'd',
        tools: ['t'],
        entrypoint: 'e.ts',
      })
    ).toThrow();
    expect(() =>
      validateSkillManifest({
        name: 'x',
        version: 'not-a-version',
        description: 'd',
        tools: ['t'],
        entrypoint: 'e.ts',
      })
    ).toThrow();
    expect(() =>
      validateSkillManifest({
        name: 'x',
        version: '0.1.0',
        description: 'd',
        tools: [],
        entrypoint: 'e.ts',
      })
    ).toThrow();
  });

  it('parses progressive disclosure from front matter', () => {
    const { manifest } = parseSkillMarkdown(`---
name: allternit/test
version: 1.0.0
description: test
tools:
  - a
entrypoint: index.ts
progressive_disclosure:
  levels:
    - name: basic
      trigger: first use
      tools:
        - a
---
`);
    expect(manifest.progressive_disclosure?.levels).toHaveLength(1);
    expect(manifest.progressive_disclosure?.levels?.[0].name).toBe('basic');
  });
});

describe('PowerPoint skill', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    new PowerPointSkill().register(registry);
  });

  it('registers the skill as allternit/powerpoint and exposes its tools', () => {
    const skill = new PowerPointSkill();
    expect(skill.name).toBe('allternit/powerpoint');
    expect(registry.getTool('create_presentation')).toBeDefined();
    expect(registry.getTool('add_slide')).toBeDefined();
  });

  it('generates a .pptx containing at least one slide', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pptx-'));
    try {
      const path = join(tmp, 'deck.pptx');
      const createTool = registry.getTool('create_presentation')!;
      const createResult = await createTool.execute!({ path }, {});
      expect(createResult.slideCount).toBe(0);

      const addTool = registry.getTool('add_slide')!;
      const addResult = await addTool.execute!(
        { path, title: 'Hello', content: 'World' },
        {}
      );
      expect(addResult.slideCount).toBe(1);

      const buffer = await readFile(path);
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files).filter((name) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(name)
      );
      expect(slideFiles.length).toBeGreaterThanOrEqual(1);

      const presentation = await zip.file('ppt/presentation.xml')!.async('string');
      expect(presentation).toContain('<p:sldId');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('adds multiple slides sequentially', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pptx-'));
    try {
      const path = join(tmp, 'multi.pptx');
      await registry
        .getTool('create_presentation')!
        .execute!({ path }, {});

      const addTool = registry.getTool('add_slide')!;
      const r1 = await addTool.execute!({ path, title: 'One' }, {});
      const r2 = await addTool.execute!({ path, title: 'Two' }, {});

      expect(r1.slideCount).toBe(1);
      expect(r2.slideCount).toBe(2);

      const buffer = await readFile(path);
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files).filter((name) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(name)
      );
      expect(slideFiles).toHaveLength(2);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
