/**
 * ACP (Agent Capability Protocol) Validator
 * Validates ACP messages, tools, sessions, and registry entries
 */
import { ACPMessage, ACPTool, ACPSession, ACPRegistryEntry, ACPError } from './schema.js';
export interface ValidationResult<T> {
    valid: boolean;
    data?: T;
    errors?: string[];
}
/**
 * Validate an ACP message
 */
export declare function validateMessage(data: unknown): ValidationResult<ACPMessage>;
/**
 * Validate an ACP tool definition
 */
export declare function validateTool(data: unknown): ValidationResult<ACPTool>;
/**
 * Validate an ACP session
 */
export declare function validateSession(data: unknown): ValidationResult<ACPSession>;
/**
 * Validate an ACP registry entry
 */
export declare function validateRegistryEntry(data: unknown): ValidationResult<ACPRegistryEntry>;
/**
 * Validate a batch of items
 */
export declare function validateBatch<T>(items: unknown[], validator: (item: unknown) => ValidationResult<T>): {
    valid: T[];
    invalid: {
        index: number;
        item: unknown;
        errors: string[];
    }[];
};
/**
 * Create a validation error
 */
export declare function createValidationError(code: ACPError['code'], message: string, details?: Record<string, unknown>): ACPError;
/**
 * Safe parse - returns data or null without throwing
 */
export declare function safeParse<T>(data: unknown, validator: (item: unknown) => ValidationResult<T>): T | null;
declare const _default: {
    validateMessage: typeof validateMessage;
    validateTool: typeof validateTool;
    validateSession: typeof validateSession;
    validateRegistryEntry: typeof validateRegistryEntry;
    validateBatch: typeof validateBatch;
    createValidationError: typeof createValidationError;
    safeParse: typeof safeParse;
};
export default _default;
