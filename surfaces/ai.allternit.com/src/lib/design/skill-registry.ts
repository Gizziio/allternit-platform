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
 *
 * Supports the subset used by SKILL.md files:
 *   - nested mappings (arbitrary depth, two-space indentation)
 *   - sequences of scalars (`- "a"`) and sequences of mappings
 *     (`- name: x` followed by deeper-indented continuation keys)
 *   - inline arrays (`[a, b]`), quoted scalars (colons allowed inside quotes),
 *     booleans, nulls, and numeric scalars
 *   - literal (`|`) and folded (`>`) block scalars
 *
 * Implemented as a small recursive indentation parser — the previous flat
 * line loop could not represent list-of-maps and silently flattened
 * `od.inputs` entries into unparseable strings (issue #368).
 */

interface YamlParseState {
  pos: number;
}

function yamlLineIndent(line: string): number {
  return line.length - line.trimStart().length;
}

function isQuotedScalar(value: string): boolean {
  return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
}

/** `key: value`, `key:` (empty value), key = letters/digits/_/.- (no spaces). */
const YAML_MAP_ENTRY_RE = /^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/;
const YAML_BLOCK_SCALAR_RE = /^[|>][-+]?\s*$/;

function parseInlineArray(value: string): string[] | null {
  if (!value.startsWith('[') || !value.endsWith(']')) return null;
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

function parseYamlScalar(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  const arr = parseInlineArray(value);
  if (arr) return arr;
  if (isQuotedScalar(value)) return value.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function skipYamlNoise(lines: string[], state: YamlParseState): void {
  while (state.pos < lines.length) {
    const text = lines[state.pos]!.trim();
    if (text === '' || text.startsWith('#')) state.pos++;
    else break;
  }
}

/** Read the value half of a `key: value` entry, consuming any nested block. */
function readYamlEntryValue(
  lines: string[],
  state: YamlParseState,
  valueText: string,
  parentIndent: number,
): unknown {
  if (YAML_BLOCK_SCALAR_RE.test(valueText)) {
    const fold = valueText.startsWith('>');
    const collected: string[] = [];
    let contentIndent = Infinity;
    while (state.pos < lines.length) {
      const line = lines[state.pos]!;
      const indent = yamlLineIndent(line);
      if (line.trim() !== '' && indent <= parentIndent) break;
      if (line.trim() !== '') {
        contentIndent = Math.min(contentIndent, indent);
        collected.push(line);
      } else {
        collected.push('');
      }
      state.pos++;
    }
    const texts = collected.map((line) => (line === '' ? '' : line.slice(contentIndent === Infinity ? 0 : contentIndent)));
    const joined = fold ? texts.join(' ') : texts.join('\n');
    return joined.replace(/\s+$/g, '');
  }

  if (valueText === '') {
    // Value is a nested block starting on the following deeper-indented lines.
    skipYamlNoise(lines, state);
    if (state.pos < lines.length && yamlLineIndent(lines[state.pos]!) > parentIndent) {
      const sub = parseYamlNode(lines, state, parentIndent + 1);
      return sub;
    }
    return null;
  }

  return parseYamlScalar(valueText);
}

function isYamlSequenceItem(lines: string[], pos: number, indent: number): boolean {
  if (pos >= lines.length) return false;
  const text = lines[pos]!.trim();
  return yamlLineIndent(lines[pos]!) === indent && (text.startsWith('- ') || text === '-');
}

/** Parse the mapping or sequence that starts at (or after) state.pos. */
function parseYamlNode(lines: string[], state: YamlParseState, minIndent: number): unknown {
  skipYamlNoise(lines, state);
  if (state.pos >= lines.length) return null;
  const baseIndent = yamlLineIndent(lines[state.pos]!);
  if (baseIndent < minIndent) return null;

  if (isYamlSequenceItem(lines, state.pos, baseIndent)) {
    const arr: unknown[] = [];
    while (isYamlSequenceItem(lines, state.pos, baseIndent)) {
      const text = lines[state.pos]!.trim();
      const itemText = text === '-' ? '' : text.slice(2).trim();
      state.pos++;
      if (itemText === '') {
        // Bare dash: value is a nested block (or null).
        skipYamlNoise(lines, state);
        arr.push(
          state.pos < lines.length && yamlLineIndent(lines[state.pos]!) > baseIndent
            ? parseYamlNode(lines, state, baseIndent + 1)
            : null,
        );
        continue;
      }
      const mapMatch = itemText.match(YAML_MAP_ENTRY_RE);
      if (mapMatch && !isQuotedScalar(itemText)) {
        // Sequence-of-maps: first key inline, continuation keys deeper-indented.
        const obj: Record<string, unknown> = {};
        obj[mapMatch[1]!] = readYamlEntryValue(lines, state, mapMatch[2] ?? '', baseIndent);
        for (;;) {
          skipYamlNoise(lines, state);
          if (state.pos >= lines.length) break;
          const contIndent = yamlLineIndent(lines[state.pos]!);
          const contText = lines[state.pos]!.trim();
          if (contIndent <= baseIndent || isYamlSequenceItem(lines, state.pos, contIndent)) break;
          const contMatch = contText.match(YAML_MAP_ENTRY_RE);
          state.pos++;
          if (!contMatch) continue; // tolerate stray non-key line
          obj[contMatch[1]!] = readYamlEntryValue(lines, state, contMatch[2] ?? '', contIndent);
        }
        arr.push(obj);
        continue;
      }
      arr.push(parseYamlScalar(itemText));
    }
    return arr;
  }

  const obj: Record<string, unknown> = {};
  for (;;) {
    skipYamlNoise(lines, state);
    if (state.pos >= lines.length) break;
    const indent = yamlLineIndent(lines[state.pos]!);
    const text = lines[state.pos]!.trim();
    if (indent !== baseIndent || isYamlSequenceItem(lines, state.pos, indent)) break;
    const match = text.match(YAML_MAP_ENTRY_RE);
    if (!match) break;
    state.pos++;
    obj[match[1]!] = readYamlEntryValue(lines, state, match[2] ?? '', baseIndent);
  }
  return obj;
}

export function parseYamlFrontmatter(raw: string): { frontmatter: ParsedFrontmatter; body: string } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: trimmed };
  }

  const lines = trimmed.split('\n');
  // The closing fence is a line that is exactly `---`; a value containing the
  // substring `---` must not terminate the frontmatter early.
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { frontmatter: {}, body: trimmed };
  }

  const state: YamlParseState = { pos: 1 };
  const parsed = parseYamlNode(lines, state, 0);
  const body = lines.slice(end + 1).join('\n').trim();
  const frontmatter =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as ParsedFrontmatter)
      : {};

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
