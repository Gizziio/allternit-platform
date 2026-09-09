import { beforeEach, describe, expect, it } from 'vitest';
import {
  getActiveDocument,
  registerActiveDocument,
  reportActiveDocument,
} from './activeDocument';

describe('activeDocument registry', () => {
  beforeEach(() => {
    registerActiveDocument('docs', null);
    reportActiveDocument('docs', null);
    registerActiveDocument('sheets', null);
    reportActiveDocument('sheets', null);
  });

  it('returns null when nothing is registered', () => {
    expect(getActiveDocument('docs')).toBeNull();
  });

  it('exposes the prop-registered name', () => {
    registerActiveDocument('docs', 'Report.docx');
    expect(getActiveDocument('docs')).toEqual({ name: 'Report.docx' });
  });

  it('clears on prop unregister', () => {
    registerActiveDocument('docs', 'Report.docx');
    registerActiveDocument('docs', null);
    expect(getActiveDocument('docs')).toBeNull();
  });

  it('prefers the app-reported document over the prop name', () => {
    registerActiveDocument('docs', 'Report.docx');
    reportActiveDocument('docs', { name: 'Untitled.docx', content: () => 'hello' });
    const doc = getActiveDocument('docs');
    expect(doc?.name).toBe('Untitled.docx');
    expect(doc?.content?.()).toBe('hello');
  });

  it('keeps the app-reported document when the prop unregisters', () => {
    // Regression: the suite adapter registers `null` for hosts that never
    // passed a `document` prop; that must not wipe the document the vendored
    // app actually has open.
    reportActiveDocument('docs', { name: 'Untitled.docx', content: () => 'hello' });
    registerActiveDocument('docs', null);
    expect(getActiveDocument('docs')?.name).toBe('Untitled.docx');
  });

  it('falls back to the prop name when the app report is cleared', () => {
    registerActiveDocument('docs', 'Report.docx');
    reportActiveDocument('docs', { name: 'Untitled.docx' });
    reportActiveDocument('docs', null);
    expect(getActiveDocument('docs')?.name).toBe('Report.docx');
  });

  it('ignores reports without a name', () => {
    reportActiveDocument('docs', { name: '' });
    expect(getActiveDocument('docs')).toBeNull();
  });

  it('tracks apps independently', () => {
    reportActiveDocument('docs', { name: 'Doc.docx' });
    registerActiveDocument('sheets', 'Book.xlsx');
    expect(getActiveDocument('docs')?.name).toBe('Doc.docx');
    expect(getActiveDocument('sheets')?.name).toBe('Book.xlsx');
  });
});
