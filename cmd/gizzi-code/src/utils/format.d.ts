/**
 * @fileoverview Format utilities for gizzi-code integration
 * @module utils/format
 *
 * Provides formatting utilities for durations, byte sizes, and numbers.
 * These functions are commonly used in CLI output and display components.
 */
/**
 * Number format options
 * @interface NumberFormatOptions
 */
export interface NumberFormatOptions {
    /** Minimum number of decimal places */
    readonly minimumFractionDigits?: number;
    /** Maximum number of decimal places */
    readonly maximumFractionDigits?: number;
    /** Use thousands separator */
    readonly useGrouping?: boolean;
    /** Locale for formatting (default: 'en-US') */
    readonly locale?: string;
}
/**
 * Duration format options
 * @interface DurationFormatOptions
 */
export interface DurationFormatOptions {
    /** Format style (default: 'auto') */
    readonly style?: 'short' | 'long' | 'narrow' | 'auto';
    /** Maximum number of units to display (default: 2) */
    readonly maxUnits?: number;
    /** Include milliseconds in output */
    readonly includeMs?: boolean;
    /** Round to nearest unit */
    readonly round?: boolean;
}
/**
 * Byte format options
 * @interface ByteFormatOptions
 */
export interface ByteFormatOptions {
    /** Number of decimal places (default: 2) */
    readonly decimals?: number;
    /** Use binary units (KiB, MiB) instead of decimal (KB, MB) */
    readonly binary?: boolean;
    /** Include space between value and unit */
    readonly space?: boolean;
}
/**
 * Formats a duration in milliseconds to a human-readable string
 *
 * @param {number} ms - Duration in milliseconds
 * @param {DurationFormatOptions} [options] - Format options
 * @returns {string} Formatted duration string
 * @example
 * ```typescript
 * formatDuration(5000); // "5s"
 * formatDuration(65000); // "1m 5s"
 * formatDuration(3600000); // "1h"
 * formatDuration(90000, { style: 'long' }); // "1 minute 30 seconds"
 * ```
 */
export declare function formatDuration(ms: number, options?: DurationFormatOptions): string;
/**
 * Formats a byte size to a human-readable string
 *
 * @param {number} bytes - Size in bytes
 * @param {ByteFormatOptions} [options] - Format options
 * @returns {string} Formatted size string
 * @example
 * ```typescript
 * formatBytes(1024); // "1 KB"
 * formatBytes(1536); // "1.50 KB"
 * formatBytes(1048576); // "1 MB"
 * formatBytes(1024, { binary: true }); // "1 KiB"
 * ```
 */
export declare function formatBytes(bytes: number, options?: ByteFormatOptions): string;
/**
 * Formats a number with locale-aware formatting
 *
 * @param {number} num - Number to format
 * @param {NumberFormatOptions} [options] - Format options
 * @returns {string} Formatted number string
 * @example
 * ```typescript
 * formatNumber(1234567); // "1,234,567"
 * formatNumber(1234.5678, { maximumFractionDigits: 2 }); // "1,234.57"
 * formatNumber(0.001234, { minimumFractionDigits: 6 }); // "0.001234"
 * ```
 */
export declare function formatNumber(num: number, options?: NumberFormatOptions): string;
/**
 * Formats a number as a percentage
 *
 * @param {number} value - Value to format (0.5 = 50%)
 * @param {number} [decimals=1] - Number of decimal places
 * @returns {string} Formatted percentage string
 * @example
 * ```typescript
 * formatPercentage(0.5); // "50%"
 * formatPercentage(0.1234, 2); // "12.34%"
 * ```
 */
export declare function formatPercentage(value: number, decimals?: number): string;
/**
 * Formats a number as compact notation (1K, 1M, etc.)
 *
 * @param {number} num - Number to format
 * @param {number} [decimals=1] - Number of decimal places
 * @returns {string} Compact formatted string
 * @example
 * ```typescript
 * formatCompact(1234); // "1.2K"
 * formatCompact(1000000); // "1M"
 * formatCompact(1234567890); // "1.2B"
 * ```
 */
export declare function formatCompact(num: number, decimals?: number): string;
declare const _default: {
    formatDuration: typeof formatDuration;
    formatBytes: typeof formatBytes;
    formatNumber: typeof formatNumber;
    formatPercentage: typeof formatPercentage;
    formatCompact: typeof formatCompact;
};
export default _default;
