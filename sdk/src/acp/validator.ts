/**
 * ACP (Agent Capability Protocol) Validator
 * Validates ACP messages, tools, sessions, and registry entries
 */

import {
  ACPMessageSchema,
  ACPToolSchema,
  ACPSessionSchema,
  ACPRegistryEntrySchema,
  ACPMessage,
  ACPTool,
  ACPSession,
  ACPRegistryEntry,
  ACPError,
} from './schema.js';
import { ZodError } from 'zod';

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Format Zod errors into readable strings
 */
function formatZodErrors(error: ZodError): string[] {
  return error.errors.map(err => {
    const path = err.path.length > 0 ? err.path.join('.') : 'root';
    return `${path}: ${err.message}`;
  });
}

/**
 * Validate an ACP message
 */
export function validateMessage(data: unknown): ValidationResult<ACPMessage> {
  try {
    const parsed = ACPMessageSchema.parse(data);
    return { valid: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return { valid: false, errors: formatZodErrors(error) };
    }
    return { valid: false, errors: [(error as Error).message] };
  }
}

/**
 * Validate an ACP tool definition
 */
export function validateTool(data: unknown): ValidationResult<ACPTool> {
  try {
    const parsed = ACPToolSchema.parse(data);
    return { valid: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return { valid: false, errors: formatZodErrors(error) };
    }
    return { valid: false, errors: [(error as Error).message] };
  }
}

/**
 * Validate an ACP session
 */
export function validateSession(data: unknown): ValidationResult<ACPSession> {
  try {
    const parsed = ACPSessionSchema.parse(data);
    return { valid: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return { valid: false, errors: formatZodErrors(error) };
    }
    return { valid: false, errors: [(error as Error).message] };
  }
}

/**
 * Validate an ACP registry entry
 */
export function validateRegistryEntry(data: unknown): ValidationResult<ACPRegistryEntry> {
  try {
    const parsed = ACPRegistryEntrySchema.parse(data);
    return { valid: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return { valid: false, errors: formatZodErrors(error) };
    }
    return { valid: false, errors: [(error as Error).message] };
  }
}

/**
 * Validate a batch of items
 */
export function validateBatch<T>(
  items: unknown[],
  validator: (item: unknown) => ValidationResult<T>
): { valid: T[]; invalid: { index: number; item: unknown; errors: string[] }[] } {
  const valid: T[] = [];
  const invalid: { index: number; item: unknown; errors: string[] }[] = [];

  items.forEach((item, index) => {
    const result = validator(item);
    if (result.valid && result.data) {
      valid.push(result.data);
    } else {
      invalid.push({ index, item, errors: result.errors || ['Unknown error'] });
    }
  });

  return { valid, invalid };
}

/**
 * Create a validation error
 */
export function createValidationError(
  code: ACPError['code'],
  message: string,
  details?: Record<string, unknown>
): ACPError {
  return { code, message, details };
}

/**
 * Safe parse - returns data or null without throwing
 */
export function safeParse<T>(
  data: unknown,
  validator: (item: unknown) => ValidationResult<T>
): T | null {
  const result = validator(data);
  return result.valid ? result.data || null : null;
}

export default {
  validateMessage,
  validateTool,
  validateSession,
  validateRegistryEntry,
  validateBatch,
  createValidationError,
  safeParse,
};
