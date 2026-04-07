/**
 * ACP (Agent Client Protocol) Validators
 *
 * Validation utilities for ACP entities.
 * Uses lightweight validation compatible with official ACP types.
 */
import type { SessionId, ToolCall, Content, AllternitACPSession, ACPRegistryEntry, ValidationResult } from './types.js';
export declare function isSessionId(value: unknown): value is SessionId;
export declare function isContent(value: unknown): value is Content;
export declare function isToolCall(value: unknown): value is ToolCall;
export declare function validateACPMessage(value: unknown): ValidationResult<Content>;
export declare function validateACPSession(value: unknown): ValidationResult<AllternitACPSession>;
export declare function validateACPRegistryEntry(value: unknown): ValidationResult<ACPRegistryEntry>;
export declare function assertValidACPMessage(value: unknown): Content;
export declare function assertValidACPSession(value: unknown): AllternitACPSession;
export declare function assertValidACPRegistryEntry(value: unknown): ACPRegistryEntry;
//# sourceMappingURL=validator.d.ts.map