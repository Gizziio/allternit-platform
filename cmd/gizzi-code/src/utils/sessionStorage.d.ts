/**
 * @fileoverview Session storage utilities for gizzi-code integration
 * @module utils/sessionStorage
 *
 * Provides session persistence, storage management, and user type detection
 * with safe fallbacks for environments without storage access.
 */
import type { UserSession } from '../state/AppStateStore';
import type { TypedMessage } from '../types/message';
/**
 * Storage keys used throughout the application
 * @constant {Record<string, string>}
 */
export declare const STORAGE_KEYS: {
    readonly SESSION: "gizzi_session";
    readonly USER_TYPE: "gizzi_user_type";
    readonly MESSAGES: "gizzi_messages";
    readonly PREFERENCES: "gizzi_preferences";
    readonly LAST_ACTIVITY: "gizzi_last_activity";
    readonly SESSION_METADATA: "gizzi_session_metadata";
};
/**
 * User type categories
 * @typedef {'anonymous' | 'free' | 'pro' | 'enterprise' | 'admin'} UserType
 */
export type UserType = 'anonymous' | 'free' | 'pro' | 'enterprise' | 'admin';
/**
 * Valid user types for runtime validation
 * @constant {readonly UserType[]}
 */
export declare const VALID_USER_TYPES: readonly UserType[];
/**
 * Session metadata stored alongside the session
 * @interface SessionMetadata
 */
export interface SessionMetadata {
    /** When the session was created */
    readonly createdAt: string;
    /** Last activity timestamp (ISO string) */
    readonly lastActivity: string;
    /** Number of messages in this session */
    readonly messageCount: number;
    /** Session version for migration purposes */
    readonly version: number;
    /** Device/browser information */
    readonly deviceInfo?: {
        readonly userAgent: string;
        readonly platform: string;
        readonly language: string;
    };
}
/**
 * Complete session data structure
 * @interface SessionData
 */
export interface SessionData {
    /** User session information */
    readonly session: UserSession;
    /** Session metadata */
    readonly metadata: SessionMetadata;
    /** Persisted messages */
    readonly messages: readonly TypedMessage[];
    /** User preferences */
    readonly preferences: Readonly<Record<string, unknown>>;
}
/**
 * Storage operation result
 * @interface StorageResult
 */
export interface StorageResult<T> {
    /** Whether the operation succeeded */
    readonly success: boolean;
    /** The data if successful, null otherwise */
    readonly data: T | null;
    /** Error message if failed */
    readonly error: string | null;
}
/**
 * Saves the current session to storage
 *
 * @param {UserSession} session - The session to save
 * @param {Object} [options] - Save options
 * @param {TypedMessage[]} [options.messages] - Messages to persist
 * @param {Record<string, unknown>} [options.preferences] - Preferences to persist
 * @returns {StorageResult<void>} Result of the save operation
 * @example
 * ```typescript
 * const result = saveSession(session, { messages, preferences });
 * if (!result.success) {
 *   console.error('Failed to save session:', result.error);
 * }
 * ```
 */
export declare function saveSession(session: UserSession, options?: {
    messages?: TypedMessage[];
    preferences?: Record<string, unknown>;
}): StorageResult<void>;
/**
 * Loads the session from storage
 *
 * @returns {StorageResult<SessionData>} The loaded session data or error
 * @example
 * ```typescript
 * const result = loadSession();
 * if (result.success && result.data) {
 *   const { session, messages } = result.data;
 *   // Restore session...
 * }
 * ```
 */
export declare function loadSession(): StorageResult<SessionData>;
/**
 * Clears all session data from storage
 *
 * @returns {boolean} True if successful
 * @example
 * ```typescript
 * clearSession(); // Logs out the user
 * ```
 */
export declare function clearSession(): boolean;
/**
 * Gets the user type from storage
 * Returns 'anonymous' if no user type is stored or on error
 *
 * @returns {UserType} The stored user type or 'anonymous'
 * @example
 * ```typescript
 * const userType = getUserType();
 * if (userType === 'pro') {
 *   // Show pro features
 * }
 * ```
 */
export declare function getUserType(): UserType;
/**
 * Saves messages to session storage
 *
 * @param {TypedMessage[]} messages - Messages to save
 * @returns {StorageResult<void>} Result of the operation
 */
export declare function saveMessages(messages: TypedMessage[]): StorageResult<void>;
/**
 * Loads messages from session storage
 *
 * @returns {StorageResult<TypedMessage[]>} The loaded messages or error
 */
export declare function loadMessages(): StorageResult<TypedMessage[]>;
/**
 * Saves user preferences to storage
 *
 * @param {Record<string, unknown>} preferences - Preferences to save
 * @returns {StorageResult<void>} Result of the operation
 */
export declare function savePreferences(preferences: Record<string, unknown>): StorageResult<void>;
/**
 * Loads user preferences from storage
 *
 * @returns {StorageResult<Record<string, unknown>>} The loaded preferences or error
 */
export declare function loadPreferences(): StorageResult<Record<string, unknown>>;
/**
 * Gets the timestamp of the last user activity
 *
 * @returns {Date | null} The last activity date or null if not found
 */
export declare function getLastActivity(): Date | null;
/**
 * Updates the last activity timestamp to now
 *
 * @returns {boolean} True if successful
 */
export declare function updateLastActivity(): boolean;
/**
 * Checks if there is an active session in storage
 *
 * @returns {boolean} True if a valid session exists
 */
export declare function hasActiveSession(): boolean;
/**
 * Type guard to check if a value is a valid UserType
 *
 * @param {unknown} value - The value to check
 * @returns {boolean} True if the value is a valid UserType
 */
export declare function isUserType(value: unknown): value is UserType;
declare const _default: {
    STORAGE_KEYS: {
        readonly SESSION: "gizzi_session";
        readonly USER_TYPE: "gizzi_user_type";
        readonly MESSAGES: "gizzi_messages";
        readonly PREFERENCES: "gizzi_preferences";
        readonly LAST_ACTIVITY: "gizzi_last_activity";
        readonly SESSION_METADATA: "gizzi_session_metadata";
    };
    VALID_USER_TYPES: readonly UserType[];
    saveSession: typeof saveSession;
    loadSession: typeof loadSession;
    clearSession: typeof clearSession;
    getUserType: typeof getUserType;
    saveMessages: typeof saveMessages;
    loadMessages: typeof loadMessages;
    savePreferences: typeof savePreferences;
    loadPreferences: typeof loadPreferences;
    getLastActivity: typeof getLastActivity;
    updateLastActivity: typeof updateLastActivity;
    hasActiveSession: typeof hasActiveSession;
    isUserType: typeof isUserType;
};
export default _default;
