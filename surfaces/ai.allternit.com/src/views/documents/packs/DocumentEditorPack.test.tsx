import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('DocumentEditorPack', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => `id-${Date.now()}` });
  });

  it('renders and registers a native document surface', async () => {
    vi.resetModules();
    const { getActiveNativeDocumentSurface } = await import('../document-surface');
    const { default: DocumentEditorPack } = await import('./DocumentEditorPack');

    render(<DocumentEditorPack documentId="doc-test" onClose={() => {}} />);

    expect(screen.getByDisplayValue('Untitled document')).toBeInTheDocument();

    const surface = getActiveNativeDocumentSurface();
    expect(surface).not.toBeNull();
    expect(surface?.id).toBe('doc-test');
    expect(surface?.kind).toBe('documents');

    const snapshot = surface?.snapshot();
    expect(snapshot?.title).toBe('Untitled document');
    expect(snapshot?.kind).toBe('documents');
  });

  it('applies a replace-document mutation', async () => {
    vi.resetModules();
    const { getActiveNativeDocumentSurface } = await import('../document-surface');
    const { default: DocumentEditorPack } = await import('./DocumentEditorPack');

    render(<DocumentEditorPack documentId="doc-test" onClose={() => {}} />);
    const surface = getActiveNativeDocumentSurface();
    expect(surface).not.toBeNull();

    await act(async () => {
      await surface?.apply({ type: 'replace-document', body: 'Hello world', title: 'Updated' });
    });

    const updatedSurface = getActiveNativeDocumentSurface();
    const snapshot = updatedSurface?.snapshot();
    expect(snapshot?.title).toBe('Updated');
    expect(snapshot?.content).toEqual({ body: 'Hello world' });
  });
});
