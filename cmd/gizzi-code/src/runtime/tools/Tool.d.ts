/**
 * @fileoverview Runtime tool base class and interfaces
 * @module runtime/tools/Tool
 *
 * Defines the abstract base class for all runtime tools, providing
 * a standardized interface for tool execution, validation, and schema generation.
 * All tools in the gizzi-code runtime must extend this base class.
 */
import type { Message } from '../../types/message.js';
/**
 * Context passed to tools during execution
 * @interface ToolContext
 */
export interface ToolContext {
    /** Unique identifier for the current execution session */
    readonly sessionId: string;
    /** Current user identifier */
    readonly userId?: string;
    /** Messages in the current conversation context */
    readonly messages: readonly Message[];
    /** Abort signal for cancellation support */
    readonly signal?: AbortSignal;
    /** Additional metadata for the execution context */
    readonly metadata?: Readonly<Record<string, unknown>>;
    /** Callback for reporting progress during long-running operations */
    readonly onProgress?: (progress: ToolProgress) => void;
}
/**
 * Progress information for long-running tool operations
 * @interface ToolProgress
 */
export interface ToolProgress {
    /** Current step number */
    readonly current: number;
    /** Total number of steps */
    readonly total: number;
    /** Human-readable status message */
    readonly message: string;
    /** Optional percentage completion (0-100) */
    readonly percent?: number;
}
/**
 * JSON Schema property definition for tool parameters
 * @interface ToolParameterSchema
 */
export interface ToolParameterSchema {
    /** Parameter type */
    readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'integer';
    /** Human-readable description of the parameter */
    readonly description: string;
    /** Whether the parameter is required */
    readonly required?: boolean;
    /** Default value for the parameter */
    readonly default?: unknown;
    /** Enum values for constrained parameters */
    readonly enum?: readonly unknown[];
    /** Array item schema for array types */
    readonly items?: ToolParameterSchema;
    /** Object properties schema for object types */
    readonly properties?: Readonly<Record<string, ToolParameterSchema>>;
    /** Format hint for string parameters (e.g., 'date', 'email', 'uri') */
    readonly format?: string;
}
/**
 * Complete tool schema definition for JSON Schema output
 * @interface ToolSchema
 */
export interface ToolSchema {
    /** Tool name */
    readonly name: string;
    /** Tool description */
    readonly description: string;
    /** JSON Schema version */
    readonly schema: 'http://json-schema.org/draft-07/schema#';
    /** Parameter definitions */
    readonly parameters: {
        readonly type: 'object';
        readonly properties: Readonly<Record<string, ToolParameterSchema>>;
        readonly required: readonly string[];
        readonly additionalProperties: boolean;
    };
}
/**
 * Result of a tool execution
 * @interface ToolResult
 */
export interface ToolResult<T = unknown> {
    /** Whether the execution was successful */
    readonly success: boolean;
    /** Result data (only present on success) */
    readonly data?: T;
    /** Error information (only present on failure) */
    readonly error?: ToolError;
    /** Execution metadata */
    readonly metadata?: {
        /** Execution duration in milliseconds */
        readonly duration: number;
        /** Timestamp when execution completed */
        readonly timestamp: Date;
        /** Additional metadata */
        readonly [key: string]: unknown;
    };
}
/**
 * Tool error information
 * @interface ToolError
 */
export interface ToolError {
    /** Error code for programmatic handling */
    readonly code: ToolErrorCode;
    /** Human-readable error message */
    readonly message: string;
    /** Additional error details */
    readonly details?: Readonly<Record<string, unknown>>;
    /** Original error if wrapped */
    readonly cause?: Error;
}
/**
 * Standard tool error codes
 * @typedef {'validation_error' | 'execution_error' | 'timeout_error' | 'cancelled_error' | 'permission_error' | 'not_found_error' | 'rate_limit_error' | 'internal_error'} ToolErrorCode
 */
export type ToolErrorCode = 'validation_error' | 'execution_error' | 'timeout_error' | 'cancelled_error' | 'permission_error' | 'not_found_error' | 'rate_limit_error' | 'internal_error';
/**
 * Tool parameter definitions mapping
 * @type ToolParameters
 */
export type ToolParameters = Readonly<Record<string, ToolParameterSchema>>;
/**
 * Abstract base class for all runtime tools
 * @abstract
 * @class Tool
 *
 * @example
 * ```typescript
 * class MyTool extends Tool<{ input: string }, { output: string }> {
 *   name = 'my_tool';
 *   description = 'A sample tool';
 *   parameters = {
 *     input: {
 *       type: 'string',
 *       description: 'Input text',
 *       required: true
 *     }
 *   };
 *
 *   async execute(args: { input: string }, context: ToolContext): Promise<ToolResult<{ output: string }>> {
 *     return {
 *       success: true,
 *       data: { output: args.input.toUpperCase() },
 *       metadata: { duration: 0, timestamp: new Date() }
 *     };
 *   }
 * }
 * ```
 */
export declare abstract class Tool<TArgs = Record<string, unknown>, TResult = unknown> {
    /**
     * Unique tool identifier (kebab-case or snake_case)
     * @abstract
     * @readonly
     */
    abstract readonly name: string;
    /**
     * Human-readable description of what the tool does
     * @abstract
     * @readonly
     */
    abstract readonly description: string;
    /**
     * Parameter schema definitions for validation and documentation
     * @abstract
     * @readonly
     */
    abstract readonly parameters: ToolParameters;
    /**
     * Execute the tool with the given arguments and context
     * @abstract
     * @param {TArgs} args - Validated tool arguments
     * @param {ToolContext} context - Execution context
     * @returns {Promise<ToolResult<TResult>>} Tool execution result
     * @throws {never} Should never throw; errors should be returned as ToolResult with success: false
     */
    abstract execute(args: TArgs, context: ToolContext): Promise<ToolResult<TResult>>;
    /**
     * Validate tool arguments against the parameter schema
     * @param {unknown} args - Arguments to validate
     * @returns {{ valid: true } | { valid: false; errors: readonly string[] }} Validation result
     */
    validate(args: unknown): {
        valid: true;
    } | {
        valid: false;
        errors: readonly string[];
    };
    /**
     * Get the JSON Schema representation of this tool
     * @returns {ToolSchema} Complete JSON Schema for the tool
     */
    getSchema(): ToolSchema;
    /**
     * Validate a single parameter value against its schema
     * @private
     * @param {string} key - Parameter name
     * @param {unknown} value - Parameter value
     * @param {ToolParameterSchema} schema - Parameter schema
     * @returns {string | null} Error message or null if valid
     */
    private validateType;
    /**
     * Execute with automatic validation (helper method)
     * @param {unknown} args - Raw arguments to validate and execute
     * @param {ToolContext} context - Execution context
     * @returns {Promise<ToolResult<TResult>>} Tool execution result
     */
    executeWithValidation(args: unknown, context: ToolContext): Promise<ToolResult<TResult>>;
}
/**
 * Type guard to check if a value is a ToolError
 * @param {unknown} value - Value to check
 * @returns {boolean} True if the value is a ToolError
 */
export declare function isToolError(value: unknown): value is ToolError;
/**
 * Create a successful tool result
 * @template T
 * @param {T} data - Result data
 * @param {Partial<ToolResult<T>['metadata']>} metadata - Optional metadata
 * @returns {ToolResult<T>} Successful tool result
 */
export declare function createSuccessResult<T>(data: T, metadata?: Partial<ToolResult<T>['metadata']>): ToolResult<T>;
/**
 * Create an error tool result
 * @param {ToolErrorCode} code - Error code
 * @param {string} message - Error message
 * @param {Partial<ToolError>} details - Additional error details
 * @returns {ToolResult<never>} Error tool result
 */
export declare function createErrorResult(code: ToolErrorCode, message: string, details?: Partial<ToolError>): ToolResult<never>;
export default Tool;
