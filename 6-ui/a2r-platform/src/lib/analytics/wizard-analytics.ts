/**
 * Analytics/Telemetry Service for Agent Creation Wizard
 *
 * Tracks wizard usage, step completion, errors, and feature usage.
 * Integrates with Aptabase (if available) and provides fallback logging.
 *
 * @module analytics/wizard-analytics
 * @version 1.0.0
 */

import { track as aptabaseTrack } from '@aptabase/tauri';

/**
 * Analytics event types for the wizard
 */
export type WizardEventType =
  // Wizard lifecycle
  | 'wizard_started'
  | 'wizard_completed'
  | 'wizard_abandoned'
  | 'wizard_resumed'
  // Step navigation
  | 'step_viewed'
  | 'step_completed'
  | 'step_skipped'
  | 'step_revisited'
  // User actions
  | 'draft_saved'
  | 'draft_loaded'
  | 'config_exported'
  | 'config_imported'
  | 'help_opened'
  | 'help_closed'
  | 'keyboard_shortcut_used'
  // Feature usage
  | 'capability_selected'
  | 'tool_enabled'
  | 'plugin_installed'
  | 'avatar_customized'
  | 'voice_configured'
  | 'hard_ban_added'
  | 'escalation_configured'
  // Errors
  | 'validation_error'
  | 'api_error'
  | 'save_error'
  | 'load_error'
  | 'import_error'
  | 'export_error';

/**
 * Wizard event payload
 */
export interface WizardEvent {
  /** Event type */
  type: WizardEventType;
  /** Timestamp in ISO format */
  timestamp: string;
  /** Session ID for tracking user sessions */
  sessionId: string;
  /** Current wizard step */
  step?: string;
  /** Step index (0-based) */
  stepIndex?: number;
  /** Total number of steps */
  totalSteps?: number;
  /** Time spent on current step in milliseconds */
  timeOnStep?: number;
  /** Additional event-specific data */
  data?: Record<string, unknown>;
  /** Error details if applicable */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Step timing data
 */
interface StepTiming {
  stepId: string;
  stepIndex: number;
  startTime: number;
  endTime?: number;
  completed: boolean;
}

/**
 * Wizard session data
 */
interface WizardSession {
  sessionId: string;
  startTime: number;
  lastActivityTime: number;
  currentStepIndex: number;
  stepTimings: Map<number, StepTiming>;
  completedSteps: Set<number>;
  abandoned: boolean;
  completed: boolean;
}

/**
 * Analytics configuration
 */
interface AnalyticsConfig {
  /** Enable/disable analytics */
  enabled: boolean;
  /** Debug mode - logs to console */
  debug: boolean;
  /** Analytics endpoint URL (for custom backend) */
  endpoint?: string;
  /** API key for analytics service */
  apiKey?: string;
  /** Sample rate (0-1) for reducing volume */
  sampleRate: number;
  /** Batch events before sending */
  batchEvents: boolean;
  /** Batch size */
  batchSize: number;
  /** Flush interval in milliseconds */
  flushInterval: number;
}

/**
 * Default analytics configuration
 */
const DEFAULT_CONFIG: AnalyticsConfig = {
  enabled: true,
  debug: import.meta.env.DEV,
  sampleRate: 1.0,
  batchEvents: true,
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
};

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `wizard_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Wizard Analytics Service
 *
 * Singleton service for tracking wizard usage and events.
 */
class WizardAnalyticsService {
  private config: AnalyticsConfig;
  private session: WizardSession | null = null;
  private eventQueue: WizardEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized: boolean = false;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Initialize the analytics service
   */
  initialize(config?: Partial<AnalyticsConfig>): void {
    if (this.initialized) {
      return;
    }

    this.config = { ...this.config, ...config };

    if (this.config.enabled) {
      this.startSession();
      this.startFlushTimer();
    }

    this.initialized = true;

    if (this.config.debug) {
      console.log('[WizardAnalytics] Initialized with config:', this.config);
    }
  }

  /**
   * Start a new wizard session
   */
  startSession(): void {
    const sessionId = generateSessionId();

    this.session = {
      sessionId,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      currentStepIndex: 0,
      stepTimings: new Map(),
      completedSteps: new Set(),
      abandoned: false,
      completed: false,
    };

    // Track wizard started event
    this.track('wizard_started', {
      step: 'identity',
      stepIndex: 0,
    });

    if (this.config.debug) {
      console.log('[WizardAnalytics] Session started:', sessionId);
    }
  }

  /**
   * End the current session
   */
  endSession(completed: boolean = false): void {
    if (!this.session) return;

    this.session.completed = completed;
    this.session.abandoned = !completed;

    // Flush any remaining events
    this.flush();

    // Clear flush timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (completed) {
      this.track('wizard_completed', {
        totalSteps: this.session.stepTimings.size,
        completedSteps: this.session.completedSteps.size,
        totalTime: Date.now() - this.session.startTime,
      });
    } else {
      this.track('wizard_abandoned', {
        lastStep: this.getCurrentStep(),
        lastStepIndex: this.session.currentStepIndex,
        totalTime: Date.now() - this.session.startTime,
      });
    }

    if (this.config.debug) {
      console.log('[WizardAnalytics] Session ended:', {
        sessionId: this.session.sessionId,
        completed,
      });
    }

    this.session = null;
  }

  /**
   * Resume a session (e.g., after loading a draft)
   */
  resumeSession(): void {
    if (!this.session) {
      this.startSession();
    } else {
      this.session.lastActivityTime = Date.now();
      this.track('wizard_resumed', {
        step: this.getCurrentStep(),
        stepIndex: this.session.currentStepIndex,
      });
    }
  }

  /**
   * Track step view
   */
  trackStepView(stepId: string, stepIndex: number, totalSteps: number): void {
    if (!this.session) return;

    // End timing for previous step
    const previousTiming = this.session.stepTimings.get(this.session.currentStepIndex);
    if (previousTiming && !previousTiming.endTime) {
      previousTiming.endTime = Date.now();
    }

    // Start timing for new step
    this.session.stepTimings.set(stepIndex, {
      stepId,
      stepIndex,
      startTime: Date.now(),
      completed: false,
    });

    this.session.currentStepIndex = stepIndex;
    this.session.lastActivityTime = Date.now();

    this.track('step_viewed', {
      step: stepId,
      stepIndex,
      totalSteps,
      timeOnPreviousStep: previousTiming?.endTime
        ? previousTiming.endTime - previousTiming.startTime
        : undefined,
    });
  }

  /**
   * Track step completion
   */
  trackStepComplete(stepId: string, stepIndex: number): void {
    if (!this.session) return;

    const timing = this.session.stepTimings.get(stepIndex);
    if (timing) {
      timing.completed = true;
      timing.endTime = Date.now();
    }

    this.session.completedSteps.add(stepIndex);
    this.session.lastActivityTime = Date.now();

    this.track('step_completed', {
      step: stepId,
      stepIndex,
      timeOnStep: timing?.endTime ? timing.endTime - timing.startTime : undefined,
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(
    feature: 'capability' | 'tool' | 'plugin' | 'avatar' | 'voice' | 'hard_ban' | 'escalation',
    details: Record<string, unknown>
  ): void {
    const eventType: WizardEventType =
      feature === 'capability'
        ? 'capability_selected'
        : feature === 'tool'
        ? 'tool_enabled'
        : feature === 'plugin'
        ? 'plugin_installed'
        : feature === 'avatar'
        ? 'avatar_customized'
        : feature === 'voice'
        ? 'voice_configured'
        : feature === 'hard_ban'
        ? 'hard_ban_added'
        : 'escalation_configured';

    this.track(eventType, details);
  }

  /**
   * Track error
   */
  trackError(
    errorType: 'validation' | 'api' | 'save' | 'load' | 'import' | 'export',
    error: Error | unknown,
    context?: Record<string, unknown>
  ): void {
    const eventType: WizardEventType =
      errorType === 'validation'
        ? 'validation_error'
        : errorType === 'api'
        ? 'api_error'
        : errorType === 'save'
        ? 'save_error'
        : errorType === 'load'
        ? 'load_error'
        : errorType === 'import'
        ? 'import_error'
        : 'export_error';

    const errorData = error instanceof Error
      ? {
          message: error.message,
          code: (error as any).code,
          stack: error.stack,
        }
      : { message: String(error) };

    this.track(eventType, {
      ...context,
      error: errorData,
    });
  }

  /**
   * Track generic event
   */
  track(
    type: WizardEventType,
    additionalData?: Record<string, unknown>
  ): void {
    if (!this.config.enabled || !this.session) {
      return;
    }

    // Apply sample rate
    if (this.config.sampleRate < 1 && Math.random() > this.config.sampleRate) {
      return;
    }

    const currentTiming = this.session.stepTimings.get(this.session.currentStepIndex);

    const event: WizardEvent = {
      type,
      timestamp: new Date().toISOString(),
      sessionId: this.session.sessionId,
      step: this.getCurrentStep(),
      stepIndex: this.session.currentStepIndex,
      totalSteps: this.session.stepTimings.size,
      timeOnStep: currentTiming?.endTime
        ? currentTiming.endTime - currentTiming.startTime
        : currentTiming
        ? Date.now() - currentTiming.startTime
        : undefined,
      data: additionalData,
    };

    // Add to queue
    this.eventQueue.push(event);

    if (this.config.debug) {
      console.log('[WizardAnalytics] Event tracked:', event);
    }

    // Flush if batch is full
    if (this.config.batchEvents && this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush event queue to analytics endpoint
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Try to send to Aptabase (Tauri)
      for (const event of eventsToSend) {
        await this.sendToAptabase(event);
      }

      // Also send to custom endpoint if configured
      if (this.config.endpoint) {
        await this.sendToEndpoint(eventsToSend);
      }

      if (this.config.debug) {
        console.log('[WizardAnalytics] Flushed', eventsToSend.length, 'events');
      }
    } catch (error) {
      console.error('[WizardAnalytics] Flush error:', error);
      // Re-queue events on failure
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  /**
   * Send event to Aptabase
   */
  private async sendToAptabase(event: WizardEvent): Promise<void> {
    try {
      // Map our event to Aptabase format
      const eventName = `wizard_${event.type}`;
      const props: Record<string, string | number> = {
        session_id: event.sessionId,
        step: event.step || 'unknown',
        step_index: event.stepIndex ?? 0,
      };

      if (event.timeOnStep) {
        props.time_on_step_ms = event.timeOnStep;
      }

      if (event.data) {
        // Add string/number properties from data
        for (const [key, value] of Object.entries(event.data)) {
          if (typeof value === 'string' || typeof value === 'number') {
            props[`data_${key}`] = value;
          }
        }
      }

      aptabaseTrack(eventName, props);
    } catch (error) {
      console.error('[WizardAnalytics] Aptabase error:', error);
    }
  }

  /**
   * Send events to custom endpoint
   */
  private async sendToEndpoint(events: WizardEvent[]): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) return;

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'X-API-Key': this.config.apiKey } : {}),
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[WizardAnalytics] Endpoint error:', error);
      throw error;
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
      this.startFlushTimer();
    }, this.config.flushInterval);
  }

  /**
   * Get current step ID
   */
  private getCurrentStep(): string {
    if (!this.session) return 'unknown';

    const timing = this.session.stepTimings.get(this.session.currentStepIndex);
    return timing?.stepId || 'unknown';
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    sessionId: string | null;
    duration: number;
    stepsCompleted: number;
    totalSteps: number;
    currentStep: number;
  } | null {
    if (!this.session) return null;

    return {
      sessionId: this.session.sessionId,
      duration: Date.now() - this.session.startTime,
      stepsCompleted: this.session.completedSteps.size,
      totalSteps: this.session.stepTimings.size,
      currentStep: this.session.currentStepIndex,
    };
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;

    if (enabled && !this.session) {
      this.startSession();
    }
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set debug mode
   */
  setDebug(debug: boolean): void {
    this.config.debug = debug;
  }
}

/**
 * Singleton instance of the analytics service
 */
export const wizardAnalytics = new WizardAnalyticsService();

/**
 * Hook-like function for React components to use analytics
 * Returns bound functions for convenience
 */
export function useWizardAnalytics() {
  return {
    trackStepView: (stepId: string, stepIndex: number, totalSteps: number) =>
      wizardAnalytics.trackStepView(stepId, stepIndex, totalSteps),

    trackStepComplete: (stepId: string, stepIndex: number) =>
      wizardAnalytics.trackStepComplete(stepId, stepIndex),

    trackFeatureUsage: (
      feature: 'capability' | 'tool' | 'plugin' | 'avatar' | 'voice' | 'hard_ban' | 'escalation',
      details: Record<string, unknown>
    ) => wizardAnalytics.trackFeatureUsage(feature, details),

    trackError: (
      errorType: 'validation' | 'api' | 'save' | 'load' | 'import' | 'export',
      error: Error | unknown,
      context?: Record<string, unknown>
    ) => wizardAnalytics.trackError(errorType, error, context),

    track: (type: WizardEventType, data?: Record<string, unknown>) =>
      wizardAnalytics.track(type, data),

    getSessionStats: () => wizardAnalytics.getSessionStats(),

    isEnabled: () => wizardAnalytics.isEnabled(),
  };
}

export default wizardAnalytics;
