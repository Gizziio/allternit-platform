/**
 * Plugin standards aligned with Claude Code style manifests.
 *
 * Validation is schema-based (Zod) so create/import/install paths share one contract.
 */
import { z } from 'zod';

export const CLAUDE_PLUGIN_SCHEMA_URL = 'https://anthropic.com/claude-code/plugin.schema.json';
export const CLAUDE_MARKETPLACE_SCHEMA_URL = 'https://anthropic.com/claude-code/marketplace.schema.json';

export type PluginAuthor = string | { name: string; email?: string; url?: string };

/**
 * Plugin dependencies map
 * Format: { "plugin-id": "^1.0.0", "optional-plugin": "~2.0.0" }
 * 
 * Supports semver ranges:
 * - ^1.0.0 - Compatible with 1.0.0 (allows minor/patch updates)
 * - ~1.0.0 - Approximately 1.0.0 (allows patch updates only)
 * - >=1.0.0 - Greater than or equal to 1.0.0
 * - 1.0.0 - Exact version
 * - * - Any version
 */
export type PluginDependencies = Record<string, string>;

export interface PluginManifestV1 {
  $schema?: string;
  name: string;
  description: string;
  version: string;
  author?: PluginAuthor;
  category?: string;
  tags?: string[];
  keywords?: string[];
  license?: string;
  homepage?: string;
  repository?: string;
  strict?: boolean;
  commands?: string[];
  skills?: string[];
  connectors?: string[];
  agents?: string[];
  hooks?: Record<string, unknown>;
  mcpServers?: Record<string, unknown>;
  lspServers?: Record<string, unknown>;
  outputStyles?: string[];
  /** Plugin dependencies with semver version ranges */
  dependencies?: PluginDependencies;
}

export type PluginMarketplaceSource =
  | string
  | {
      source: 'github' | 'url' | 'local';
      repo?: string;
      ref?: string;
      url?: string;
      path?: string;
    };

export interface PluginMarketplaceEntryV1 {
  name: string;
  description?: string;
  version?: string;
  author?: PluginAuthor;
  source: PluginMarketplaceSource;
  category?: string;
  tags?: string[];
  keywords?: string[];
  strict?: boolean;
  commands?: string[];
  skills?: string[];
  connectors?: string[];
}

export interface PluginMarketplaceManifestV1 {
  $schema?: string;
  name: string;
  owner: {
    name: string;
    email?: string;
  };
  metadata?: {
    version?: string;
    description?: string;
  };
  plugins: PluginMarketplaceEntryV1[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PluginWizardInput {
  name: string;
  description: string;
  version?: string;
  authorName?: string;
  authorEmail?: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  license?: string;
  homepage?: string;
  repository?: string;
  strict?: boolean;
  commands?: string[];
  skills?: string[];
  connectors?: string[];
  agents?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function slugifyPluginName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'plugin';
}

export function parseCsvList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueStringList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const item = raw.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function authorToDisplayName(author: unknown, fallback = 'Unknown'): string {
  if (typeof author === 'string' && author.trim()) return author.trim();
  if (isRecord(author) && typeof author.name === 'string' && author.name.trim()) {
    return author.name.trim();
  }
  return fallback;
}

export function normalizeAuthor(authorName?: string, authorEmail?: string): PluginAuthor | undefined {
  const name = (authorName || '').trim();
  const email = (authorEmail || '').trim();
  if (!name && !email) return undefined;
  if (!email) return name || undefined;
  return {
    name: name || 'Unknown',
    email,
  };
}

export function buildPluginManifestFromWizard(input: PluginWizardInput): PluginManifestV1 {
  const manifest: PluginManifestV1 = {
    $schema: CLAUDE_PLUGIN_SCHEMA_URL,
    name: slugifyPluginName(input.name),
    description: input.description.trim(),
    version: (input.version || '1.0.0').trim() || '1.0.0',
  };

  const author = normalizeAuthor(input.authorName, input.authorEmail);
  if (author) manifest.author = author;

  if (input.category?.trim()) manifest.category = input.category.trim();
  const tags = uniqueStringList(input.tags);
  if (tags.length > 0) manifest.tags = tags;
  const keywords = uniqueStringList(input.keywords);
  if (keywords.length > 0) manifest.keywords = keywords;
  if (input.license?.trim()) manifest.license = input.license.trim();
  if (input.homepage?.trim()) manifest.homepage = input.homepage.trim();
  if (input.repository?.trim()) manifest.repository = input.repository.trim();

  if (input.strict) manifest.strict = true;

  const commands = uniqueStringList(input.commands);
  const skills = uniqueStringList(input.skills);
  const connectors = uniqueStringList(input.connectors);
  const agents = uniqueStringList(input.agents);

  if (commands.length > 0) manifest.commands = commands;
  if (skills.length > 0) manifest.skills = skills;
  if (connectors.length > 0) manifest.connectors = connectors;
  if (agents.length > 0) manifest.agents = agents;

  return manifest;
}

export function buildMarketplaceManifestForPlugin(
  plugin: PluginManifestV1,
  options?: {
    ownerName?: string;
    ownerEmail?: string;
    source?: PluginMarketplaceSource;
    name?: string;
  }
): PluginMarketplaceManifestV1 {
  const entry: PluginMarketplaceEntryV1 = {
    name: plugin.name,
    description: plugin.description,
    version: plugin.version,
    author: plugin.author,
    source: options?.source || './',
    category: plugin.category,
    tags: plugin.tags,
    keywords: plugin.keywords,
    strict: plugin.strict,
    commands: plugin.commands,
    skills: plugin.skills,
    connectors: plugin.connectors,
  };

  return {
    $schema: CLAUDE_MARKETPLACE_SCHEMA_URL,
    name: options?.name || 'a2r-plugin-marketplace',
    owner: {
      name: (options?.ownerName || authorToDisplayName(plugin.author, 'A2R Team')).trim(),
      ...(options?.ownerEmail ? { email: options.ownerEmail.trim() } : {}),
    },
    metadata: {
      version: '1.0.0',
      description: 'Generated by A2R Plugin Wizard',
    },
    plugins: [entry],
  };
}

// Base non-empty string validator - uses transform instead of refine to preserve ZodString methods
const nonEmptyString = z.string().min(1, { message: 'must be a non-empty string' });

const optionalStringArray = z.array(nonEmptyString).optional();
const boundedNonEmptyString = (max: number) =>
  nonEmptyString.max(max);

const pluginAuthorSchema = z.union([
  nonEmptyString,
  z.object({
    name: nonEmptyString,
    email: z.string().email().optional(),
    url: z.string().url().optional(),
  }).strict(),
]);

/**
 * Validates a semver version range string
 * Supports: ^, ~, >=, <=, >, <, =, *, x, ranges with spaces
 */
function isValidSemverRange(range: string): boolean {
  if (!range || typeof range !== 'string') return false;
  
  const cleanRange = range.trim();
  if (cleanRange === '*' || cleanRange === 'x' || cleanRange === 'X') return true;
  
  // Remove common prefixes for validation
  const withoutPrefix = cleanRange.replace(/^[\^~>=<]+/, '');
  
  // Basic semver version check (major.minor.patch)
  const semverPattern = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/;
  
  // Check for hyphen range (e.g., "1.2.3 - 2.3.4")
  if (cleanRange.includes(' - ')) {
    const parts = cleanRange.split(' - ');
    return parts.length === 2 && parts.every(p => semverPattern.test(p.trim()));
  }
  
  // Check for OR ranges (e.g., "1.2.3 || 2.0.0")
  if (cleanRange.includes('||')) {
    const parts = cleanRange.split(/\s*\|\|\s*/);
    return parts.every(p => isValidSemverRange(p.trim()));
  }
  
  // Check for space-separated ranges (AND)
  if (cleanRange.includes(' ')) {
    const parts = cleanRange.split(/\s+/);
    return parts.every(p => isValidSemverRange(p.trim()));
  }
  
  // Check for wildcards (e.g., "1.x", "1.2.x")
  if (cleanRange.includes('x') || cleanRange.includes('X') || cleanRange.includes('*')) {
    const wildcardPattern = /^(\d+|x|X|\*)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?$/;
    return wildcardPattern.test(cleanRange);
  }
  
  // Standard version with optional prefix
  return semverPattern.test(withoutPrefix);
}

const pluginDependenciesSchema = z.record(
  z.string().refine(
    (val) => isValidSemverRange(val),
    {
      message: 'must be a valid semver version range (e.g., "^1.0.0", "~2.0.0", ">=1.0.0 <2.0.0")',
    }
  )
).optional();

const pluginManifestSchema = z.object({
  $schema: z.string().url().optional(),
  name: boundedNonEmptyString(120),
  description: boundedNonEmptyString(5000),
  version: boundedNonEmptyString(64),
  author: pluginAuthorSchema.optional(),
  category: boundedNonEmptyString(80).optional(),
  tags: optionalStringArray,
  keywords: optionalStringArray,
  license: boundedNonEmptyString(120).optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  strict: z.boolean().optional(),
  commands: optionalStringArray,
  skills: optionalStringArray,
  connectors: optionalStringArray,
  agents: optionalStringArray,
  hooks: z.record(z.unknown()).optional(),
  mcpServers: z.record(z.unknown()).optional(),
  lspServers: z.record(z.unknown()).optional(),
  outputStyles: optionalStringArray,
  dependencies: pluginDependenciesSchema,
}).passthrough();

const pluginMarketplaceSourceSchema = z.union([
  nonEmptyString,
  z.object({
    source: z.enum(['github', 'url', 'local']),
    repo: nonEmptyString.optional(),
    ref: nonEmptyString.optional(),
    url: z.string().url().optional(),
    path: nonEmptyString.optional(),
  }).superRefine((value, ctx) => {
    if (value.source === 'github' && !value.repo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'repo is required when source is "github"',
        path: ['repo'],
      });
    }
    if (value.source === 'url' && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'url is required when source is "url"',
        path: ['url'],
      });
    }
  }),
]);

const pluginMarketplaceEntrySchema = z.object({
  name: boundedNonEmptyString(120),
  description: boundedNonEmptyString(5000).optional(),
  version: boundedNonEmptyString(64).optional(),
  author: pluginAuthorSchema.optional(),
  source: pluginMarketplaceSourceSchema,
  category: boundedNonEmptyString(80).optional(),
  tags: optionalStringArray,
  keywords: optionalStringArray,
  strict: z.boolean().optional(),
  commands: optionalStringArray,
  skills: optionalStringArray,
  connectors: optionalStringArray,
}).passthrough();

const pluginMarketplaceManifestSchema = z.object({
  $schema: z.string().url().optional(),
  name: boundedNonEmptyString(120),
  owner: z.object({
    name: boundedNonEmptyString(120),
    email: z.string().email().optional(),
  }).strict(),
  metadata: z.object({
    version: boundedNonEmptyString(64).optional(),
    description: boundedNonEmptyString(5000).optional(),
  }).partial().optional(),
  plugins: z.array(pluginMarketplaceEntrySchema).min(1),
}).passthrough();

function zodIssuesToMessages(issues: z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${path}: ${issue.message}`;
  });
}

export function validatePluginManifestV1(value: unknown): ValidationResult {
  const result = pluginManifestSchema.safeParse(value);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: zodIssuesToMessages(result.error.issues),
  };
}

export function validateMarketplaceManifestV1(value: unknown): ValidationResult {
  const result = pluginMarketplaceManifestSchema.safeParse(value);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: zodIssuesToMessages(result.error.issues),
  };
}

export function sanitizeRelativePath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) return null;
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some((part) => part === '.' || part === '..')) return null;
  return parts.join('/');
}
