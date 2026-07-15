import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SheetEditorPack', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => `id-${Date.now()}` });
  });

  it('renders and registers a native document surface', async () => {
    vi.resetModules();
    const { getActiveNativeDocumentSurface } = await import('../document-surface');
    const { default: SheetEditorPack } = await import('./SheetEditorPack');

    render(<SheetEditorPack documentId="sheet-test" onClose={() => {}} />);

    expect(screen.getByDisplayValue('Untitled sheet')).toBeInTheDocument();

    const surface = getActiveNativeDocumentSurface();
    expect(surface).not.toBeNull();
    expect(surface?.id).toBe('sheet-test');
    expect(surface?.kind).toBe('sheets');

    const snapshot = surface?.snapshot();
    expect(snapshot?.title).toBe('Untitled sheet');
    expect(snapshot?.kind).toBe('sheets');
  });

  it('applies a set-cell mutation', async () => {
    vi.resetModules();
    const { getActiveNativeDocumentSurface } = await import('../document-surface');
    const { default: SheetEditorPack } = await import('./SheetEditorPack');

    render(<SheetEditorPack documentId="sheet-test" onClose={() => {}} />);
    const surface = getActiveNativeDocumentSurface();
    expect(surface).not.toBeNull();

    await act(async () => {
      await surface?.apply({ type: 'set-cell', row: 0, column: 0, value: '42' });
    });

    const updatedSurface = getActiveNativeDocumentSurface();
    const snapshot = updatedSurface?.snapshot();
    expect(snapshot?.title).toBe('Untitled sheet');
    expect((snapshot?.content as { cells: Record<string, string> })?.cells['0:0']).toBe('42');
  });
});
