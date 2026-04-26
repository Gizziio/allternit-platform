/**
 * Session Transition Controller
 *
 * Prevents old session transcript from flashing when switching sessions.
 * Tracks intended vs rendered session with explicit transition states.
 *
 * Inspired by OpenWork's transition-controller.ts.
 */

export type TransitionState = 'idle' | 'switching' | 'loading' | 'error' | 'recovering';
export type RenderSource = 'cache' | 'live' | 'empty' | 'error' | 'recovering';

export interface SessionRenderModel {
  intendedSessionId: string | null;
  renderedSessionId: string | null;
  transitionState: TransitionState;
  renderSource: RenderSource;
  isFetching: boolean;
}

export function deriveSessionRenderModel(input: {
  intendedSessionId: string | null;
  renderedSessionId: string | null;
  hasSnapshot: boolean;
  isFetching: boolean;
  isError: boolean;
}): SessionRenderModel {
  const { intendedSessionId, renderedSessionId, hasSnapshot, isFetching, isError } = input;

  // No intended session → empty state
  if (!intendedSessionId) {
    return {
      intendedSessionId: null,
      renderedSessionId,
      transitionState: 'idle',
      renderSource: 'empty',
      isFetching: false,
    };
  }

  // Error state takes precedence
  if (isError) {
    return {
      intendedSessionId,
      renderedSessionId,
      transitionState: 'error',
      renderSource: renderedSessionId === intendedSessionId ? 'live' : 'error',
      isFetching: false,
    };
  }

  // Currently fetching intended session
  if (isFetching) {
    // If we have a cached snapshot of the intended session, show it while loading
    if (hasSnapshot && renderedSessionId === intendedSessionId) {
      return {
        intendedSessionId,
        renderedSessionId,
        transitionState: 'loading',
        renderSource: 'cache',
        isFetching: true,
      };
    }
    // Otherwise we're switching from another session → show loading state
    return {
      intendedSessionId,
      renderedSessionId,
      transitionState: 'switching',
      renderSource: 'empty',
      isFetching: true,
    };
  }

  // Not fetching — check if rendered matches intended
  if (renderedSessionId === intendedSessionId) {
    return {
      intendedSessionId,
      renderedSessionId,
      transitionState: 'idle',
      renderSource: hasSnapshot ? 'live' : 'empty',
      isFetching: false,
    };
  }

  // Mismatch: we're showing stale data from a different session
  return {
    intendedSessionId,
    renderedSessionId,
    transitionState: 'switching',
    renderSource: renderedSessionId ? 'cache' : 'empty',
    isFetching: false,
  };
}

/**
 * Hook-friendly state manager for transitions.
 * Use this in components that need to guard against stale session data.
 */
export class SessionTransitionController {
  private state: SessionRenderModel = {
    intendedSessionId: null,
    renderedSessionId: null,
    transitionState: 'idle',
    renderSource: 'empty',
    isFetching: false,
  };

  private listeners = new Set<(state: SessionRenderModel) => void>();

  getState(): SessionRenderModel {
    return { ...this.state };
  }

  subscribe(listener: (state: SessionRenderModel) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const snapshot = { ...this.state };
    this.listeners.forEach((cb) => cb(snapshot));
  }

  beginTransition(intendedSessionId: string | null): void {
    this.state = deriveSessionRenderModel({
      intendedSessionId,
      renderedSessionId: this.state.renderedSessionId,
      hasSnapshot: false,
      isFetching: true,
      isError: false,
    });
    this.emit();
  }

  markRendered(sessionId: string | null, hasSnapshot: boolean = false): void {
    this.state = deriveSessionRenderModel({
      intendedSessionId: this.state.intendedSessionId,
      renderedSessionId: sessionId,
      hasSnapshot,
      isFetching: this.state.isFetching,
      isError: false,
    });
    this.emit();
  }

  markReady(sessionId: string): void {
    this.state = deriveSessionRenderModel({
      intendedSessionId: sessionId,
      renderedSessionId: sessionId,
      hasSnapshot: true,
      isFetching: false,
      isError: false,
    });
    this.emit();
  }

  markError(): void {
    this.state = deriveSessionRenderModel({
      intendedSessionId: this.state.intendedSessionId,
      renderedSessionId: this.state.renderedSessionId,
      hasSnapshot: false,
      isFetching: false,
      isError: true,
    });
    this.emit();
  }

  clear(): void {
    this.state = {
      intendedSessionId: null,
      renderedSessionId: null,
      transitionState: 'idle',
      renderSource: 'empty',
      isFetching: false,
    };
    this.emit();
  }
}

// Singleton for the cowork surface
export const coworkTransitionController = new SessionTransitionController();
