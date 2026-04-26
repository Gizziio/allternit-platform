/**
 * @fileoverview Application state store with React integration
 * @module state/AppStateStore
 *
 * Centralized state management using the store pattern with subscription-based
 * reactivity. Provides React hooks for component integration.
 */
import type { TypedMessage } from '../types/message';
/**
 * User preferences and settings
 * @interface UserPreferences
 */
export interface UserPreferences {
    /** UI theme preference */
    readonly theme: 'light' | 'dark' | 'system';
    /** Language code */
    readonly language: string;
    /** Notification preferences */
    readonly notifications: {
        readonly enabled: boolean;
        readonly sound: boolean;
        readonly desktop: boolean;
    };
    /** Editor preferences */
    readonly editor: {
        readonly fontSize: number;
        readonly fontFamily: string;
        readonly wordWrap: boolean;
        readonly lineNumbers: boolean;
        readonly tabSize: number;
    };
}
/**
 * User session information
 * @interface UserSession
 */
export interface UserSession {
    /** User identifier */
    readonly userId: string;
    /** User display name */
    readonly displayName: string;
    /** User email */
    readonly email: string;
    /** User type/role */
    readonly userType: 'free' | 'pro' | 'enterprise' | 'admin';
    /** Session token */
    readonly token: string;
    /** Session expiration timestamp */
    readonly expiresAt: Date;
    /** Authentication provider */
    readonly provider: 'local' | 'oauth' | 'sso';
}
/**
 * Connection status types
 * @typedef {'online' | 'offline' | 'connecting' | 'reconnecting'} ConnectionStatus
 */
export type ConnectionStatus = 'online' | 'offline' | 'connecting' | 'reconnecting';
/**
 * Complete application state structure
 * @interface AppState
 */
export interface AppState {
    /** Current user session, null if not authenticated */
    readonly session: UserSession | null;
    /** User preferences */
    readonly preferences: UserPreferences;
    /** Active conversation messages */
    readonly messages: readonly TypedMessage[];
    /** Connection status to backend services */
    readonly connectionStatus: ConnectionStatus;
    /** Whether the application is currently loading */
    readonly isLoading: boolean;
    /** Current loading message or operation description */
    readonly loadingMessage: string | null;
    /** Active errors to display */
    readonly errors: readonly AppError[];
    /** Current view/route */
    readonly currentView: string;
    /** View-specific state data */
    readonly viewState: Readonly<Record<string, unknown>>;
    /** Timestamp of last state update */
    readonly lastUpdated: Date;
}
/**
 * Application error structure
 * @interface AppError
 */
export interface AppError {
    /** Unique error identifier */
    readonly id: string;
    /** Error severity level */
    readonly severity: 'info' | 'warning' | 'error' | 'critical';
    /** Error code for programmatic handling */
    readonly code: string;
    /** Human-readable error message */
    readonly message: string;
    /** Error timestamp */
    readonly timestamp: Date;
    /** Whether the error has been dismissed by the user */
    readonly dismissed: boolean;
    /** Additional error context */
    readonly context?: Readonly<Record<string, unknown>>;
}
/**
 * State change listener callback type
 * @typedef {(state: AppState, prevState: AppState) => void} StateListener
 */
type StateListener = (state: AppState, prevState: AppState) => void;
/**
 * Selector function type for deriving values from state
 * @template T
 * @typedef {(state: AppState) => T} StateSelector
 */
type StateSelector<T> = (state: AppState) => T;
/**
 * Application state store class
 * Implements the observable store pattern with subscription-based updates
 *
 * @example
 * ```typescript
 * const store = new AppStateStore();
 * const unsubscribe = store.subscribe((state, prevState) => {
 *   console.log('State updated:', state);
 * });
 * store.setState({ isLoading: true });
 * ```
 */
export declare class AppStateStore {
    private state;
    private listeners;
    private isBatching;
    private pendingUpdates;
    constructor(initialState?: Partial<AppState>);
    /**
     * Gets the current state
     * @returns {Readonly<AppState>} The current application state
     */
    getState(): Readonly<AppState>;
    /**
     * Gets a derived value from state using a selector function
     *
     * @template T
     * @param {StateSelector<T>} selector - Function to extract value from state
     * @returns {T} The selected value
     * @example
     * ```typescript
     * const userName = store.select(state => state.session?.displayName);
     * ```
     */
    select<T>(selector: StateSelector<T>): T;
    /**
     * Updates the state with partial changes
     * Automatically notifies all subscribers
     *
     * @param {Partial<AppState>} updates - Partial state updates
     * @param {Object} [options] - Update options
     * @param {boolean} [options.silent=false] - If true, does not notify subscribers
     * @returns {Readonly<AppState>} The updated state
     */
    setState(updates: Partial<AppState>, options?: {
        silent?: boolean;
    }): Readonly<AppState>;
    /**
     * Batches multiple state updates into a single notification
     *
     * @param {() => void} callback - Function containing state updates to batch
     * @returns {Readonly<AppState>} The final state after all updates
     * @example
     * ```typescript
     * store.batch(() => {
     *   store.setState({ isLoading: true });
     *   store.setState({ loadingMessage: 'Fetching data...' });
     * });
     * // Subscribers are notified once after both updates
     * ```
     */
    batch(callback: () => void): Readonly<AppState>;
    /**
     * Subscribes to state changes
     *
     * @param {StateListener} listener - Callback invoked on state changes
     * @returns {() => void} Unsubscribe function
     */
    subscribe(listener: StateListener): () => void;
    /**
     * Subscribes to a specific derived value using a selector
     * Only notifies when the selected value changes
     *
     * @template T
     * @param {StateSelector<T>} selector - Function to extract value
     * @param {(value: T) => void} callback - Callback invoked when value changes
     * @returns {() => void} Unsubscribe function
     * @example
     * ```typescript
     * store.subscribeTo(
     *   state => state.connectionStatus,
     *   status => console.log('Connection:', status)
     * );
     * ```
     */
    subscribeTo<T>(selector: StateSelector<T>, callback: (value: T) => void): () => void;
    /**
     * Resets the store to initial state
     *
     * @param {Partial<AppState>} [mergeState] - Optional state to merge after reset
     * @returns {Readonly<AppState>} The reset state
     */
    reset(mergeState?: Partial<AppState>): Readonly<AppState>;
    /**
     * Adds an error to the state
     *
     * @param {Omit<AppError, 'id' | 'timestamp' | 'dismissed'>} error - Error details
     * @returns {Readonly<AppState>} The updated state
     */
    addError(error: Omit<AppError, 'id' | 'timestamp' | 'dismissed'>): Readonly<AppState>;
    /**
     * Dismisses an error by ID
     *
     * @param {string} errorId - The error ID to dismiss
     * @returns {Readonly<AppState>} The updated state
     */
    dismissError(errorId: string): Readonly<AppState>;
    /**
     * Clears all dismissed errors
     *
     * @returns {Readonly<AppState>} The updated state
     */
    clearDismissedErrors(): Readonly<AppState>;
    /**
     * Adds a message to the conversation
     *
     * @param {TypedMessage} message - The message to add
     * @returns {Readonly<AppState>} The updated state
     */
    addMessage(message: TypedMessage): Readonly<AppState>;
    /**
     * Clears all messages
     *
     * @returns {Readonly<AppState>} The updated state
     */
    clearMessages(): Readonly<AppState>;
    /**
     * Sets the user session
     *
     * @param {UserSession | null} session - The session or null to logout
     * @returns {Readonly<AppState>} The updated state
     */
    setSession(session: UserSession | null): Readonly<AppState>;
    /**
     * Updates user preferences
     *
     * @param {Partial<UserPreferences>} prefs - Preference updates
     * @returns {Readonly<AppState>} The updated state
     */
    setPreferences(prefs: Partial<UserPreferences>): Readonly<AppState>;
    /**
     * Sets the loading state
     *
     * @param {boolean} isLoading - Whether loading is active
     * @param {string} [message] - Optional loading message
     * @returns {Readonly<AppState>} The updated state
     */
    setLoading(isLoading: boolean, message?: string): Readonly<AppState>;
    /**
     * Updates view-specific state
     *
     * @param {string} view - View identifier
     * @param {unknown} data - View state data
     * @returns {Readonly<AppState>} The updated state
     */
    setViewState(view: string, data: unknown): Readonly<AppState>;
    private notifyListeners;
}
/**
 * Gets or creates the global AppStateStore instance
 *
 * @returns {AppStateStore} The global store instance
 */
export declare function getGlobalStore(): AppStateStore;
/**
 * Sets the global store instance (useful for testing)
 *
 * @param {AppStateStore | null} store - The store instance or null to reset
 */
export declare function setGlobalStore(store: AppStateStore | null): void;
/**
 * React hook for accessing the app state store
 * Provides reactive updates and selector support
 *
 * @template T
 * @param {StateSelector<T>} [selector] - Optional selector function
 * @returns {T | AppState} The selected state or full state
 * @example
 * ```typescript
 * // Get full state
 * const state = useAppStateStore();
 *
 * // Get specific value
 * const isLoading = useAppStateStore(state => state.isLoading);
 *
 * // Get derived value
 * const messageCount = useAppStateStore(state => state.messages.length);
 * ```
 */
export declare function useAppStateStore<T>(selector?: StateSelector<T>): T | AppState;
/**
 * React hook for accessing a specific slice of state with optional transformation
 *
 * @template T
 * @param {StateSelector<T>} selector - Function to extract value from state
 * @param {(left: T, right: T) => boolean} [isEqual] - Custom equality function
 * @returns {T} The selected value
 * @example
 * ```typescript
 * const userName = useAppStateSelector(state => state.session?.displayName);
 * ```
 */
export declare function useAppStateSelector<T>(selector: StateSelector<T>, isEqual?: (left: T, right: T) => boolean): T;
/**
 * React hook for state setters
 * Returns stable callback functions for common state operations
 *
 * @returns {Object} Object containing state setter callbacks
 * @example
 * ```typescript
 * const { setLoading, addMessage, setSession } = useAppStateActions();
 * ```
 */
export declare function useAppStateActions(): {
    setState: (updates: Partial<AppState>) => Readonly<AppState>;
    setLoading: (isLoading: boolean, message?: string) => Readonly<AppState>;
    addMessage: (message: TypedMessage) => Readonly<AppState>;
    setSession: (session: UserSession | null) => Readonly<AppState>;
    addError: (error: Omit<AppError, "id" | "timestamp" | "dismissed">) => Readonly<AppState>;
    dismissError: (errorId: string) => Readonly<AppState>;
    setPreferences: (prefs: Partial<UserPreferences>) => Readonly<AppState>;
    clearMessages: () => Readonly<AppState>;
};
declare const _default: {
    AppStateStore: typeof AppStateStore;
    getGlobalStore: typeof getGlobalStore;
    setGlobalStore: typeof setGlobalStore;
    useAppStateStore: typeof useAppStateStore;
    useAppStateSelector: typeof useAppStateSelector;
    useAppStateActions: typeof useAppStateActions;
};
export default _default;
