/**
 * ACP (Agent Capability Protocol) Validator
 * Validates ACP messages, tools, sessions, and registry entries
 */
import { ACPMessageSchema, ACPToolSchema, ACPSessionSchema, ACPRegistryEntrySchema, } from './schema.js';
import { ZodError } from 'zod';
/**
 * Format Zod errors into readable strings
 */
function formatZodErrors(error) {
    return error.issues.map((err) => {
        const path = err.path && err.path.length > 0 ? String(err.path.join('.')) : 'root';
        return `${path}: ${err.message}`;
    });
}
/**
 * Validate an ACP message
 */
export function validateMessage(data) {
    try {
        const parsed = ACPMessageSchema.parse(data);
        return { valid: true, data: parsed };
    }
    catch (error) {
        if (error instanceof ZodError) {
            return { valid: false, errors: formatZodErrors(error) };
        }
        return { valid: false, errors: [error.message] };
    }
}
/**
 * Validate an ACP tool definition
 */
export function validateTool(data) {
    try {
        const parsed = ACPToolSchema.parse(data);
        return { valid: true, data: parsed };
    }
    catch (error) {
        if (error instanceof ZodError) {
            return { valid: false, errors: formatZodErrors(error) };
        }
        return { valid: false, errors: [error.message] };
    }
}
/**
 * Validate an ACP session
 */
export function validateSession(data) {
    try {
        const parsed = ACPSessionSchema.parse(data);
        return { valid: true, data: parsed };
    }
    catch (error) {
        if (error instanceof ZodError) {
            return { valid: false, errors: formatZodErrors(error) };
        }
        return { valid: false, errors: [error.message] };
    }
}
/**
 * Validate an ACP registry entry
 */
export function validateRegistryEntry(data) {
    try {
        const parsed = ACPRegistryEntrySchema.parse(data);
        return { valid: true, data: parsed };
    }
    catch (error) {
        if (error instanceof ZodError) {
            return { valid: false, errors: formatZodErrors(error) };
        }
        return { valid: false, errors: [error.message] };
    }
}
/**
 * Validate a batch of items
 */
export function validateBatch(items, validator) {
    const valid = [];
    const invalid = [];
    items.forEach((item, index) => {
        const result = validator(item);
        if (result.valid && result.data) {
            valid.push(result.data);
        }
        else {
            invalid.push({ index, item, errors: result.errors || ['Unknown error'] });
        }
    });
    return { valid, invalid };
}
/**
 * Create a validation error
 */
export function createValidationError(code, message, details) {
    return { code, message, details };
}
/**
 * Safe parse - returns data or null without throwing
 */
export function safeParse(data, validator) {
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
