import type { JsonSchema } from './types.js';
export interface SchemaValidationResult {
    valid: boolean;
    errors: string[];
}
/** Recursively closes object schemas for providers that require strict tools. */
export declare function toStrictJsonSchema<T extends JsonSchema>(schema: T): T;
/** Small, dependency-free validator for the JSON Schema subset used by tools. */
export declare function validateJsonSchema(schema: JsonSchema, value: unknown): SchemaValidationResult;
