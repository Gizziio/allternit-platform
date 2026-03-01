/**
 * Circuit Breaker Pattern
 * 
 * Prevents cascading failures by failing fast when a service is unhealthy.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  resetTimeoutMs: number;        // Time before attempting reset
  halfOpenMaxCalls: number;      // Max calls in half-open state
  successThreshold: number;      // Successes needed to close
  monitoringPeriodMs: number;    // Window for counting failures
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  totalCalls: number;
  rejectedCalls: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxCalls: 3,
  successThreshold: 2,
  monitoringPeriodMs: 60000
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private config: CircuitBreakerConfig;
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private totalCalls: number = 0;
  private rejectedCalls: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private halfOpenCalls: number = 0;
  private nextAttempt: number = 0;
  private name: string;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.rejectedCalls++;
        throw new CircuitBreakerError(
          `Circuit breaker '${this.name}' is OPEN`,
          this.state,
          this.getMetrics()
        );
      }
      
      // Transition to half-open
      this.transitionTo('HALF_OPEN');
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      this.rejectedCalls++;
      throw new CircuitBreakerError(
        `Circuit breaker '${this.name}' is HALF_OPEN (max calls reached)`,
        this.state,
        this.getMetrics()
      );
    }

    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      totalCalls: this.totalCalls,
      rejectedCalls: this.rejectedCalls
    };
  }

  /**
   * Force circuit to open (for testing/emergencies)
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
    this.nextAttempt = Date.now() + this.config.resetTimeoutMs;
  }

  /**
   * Force circuit to close (for testing/recovery)
   */
  forceClose(): void {
    this.reset();
    this.transitionTo('CLOSED');
  }

  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date();

    if (this.state === 'HALF_OPEN') {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();

    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
      this.nextAttempt = Date.now() + this.config.resetTimeoutMs;
    } else if (this.state === 'CLOSED' && this.consecutiveFailures >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
      this.nextAttempt = Date.now() + this.config.resetTimeoutMs;
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'CLOSED') {
      this.reset();
    } else if (newState === 'HALF_OPEN') {
      this.halfOpenCalls = 0;
      this.consecutiveSuccesses = 0;
    }

    // Emit event for monitoring
    this.emitStateChange(oldState, newState);
  }

  private reset(): void {
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.halfOpenCalls = 0;
  }

  private emitStateChange(from: CircuitState, to: CircuitState): void {
    // Could emit to event bus or logger
    console.log(`[CircuitBreaker:${this.name}] ${from} -> ${to}`);
  }
}

export class CircuitBreakerError extends Error {
  public readonly state: CircuitState;
  public readonly metrics: CircuitBreakerMetrics;

  constructor(message: string, state: CircuitState, metrics: CircuitBreakerMetrics) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.state = state;
    this.metrics = metrics;
  }
}

/**
 * Create a circuit breaker with common configurations
 */
export function createCircuitBreaker(
  name: string,
  preset: 'strict' | 'lenient' | 'custom' = 'lenient',
  customConfig?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  const presets: Record<string, Partial<CircuitBreakerConfig>> = {
    strict: {
      failureThreshold: 3,
      resetTimeoutMs: 60000,
      successThreshold: 3,
      monitoringPeriodMs: 30000
    },
    lenient: {
      failureThreshold: 10,
      resetTimeoutMs: 15000,
      successThreshold: 2,
      monitoringPeriodMs: 120000
    }
  };

  const config = {
    ...presets[preset],
    ...customConfig
  };

  return new CircuitBreaker(name, config);
}
