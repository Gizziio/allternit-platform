/**
 * Canvas Artifact Events
 *
 * Lightweight pub/sub for artifact production across the app. Streaming surfaces
 * (chat, cowork, code) emit artifacts as they are generated; AllternitCanvasView
 * listens for artifacts that belong to the same backend session and mirrors them
 * into the persisted canvas state.
 *
 * Why not React context? These events cross view boundaries (chat root →
 * allternit-canvas view) and must work even when the views are not in the same
 * React tree.
 */

import { useEffect } from 'react';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';

const EVENT_NAME = 'allternit:artifact';

export interface CanvasArtifactEventDetail {
  sessionId: string;
  artifact: ArtifactUIPart;
}

function isArtifactUIPart(value: unknown): value is ArtifactUIPart {
  if (!value || typeof value !== 'object') return false;
  const part = value as Partial<ArtifactUIPart>;
  return (
    part.type === 'artifact' &&
    typeof part.artifactId === 'string' &&
    typeof part.title === 'string' &&
    typeof part.kind === 'string'
  );
}

export function emitArtifact(sessionId: string, artifact: ArtifactUIPart): void {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent<CanvasArtifactEventDetail>(EVENT_NAME, {
    detail: { sessionId, artifact },
  });
  window.dispatchEvent(event);
}

export function useArtifactEventListener(
  sessionId: string | undefined,
  handler: (artifact: ArtifactUIPart) => void,
): void {
  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;

    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<CanvasArtifactEventDetail>).detail;
      if (!detail || detail.sessionId !== sessionId) return;
      if (!isArtifactUIPart(detail.artifact)) return;
      handler(detail.artifact);
    };

    window.addEventListener(EVENT_NAME, onEvent);
    return () => window.removeEventListener(EVENT_NAME, onEvent);
  }, [sessionId, handler]);
}
