/**
 * @fileoverview Exit handler hook for gizzi-code integration
 * @module hooks/useExitOnCtrlCD
 *
 * Provides a React hook for handling exit key combinations (Ctrl+C and Ctrl+D).
 * Commonly used for CLI applications to handle graceful shutdown or exit actions.
 */
/**
 * Exit handler callback type
 * @typedef {Function} ExitHandler
 */
export type ExitHandler = () => void | boolean | Promise<void | boolean>;
/**
 * Options for the exit handler hook
 * @interface UseExitOnCtrlCDOptions
 */
export interface UseExitOnCtrlCDOptions {
    /** Callback function to execute when exit keys are pressed */
    readonly onExit?: ExitHandler;
    /** Whether Ctrl+C triggers exit (default: true) */
    readonly enableCtrlC?: boolean;
    /** Whether Ctrl+D triggers exit (default: true) */
    readonly enableCtrlD?: boolean;
    /** Whether the exit handler is active (default: true) */
    readonly enabled?: boolean;
    /** Custom message to display on exit (optional) */
    readonly exitMessage?: string;
    /** Whether to confirm before exit (default: false) */
    readonly confirmBeforeExit?: boolean;
    /** Custom confirmation message */
    readonly confirmMessage?: string;
}
/**
 * React hook for handling Ctrl+C and Ctrl+D exit combinations
 *
 * Registers keyboard shortcuts for common terminal exit commands and
 * executes the provided callback when triggered. Supports optional
 * confirmation before exit.
 *
 * @param {ExitHandler | UseExitOnCtrlCDOptions} handler - Exit callback or options object
 * @example
 * ```typescript
 * // Simple usage with callback
 * useExitOnCtrlCD(() => {
 *   console.log('Exiting...');
 *   process.exit(0);
 * });
 *
 * // With options
 * useExitOnCtrlCD({
 *   onExit: () => saveAndQuit(),
 *   enableCtrlC: true,
 *   enableCtrlD: false,
 *   exitMessage: '👋 See you later!',
 *   confirmBeforeExit: true,
 * });
 * ```
 */
export declare function useExitOnCtrlCD(handler: ExitHandler | UseExitOnCtrlCDOptions): void;
/**
 * Convenience hook for just Ctrl+C handling
 *
 * @param {ExitHandler} handler - Exit callback
 * @param {boolean} [enabled=true] - Whether the handler is active
 * @example
 * ```typescript
 * useExitOnCtrlC(() => {
 *   console.log('Interrupted');
 * });
 * ```
 */
export declare function useExitOnCtrlC(handler: ExitHandler, enabled?: boolean): void;
/**
 * Convenience hook for just Ctrl+D handling
 *
 * @param {ExitHandler} handler - Exit callback
 * @param {boolean} [enabled=true] - Whether the handler is active
 * @example
 * ```typescript
 * useExitOnCtrlD(() => {
 *   console.log('EOF received');
 * });
 * ```
 */
export declare function useExitOnCtrlD(handler: ExitHandler, enabled?: boolean): void;
export default useExitOnCtrlCD;
