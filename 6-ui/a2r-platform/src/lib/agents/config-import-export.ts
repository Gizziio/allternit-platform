/**
 * Agent Configuration Export/Import Utilities
 *
 * Provides functionality to export and import agent configurations
 * in JSON and YAML formats.
 *
 * @module agents/config-import-export
 * @version 1.0.0
 */

import type { CharacterLayerConfig, AvatarConfig, AgentType, ModelProvider } from '@/components/agents/AgentCreationWizardEnhanced';

/**
 * Exported agent configuration format
 */
export interface ExportedAgentConfig {
  /** Schema version for compatibility checking */
  schemaVersion: string;
  /** Export timestamp */
  exportedAt: string;
  /** Export format */
  format: 'json' | 'yaml';
  /** Basic agent information */
  basic: {
    name: string;
    description: string;
    type: AgentType;
    model: string;
    provider: ModelProvider;
  };
  /** Character layer configuration */
  character?: CharacterLayerConfig;
  /** Avatar configuration */
  avatar?: AvatarConfig;
  /** Tools and capabilities */
  tools: {
    enabled: string[];
    systemPrompt: string;
    temperature: number;
    maxIterations: number;
  };
  /** Capabilities list */
  capabilities: string[];
  /** Plugins */
  plugins?: Array<{
    id: string;
    name: string;
    version?: string;
    config?: Record<string, unknown>;
  }>;
  /** Metadata */
  metadata: {
    /** Original creator */
    createdBy?: string;
    /** Organization/team */
    organization?: string;
    /** Tags for categorization */
    tags?: string[];
    /** Notes about this configuration */
    notes?: string;
    /** License for sharing */
    license?: string;
  };
}

/**
 * Current schema version
 */
export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Convert agent configuration to exportable format
 */
export function prepareForExport(
  basic: {
    name: string;
    description: string;
    type: AgentType;
    model: string;
    provider: ModelProvider;
  },
  character: CharacterLayerConfig,
  avatar: AvatarConfig,
  tools: {
    enabled: string[];
    systemPrompt: string;
    temperature: number;
    maxIterations: number;
  },
  capabilities: string[],
  plugins?: Array<{ id: string; name: string; version?: string; config?: Record<string, unknown> }>,
  metadata?: ExportedAgentConfig['metadata']
): ExportedAgentConfig {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    format: 'json',
    basic,
    character,
    avatar,
    tools,
    capabilities,
    plugins,
    metadata: metadata || {},
  };
}

/**
 * Export configuration as JSON string
 */
export function exportAsJson(config: ExportedAgentConfig, pretty: boolean = true): string {
  if (pretty) {
    return JSON.stringify(config, null, 2);
  }
  return JSON.stringify(config);
}

/**
 * Export configuration as YAML string
 * Simple YAML serialization (for complex YAML, consider using js-yaml library)
 */
export function exportAsYaml(config: ExportedAgentConfig): string {
  return simpleJsonToYaml(config);
}

/**
 * Simple JSON to YAML converter
 * Note: For production use, consider using the js-yaml library
 */
function simpleJsonToYaml(obj: unknown, indent: number = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'boolean') {
    return obj ? 'true' : 'false';
  }

  if (typeof obj === 'number') {
    return String(obj);
  }

  if (typeof obj === 'string') {
    // Check if string needs quoting
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#') || obj.startsWith(' ') || obj.endsWith(' ')) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';
    }
    return obj
      .map((item) => `${spaces}- ${simpleJsonToYaml(item, indent + 1)}`)
      .join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return '{}';
    }
    return entries
      .map(([key, value]) => `${spaces}${key}: ${simpleJsonToYaml(value, indent + 1)}`)
      .join('\n');
  }

  return String(obj);
}

/**
 * Download configuration as file
 */
export function downloadConfigFile(
  config: ExportedAgentConfig,
  format: 'json' | 'yaml' = 'json',
  filename?: string
): void {
  const content = format === 'json' ? exportAsJson(config) : exportAsYaml(config);
  const extension = format === 'json' ? 'json' : 'yaml';
  const safeName = (filename || config.basic.name).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const finalFilename = `${safeName}-agent-config.${extension}`;

  const blob = new Blob([content], {
    type: format === 'json' ? 'application/json' : 'application/x-yaml',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy configuration to clipboard
 */
export async function copyToClipboard(
  config: ExportedAgentConfig,
  format: 'json' | 'yaml' = 'json'
): Promise<void> {
  const content = format === 'json' ? exportAsJson(config) : exportAsYaml(config);

  try {
    await navigator.clipboard.writeText(content);
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Parse imported configuration
 */
export function parseImportedConfig(
  content: string,
  format?: 'json' | 'yaml'
): { config: ExportedAgentConfig; warnings: string[] } {
  const warnings: string[] = [];
  let parsed: ExportedAgentConfig;

  // Auto-detect format if not specified
  if (!format) {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      format = 'json';
    } else if (trimmed.includes(':')) {
      format = 'yaml';
    } else {
      throw new Error('Unable to detect configuration format. Please specify JSON or YAML.');
    }
  }

  try {
    if (format === 'json') {
      parsed = JSON.parse(content);
    } else {
      // Simple YAML parsing (for production, use js-yaml library)
      parsed = simpleYamlToJson(content) as ExportedAgentConfig;
    }
  } catch (error) {
    throw new Error(`Failed to parse configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate schema version
  if (!parsed.schemaVersion) {
    warnings.push('No schema version found. Configuration may be incompatible.');
  } else if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    warnings.push(
      `Schema version mismatch. Expected ${CURRENT_SCHEMA_VERSION}, got ${parsed.schemaVersion}. Some features may not work correctly.`
    );
  }

  // Validate required fields
  const requiredFields: (keyof ExportedAgentConfig['basic'])[] = ['name', 'description', 'type', 'model', 'provider'];
  for (const field of requiredFields) {
    if (!parsed.basic[field]) {
      throw new Error(`Missing required field: basic.${field}`);
    }
  }

  return { config: parsed, warnings };
}

/**
 * Simple YAML to JSON parser
 * Note: For production use, consider using the js-yaml library
 */
function simpleYamlToJson(yaml: string): unknown {
  // This is a very basic YAML parser
  // For production, use the js-yaml library

  const lines = yaml.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#'));
  const result: Record<string, unknown> = {};
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [{ obj: result, indent: -1 }];

  for (const line of lines) {
    const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (!match) continue;

    const [, spaces, key, valueStr] = match;
    const indent = spaces.length;
    const keyTrimmed = key.trim();

    // Pop stack until we find the right parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (valueStr === '' || valueStr.startsWith('#')) {
      // Nested object or array
      const newObj: Record<string, unknown> = {};
      parent[keyTrimmed] = newObj;
      stack.push({ obj: newObj, indent });
    } else if (valueStr.startsWith('-')) {
      // Array
      const array: unknown[] = [];
      parent[keyTrimmed] = array;

      // Parse array items
      const arrayLines = lines.filter((l) => l.trim().startsWith('-'));
      for (const arrayLine of arrayLines) {
        const arrayMatch = arrayLine.match(/^\s*-\s*(.*)$/);
        if (arrayMatch) {
          const itemValue = arrayMatch[1].trim();
          array.push(parseYamlValue(itemValue));
        }
      }
    } else {
      // Simple value
      parent[keyTrimmed] = parseYamlValue(valueStr.trim());
    }
  }

  return result;
}

/**
 * Parse a YAML value string to appropriate type
 */
function parseYamlValue(value: string): unknown {
  if (value === 'null' || value === '~') return null;
  if (value === 'true' || value === 'yes') return true;
  if (value === 'false' || value === 'no') return false;

  // Try to parse as number
  const num = Number(value);
  if (!isNaN(num) && value !== '') return num;

  // Remove quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

/**
 * Import configuration from file
 */
export async function importFromFile(file: File): Promise<{ config: ExportedAgentConfig; warnings: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        reject(new Error('Failed to read file'));
        return;
      }

      try {
        const format = file.name.endsWith('.yaml') || file.name.endsWith('.yml') ? 'yaml' : 'json';
        const result = parseImportedConfig(content, format);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Validate imported configuration against current schema
 */
export function validateImportedConfig(config: ExportedAgentConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check schema version
  if (!config.schemaVersion) {
    errors.push('Missing schema version');
  }

  // Check required basic fields
  if (!config.basic) {
    errors.push('Missing basic configuration');
  } else {
    const requiredBasicFields: (keyof ExportedAgentConfig['basic'])[] = [
      'name',
      'description',
      'type',
      'model',
      'provider',
    ];
    for (const field of requiredBasicFields) {
      if (!config.basic[field]) {
        errors.push(`Missing required field: basic.${field}`);
      }
    }
  }

  // Check tools configuration
  if (!config.tools) {
    errors.push('Missing tools configuration');
  } else {
    if (!Array.isArray(config.tools.enabled)) {
      errors.push('Tools.enabled must be an array');
    }
    if (typeof config.tools.temperature !== 'number') {
      errors.push('Tools.temperature must be a number');
    }
    if (typeof config.tools.maxIterations !== 'number') {
      errors.push('Tools.maxIterations must be a number');
    }
  }

  // Check capabilities
  if (!Array.isArray(config.capabilities)) {
    errors.push('Capabilities must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Share configuration (generates shareable link or code)
 */
export function generateShareCode(config: ExportedAgentConfig): string {
  // Compress and encode configuration for sharing
  // In production, you might want to:
  // 1. Upload to a server and generate a short URL
  // 2. Use a compression library like lz-string
  // 3. Generate a QR code

  const json = exportAsJson(config, false);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return encoded;
}

/**
 * Load configuration from share code
 */
export function loadFromShareCode(code: string): { config: ExportedAgentConfig; warnings: string[] } {
  try {
    const decoded = decodeURIComponent(escape(atob(code)));
    return parseImportedConfig(decoded, 'json');
  } catch (error) {
    throw new Error('Invalid share code. The code may be corrupted or expired.');
  }
}
