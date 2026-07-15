import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('PresentationEditorPack', () => {
  beforeEach(() => {
    let counter = 0;
    vi.stubGlobal('crypto', { randomUUID: () => `id-${Date.now()}-${counter++}` });
  });

  it('renders and registers a native document surface', async () => {
    vi.resetModules();
    const { getActiveNativeDocumentSurface } = await import('../document-surface');
    const { default: PresentationEditorPack } = await import('./PresentationEditorPack');

    render(<PresentationEditorPack documentId="deck-test" onClose={() => {}} />);

    expect(screen.getByDisplayValue('Untitled presentation')).toBeInTheDocument();

    const surface = getActiveNativeDocumentSurface();
    expect(surface).not.toBeNull();
    expect(surface?.id).toBe('deck-test');
    expect(surface?.kind).toBe('presentations');

    const snapshot = surface?.snapshot();
    expect(snapshot?.title).toBe('Untitled presentation');
    expect(snapshot?.kind).toBe('presentations');
  });

  it('applies an add-slide mutation', async () => {
    vi.resetModules();
    const { getActiveNativeDocumentSurface } = await import('../document-surface');
    const { default: PresentationEditorPack } = await import('./PresentationEditorPack');

    render(<PresentationEditorPack documentId="deck-test" onClose={() => {}} />);
    const surface = getActiveNativeDocumentSurface();
    expect(surface).not.toBeNull();

    await act(async () => {
      await surface?.apply({ type: 'add-slide', title: 'New Slide', body: 'Slide body' });
    });

    const updatedSurface = getActiveNativeDocumentSurface();
    const snapshot = updatedSurface?.snapshot();
    expect(snapshot?.title).toBe('Untitled presentation');
    const slides = (snapshot?.content as { slides: unknown[] })?.slides;
    expect(slides.length).toBeGreaterThan(1);
  });
});
