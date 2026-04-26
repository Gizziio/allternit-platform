/**
 * @fileoverview Bootstrap state management for gizzi-code integration
 * @module bootstrap/state
 *
 * Manages application initialization state, loading phases, and bootstrap
 * lifecycle events. Provides centralized state tracking during application startup.
 */
import type { TypedMessage } from '../types/message';
/**
 * Loading phase identifiers for the bootstrap process
 * @typedef {'idle' | 'initializing' | 'loading_config' | 'connecting' | 'authenticating' | 'ready' | 'error'} LoadingPhase
 */
export type LoadingPhase = 'idle' | 'initializing' | 'loading_config' | 'connecting' | 'authenticating' | 'ready' | 'error';
/**
 * Valid loading phase transitions
 * @constant {Record<LoadingPhase, readonly LoadingPhase[]>}
 */
export declare const VALID_PHASE_TRANSITIONS: Readonly<Record<LoadingPhase, readonly LoadingPhase[]>>;
/**
 * Bootstrap error structure
 * @interface BootstrapError
 */
export interface BootstrapError {
    /** Error code for programmatic handling */
    readonly code: string;
    /** Human-readable error message */
    readonly message: string;
    /** Error timestamp */
    readonly timestamp: Date;
    /** Optional error details or stack trace */
    readonly details?: string;
    /** Phase where the error occurred */
    readonly phase: LoadingPhase;
}
/**
 * Bootstrap state interface tracking initialization progress
 * @interface BootstrapState
 */
export interface BootstrapState {
    /** Current loading phase */
    readonly phase: LoadingPhase;
    /** Overall progress percentage (0-100) */
    readonly progress: number;
    /** Whether the application has completed bootstrap */
    readonly isComplete: boolean;
    /** Whether an error has occurred during bootstrap */
    readonly hasError: boolean;
    /** Current error if any */
    readonly error: BootstrapError | null;
    /** Timestamp when bootstrap started */
    readonly startTime: Date | null;
    /** Timestamp when bootstrap completed */
    readonly endTime: Date | null;
    /** Messages collected during initialization */
    readonly messages: readonly TypedMessage[];
    /** Configuration data loaded during bootstrap */
    readonly config: Readonly<Record<string, unknown>>;
    /** Services initialized during bootstrap */
    readonly services: readonly string[];
}
/**
 * Listener callback type for state changes
 * @typedef {(state: BootstrapState) => void} StateChangeListener
 */
type StateChangeListener = (state: BootstrapState) => void;
/**
 * Gets the current bootstrap state
 * @returns {Readonly<BootstrapState>} The current bootstrap state (immutable)
 * @example
 * ```typescript
 * const state = getBootstrapState();
 * if (state.phase === 'ready') {
 *   console.log('Application is ready');
 * }
 * ```
 */
export declare function getBootstrapState(): Readonly<BootstrapState>;
/**
 * Sets the bootstrap state with partial updates
 * Automatically notifies all registered listeners
 *
 * @param {Partial<BootstrapState>} updates - Partial state updates to apply
 * @returns {Readonly<BootstrapState>} The updated state
 * @throws {Error} If attempting an invalid phase transition
 * @example
 * ```typescript
 * setBootstrapState({ phase: 'initializing', progress: 10 });
 * ```
 */
export declare function setBootstrapState(updates: Partial<BootstrapState>): Readonly<BootstrapState>;
/**
 * Subscribes to bootstrap state changes
 *
 * @param {StateChangeListener} listener - Callback function to invoke on state changes
 * @returns {() => void} Unsubscribe function
 * @example
 * ```typescript
 * const unsubscribe = subscribeToBootstrapState((state) => {
 *   console.log('Phase:', state.phase);
 * });
 * // Later: unsubscribe();
 * ```
 */
export declare function subscribeToBootstrapState(listener: StateChangeListener): () => void;
/**
 * Resets the bootstrap state to initial values
 * Useful for testing or re-initializing the application
 *
 * @param {boolean} [notifyListeners=true] - Whether to notify listeners of the reset
 * @returns {Readonly<BootstrapState>} The reset state
 */
export declare function resetBootstrapState(notifyListeners?: boolean): Readonly<BootstrapState>;
/**
 * Starts the bootstrap process
 * Sets phase to 'initializing' and records start time
 *
 * @returns {Readonly<BootstrapState>} The updated state
 */
export declare function startBootstrap(): Readonly<BootstrapState>;
/**
 * Reports a bootstrap error
 * Sets phase to 'error' and records error details
 *
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {string} [details] - Optional error details
 * @returns {Readonly<BootstrapState>} The updated state
 */
export declare function setBootstrapError(code: string, message: string, details?: string): Readonly<BootstrapState>;
/**
 * Completes the bootstrap process
 * Sets phase to 'ready' and records completion time
 *
 * @returns {Readonly<BootstrapState>} The updated state
 */
export declare function completeBootstrap(): Readonly<BootstrapState>;
/**
 * Gets the estimated time remaining for bootstrap
 *
 * @returns {number | null} Estimated milliseconds remaining, or null if not available
 */
export declare function getEstimatedTimeRemaining(): number | null;
/**
 * Adds a message to the bootstrap state
 *
 * @param {TypedMessage} message - The message to add
 * @returns {Readonly<BootstrapState>} The updated state
 */
export declare function addBootstrapMessage(message: TypedMessage): Readonly<BootstrapState>;
/**
 * Registers a service as initialized
 *
 * @param {string} serviceName - Name of the service
 * @returns {Readonly<BootstrapState>} The updated state
 */
export declare function registerService(serviceName: string): Readonly<BootstrapState>;
declare const _default: {
    getBootstrapState: typeof getBootstrapState;
    setBootstrapState: typeof setBootstrapState;
    subscribeToBootstrapState: typeof subscribeToBootstrapState;
    resetBootstrapState: typeof resetBootstrapState;
    startBootstrap: typeof startBootstrap;
    completeBootstrap: typeof completeBootstrap;
    setBootstrapError: typeof setBootstrapError;
    addBootstrapMessage: typeof addBootstrapMessage;
    registerService: typeof registerService;
    getEstimatedTimeRemaining: typeof getEstimatedTimeRemaining;
};
export default _default;
