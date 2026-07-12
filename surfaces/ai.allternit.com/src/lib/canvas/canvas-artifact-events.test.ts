import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { emitArtifact, useArtifactEventListener } from './canvas-artifact-events';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';

function makeArtifact(title: string): ArtifactUIPart {
  return {
    type: 'artifact',
    artifactId: `art-${title}`,
    kind: 'html',
    title,
    content: `<p>${title}</p>`,
  };
}

describe('canvas-artifact-events', () => {
  it('delivers emitted artifacts to listeners with the same sessionId', () => {
    const received: ArtifactUIPart[] = [];
    const { unmount } = renderHook(() =>
      useArtifactEventListener('ses_test', (artifact) => {
        received.push(artifact);
      }),
    );

    emitArtifact('ses_test', makeArtifact('One'));
    emitArtifact('ses_other', makeArtifact('Ignored'));
    emitArtifact('ses_test', makeArtifact('Two'));

    expect(received).toHaveLength(2);
    expect(received.map((a) => a.title)).toEqual(['One', 'Two']);

    unmount();
  });

  it('does not call the listener after unmount', () => {
    const received: ArtifactUIPart[] = [];
    const { unmount } = renderHook(() =>
      useArtifactEventListener('ses_test', (artifact) => {
        received.push(artifact);
      }),
    );

    emitArtifact('ses_test', makeArtifact('Before'));
    unmount();
    emitArtifact('ses_test', makeArtifact('After'));

    expect(received).toHaveLength(1);
    expect(received[0].title).toBe('Before');
  });

  it('ignores malformed artifacts', () => {
    const received: ArtifactUIPart[] = [];
    renderHook(() =>
      useArtifactEventListener('ses_test', (artifact) => {
        received.push(artifact);
      }),
    );

    const event = new CustomEvent('allternit:artifact', {
      detail: { sessionId: 'ses_test', artifact: { type: 'text', text: 'not an artifact' } },
    });
    window.dispatchEvent(event);

    expect(received).toHaveLength(0);
  });
});
