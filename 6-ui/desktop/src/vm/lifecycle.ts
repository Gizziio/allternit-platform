/**
 * VM Lifecycle State Machine
 *
 * Manages VM state transitions with validation and history tracking.
 * Ensures only valid state transitions are allowed and provides
 * comprehensive logging for debugging.
 *
 * @module lifecycle
 * @example
 * ```typescript
 * const lifecycle = new VMLifecycle();
 * await lifecycle.transition("initializing");
 * await lifecycle.transition("downloading");
 * await lifecycle.transition("creating");
 * await lifecycle.transition("starting");
 * await lifecycle.transition("running");
 * ```
 */

import { EventEmitter } from "events";

/**
 * VM state enumeration
 * Represents all possible states in the VM lifecycle
 */
export type VMState =
  | "uninitialized"
  | "initializing"
  | "downloading"
  | "creating"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error"
  | "destroying";

/**
 * Valid state transitions map
 * Defines which states can transition to which other states
 */
const VALID_TRANSITIONS: Record<VMState, VMState[]> = {
  uninitialized: ["initializing"],
  initializing: ["downloading", "creating", "error"],
  downloading: ["creating", "stopped", "error"],
  creating: ["starting", "stopped", "error"],
  starting: ["running", "stopped", "error"],
  running: ["stopping", "error"],
  stopping: ["stopped", "error"],
  stopped: ["starting", "destroying", "error"],
  error: ["initializing", "stopped", "destroying"],
  destroying: ["uninitialized", "error"],
};

/**
 * State history entry
 */
export interface StateHistoryEntry {
  /** Previous state */
  from: VMState;
  /** New state */
  to: VMState;
  /** Timestamp of transition */
  timestamp: Date;
  /** Optional reason for transition */
  reason?: string;
  /** Duration in previous state (ms) */
  duration?: number;
}

/**
 * Transition result
 */
export interface TransitionResult {
  /** Whether transition succeeded */
  success: boolean;
  /** Previous state */
  from: VMState;
  /** New state */
  to: VMState;
  /** Error message if failed */
  error?: string;
}

/**
 * VM lifecycle error
 */
export class VMLifecycleError extends Error {
  constructor(
    message: string,
    public readonly from: VMState,
    public readonly to: VMState,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "VMLifecycleError";
    Object.setPrototypeOf(this, VMLifecycleError.prototype);
  }
}

/**
 * VM lifecycle timeout error
 */
export class VMLifecycleTimeoutError extends VMLifecycleError {
  constructor(
    public readonly state: VMState,
    public readonly timeoutMs: number
  ) {
    super(
      `Timeout waiting for transition to ${state} after ${timeoutMs}ms`,
      state,
      state
    );
    this.name = "VMLifecycleTimeoutError";
    Object.setPrototypeOf(this, VMLifecycleTimeoutError.prototype);
  }
}

/**
 * VM Lifecycle State Machine
 *
 * Manages VM state transitions with validation and history tracking.
 * Emits events for state changes that can be used to update the UI.
 */
export class VMLifecycle extends EventEmitter {
  private _state: VMState = "uninitialized";
  private readonly _stateHistory: StateHistoryEntry[] = [];
  private _stateStartTime: Date = new Date();
  private _transitionPromise: Promise<void> | null = null;
  private _transitionInProgress = false;

  /**
   * Current VM state
   */
  get state(): VMState {
    return this._state;
  }

  /**
   * State transition history
   */
  get history(): ReadonlyArray<StateHistoryEntry> {
    return Object.freeze([...this._stateHistory]);
  }

  /**
   * Time spent in current state (milliseconds)
   */
  get timeInCurrentState(): number {
    return Date.now() - this._stateStartTime.getTime();
  }

  /**
   * Whether a transition is currently in progress
   */
  get isTransitioning(): boolean {
    return this._transitionInProgress;
  }

  /**
   * Check if a transition is valid
   * @param to - Target state
   * @returns Whether the transition is allowed
   */
  canTransition(to: VMState): boolean {
    const validNextStates = VALID_TRANSITIONS[this._state];
    return validNextStates.includes(to);
  }

  /**
   * Get valid next states from current state
   * @returns Array of valid next states
   */
  getValidNextStates(): VMState[] {
    return [...VALID_TRANSITIONS[this._state]];
  }

  /**
   * Transition to a new state
   * @param to - Target state
   * @param reason - Optional reason for the transition
   * @returns Promise resolving when transition completes
   * @throws {VMLifecycleError} If transition is invalid
   */
  async transition(to: VMState, reason?: string): Promise<TransitionResult> {
    // Check if already in target state
    if (this._state === to) {
      return {
        success: true,
        from: to,
        to,
      };
    }

    // Validate transition
    if (!this.canTransition(to)) {
      const error = new VMLifecycleError(
        `Invalid state transition from "${this._state}" to "${to}". ` +
          `Valid transitions: [${VALID_TRANSITIONS[this._state].join(", ")}]`,
        this._state,
        to
      );

      this.emit("transition:failed", {
        from: this._state,
        to,
        error: error.message,
      });

      throw error;
    }

    // Wait for any in-progress transition
    if (this._transitionInProgress && this._transitionPromise) {
      await this._transitionPromise;
    }

    // Execute transition
    return this.executeTransition(to, reason);
  }

  /**
   * Execute the actual state transition
   * @param to - Target state
   * @param reason - Optional reason
   */
  private async executeTransition(
    to: VMState,
    reason?: string
  ): Promise<TransitionResult> {
    const from = this._state;
    this._transitionInProgress = true;

    this._transitionPromise = new Promise<void>((resolve) => {
      // Calculate duration in previous state
      const duration = Date.now() - this._stateStartTime.getTime();

      // Update state
      this._state = to;
      this._stateStartTime = new Date();

      // Record in history
      const entry: StateHistoryEntry = {
        from,
        to,
        timestamp: this._stateStartTime,
        reason,
        duration,
      };
      this._stateHistory.push(entry);

      // Limit history size (keep last 100 entries)
      if (this._stateHistory.length > 100) {
        this._stateHistory.shift();
      }

      // Emit events
      this.emit("state:changed", entry);
      this.emit(`state:${to}`, { from, duration, reason });
      this.emit("transition:complete", { from, to, duration });

      resolve();
    });

    try {
      await this._transitionPromise;

      return {
        success: true,
        from,
        to,
      };
    } finally {
      this._transitionInProgress = false;
      this._transitionPromise = null;
    }
  }

  /**
   * Force transition to a state (bypasses validation)
   * @param to - Target state
   * @param reason - Optional reason
   * @internal
   */
  forceTransition(to: VMState, reason?: string): void {
    const from = this._state;
    const duration = Date.now() - this._stateStartTime.getTime();

    this._state = to;
    this._stateStartTime = new Date();

    const entry: StateHistoryEntry = {
      from,
      to,
      timestamp: this._stateStartTime,
      reason: reason || "forced",
      duration,
    };
    this._stateHistory.push(entry);

    this.emit("state:changed", entry);
    this.emit(`state:${to}`, { from, duration, reason: reason || "forced" });
  }

  /**
   * Set error state
   * @param error - Error that occurred
   * @param recoverable - Whether the error is recoverable
   */
  setError(error: Error, recoverable = false): void {
    const from = this._state;
    const duration = Date.now() - this._stateStartTime.getTime();

    this._state = "error";
    this._stateStartTime = new Date();

    const entry: StateHistoryEntry = {
      from,
      to: "error",
      timestamp: this._stateStartTime,
      reason: error.message,
      duration,
    };
    this._stateHistory.push(entry);

    this.emit("state:changed", entry);
    this.emit("state:error", { from, error, recoverable, duration });
  }

  /**
   * Wait for a specific state
   * @param targetState - State to wait for
   * @param timeoutMs - Timeout in milliseconds
   * @returns Promise that resolves when state is reached
   * @throws {VMLifecycleTimeoutError} If timeout is reached
   */
  async waitForState(
    targetState: VMState,
    timeoutMs: number = 30000
  ): Promise<void> {
    if (this._state === targetState) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new VMLifecycleTimeoutError(targetState, timeoutMs));
      }, timeoutMs);

      const onStateChange = (entry: StateHistoryEntry) => {
        if (entry.to === targetState) {
          cleanup();
          resolve();
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.off("state:changed", onStateChange);
      };

      this.on("state:changed", onStateChange);
    });
  }

  /**
   * Get state at a specific time
   * @param timestamp - Timestamp to query
   * @returns State at that time, or null if before any history
   */
  getStateAtTime(timestamp: Date): VMState | null {
    if (timestamp < this._stateHistory[0]?.timestamp) {
      return null;
    }

    for (let i = this._stateHistory.length - 1; i >= 0; i--) {
      if (this._stateHistory[i].timestamp <= timestamp) {
        return this._stateHistory[i].to;
      }
    }

    return "uninitialized";
  }

  /**
   * Get total time spent in a specific state
   * @param state - State to query
   * @returns Total milliseconds spent in the state
   */
  getTotalTimeInState(state: VMState): number {
    return this._stateHistory
      .filter((entry) => entry.from === state)
      .reduce((total, entry) => total + (entry.duration || 0), 0);
  }

  /**
   * Reset to uninitialized state
   * Clears history and resets all tracking
   */
  reset(): void {
    this._state = "uninitialized";
    this._stateHistory.length = 0;
    this._stateStartTime = new Date();
    this._transitionInProgress = false;
    this._transitionPromise = null;

    this.emit("reset");
  }

  /**
   * Get detailed status for debugging
   */
  getDebugInfo(): {
    currentState: VMState;
    timeInCurrentState: number;
    historyLength: number;
    isTransitioning: boolean;
    validNextStates: VMState[];
  } {
    return {
      currentState: this._state,
      timeInCurrentState: this.timeInCurrentState,
      historyLength: this._stateHistory.length,
      isTransitioning: this._transitionInProgress,
      validNextStates: this.getValidNextStates(),
    };
  }
}

/**
 * Create a new VM lifecycle instance
 * @returns New VMLifecycle instance
 */
export function createVMLifecycle(): VMLifecycle {
  return new VMLifecycle();
}

export default VMLifecycle;
