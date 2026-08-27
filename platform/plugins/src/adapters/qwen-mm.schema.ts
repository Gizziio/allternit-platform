export interface QwenMMPluginOwner {
  name: string;
  url: string;
}

export interface QwenMMPluginMetadata {
  description: string;
  version: string;
}

export interface QwenMMPluginSource {
  source: 'git-subdir' | 'local';
  url: string;
  path: string;
  ref: string;
}

export interface QwenMMPluginEntry {
  name: string;
  source: QwenMMPluginSource;
  description: string;
}

export interface QwenMMMarketplaceManifest {
  name: string;
  owner: QwenMMPluginOwner;
  metadata: QwenMMPluginMetadata;
  plugins: QwenMMPluginEntry[];
}

export interface QwenMMCapabilityTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface QwenMMCapabilityServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface QwenMMCapabilityManifest {
  name: string;
  version: string;
  description: string;
  tools: QwenMMCapabilityTool[];
  server: QwenMMCapabilityServer;
  config?: Record<string, string>;
}

export interface QwenMMPluginVersions {
  distribution_version: string;
  tag_format: string;
  plugins: Record<string, string>;
}

export class QwenMMValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
  ) {
    super(`Qwen MM manifest validation failed at "${field}": ${message}`);
    this.name = 'QwenMMValidationError';
  }
}

function assertString(val: unknown, field: string): asserts val is string {
  if (typeof val !== 'string' || val.length === 0) {
    throw new QwenMMValidationError(`expected non-empty string`, field, val);
  }
}

function assertObject(val: unknown, field: string): asserts val is Record<string, unknown> {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    throw new QwenMMValidationError(`expected object`, field, val);
  }
}

function assertArray(val: unknown, field: string): asserts val is unknown[] {
  if (!Array.isArray(val)) {
    throw new QwenMMValidationError(`expected array`, field, val);
  }
}

export function validateMarketplaceManifest(raw: unknown): QwenMMMarketplaceManifest {
  assertObject(raw, 'root');

  assertString(raw.name, 'name');
  assertObject(raw.owner, 'owner');
  assertString(raw.owner.name, 'owner.name');
  assertString(raw.owner.url, 'owner.url');

  assertObject(raw.metadata, 'metadata');
  assertString(raw.metadata.description, 'metadata.description');
  assertString(raw.metadata.version, 'metadata.version');

  assertArray(raw.plugins, 'plugins');
  for (let i = 0; i < raw.plugins.length; i++) {
    const entry = raw.plugins[i];
    assertObject(entry, `plugins[${i}]`);
    assertString(entry.name, `plugins[${i}].name`);
    assertString(entry.description, `plugins[${i}].description`);
    assertObject(entry.source, `plugins[${i}].source`);
    assertString(entry.source.source, `plugins[${i}].source.source`);
    assertString(entry.source.url, `plugins[${i}].source.url`);
    assertString(entry.source.path, `plugins[${i}].source.path`);
    assertString(entry.source.ref, `plugins[${i}].source.ref`);
  }

  return raw as unknown as QwenMMMarketplaceManifest;
}

export function validateCapabilityManifest(raw: unknown): QwenMMCapabilityManifest {
  assertObject(raw, 'root');

  assertString(raw.name, 'name');
  assertString(raw.version, 'version');
  assertString(raw.description, 'description');

  assertArray(raw.tools, 'tools');
  for (let i = 0; i < raw.tools.length; i++) {
    const tool = raw.tools[i];
    assertObject(tool, `tools[${i}]`);
    assertString(tool.name, `tools[${i}].name`);
    assertString(tool.description, `tools[${i}].description`);
    assertObject(tool.inputSchema, `tools[${i}].inputSchema`);
  }

  assertObject(raw.server, 'server');
  assertString(raw.server.command, 'server.command');
  assertArray(raw.server.args, 'server.args');

  return raw as unknown as QwenMMCapabilityManifest;
}

export function validatePluginVersions(raw: unknown): QwenMMPluginVersions {
  assertObject(raw, 'root');
  assertString(raw.distribution_version, 'distribution_version');
  assertString(raw.tag_format, 'tag_format');
  assertObject(raw.plugins, 'plugins');

  for (const [key, val] of Object.entries(raw.plugins)) {
    assertString(val, `plugins.${key}`);
  }

  return raw as unknown as QwenMMPluginVersions;
}
