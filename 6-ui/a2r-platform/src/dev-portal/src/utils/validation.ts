import { z } from 'zod';
import type { PluginManifest } from '../types';

// Plugin Manifest Validation Schema
export const pluginManifestSchema = z.object({
  id: z.string()
    .min(3, 'ID must be at least 3 characters')
    .max(64, 'ID must be at most 64 characters')
    .regex(/^[a-z0-9-]+$/, 'ID must contain only lowercase letters, numbers, and hyphens'),
  
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  
  version: z.string()
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/, 'Invalid semantic version'),
  
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters'),
  
  author: z.string().min(1, 'Author is required'),
  license: z.string().min(1, 'License is required'),
  
  entry: z.string()
    .regex(/\.(js|ts|jsx|tsx)$/, 'Entry must be a JavaScript/TypeScript file'),
  
  icon: z.string().optional(),
  
  categories: z.array(z.string()).min(1, 'At least one category is required'),
  
  permissions: z.array(z.string()),
  
  dependencies: z.record(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
  
  settings: z.array(z.object({
    key: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'select', 'multiselect', 'secret']),
    label: z.string(),
    description: z.string().optional(),
    default: z.any().optional(),
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
  })).optional(),
  
  hooks: z.array(z.object({
    event: z.string(),
    handler: z.string(),
    priority: z.number().optional(),
  })).optional(),
  
  commands: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    shortcut: z.string().optional(),
    icon: z.string().optional(),
    handler: z.string(),
  })).optional(),
  
  minA2RVersion: z.string().optional(),
  maxA2RVersion: z.string().optional(),
});

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
  }>;
}

export function validateManifest(manifest: unknown): ValidationResult {
  const result: ValidationResult = {
    valid: false,
    errors: [],
    warnings: [],
  };

  try {
    pluginManifestSchema.parse(manifest);
    result.valid = true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.errors = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
    }
  }

  // Additional warnings
  const m = manifest as Partial<PluginManifest>;
  
  if (!m.icon) {
    result.warnings.push({
      path: 'icon',
      message: 'No icon specified. Consider adding an icon for better visibility in the marketplace.',
    });
  }

  if (!m.settings || m.settings.length === 0) {
    result.warnings.push({
      path: 'settings',
      message: 'No settings defined. Consider adding configuration options for users.',
    });
  }

  if (!m.commands || m.commands.length === 0) {
    result.warnings.push({
      path: 'commands',
      message: 'No commands defined. Consider adding slash commands or actions.',
    });
  }

  if (m.dependencies && Object.keys(m.dependencies).length > 10) {
    result.warnings.push({
      path: 'dependencies',
      message: 'Large number of dependencies may impact performance.',
    });
  }

  return result;
}
