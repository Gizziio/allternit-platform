/**
 * Browser Event Bus
 *
 * A simple event bus for browser/agent events that components can subscribe to.
 * Uses window CustomEvents for cross-component communication.
 */

import type { NavIntent } from './types';

// ============================================================================
// Event Types
// ============================================================================

export interface BrowserIntentChangedEvent {
  type: 'browser.intent.changed';
  payload: {
    tabId: string;
    intent: NavIntent;
    source: 'user' | 'agent';
    timestamp: number;
  };
}

export interface BrowserNavRequestedEvent {
  type: 'browser.nav.requested';
  payload: {
    tabId: string | null;
    url: string;
    intent: NavIntent;
    timestamp: number;
  };
}

export interface BrowserNavCommittedEvent {
  type: 'browser.nav.committed';
  payload: {
    tabId: string;
    url: string;
    title: string;
    timestamp: number;
  };
}

export interface BrowserAgentStepEvent {
  type: 'browser.agent.step';
  payload: {
    stepId: string;
    status: 'pending' | 'running' | 'done' | 'error';
    description: string;
    timestamp: number;
  };
}

export interface BrowserInspectSnapshotEvent {
  type: 'browser.inspect.snapshot';
  payload: {
    tabId: string;
    htmlLength: number;
    title: string;
    url: string;
    timestamp: number;
  };
}

export type BrowserEvent =
  | BrowserIntentChangedEvent
  | BrowserNavRequestedEvent
  | BrowserNavCommittedEvent
  | BrowserAgentStepEvent
  | BrowserInspectSnapshotEvent;

// ============================================================================
// Event Bus
// ============================================================================

const EVENT_NAMESPACE = 'a2rchitech-browser';

function makeEventType(type: string): string {
  return `${EVENT_NAMESPACE}.${type}`;
}

// Emit event to window
function emitBrowserEvent(event: BrowserEvent): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(makeEventType(event.type), {
        detail: event,
        bubbles: true,
      })
    );
  }
}

// Subscribe to browser events
export function onBrowserEvent<K extends BrowserEvent['type']>(
  eventType: K,
  callback: (event: Extract<BrowserEvent, { type: K }>) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = ((e: CustomEvent) => {
    const event = e.detail as BrowserEvent;
    if (event.type === eventType) {
      callback(event as Extract<BrowserEvent, { type: K }>);
    }
  }) as EventListener;

  window.addEventListener(makeEventType(eventType), handler);

  // Return unsubscribe function
  return () => {
    window.removeEventListener(makeEventType(eventType), handler);
  };
}

// Convenience emitters
export function emitIntentChanged(
  tabId: string,
  intent: NavIntent,
  source: 'user' | 'agent' = 'user'
): void {
  emitBrowserEvent({
    type: 'browser.intent.changed',
    payload: { tabId, intent, source, timestamp: Date.now() },
  });
}

export function emitNavRequested(
  tabId: string | null,
  url: string,
  intent: NavIntent
): void {
  emitBrowserEvent({
    type: 'browser.nav.requested',
    payload: { tabId, url, intent, timestamp: Date.now() },
  });
}

export function emitNavCommitted(
  tabId: string,
  url: string,
  title: string
): void {
  emitBrowserEvent({
    type: 'browser.nav.committed',
    payload: { tabId, url, title, timestamp: Date.now() },
  });
}

export function emitAgentStep(
  stepId: string,
  status: 'pending' | 'running' | 'done' | 'error',
  description: string
): void {
  emitBrowserEvent({
    type: 'browser.agent.step',
    payload: { stepId, status, description, timestamp: Date.now() },
  });
}

export function emitInspectSnapshot(
  tabId: string,
  htmlLength: number,
  title: string,
  url: string
): void {
  emitBrowserEvent({
    type: 'browser.inspect.snapshot',
    payload: { tabId, htmlLength, title, url, timestamp: Date.now() },
  });
}
