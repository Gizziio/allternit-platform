/**
 * Allternit Computer Use Engine - TypeScript SDK Event Streaming
 * 
 * Server-Sent Events (SSE) handling for real-time event streaming.
 */

import {
  EngineEvent,
  EngineEventType,
  EventHandler,
  SubscribeOptions,
} from './types';

// EventSource is used for SSE (available in Node via eventsource package)
declare class EventSource {
  constructor(url: string, init?: { headers?: Record<string, string> });
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((error: Error) => void) | null;
  onopen: (() => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  removeEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
  readyState: number;
}

interface MessageEvent {
  data: string;
  type: string;
  lastEventId?: string;
}

// Try to import EventSource, fallback to global
let EventSourceImpl: typeof EventSource;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  EventSourceImpl = require('eventsource').EventSource;
} catch {
  if (typeof globalThis.EventSource !== 'undefined') {
    EventSourceImpl = globalThis.EventSource as unknown as typeof EventSource;
  } else {
    throw new Error(
      'EventSource not available. Please install the "eventsource" package for Node.js environments.'
    );
  }
}

/**
 * Subscription state for a run.
 */
interface Subscription {
  eventSource: EventSource;
  callbacks: Set<EventHandler>;
  options: SubscribeOptions;
}

/**
 * Event stream manager for SSE handling.
 * 
 * Manages EventSource connections for real-time event streaming
 * from the Allternit Computer Use Engine.
 */
export class EventStream {
  private endpoint: string;
  private apiKey?: string;
  private headers: Record<string, string>;
  private subscriptions: Map<string, Subscription> = new Map();

  /**
   * Create a new event stream manager.
   * 
   * @param endpoint - The engine endpoint URL
   * @param apiKey - Optional API key for authentication
   * @param headers - Optional additional headers
   */
  constructor(
    endpoint: string,
    apiKey?: string,
    headers: Record<string, string> = {}
  ) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.headers = headers;
  }

  /**
   * Subscribe to events for a run.
   *
   * Connects to the gateway run-events SSE endpoint
   * (`{endpoint}/computer-use/runs/{runId}/events`). The gateway sends every
   * event as a JSON envelope `{event_type, run_id, message, data}` on the
   * default `message` channel (no named SSE `event:` fields) and closes the
   * stream with a terminal `run.ended` event. `options.afterIndex` has no
   * server-side equivalent and is ignored.
   *
   * @param runId - The run ID to subscribe to
   * @param callback - Function called for each event
   * @param options - Subscription options
   * @returns Unsubscribe function
   */
  subscribe(
    runId: string,
    callback: EventHandler,
    options: SubscribeOptions = {}
  ): () => void {
    const { autoClose = true } = options;

    // Check if we already have a subscription for this run
    let subscription = this.subscriptions.get(runId);

    if (!subscription) {
      // Create new EventSource connection
      const url = `${this.endpoint}/computer-use/runs/${encodeURIComponent(runId)}/events`;

      const eventSource = new EventSourceImpl(url, {
        headers: this.buildHeaders(),
      });

      subscription = {
        eventSource,
        callbacks: new Set(),
        options,
      };

      // Set up EventSource handlers
      this.setupEventSourceHandlers(runId, subscription, autoClose);

      this.subscriptions.set(runId, subscription);
    }

    // Add the callback
    subscription.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(runId, callback);
    };
  }

  /**
   * Parse a gateway SSE event envelope into an EngineEvent.
   *
   * Gateway envelope: `{event_type, run_id, message, data}`. Fields the
   * envelope does not carry (session_id, mode, target_scope) are left unset.
   * Returns null when the payload is not a valid envelope.
   */
  private parseEventEnvelope(raw: string, fallbackRunId: string): EngineEvent | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed as {
      event_type?: unknown;
      run_id?: unknown;
      message?: unknown;
      data?: unknown;
    };
    if (typeof envelope.event_type !== 'string') return null;
    return {
      run_id: typeof envelope.run_id === 'string' ? envelope.run_id : fallbackRunId,
      event_type: envelope.event_type as EngineEventType,
      message: typeof envelope.message === 'string' ? envelope.message : envelope.event_type,
      data: envelope.data,
    };
  }

  /**
   * Set up EventSource event handlers.
   */
  private setupEventSourceHandlers(
    runId: string,
    subscription: Subscription,
    autoClose: boolean
  ): void {
    const { eventSource } = subscription;

    // The gateway sends all events as `data:` lines with no named SSE
    // `event:` field, so every event arrives on the 'message' channel.
    eventSource.addEventListener('message', (event: MessageEvent) => {
      const engineEvent = this.parseEventEnvelope(event.data, runId);
      if (!engineEvent) {
        console.error('Failed to parse event envelope:', event.data);
        return;
      }
      try {
        this.notifyCallbacks(runId, engineEvent);

        // Auto-close on terminal events (run.ended is the gateway's
        // end-of-stream sentinel)
        if (autoClose && this.isTerminalEvent(engineEvent.event_type)) {
          this.closeSubscription(runId);
        }
      } catch (error) {
        console.error('Event callback error:', error);
      }
    });

    // Handle errors
    eventSource.onerror = (error: Error) => {
      console.error(`EventSource error for run ${runId}:`, error);
      // Notify all callbacks of the error
      this.notifyError(runId, error);
    };
  }

  /**
   * Check if an event type is terminal (run ends).
   */
  private isTerminalEvent(eventType: EngineEventType): boolean {
    return (
      eventType === 'run.completed' ||
      eventType === 'run.failed' ||
      eventType === 'run.cancelled' ||
      eventType === 'run.ended'
    );
  }

  /**
   * Notify all callbacks for a run.
   */
  private notifyCallbacks(runId: string, event: EngineEvent): void {
    const subscription = this.subscriptions.get(runId);
    if (!subscription) return;

    for (const callback of subscription.callbacks) {
      try {
        void callback(event);
      } catch (error) {
        console.error('Event callback error:', error);
      }
    }
  }

  /**
   * Notify all callbacks of an error.
   */
  private notifyError(runId: string, error: Error): void {
    // Create a synthetic error event
    const errorEvent: EngineEvent = {
      run_id: runId,
      session_id: '',
      event_type: 'run.failed',
      mode: 'intent',
      target_scope: 'auto',
      message: `Event stream error: ${error.message}`,
      data: { error: error.message },
    };

    this.notifyCallbacks(runId, errorEvent);
  }

  /**
   * Unsubscribe a callback from a run.
   */
  private unsubscribe(runId: string, callback: EventHandler): void {
    const subscription = this.subscriptions.get(runId);
    if (!subscription) return;

    subscription.callbacks.delete(callback);

    // Close the connection if no more callbacks
    if (subscription.callbacks.size === 0) {
      this.closeSubscription(runId);
    }
  }

  /**
   * Close a subscription and clean up resources.
   */
  private closeSubscription(runId: string): void {
    const subscription = this.subscriptions.get(runId);
    if (!subscription) return;

    subscription.eventSource.close();
    this.subscriptions.delete(runId);
  }

  /**
   * Build headers for EventSource connection.
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.headers };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Wait for a run to complete and return the final event.
   * 
   * @param runId - The run ID
   * @returns Promise that resolves with the final event when run completes
   */
  waitForRun(runId: string): Promise<EngineEvent> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.subscribe(
        runId,
        (event) => {
          if (this.isTerminalEvent(event.event_type)) {
            unsubscribe();
            resolve(event);
          }
        },
        { autoClose: true }
      );

      // Set up error handling
      const subscription = this.subscriptions.get(runId);
      if (subscription) {
        const originalOnError = subscription.eventSource.onerror;
        subscription.eventSource.onerror = (error: Error) => {
          unsubscribe();
          if (originalOnError) {
            originalOnError(error);
          }
          reject(error);
        };
      }
    });
  }

  /**
   * Wait for an approval request for a run.
   * 
   * @param runId - The run ID
   * @returns Promise that resolves with the approval event
   */
  waitForApproval(runId: string): Promise<EngineEvent> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.subscribe(
        runId,
        (event) => {
          if (event.event_type === 'approval.required') {
            unsubscribe();
            resolve(event);
          } else if (this.isTerminalEvent(event.event_type)) {
            unsubscribe();
            reject(new Error(`Run ${runId} ended without requiring approval`));
          }
        },
        { autoClose: false }
      );

      // Set up error handling
      const subscription = this.subscriptions.get(runId);
      if (subscription) {
        const originalOnError = subscription.eventSource.onerror;
        subscription.eventSource.onerror = (error: Error) => {
          unsubscribe();
          if (originalOnError) {
            originalOnError(error);
          }
          reject(error);
        };
      }
    });
  }

  /**
   * Close all active subscriptions.
   */
  closeAll(): void {
    for (const [runId] of this.subscriptions) {
      this.closeSubscription(runId);
    }
  }
}

/**
 * Create an event stream for a run.
 * 
 * @param endpoint - The engine endpoint
   * @param runId - The run ID
   * @param apiKey - Optional API key
   * @returns EventStream instance
   */
export function createEventStream(
  endpoint: string,
  _runId: string,
  apiKey?: string
): EventStream {
  const stream = new EventStream(endpoint, apiKey);
  return stream;
}
