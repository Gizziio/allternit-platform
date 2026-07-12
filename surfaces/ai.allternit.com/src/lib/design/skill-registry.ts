/**
 * Allternit Design skill registry — ported from nexu-io/open-design.
 *
 * A skill is a folder containing SKILL.md + optional assets/ + references/.
 * SKILL.md frontmatter follows the Claude Code convention with an optional
 * `od:` block for Open-Design-specific UI hints (mode, preview type, inputs,
 * parameters, craft requirements).
 *
 * This module does NOT touch the filesystem at runtime in the browser. It
 * provides parsers and typed records so the Design mode UI and API routes can
 * discover, filter, and bind skills.
 */

export type SkillMode =
  | 'prototype'
  | 'deck'
  | 'template'
  | 'design-system'
  | 'image'
  | 'video'
  | 'audio'
  | 'utility';

export type SkillScenario =
  | 'design'
  | 'marketing'
  | 'operation'
  | 'engineering'
  | 'product'
  | 'finance'
  | 'hr'
  | 'sale'
  | 'personal';

export type PreviewType = 'html' | 'jsx' | 'pptx' | 'markdown';

export interface SkillInput {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'enum' | 'text';
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  values?: string[];
  placeholder?: string;
  label?: string;
}

export interface SkillParameter {
  name: string;
  type: 'hue' | 'spacing' | 'font-scale' | 'opacity';
  default: number;
  range: [number, number];
  label?: string;
}

export interface SkillOutput {
  primary: string;
  secondary?: string[];
}

export interface SkillCraftRequirement {
  requires: string[];
}

export interface SkillDesignSystemRequirement {
  requires: boolean;
  sections?: string[];
}

export interface SkillPreview {
  type: PreviewType;
  entry?: string;
  reload?: 'instant' | 'debounce-100' | 'debounce-300';
}

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  mode: SkillMode;
  scenario?: SkillScenario;
  preview: SkillPreview;
  examplePrompt?: string;
  examplePromptI18n?: Record<string, string>;
  designSystem: SkillDesignSystemRequirement;
  craft: SkillCraftRequirement;
  inputs: SkillInput[];
  parameters: SkillParameter[];
  outputs: SkillOutput;
  capabilitiesRequired: string[];
  upstream?: string;
  body: string;
  /** Relative path to assets dir if available (server-side). */
  assetDir?: string;
}

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  triggers?: string[];
  od?: Record<string, unknown>;
  [key: string]: unknown;
}

function inferModeFromBody(body: string, requested?: string): SkillMode {
  if (requested && isSkillMode(requested)) return requested;
  const lower = body.toLowerCase();
  if (lower.includes('ppt') || lower.includes('deck') || lower.includes('slide')) return 'deck';
  if (lower.includes('design system') || lower.includes('design.md')) return 'design-system';
  if (lower.includes('template')) return 'template';
  if (lower.includes('image') || lower.includes('poster')) return 'image';
  if (lower.includes('video') || lower.includes('motion')) return 'video';
  return 'prototype';
}

function inferPreviewFromBody(body: string, assetNames: string[]): PreviewType {
  if (assetNames.some((n) => /index\.html$/i.test(n) || /\.html$/i.test(n))) return 'html';
  if (assetNames.some((n) => /\.jsx$/i.test(n) || /\.tsx$/i.test(n))) return 'jsx';
  if (body.toLowerCase().includes('pptx')) return 'pptx';
  return 'html';
}

function isSkillMode(value: string): value is SkillMode {
  return [
    'prototype', 'deck', 'template', 'design-system',
    'image', 'video', 'audio', 'utility',
  ].includes(value);
}

function isSkillScenario(value: string): value is SkillScenario {
  return ['design', 'marketing', 'operation', 'engineering', 'product', 'finance', 'hr', 'sale', 'personal'].includes(value);
}

function isPreviewType(value: string): value is PreviewType {
  return ['html', 'jsx', 'pptx', 'markdown'].includes(value);
}

/**
 * Minimal YAML frontmatter parser.
 * Only handles the flat-ish shape used by SKILL.md files:
 *   ---
 *   name: foo
 *   triggers:
 *     - "a"
 *     - "b"
 *   od:
 *     mode: prototype
 *   ---
 */
export function parseYamlFrontmatter(raw: string): { frontmatter: ParsedFrontmatter; body: string } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: trimmed };
  }

  const end = trimmed.indexOf('---', 3);
  if (end === -1) {
    return { frontmatter: {}, body: trimmed };
  }

  const yaml = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 3).trim();
  const frontmatter: ParsedFrontmatter = {};
  let currentKey: string | null = null;
  let currentNested: Record<string, unknown> | null = null;
  let nestedKey: string | null = null;
  // Block scalar (| literal / > folded) accumulation — top-level keys only.
  let blockKey: string | null = null;
  let blockFold = false;
  let blockLines: string[] = [];
  let blockIndent: number | null = null;

  const finalizeBlock = () => {
    if (!blockKey) return;
    const joined = blockFold ? blockLines.join(' ') : blockLines.join('\n');
    frontmatter[blockKey] = joined.replace(/\s+$/g, '');
    blockKey = null;
    blockLines = [];
    blockIndent = null;
  };

  const parseInlineArray = (value: string): string[] | null => {
    if (!value.startsWith('[') || !value.endsWith(']')) return null;
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  };

  const unquote = (value: string): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    const arr = parseInlineArray(value);
    if (arr) return arr;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  };

  for (const line of yaml.split('\n')) {
    const indent = line.length - line.trimStart().length;
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    // While collecting a block scalar, indented lines are content; a dedent ends it.
    if (blockKey) {
      if (indent > 0) {
        if (blockIndent === null) blockIndent = indent;
        blockLines.push(line.slice(Math.min(blockIndent, indent)));
        continue;
      }
      finalizeBlock();
    }

    // Top-level key: value
    if (indent === 0 && trimmedLine.includes(':')) {
      currentNested = null;
      nestedKey = null;
      const idx = trimmedLine.indexOf(':');
      const key = trimmedLine.slice(0, idx).trim();
      const value = trimmedLine.slice(idx + 1).trim();
      if (value === '') {
        // Nested block starting on the next line.
        currentKey = key;
        frontmatter[key] = {};
        currentNested = frontmatter[key] as Record<string, unknown>;
        continue;
      }
      if (/^[|>][-+]?\s*$/.test(value)) {
        // Start of a literal (|) or folded (>) block scalar.
        blockKey = key;
        blockFold = value.startsWith('>');
        blockLines = [];
        blockIndent = null;
        currentKey = key;
        continue;
      }
      frontmatter[key] = unquote(value);
      currentKey = key;
      continue;
    }

    // Top-level array item
    if (indent === 2 && trimmedLine.startsWith('- ') && currentKey) {
      if (!Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = [];
      }
      (frontmatter[currentKey] as string[]).push(trimmedLine.slice(2).replace(/^["']|["']$/g, ''));
      continue;
    }

    // Nested key under current od block
    if (indent === 2 && trimmedLine.includes(':') && currentNested) {
      nestedKey = null;
      const idx = trimmedLine.indexOf(':');
      const key = trimmedLine.slice(0, idx).trim();
      const value = trimmedLine.slice(idx + 1).trim();
      if (value === '') {
        nestedKey = key;
        currentNested[key] = {};
        continue;
      }
      currentNested[key] = unquote(value);
      nestedKey = key;
      continue;
    }

    // Nested array item (indent 4 under a nested key)
    if (indent === 4 && trimmedLine.startsWith('- ') && currentNested && nestedKey) {
      if (!Array.isArray(currentNested[nestedKey])) {
        currentNested[nestedKey] = [];
      }
      (currentNested[nestedKey] as string[]).push(trimmedLine.slice(2).replace(/^["']|["']$/g, ''));
      continue;
    }

    // Deeper nested key (indent 4) — treat as key under current nested object
    if (indent === 4 && trimmedLine.includes(':') && currentNested) {
      const idx = trimmedLine.indexOf(':');
      const key = trimmedLine.slice(0, idx).trim();
      const value = trimmedLine.slice(idx + 1).trim();
      if (nestedKey && typeof currentNested[nestedKey] === 'object' && currentNested[nestedKey] !== null) {
        (currentNested[nestedKey] as Record<string, unknown>)[key] = unquote(value);
      } else {
        currentNested[key] = unquote(value);
      }
      continue;
    }
  }
  finalizeBlock();

  return { frontmatter, body };
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') return value.split(/,\s*/).filter(Boolean);
  return [];
}

function normalizeInputs(value: unknown): SkillInput[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = item as Record<string, unknown>;
    return {
      name: String(raw.name ?? ''),
      type: (['string', 'integer', 'boolean', 'enum', 'text'].includes(String(raw.type)) ? raw.type : 'string') as SkillInput['type'],
      required: raw.required === true,
      default: raw.default,
      min: typeof raw.min === 'number' ? raw.min : undefined,
      max: typeof raw.max === 'number' ? raw.max : undefined,
      values: Array.isArray(raw.values) ? raw.values.filter((v): v is string => typeof v === 'string') : undefined,
      placeholder: raw.placeholder ? String(raw.placeholder) : undefined,
      label: raw.label ? String(raw.label) : undefined,
    };
  }).filter((i) => i.name);
}

function normalizeParameters(value: unknown): SkillParameter[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = item as Record<string, unknown>;
    const range = Array.isArray(raw.range) && raw.range.length >= 2
      ? [Number(raw.range[0]), Number(raw.range[1])] as [number, number]
      : ([0, 100] as [number, number]);
    return {
      name: String(raw.name ?? ''),
      type: (['hue', 'spacing', 'font-scale', 'opacity'].includes(String(raw.type)) ? raw.type : 'spacing') as SkillParameter['type'],
      default: typeof raw.default === 'number' ? raw.default : 0,
      range,
      label: raw.label ? String(raw.label) : undefined,
    };
  }).filter((p) => p.name);
}

function normalizeOutputs(value: unknown): SkillOutput {
  if (!value || typeof value !== 'object') return { primary: 'index.html' };
  const raw = value as Record<string, unknown>;
  return {
    primary: String(raw.primary ?? 'index.html'),
    secondary: Array.isArray(raw.secondary)
      ? raw.secondary.filter((v): v is string => typeof v === 'string')
      : undefined,
  };
}

function normalizeDesignSystem(value: unknown): SkillDesignSystemRequirement {
  if (!value || typeof value !== 'object') return { requires: false };
  const raw = value as Record<string, unknown>;
  return {
    requires: raw.requires === true,
    sections: Array.isArray(raw.sections)
      ? raw.sections.filter((v): v is string => typeof v === 'string')
      : undefined,
  };
}

function normalizeCraft(value: unknown): SkillCraftRequirement {
  if (!value || typeof value !== 'object') return { requires: [] };
  const raw = value as Record<string, unknown>;
  return {
    requires: Array.isArray(raw.requires)
      ? raw.requires.filter((v): v is string => typeof v === 'string')
      : [],
  };
}

function normalizePreview(value: unknown, inferred: PreviewType): SkillPreview {
  if (!value || typeof value !== 'object') {
    return { type: inferred, entry: inferred === 'html' ? 'index.html' : undefined };
  }
  const raw = value as Record<string, unknown>;
  const type = isPreviewType(String(raw.type)) ? (raw.type as PreviewType) : inferred;
  return {
    type,
    entry: raw.entry ? String(raw.entry) : (type === 'html' ? 'index.html' : undefined),
    reload: ['instant', 'debounce-100', 'debounce-300'].includes(String(raw.reload))
      ? (String(raw.reload) as SkillPreview['reload'])
      : 'debounce-100',
  };
}

export function parseSkillMarkdown(skillId: string, raw: string, assetNames: string[] = []): SkillRecord {
  const { frontmatter, body } = parseYamlFrontmatter(raw);
  const od = (frontmatter.od ?? {}) as Record<string, unknown>;

  const name = String(frontmatter.name ?? skillId);
  const description = String(frontmatter.description ?? '');
  const triggers = normalizeStringArray(frontmatter.triggers);
  const mode = inferModeFromBody(body, od.mode ? String(od.mode) : undefined);
  const scenario = isSkillScenario(String(od.scenario)) ? od.scenario as SkillScenario : undefined;
  const preview = normalizePreview(od.preview, inferPreviewFromBody(body, assetNames));
  const examplePrompt = od.example_prompt ? String(od.example_prompt) : undefined;
  const examplePromptI18n = od.example_prompt_i18n && typeof od.example_prompt_i18n === 'object'
    ? Object.fromEntries(Object.entries(od.example_prompt_i18n as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
    : undefined;
  const designSystem = normalizeDesignSystem(od.design_system);
  const craft = normalizeCraft(od.craft);
  const inputs = normalizeInputs(od.inputs);
  const parameters = normalizeParameters(od.parameters);
  const outputs = normalizeOutputs(od.outputs);
  const capabilitiesRequired = Array.isArray(od.capabilities_required)
    ? od.capabilities_required.filter((v): v is string => typeof v === 'string')
    : [];
  const upstream = frontmatter.upstream ? String(frontmatter.upstream) : undefined;

  return {
    id: skillId,
    name,
    description,
    triggers,
    mode,
    scenario,
    preview,
    examplePrompt,
    examplePromptI18n,
    designSystem,
    craft,
    inputs,
    parameters,
    outputs,
    capabilitiesRequired,
    upstream,
    body,
  };
}

/** Convert a user brief + skill inputs into a concrete prompt opener. */
export function buildSkillPrompt(skill: SkillRecord, values: Record<string, unknown>): string {
  const filled = skill.inputs
    .map((input) => {
      const value = values[input.name] ?? input.default ?? '';
      return `- ${input.label ?? input.name}: ${value}`;
    })
    .join('\n');
  return `Run the "${skill.name}" skill.\n\nInputs:\n${filled || '- (none provided)'}`;
}

export const SKILL_MODE_LABELS: Record<SkillMode, string> = {
  prototype: 'Prototype',
  deck: 'Deck',
  template: 'Template',
  'design-system': 'Design System',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  utility: 'Utility',
};

export const SKILL_SCENARIO_LABELS: Record<SkillScenario, string> = {
  design: 'Design',
  marketing: 'Marketing',
  operation: 'Operations',
  engineering: 'Engineering',
  product: 'Product',
  finance: 'Finance',
  hr: 'HR',
  sale: 'Sales',
  personal: 'Personal',
};
