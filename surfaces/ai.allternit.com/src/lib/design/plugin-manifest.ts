/**
 * Open Design plugin manifest parser — ported from nexu-io/open-design.
 *
 * A plugin is a portable agent-skill folder containing SKILL.md plus an
 * optional `open-design.json` manifest that gives marketplace metadata,
 * inputs, previews, pipelines, and capability declarations.
 */

export interface PluginPreview {
  type: 'html' | 'jsx' | 'markdown' | 'image';
  entry?: string;
}

export interface PluginInput {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'enum' | 'text';
  required?: boolean;
  default?: unknown;
  values?: string[];
  label?: string;
}

export interface PluginPipeline {
  name: string;
  format: 'html' | 'pdf' | 'pptx' | 'zip' | 'mp4';
  entry?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version?: string;
  description?: string;
  category?: string;
  author?: string;
  upstream?: string;
  tags?: string[];
  preview?: PluginPreview;
  inputs?: PluginInput[];
  pipelines?: PluginPipeline[];
  capabilities?: string[];
}

export function parsePluginManifest(id: string, raw: string): PluginManifest {
  const parsed = JSON.parse(raw) as Partial<PluginManifest>;
  return {
    id,
    name: parsed.name ?? id,
    version: parsed.version ?? '0.0.1',
    description: parsed.description ?? '',
    category: parsed.category ?? 'utility',
    author: parsed.author ?? 'unknown',
    upstream: parsed.upstream,
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === 'string') : [],
    preview: parsed.preview && typeof parsed.preview === 'object'
      ? {
          type: ['html', 'jsx', 'markdown', 'image'].includes(String(parsed.preview.type))
            ? (parsed.preview.type as PluginPreview['type'])
            : 'html',
          entry: parsed.preview.entry ? String(parsed.preview.entry) : undefined,
        }
      : undefined,
    inputs: Array.isArray(parsed.inputs)
      ? parsed.inputs.map((input) => ({
          name: String(input.name ?? ''),
          type: (['string', 'integer', 'boolean', 'enum', 'text'].includes(String(input.type))
            ? input.type
            : 'string') as PluginInput['type'],
          required: input.required === true,
          default: input.default,
          values: Array.isArray(input.values)
            ? input.values.filter((v): v is string => typeof v === 'string')
            : undefined,
          label: input.label ? String(input.label) : undefined,
        })).filter((i) => i.name)
      : [],
    pipelines: Array.isArray(parsed.pipelines)
      ? parsed.pipelines.map((p) => ({
          name: String(p.name ?? ''),
          format: (['html', 'pdf', 'pptx', 'zip', 'mp4'].includes(String(p.format))
            ? p.format
            : 'html') as PluginPipeline['format'],
          entry: p.entry ? String(p.entry) : undefined,
        })).filter((p) => p.name)
      : [],
    capabilities: Array.isArray(parsed.capabilities)
      ? parsed.capabilities.filter((c): c is string => typeof c === 'string')
      : [],
  };
}
