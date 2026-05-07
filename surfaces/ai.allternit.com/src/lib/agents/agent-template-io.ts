/**
 * Agent Template Import/Export Service
 *
 * Handles serialization and deserialization of agent configurations.
 * Supports JSON format for portability between instances.
 *
 * @module agent-template-io
 */

import type { CreateAgentInput } from './agent.types';
import type { SpecialistTemplate } from './agent-templates.specialist';

// ============================================================================
// Types
// ============================================================================

export interface AgentExportData {
  /** Export format version */
  version: string;
  /** Export timestamp */
  exportedAt: string;
  /** Agent configuration */
  agent: {
    /** Agent name */
    name: string;
    /** Agent description */
    description: string;
    /** Agent type */
    type: CreateAgentInput['type'];
    /** AI model */
    model: string;
    /** Model provider */
    provider: CreateAgentInput['provider'];
    /** System prompt */
    systemPrompt?: string;
    /** Capabilities */
    capabilities?: string[];
    /** Tools */
    tools?: string[];
    /** Max iterations */
    maxIterations?: number;
    /** Temperature */
    temperature?: number;
    /** Additional config */
    config?: Record<string, unknown>;
  };
  /** Source template (if created from template) */
  template?: {
    id: string;
    name: string;
    category: string;
    version: string;
  };
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

export interface AgentImportResult {
  success: boolean;
  config: CreateAgentInput | null;
  error?: string;
  warnings?: string[];
}

// ============================================================================
// Constants
// ============================================================================

const EXPORT_VERSION = '1.0';
const SUPPORTED_VERSIONS = ['1.0'];

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export agent configuration to JSON format
 */
export function exportAgent(
  config: CreateAgentInput,
  options?: {
    template?: SpecialistTemplate;
    metadata?: Record<string, unknown>;
  }
): AgentExportData {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    agent: {
      name: config.name,
      description: config.description,
      type: config.type || 'worker',
      model: config.model,
      provider: config.provider,
      systemPrompt: config.systemPrompt,
      capabilities: config.capabilities,
      tools: config.tools,
      maxIterations: config.maxIterations,
      temperature: config.temperature,
      config: config.config,
    },
    template: options?.template ? {
      id: options.template.id,
      name: options.template.name,
      category: options.template.category,
      version: options.template.version,
    } : undefined,
    metadata: options?.metadata,
  };
}

/**
 * Export agent to JSON string
 */
export function exportAgentToString(
  config: CreateAgentInput,
  options?: {
    template?: SpecialistTemplate;
    metadata?: Record<string, unknown>;
    pretty?: boolean;
  }
): string {
  const data = exportAgent(config, options);
  return JSON.stringify(data, null, options?.pretty ? 2 : 0);
}

/**
 * Download agent configuration as file
 */
export function downloadAgentFile(
  config: CreateAgentInput,
  options?: {
    template?: SpecialistTemplate;
    metadata?: Record<string, unknown>;
    filename?: string;
  }
): void {
  const data = exportAgentToString(config, { ...options, pretty: true });
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options?.filename || `${config.name.toLowerCase().replace(/\s+/g, '-')}-agent.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import agent configuration from JSON string
 */
export function importAgentFromString(jsonString: string): AgentImportResult {
  try {
    const data = JSON.parse(jsonString);
    return importAgentFromObject(data);
  } catch (error) {
    return {
      success: false,
      config: null,
      error: `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Import agent configuration from object
 */
export function importAgentFromObject(data: unknown): AgentImportResult {
  const warnings: string[] = [];

  // Validate structure
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      config: null,
      error: 'Invalid import data: expected object',
    };
  }

  const exportData = data as AgentExportData;

  // Check version
  if (!exportData.version) {
    warnings.push('No version specified, assuming v1.0');
  } else if (!SUPPORTED_VERSIONS.includes(exportData.version)) {
    return {
      success: false,
      config: null,
      error: `Unsupported export version: ${exportData.version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`,
    };
  }

  // Validate agent configuration
  if (!exportData.agent || typeof exportData.agent !== 'object') {
    return {
      success: false,
      config: null,
      error: 'Invalid import data: missing agent configuration',
    };
  }

  const agent = exportData.agent;

  // Required fields validation
  if (!agent.name || typeof agent.name !== 'string') {
    return {
      success: false,
      config: null,
      error: 'Invalid import data: missing or invalid agent name',
    };
  }

  if (!agent.model || typeof agent.model !== 'string') {
    return {
      success: false,
      config: null,
      error: 'Invalid import data: missing or invalid model',
    };
  }

  // Build configuration
  const config: CreateAgentInput = {
    name: agent.name,
    description: agent.description || '',
    type: agent.type as CreateAgentInput['type'] || 'worker',
    model: agent.model,
    provider: agent.provider as CreateAgentInput['provider'] || 'openai',
    systemPrompt: agent.systemPrompt,
    capabilities: agent.capabilities,
    tools: agent.tools,
    maxIterations: agent.maxIterations || 10,
    temperature: agent.temperature || 0.7,
    config: agent.config,
  };

  // Validate optional fields
  if (config.maxIterations && (config.maxIterations < 1 || config.maxIterations > 100)) {
    warnings.push('maxIterations out of range (1-100), using default value of 10');
    config.maxIterations = 10;
  }

  if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
    warnings.push('temperature out of range (0-2), using default value of 0.7');
    config.temperature = 0.7;
  }

  return {
    success: true,
    config,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Import agent from file input
 */
export function importAgentFromFile(file: File): Promise<AgentImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        resolve({
          success: false,
          config: null,
          error: 'Failed to read file',
        });
        return;
      }
      resolve(importAgentFromString(content));
    };
    reader.onerror = () => {
      resolve({
        success: false,
        config: null,
        error: 'Failed to read file',
      });
    };
    reader.readAsText(file);
  });
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: CreateAgentInput): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.name || config.name.trim().length === 0) {
    errors.push('Agent name is required');
  } else if (config.name.length > 100) {
    errors.push('Agent name must be less than 100 characters');
  }

  if (!config.description || config.description.trim().length === 0) {
    warnings.push('Agent description is recommended');
  }

  if (!config.model) {
    errors.push('Model is required');
  }

  if (!config.provider) {
    errors.push('Provider is required');
  }

  // Optional field validation
  if (config.maxIterations !== undefined) {
    if (config.maxIterations < 1 || config.maxIterations > 100) {
      errors.push('maxIterations must be between 1 and 100');
    }
  }

  if (config.temperature !== undefined) {
    if (config.temperature < 0 || config.temperature > 2) {
      errors.push('temperature must be between 0 and 2');
    }
  }

  if (config.tools && config.tools.length > 20) {
    warnings.push('Having more than 20 tools may impact performance');
  }

  if (config.capabilities && config.capabilities.length > 10) {
    warnings.push('Having more than 10 capabilities may impact focus');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get supported export versions
 */
export function getSupportedVersions(): string[] {
  return [...SUPPORTED_VERSIONS];
}

/**
 * Get current export version
 */
export function getCurrentVersion(): string {
  return EXPORT_VERSION;
}

/**
 * Migrate old export format to current format
 */
export function migrateExportData(data: unknown): AgentExportData | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const exportData = data as any;

  // Handle v1.0 (current version, no migration needed)
  if (exportData.version === '1.0' || !exportData.version) {
    return {
      version: '1.0',
      exportedAt: exportData.exportedAt || new Date().toISOString(),
      agent: exportData.agent,
      template: exportData.template,
      metadata: exportData.metadata,
    };
  }

  // Unknown version
  return null;
}
