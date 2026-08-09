import type { JsonSchema } from './types.js';

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/** Recursively closes object schemas for providers that require strict tools. */
export function toStrictJsonSchema<T extends JsonSchema>(schema: T): T {
  const copy = structuredClone(schema) as JsonSchema;
  closeObjects(copy);
  return copy as T;
}

function closeObjects(schema: JsonSchema): void {
  if (schema.type === 'object' || schema.properties) {
    schema.additionalProperties = false;
    for (const child of Object.values(schema.properties ?? {})) closeObjects(child);
  }
  if (schema.items) closeObjects(schema.items);
}

/** Small, dependency-free validator for the JSON Schema subset used by tools. */
export function validateJsonSchema(schema: JsonSchema, value: unknown): SchemaValidationResult {
  const errors: string[] = [];
  validateNode(schema, value, '$', errors);
  return { valid: errors.length === 0, errors };
}

function validateNode(schema: JsonSchema, value: unknown, path: string, errors: string[]): void {
  if (schema.enum && !schema.enum.some(candidate => Object.is(candidate, value))) {
    errors.push(`${path} must be one of the allowed values`);
    return;
  }

  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const expected = schema.type;
  const typeMatches = !expected
    || expected === actual
    || (expected === 'integer' && typeof value === 'number' && Number.isInteger(value))
    || (expected === 'number' && typeof value === 'number' && Number.isFinite(value))
    || (expected === 'image' && value && typeof value === 'object' && !Array.isArray(value));
  if (!typeMatches) {
    errors.push(`${path} must be ${expected}`);
    return;
  }

  if (expected === 'image' && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (!record.source || typeof record.source !== 'object' || Array.isArray(record.source)) {
      errors.push(`${path}.source must be an object`);
      return;
    }
    const source = record.source as Record<string, unknown>;
    if (source.type === 'url') {
      if (typeof source.url !== 'string') errors.push(`${path}.source.url must be a string`);
    } else if (source.type === 'base64') {
      if (typeof source.media_type !== 'string') errors.push(`${path}.source.media_type must be a string`);
      if (typeof source.data !== 'string') errors.push(`${path}.source.data must be a string`);
    } else {
      errors.push(`${path}.source.type must be "url" or "base64"`);
    }
    return;
  }

  if ((expected === 'object' || schema.properties) && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) errors.push(`${path}.${key} is required`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in record) validateNode(child, record[key], `${path}.${key}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!(key in (schema.properties ?? {}))) errors.push(`${path}.${key} is not allowed`);
      }
    }
  }

  if (expected === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => validateNode(schema.items!, item, `${path}[${index}]`, errors));
  }
}
